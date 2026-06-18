import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft,
  History,
  Trash2
} from 'lucide-react';
import { 
  doc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  addDoc,
  deleteDoc,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError } from '../../lib/firestoreUtils';
import { OperationType } from '../../types';

function ItemDetailContent({ item, logistics, production, inventory, onNavigate, canEditItems, canViewPrices, canEditPrices }: any) {
  const [stock, setStock] = useState(item.currentStock);
  const [priceForm, setPriceForm] = useState({
    purchasePrice: item.purchasePrice || 0,
    salesPrice: item.salesPrice || 0
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setStock(item.currentStock);
    setPriceForm({
      purchasePrice: item.purchasePrice || 0,
      salesPrice: item.salesPrice || 0
    });
  }, [item]);

  const activities = useMemo(() => {
    const combined = [
      ...logistics.filter((l: any) => l.item === item.name).map((l: any) => ({
        ...l,
        source: '물류',
        originalId: l.id,
        rawTime: l.createdAt?.seconds || 0
      })),
      ...production.flatMap((p: any) => {
        const rows = [];
        if (p.title === item.name) {
          rows.push({
            date: p.manufDate,
            type: '입고',
            item: p.title,
            weight: p.production,
            partner: `공정: ${p.line} (완성)`,
            source: '생산(완성)',
            originalId: p.id,
            rawTime: p.createdAt?.seconds || 0
          });
        }
        if (p.rawMaterial === item.name) {
          rows.push({
            date: p.manufDate,
            type: '출고',
            item: p.rawMaterial,
            weight: p.rawQty,
            partner: `공정: ${p.line} (투입)`,
            source: '생산(투입)',
            originalId: p.id,
            rawTime: p.createdAt?.seconds || 0
          });
        }
        return rows;
      })
    ].sort((a, b) => b.rawTime - a.rawTime);
    
    return combined.slice(0, 10);
  }, [logistics, production, item.name]);

  const handleDeleteActivity = async (a: any) => {
    if (!canEditItems || loading) return;

    const isProduction = a.source.includes('생산');
    const confirmMsg = isProduction 
      ? `관련 생산 일지 전체를 삭제하시겠습니까? (이 품목 및 관련 원육/생산품 재고가 모두 복구됩니다)`
      : `물류 기록을 삭제하시겠습니까? (재고가 같이 조정됩니다)`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      if (isProduction) {
        const record = production.find((p: any) => p.id === a.originalId);
        if (record) {
          await deleteDoc(doc(db, 'production_batches', record.id));
          
          const prodItem = inventory?.find((i: any) => i.name === record.title);
          if (prodItem) {
            await updateDoc(doc(db, 'inventory', prodItem.id), {
              currentStock: increment(-record.production),
              updatedAt: serverTimestamp()
            });
          }
          
          const rawItem = inventory?.find((i: any) => i.name === record.rawMaterial);
          if (rawItem) {
            await updateDoc(doc(db, 'inventory', rawItem.id), {
              currentStock: increment(record.rawQty),
              updatedAt: serverTimestamp()
            });
          }
        }
      } else {
        await runTransaction(db, async (transaction) => {
          const itemRef = doc(db, 'inventory', item.id);
          const docSnap = await transaction.get(itemRef);

          const logRef = doc(db, 'logistics', a.originalId);
          transaction.delete(logRef);

          if (docSnap.exists()) {
            const currentData = docSnap.data();
            const itemMasterUnit = (currentData.unit || 'BOX').toUpperCase();
            const isMasterWeightBased = ['KG', 'G'].includes(itemMasterUnit);
            
            let finalStockDiff = 0;
            const boxesDiff = a.type === '입고' ? -Number(a.boxes || 0) : Number(a.boxes || 0);
            const weightDiff = a.type === '입고' ? -Number(a.weight || 0) : Number(a.weight || 0);

            if (isMasterWeightBased) {
              const currentTxWeightUnit = (a.weightUnit || 'KG').toUpperCase();
              if (itemMasterUnit === 'KG') {
                if (currentTxWeightUnit === 'G') {
                  finalStockDiff = weightDiff / 1000;
                } else {
                  finalStockDiff = weightDiff;
                }
              } else if (itemMasterUnit === 'G') {
                if (currentTxWeightUnit === 'KG') {
                  finalStockDiff = weightDiff * 1000;
                } else {
                  finalStockDiff = weightDiff;
                }
              }
            } else {
              const inputCount = (boxesDiff !== 0) ? boxesDiff : weightDiff;
              const currentTxUnit = (a.unit || 'BOX').toUpperCase();

              if (itemMasterUnit === currentTxUnit) {
                finalStockDiff = inputCount;
              } else {
                // Parse pack size from specs to convert between BOX and EA
                const itemSpecs = (currentData.specs || '').trim();
                const packSize = (() => {
                  if (!itemSpecs) return 1;
                  const match = itemSpecs.match(/(?:x|\*)\s*(\d+)\s*(?:ea|개)/i) || itemSpecs.match(/\b(\d+)\s*(?:ea|개)/i);
                  if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > 0) return num;
                  }
                  return 1;
                })();

                if (itemMasterUnit === 'EA' && currentTxUnit === 'BOX') {
                  finalStockDiff = inputCount * packSize;
                } else if (itemMasterUnit === 'BOX' && currentTxUnit === 'EA') {
                  finalStockDiff = inputCount / packSize;
                } else {
                  finalStockDiff = inputCount;
                }
              }
            }

            transaction.update(itemRef, {
              currentStock: Number(currentData.currentStock || 0) + finalStockDiff,
              boxes: Number(currentData.boxes || 0) + boxesDiff,
              updatedAt: serverTimestamp()
            });
          }
        });
      }
      alert('삭제 완료');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, isProduction ? 'production_batches' : 'logistics');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdate = async () => {
    if (!canEditItems) return;
    setLoading(true);
    try {
      const diff = Number(stock) - item.currentStock;
      
      const updateData: any = { 
        currentStock: Number(stock), 
        updatedAt: serverTimestamp() 
      };

      if (canEditPrices) {
        updateData.purchasePrice = Number(priceForm.purchasePrice);
        updateData.salesPrice = Number(priceForm.salesPrice);
      }

      await updateDoc(doc(db, 'inventory', String(item.id)), updateData);
      
      if (diff !== 0) {
        await addDoc(collection(db, 'logistics'), {
          date: new Date().toLocaleDateString('sv-SE'),
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          type: diff > 0 ? '입고' : '출고',
          item: item.name,
          partner: '',
          weight: Math.abs(diff),
          boxes: 0,
          unit: item.unit || 'BOX',
          prevStock: item.currentStock,
          nextStock: Number(stock),
          prevBoxes: item.boxes || 0,
          nextBoxes: item.boxes || 0,
          specs: item.specs || '',
          category: item.category || '미분류',
          status: '완료',
          createdAt: serverTimestamp(),
          color: diff > 0 ? 'bg-emerald-500' : 'bg-error'
        });
      }
      alert('저장되었습니다.');
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, 'inventory'); } finally { setLoading(false); }
  };

  const formatWithCommas = (value: string | number) => {
    if (value === '' || value === null || value === undefined) return '';
    let str = String(value).replace(/[^0-9.-]/g, '');
    const parts = str.split('.');
    if (parts.length > 2) {
      str = parts[0] + '.' + parts.slice(1).join('');
    }
    const dotIndex = str.indexOf('.');
    if (dotIndex !== -1) {
      const integerPart = str.substring(0, dotIndex);
      let decimalPart = str.substring(dotIndex + 1);
      decimalPart = decimalPart.substring(0, 2);
      const parsedInt = parseInt(integerPart.replace(/[^0-9-]/g, ''));
      const formattedInt = isNaN(parsedInt) ? (integerPart.startsWith('-') ? '-' : '') : parsedInt.toLocaleString();
      return formattedInt + '.' + decimalPart;
    } else {
      const parsed = parseInt(str.replace(/[^0-9-]/g, ''));
      if (isNaN(parsed)) return str.startsWith('-') ? '-' : '';
      return parsed.toLocaleString();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('inventory')} className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="text-xl md:text-2xl font-black text-primary tracking-tighter">{item.name} 상세</h2>
      </div>
      <div className="flex flex-col gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[32px] border-2 border-outline-variant shadow-sm w-full transition-all hover:border-primary/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {/* 1. SKU */}
            <div className="space-y-1 pb-4 border-b border-outline-variant/30">
              <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1">SKU</p>
              <p className="text-xl font-black text-on-surface font-mono">{item.sku}</p>
            </div>

            {/* 2. Category */}
            <div className="space-y-1 pb-4 border-b border-outline-variant/30">
              <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1">카테고리</p>
              <p className="text-xl font-black text-on-surface">{item.category}</p>
            </div>

            {/* 2.1 Specs */}
            <div className="space-y-1 pb-4 border-b border-outline-variant/30">
              <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1">규격</p>
              <p className="text-xl font-black text-on-surface">{item.specs || '-'}</p>
            </div>

            {/* 3. Current Stock */}
            <div className="space-y-1 pb-4 border-b border-outline-variant/30">
              <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1 text-primary">현재 재고</p>
              <p className="text-4xl font-black text-primary tracking-tighter">{Math.round(item.currentStock || 0).toLocaleString()} <span className="text-lg">{item.unit}</span></p>
            </div>

            {/* 4. Safety Stock */}
            <div className="space-y-1 pb-4 border-b border-outline-variant/30">
              <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1">안전 재고</p>
              <p className="text-xl font-black text-on-surface">{Math.round(item.safetyStock || 0).toLocaleString()} {item.unit}</p>
            </div>

            {/* 5 & 6. Prices */}
            {canViewPrices && (
              <>
                <div className="space-y-1 pb-4 border-b border-outline-variant/30">
                  <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1">매입 단가</p>
                  {canEditPrices ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={formatWithCommas(priceForm.purchasePrice)} 
                        onChange={e => setPriceForm({...priceForm, purchasePrice: e.target.value.replace(/[^0-9]/g, '')})} 
                        className="h-10 px-4 bg-surface-container rounded-xl font-black text-base outline-none w-full max-w-xs focus:ring-2 ring-primary/20 transition-all border border-outline-variant/20" 
                      />
                      <span className="text-sm font-black text-outline">원</span>
                    </div>
                  ) : (
                    <p className="text-xl font-black text-[#0f172a]">{item.purchasePrice?.toLocaleString()} 원</p>
                  )}
                </div>
                <div className="space-y-1 pb-4 border-b border-outline-variant/30">
                  <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1">판매 단가</p>
                  {canEditPrices ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={formatWithCommas(priceForm.salesPrice)} 
                        onChange={e => setPriceForm({...priceForm, salesPrice: e.target.value.replace(/[^0-9]/g, '')})} 
                        className="h-10 px-4 bg-surface-container rounded-xl font-black text-base outline-none w-full max-w-xs focus:ring-2 ring-primary/20 transition-all border border-outline-variant/20" 
                      />
                      <span className="text-sm font-black text-outline">원</span>
                    </div>
                  ) : (
                    <p className="text-xl font-black text-[#0f172a]">{item.salesPrice?.toLocaleString()} 원</p>
                  )}
                </div>

                {/* Economic Stats */}
                <div className="space-y-1 pb-4 border-b border-outline-variant/30">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">개당 이익금 (원)</p>
                  <p className="text-xl font-black text-emerald-600">
                    {(Number(priceForm.salesPrice) - Number(priceForm.purchasePrice)).toLocaleString()} 원
                  </p>
                </div>
                <div className="space-y-1 pb-4 border-b border-outline-variant/30">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">이익률 (%)</p>
                  <p className="text-xl font-black text-blue-600">
                    {Number(priceForm.salesPrice) > 0 
                      ? (((Number(priceForm.salesPrice) - Number(priceForm.purchasePrice)) / Number(priceForm.salesPrice)) * 100).toFixed(1)
                      : '0'} %
                  </p>
                </div>

                <div className="space-y-1 pb-4 border-b border-outline-variant/30">
                  <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1">재고 자산 가치 (매입가 기준)</p>
                  <p className="text-xl font-black text-on-surface">
                    {Math.round(item.currentStock * Number(priceForm.purchasePrice)).toLocaleString()} 원
                  </p>
                </div>
                <div className="space-y-1 pb-4 border-b border-outline-variant/30">
                  <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1">총 예상 매출 (재고 기준)</p>
                  <p className="text-xl font-black text-on-surface">
                    {Math.round(item.currentStock * Number(priceForm.salesPrice)).toLocaleString()} 원
                  </p>
                </div>
              </>
            )}

            {item.category === '원육' && Number(item.avgWeight || 0) > 0 && (
              <div className="space-y-1 pb-4 border-b border-outline-variant/30">
                <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1">박스당 평균 무게</p>
                <p className="text-xl font-black text-on-surface">{Number(item.avgWeight).toLocaleString()} KG</p>
              </div>
            )}

            {/* 7. Storage Location */}
            <div className="space-y-1 pb-4 border-b border-outline-variant/30">
              <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-1">보관 위치</p>
              <p className="text-xl font-black text-on-surface">{item.location || '미지정'}</p>
            </div>

            {/* 8. Inventory Update */}
            {canEditItems && (
              <div className="space-y-2 pt-2 md:col-span-2">
                <p className="text-[9px] font-black text-outline uppercase tracking-[0.2em] mb-2 text-primary">재고 직접 수정</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    value={formatWithCommas(stock)} 
                    onChange={e => setStock((() => {
                      const val = e.target.value;
                      let cleaned = val.replace(/(?!^)-/g, '').replace(/[^0-9.-]/g, '');
                      const parts = cleaned.split('.');
                      if (parts.length > 2) {
                        cleaned = parts[0] + '.' + parts.slice(1).join('');
                      }
                      const dotIndex = cleaned.indexOf('.');
                      if (dotIndex !== -1) {
                        cleaned = cleaned.substring(0, dotIndex + 1) + cleaned.substring(dotIndex + 1, dotIndex + 3);
                      }
                      return cleaned;
                    })())} 
                    className="h-12 px-6 bg-surface-container border-2 border-outline-variant rounded-xl outline-none font-black text-xl w-full sm:w-40 focus:border-primary transition-all shadow-inner" 
                  />
                  <button 
                    onClick={handleUpdate} 
                    disabled={loading} 
                    className="bg-[#0f172a] text-white h-12 px-8 rounded-xl font-black text-sm shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
                  >
                    {loading ? '저장 중...' : '변경 사항 저장'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#0f172a]" />
              <h3 className="text-xl font-black text-[#0f172a] tracking-tight">최근 상세 활동</h3>
            </div>
          </div>
          
          <div className="flex overflow-x-auto pb-6 gap-4 px-2 no-scrollbar">
            {activities.length > 0 ? (
              activities.map((a: any, i: number) => (
                <div key={i} className="min-w-[260px] bg-white p-6 rounded-[32px] border border-outline-variant shadow-sm flex flex-col justify-between gap-6 shrink-0 relative transition-all hover:border-primary/40 hover:shadow-xl group">
                    <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black ${a.type === '입고' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} border ${a.type === '입고' ? 'border-emerald-100' : 'border-rose-100'}`}>
                        {a.type}
                      </span>
                      {canEditItems && (
                        <button 
                          onClick={() => handleDeleteActivity(a)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                     </div>
                     <p className="text-[9px] font-black text-outline/60 uppercase tracking-widest">{a.date}</p>
                   </div>
                  
                  <div>
                    <p className="text-[9px] font-black text-outline uppercase tracking-widest mb-1">거래처/대상</p>
                    <p className="text-base font-black text-[#0f172a] line-clamp-1 group-hover:text-primary transition-colors">
                      {(!a.partner || a.partner === '초기재고등록') ? '' : a.partner}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-outline-variant/30 flex items-center justify-between">
                    <p className="text-[9px] font-black text-outline uppercase">변동량</p>
                    <p className={`text-2xl font-black ${a.type === '입고' ? 'text-emerald-600' : 'text-rose-600'} tracking-tighter`}>
                      {a.type === '입고' ? '+' : '-'}{Math.round(a.weight || 0).toLocaleString()}<span className="text-sm ml-0.5">{(item.unit || 'kg').toLowerCase()}</span>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full py-24 flex flex-col items-center justify-center bg-surface-container/10 rounded-[48px] border-2 border-dashed border-outline-variant/30">
                <History className="w-12 h-12 text-outline/20 mb-4" />
                <p className="text-xl font-black text-[#0f172a]/30">활동 내역이 아직 존재하지 않습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemDetailContent;
