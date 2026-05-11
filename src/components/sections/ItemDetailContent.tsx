import React, { useState } from 'react';
import { 
  ArrowLeft,
  History
} from 'lucide-react';
import { 
  doc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  addDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError } from '../../lib/firestoreUtils';
import { OperationType } from '../../types';

function ItemDetailContent({ item, logistics, onNavigate, canEditItems, canViewPrices, canEditPrices }: any) {
  const [stock, setStock] = useState(item.currentStock);
  const [priceForm, setPriceForm] = useState({
    purchasePrice: item.purchasePrice || 0,
    salesPrice: item.salesPrice || 0
  });
  const [loading, setLoading] = useState(false);
  const activities = logistics.filter((l: any) => l.item === item.name).slice(0, 10);
  
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

      await updateDoc(doc(db, 'inventory', item.id), updateData);
      
      if (diff !== 0) {
        await addDoc(collection(db, 'logistics'), {
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          type: diff > 0 ? '입고' : '출고',
          item: item.name,
          partner: '시스템 조정 (Detail)',
          weight: Math.abs(diff),
          status: '완료',
          createdAt: serverTimestamp(),
          color: diff > 0 ? 'bg-emerald-500' : 'bg-error'
        });
      }
      alert('저장되었습니다.');
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, 'inventory'); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('inventory')} className="p-3 bg-surface-container hover:bg-surface-container-high rounded-full"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-2xl md:text-4xl font-black text-primary tracking-tighter">{item.name} 상세</h2>
      </div>
      <div className="flex flex-col gap-10">
        <div className="bg-white p-10 rounded-[48px] border-2 border-outline-variant shadow-sm w-full transition-all hover:border-primary/20">
          <div className="flex flex-col gap-10">
            {/* 1. SKU */}
            <div className="space-y-1 pb-6 border-b border-outline-variant/30">
              <p className="text-[10px] font-black text-outline uppercase tracking-[0.2em] mb-2">SKU</p>
              <p className="text-2xl font-black text-on-surface font-mono">{item.sku}</p>
            </div>

            {/* 2. Category */}
            <div className="space-y-1 pb-6 border-b border-outline-variant/30">
              <p className="text-[10px] font-black text-outline uppercase tracking-[0.2em] mb-2">카테고리</p>
              <p className="text-2xl font-black text-on-surface">{item.category}</p>
            </div>

            {/* 3. Current Stock */}
            <div className="space-y-1 pb-6 border-b border-outline-variant/30">
              <p className="text-[10px] font-black text-outline uppercase tracking-[0.2em] mb-2">현재 재고</p>
              <p className="text-5xl font-black text-primary tracking-tighter">{item.currentStock?.toLocaleString()} {item.unit}</p>
            </div>

            {/* 4. Safety Stock */}
            <div className="space-y-1 pb-6 border-b border-outline-variant/30">
              <p className="text-[10px] font-black text-outline uppercase tracking-[0.2em] mb-2">안전 재고</p>
              <p className="text-2xl font-black text-on-surface">{item.safetyStock?.toLocaleString()} {item.unit}</p>
            </div>

            {/* 5 & 6. Prices */}
            {canViewPrices && (
              <>
                <div className="space-y-2 pb-6 border-b border-outline-variant/30">
                  <p className="text-[10px] font-black text-outline uppercase tracking-[0.2em] mb-2">매입 단가</p>
                  {canEditPrices ? (
                    <input type="number" value={priceForm.purchasePrice} onChange={e => setPriceForm({...priceForm, purchasePrice: e.target.value})} className="h-14 px-6 bg-surface-container rounded-2xl font-black text-lg outline-none w-full max-w-md focus:ring-2 ring-primary/20 transition-all border border-outline-variant/20" />
                  ) : (
                    <p className="text-2xl font-black text-[#0f172a]">{item.purchasePrice?.toLocaleString()} W</p>
                  )}
                </div>
                <div className="space-y-2 pb-6 border-b border-outline-variant/30">
                  <p className="text-[10px] font-black text-outline uppercase tracking-[0.2em] mb-2">판매 단가</p>
                  {canEditPrices ? (
                    <input type="number" value={priceForm.salesPrice} onChange={e => setPriceForm({...priceForm, salesPrice: e.target.value})} className="h-14 px-6 bg-surface-container rounded-2xl font-black text-lg outline-none w-full max-w-md focus:ring-2 ring-primary/20 transition-all border border-outline-variant/20" />
                  ) : (
                    <p className="text-2xl font-black text-[#0f172a]">{item.salesPrice?.toLocaleString()} W</p>
                  )}
                </div>
              </>
            )}

            {/* 7. Storage Location */}
            <div className="space-y-1 pb-6 border-b border-outline-variant/30">
              <p className="text-[10px] font-black text-outline uppercase tracking-[0.2em] mb-2">보관 위치</p>
              <p className="text-2xl font-black text-on-surface">{item.location || '미지정'}</p>
            </div>

            {/* 8. Inventory Update */}
            {canEditItems && (
              <div className="space-y-2 pt-4">
                <p className="text-[10px] font-black text-outline uppercase tracking-[0.2em] mb-4 text-primary">재고 수정</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <input 
                    type="number" 
                    value={stock} 
                    onChange={e => setStock(e.target.value)} 
                    className="h-16 px-8 bg-surface-container border-2 border-outline-variant rounded-2xl outline-none font-black text-3xl w-full sm:w-48 focus:border-primary transition-all shadow-inner" 
                  />
                  <button 
                    onClick={handleUpdate} 
                    disabled={loading} 
                    className="bg-[#0f172a] text-white h-16 px-10 rounded-2xl font-black text-lg shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
                  >
                    {loading ? '저장 중...' : '변경 사항 저장하기'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <History className="w-6 h-6 text-[#0f172a]" />
              <h3 className="text-2xl font-black text-[#0f172a] tracking-tight">상세 활동 내역</h3>
            </div>
          </div>
          
          <div className="flex overflow-x-auto pb-8 gap-6 px-4 no-scrollbar">
            {activities.length > 0 ? (
              activities.map((a: any, i: number) => (
                <div key={i} className="min-w-[320px] bg-white p-8 rounded-[40px] border border-outline-variant shadow-sm flex flex-col justify-between gap-8 shrink-0 relative transition-all hover:border-primary/40 hover:shadow-xl group">
                   <div className="flex items-center justify-between">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black ${a.type === '입고' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} border ${a.type === '입고' ? 'border-emerald-100' : 'border-rose-100'}`}>
                      {a.type}
                    </span>
                    <p className="text-[10px] font-black text-outline/60 uppercase tracking-widest">{a.date} {a.time}</p>
                  </div>
                  
                  <div>
                    <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-2">거래처/대상</p>
                    <p className="text-xl font-black text-[#0f172a] line-clamp-1 group-hover:text-primary transition-colors">{a.partner}</p>
                  </div>

                  <div className="pt-6 border-t border-outline-variant/30 flex items-center justify-between">
                    <p className="text-[10px] font-black text-outline uppercase">변동량</p>
                    <p className={`text-4xl font-black ${a.type === '입고' ? 'text-emerald-600' : 'text-rose-600'} tracking-tighter`}>
                      {a.type === '입고' ? '+' : '-'}{a.weight?.toLocaleString()}<span className="text-lg ml-0.5">kg</span>
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
