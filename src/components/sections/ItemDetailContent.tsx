import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  History,
  Save,
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
  const buildForm = (source: any) => {
    const unit = (source.unit || 'KG').toUpperCase();
    const fallbackQuantityUnit = ['KG', 'G'].includes(unit) ? 'BOX' : unit;

    return {
      sku: source.sku || '',
      name: source.name || '',
      category: source.category || '',
      brand: source.brand || '',
      specs: source.specs || '',
      unit,
      quantityUnit: (source.quantityUnit || fallbackQuantityUnit || 'BOX').toUpperCase(),
      currentStock: String(source.currentStock ?? 0),
      boxes: String(source.boxes ?? 0),
      safetyStock: String(source.safetyStock ?? 0),
      purchasePrice: String(source.purchasePrice ?? 0),
      salesPrice: String(source.salesPrice ?? 0),
      avgWeight: String(source.avgWeight ?? ''),
      manufDate: source.manufDate || '',
      expiryDate: source.expiryDate || '',
      location: source.location || '',
      detailLocation: source.detailLocation || '',
      partner: source.partner || ''
    };
  };

  const [itemForm, setItemForm] = useState(() => buildForm(item));
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setItemForm(buildForm(item));
  }, [item]);

  const parseNumber = (value: string | number) => {
    const parsed = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const cleanDecimal = (value: string) => {
    let cleaned = value.replace(/(?!^)-/g, '').replace(/[^0-9.-]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    const dotIndex = cleaned.indexOf('.');
    if (dotIndex !== -1) {
      cleaned = cleaned.substring(0, dotIndex + 1) + cleaned.substring(dotIndex + 1, dotIndex + 3);
    }
    return cleaned;
  };

  const cleanInteger = (value: string) => value.replace(/[^0-9]/g, '');

  const formatWithCommas = (value: string | number) => {
    if (value === '' || value === null || value === undefined) return '';
    const str = String(value).replace(/[^0-9.-]/g, '');
    const parts = str.split('.');
    if (parts.length > 1) {
      const integerPart = parts[0];
      const decimalPart = parts.slice(1).join('').substring(0, 2);
      const parsedInt = parseInt(integerPart.replace(/[^0-9-]/g, ''), 10);
      const formattedInt = isNaN(parsedInt) ? (integerPart.startsWith('-') ? '-' : '') : parsedInt.toLocaleString();
      return formattedInt + '.' + decimalPart;
    }
    const parsed = parseInt(str.replace(/[^0-9-]/g, ''), 10);
    if (isNaN(parsed)) return str.startsWith('-') ? '-' : '';
    return parsed.toLocaleString();
  };

  const updateForm = (updates: Partial<typeof itemForm>) => {
    setItemForm(prev => ({ ...prev, ...updates }));
  };

  const activities = useMemo(() => {
    const currentName = item.name;
    const combined = [
      ...logistics.filter((l: any) => l.item === currentName).map((l: any) => ({
        ...l,
        source: '물류',
        originalId: l.id,
        rawTime: l.createdAt?.seconds || 0
      })),
      ...production.flatMap((p: any) => {
        const rows = [];
        if (p.title === currentName) {
          rows.push({
            date: p.manufDate,
            type: '입고',
            item: p.title,
            weight: p.production,
            weightUnit: p.unit || item.unit,
            partner: `공정: ${p.line || ''} (완성)`,
            source: '생산',
            originalId: p.id,
            rawTime: p.createdAt?.seconds || 0
          });
        }
        if (p.rawMaterial === currentName) {
          rows.push({
            date: p.manufDate,
            type: '출고',
            item: p.rawMaterial,
            weight: p.rawQty,
            weightUnit: p.rawUnit || item.unit,
            partner: `공정: ${p.line || ''} (투입)`,
            source: '생산',
            originalId: p.id,
            rawTime: p.createdAt?.seconds || 0
          });
        }
        return rows;
      })
    ].sort((a, b) => b.rawTime - a.rawTime);

    return combined.slice(0, 10);
  }, [logistics, production, item.name, item.unit]);

  const handleDeleteActivity = async (a: any) => {
    if (!canEditItems || loading) return;

    const isProduction = a.source === '생산';
    const confirmMsg = isProduction
      ? '관련 생산 일지 전체를 삭제하고 재고를 복구할까요?'
      : '물류 기록을 삭제하고 재고를 같이 조정할까요?';

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

          if (!docSnap.exists()) return;

          const currentData = docSnap.data();
          const itemMasterUnit = (currentData.unit || 'BOX').toUpperCase();
          const isMasterWeightBased = ['KG', 'G'].includes(itemMasterUnit);
          const boxesDiff = a.type === '입고' ? -Number(a.boxes || 0) : Number(a.boxes || 0);
          const weightDiff = a.type === '입고' ? -Number(a.weight || 0) : Number(a.weight || 0);
          let finalStockDiff = 0;

          if (isMasterWeightBased) {
            const currentTxWeightUnit = (a.weightUnit || 'KG').toUpperCase();
            if (itemMasterUnit === 'KG') {
              finalStockDiff = currentTxWeightUnit === 'G' ? weightDiff / 1000 : weightDiff;
            } else {
              finalStockDiff = currentTxWeightUnit === 'KG' ? weightDiff * 1000 : weightDiff;
            }
          } else {
            finalStockDiff = boxesDiff !== 0 ? boxesDiff : weightDiff;
          }

          transaction.update(itemRef, {
            currentStock: Math.max(0, Number(currentData.currentStock || 0) + finalStockDiff),
            boxes: Math.max(0, Number(currentData.boxes || 0) + boxesDiff),
            updatedAt: serverTimestamp()
          });
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
      const targetStock = Math.max(0, parseNumber(itemForm.currentStock));
      const targetBoxes = Math.max(0, parseNumber(itemForm.boxes));
      const prevStock = Number(item.currentStock || 0);
      const prevBoxes = Number(item.boxes || 0);
      const stockDiff = targetStock - prevStock;
      const boxesDiff = targetBoxes - prevBoxes;
      const nextUnit = (itemForm.unit || 'KG').toUpperCase();
      const nextQuantityUnit = (itemForm.quantityUnit || 'BOX').toUpperCase();

      const updateData: any = {
        sku: itemForm.sku.trim(),
        name: itemForm.name.trim(),
        category: itemForm.category.trim(),
        brand: itemForm.brand.trim(),
        specs: itemForm.specs.trim(),
        unit: nextUnit,
        quantityUnit: nextQuantityUnit,
        currentStock: targetStock,
        boxes: targetBoxes,
        safetyStock: Math.max(0, parseNumber(itemForm.safetyStock)),
        avgWeight: Math.max(0, parseNumber(itemForm.avgWeight)),
        manufDate: itemForm.manufDate,
        expiryDate: itemForm.expiryDate,
        location: itemForm.location.trim(),
        detailLocation: itemForm.detailLocation.trim(),
        partner: itemForm.partner.trim(),
        updatedAt: serverTimestamp()
      };

      if (canEditPrices) {
        updateData.purchasePrice = Math.max(0, parseNumber(itemForm.purchasePrice));
        updateData.salesPrice = Math.max(0, parseNumber(itemForm.salesPrice));
      }

      await updateDoc(doc(db, 'inventory', String(item.id)), updateData);

      if (stockDiff !== 0 || boxesDiff !== 0) {
        await addDoc(collection(db, 'logistics'), {
          date: new Date().toLocaleDateString('sv-SE'),
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          type: stockDiff >= 0 ? '입고' : '출고',
          item: updateData.name || item.name,
          partner: updateData.partner || '',
          weight: Math.abs(stockDiff),
          weightUnit: nextUnit,
          boxes: Math.abs(boxesDiff),
          unit: nextQuantityUnit,
          prevStock,
          nextStock: targetStock,
          prevBoxes,
          nextBoxes: targetBoxes,
          specs: updateData.specs || '',
          category: updateData.category || '미분류',
          brand: updateData.brand || '',
          status: '완료',
          createdAt: serverTimestamp(),
          color: stockDiff >= 0 ? 'bg-emerald-500' : 'bg-error'
        });
      }

      alert('저장되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inventory');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = 'w-full h-11 px-3.5 bg-white border border-outline-variant/70 rounded-xl font-bold text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:bg-slate-100 disabled:text-slate-400';
  const labelClass = 'text-[10px] font-black text-slate-500 uppercase tracking-tight ml-1';
  const unitOptions = ['KG', 'G', 'BOX', 'EA'];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('inventory')} className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl md:text-2xl font-black text-primary tracking-tighter">{itemForm.name || item.name} 상세</h2>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border-2 border-outline-variant shadow-sm w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>SKU</label>
            <input disabled={!canEditItems || loading} value={itemForm.sku} onChange={e => updateForm({ sku: e.target.value })} className={fieldClass} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className={labelClass}>품목명</label>
            <input disabled={!canEditItems || loading} value={itemForm.name} onChange={e => updateForm({ name: e.target.value })} className={fieldClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>카테고리</label>
            <input disabled={!canEditItems || loading} value={itemForm.category} onChange={e => updateForm({ category: e.target.value })} className={fieldClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>브랜드</label>
            <input disabled={!canEditItems || loading} value={itemForm.brand} onChange={e => updateForm({ brand: e.target.value })} className={fieldClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>거래처</label>
            <input disabled={!canEditItems || loading} value={itemForm.partner} onChange={e => updateForm({ partner: e.target.value })} className={fieldClass} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className={labelClass}>규격</label>
            <input disabled={!canEditItems || loading} value={itemForm.specs} onChange={e => updateForm({ specs: e.target.value })} className={fieldClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>품목 단위</label>
            <select disabled={!canEditItems || loading} value={itemForm.unit} onChange={e => updateForm({ unit: e.target.value })} className={fieldClass}>
              {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>현재 재고 ({itemForm.unit})</label>
            <input disabled={!canEditItems || loading} value={formatWithCommas(itemForm.currentStock)} onChange={e => updateForm({ currentStock: cleanDecimal(e.target.value) })} className={fieldClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>박스수/수량</label>
            <input disabled={!canEditItems || loading} value={formatWithCommas(itemForm.boxes)} onChange={e => updateForm({ boxes: cleanDecimal(e.target.value) })} className={fieldClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>수량 단위</label>
            <select disabled={!canEditItems || loading} value={itemForm.quantityUnit} onChange={e => updateForm({ quantityUnit: e.target.value })} className={fieldClass}>
              {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>안전 재고</label>
            <input disabled={!canEditItems || loading} value={formatWithCommas(itemForm.safetyStock)} onChange={e => updateForm({ safetyStock: cleanDecimal(e.target.value) })} className={fieldClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>평균 중량</label>
            <input disabled={!canEditItems || loading} value={formatWithCommas(itemForm.avgWeight)} onChange={e => updateForm({ avgWeight: cleanDecimal(e.target.value) })} className={fieldClass} />
          </div>
          {canViewPrices && (
            <>
              <div className="space-y-1">
                <label className={labelClass}>매입단가</label>
                <input disabled={!canEditItems || !canEditPrices || loading} value={formatWithCommas(itemForm.purchasePrice)} onChange={e => updateForm({ purchasePrice: cleanInteger(e.target.value) })} className={fieldClass} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>판매단가</label>
                <input disabled={!canEditItems || !canEditPrices || loading} value={formatWithCommas(itemForm.salesPrice)} onChange={e => updateForm({ salesPrice: cleanInteger(e.target.value) })} className={fieldClass} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>개당 이익</label>
                <div className="h-11 px-3.5 bg-slate-50 border border-outline-variant/50 rounded-xl flex items-center font-black text-emerald-600">
                  {(parseNumber(itemForm.salesPrice) - parseNumber(itemForm.purchasePrice)).toLocaleString()} 원
                </div>
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className={labelClass}>제조일자</label>
            <input type="date" disabled={!canEditItems || loading} value={itemForm.manufDate} onChange={e => updateForm({ manufDate: e.target.value })} className={fieldClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>유통기한</label>
            <input type="date" disabled={!canEditItems || loading} value={itemForm.expiryDate} onChange={e => updateForm({ expiryDate: e.target.value })} className={fieldClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>보관 위치</label>
            <input disabled={!canEditItems || loading} value={itemForm.location} onChange={e => updateForm({ location: e.target.value })} className={fieldClass} />
          </div>
          <div className="space-y-1 md:col-span-3">
            <label className={labelClass}>상세 위치</label>
            <input disabled={!canEditItems || loading} value={itemForm.detailLocation} onChange={e => updateForm({ detailLocation: e.target.value })} className={fieldClass} />
          </div>
        </div>

        {canEditItems && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpdate}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0f172a] px-8 text-sm font-black text-white shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? '저장 중...' : '변경사항 저장'}
            </button>
          </div>
        )}
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
            activities.map((activity: any, index: number) => {
              const isInbound = activity.type === '입고';
              const activityUnit = (activity.weightUnit || item.unit || 'KG').toUpperCase();

              return (
                <div key={activity.id || index} className="min-w-[260px] bg-white p-6 rounded-[32px] border border-outline-variant shadow-sm flex flex-col justify-between gap-6 shrink-0 relative transition-all hover:border-primary/40 hover:shadow-xl group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black ${isInbound ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'} border`}>
                        {activity.type}
                      </span>
                      {canEditItems && (
                        <button
                          onClick={() => handleDeleteActivity(activity)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] font-black text-outline/60 uppercase tracking-widest">{activity.date}</p>
                  </div>

                  <div>
                    <p className="text-[9px] font-black text-outline uppercase tracking-widest mb-1">거래처/대상</p>
                    <p className="text-base font-black text-[#0f172a] line-clamp-1 group-hover:text-primary transition-colors">
                      {(!activity.partner || activity.partner === '초기재고등록') ? '' : activity.partner}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-outline-variant/30 flex items-center justify-between">
                    <p className="text-[9px] font-black text-outline uppercase">변동량</p>
                    <p className={`text-2xl font-black ${isInbound ? 'text-emerald-600' : 'text-rose-600'} tracking-tighter`}>
                      {isInbound ? '+' : '-'}{Math.round(activity.weight || 0).toLocaleString()}<span className="text-sm ml-0.5">{activityUnit}</span>
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="w-full py-24 flex flex-col items-center justify-center bg-surface-container/10 rounded-[48px] border-2 border-dashed border-outline-variant/30">
              <History className="w-12 h-12 text-outline/20 mb-4" />
              <p className="text-xl font-black text-[#0f172a]/30">활동 내역이 아직 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ItemDetailContent;
