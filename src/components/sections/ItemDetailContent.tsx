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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-white p-8 rounded-[40px] border-2 border-outline-variant space-y-6 shadow-sm underline-none">
          <div className="grid grid-cols-2 gap-6 pb-6 border-b border-outline-variant">
            <div><p className="text-[10px] font-black text-outline uppercase">카테고리</p><p className="text-xl font-black">{item.category}</p></div>
            <div><p className="text-[10px] font-black text-outline uppercase">SKU</p><p className="text-xl font-black font-mono">{item.sku}</p></div>
            <div><p className="text-[10px] font-black text-outline uppercase">안전 재고</p><p className="text-xl font-black">{item.safetyStock?.toLocaleString()} {item.unit}</p></div>
            <div><p className="text-[10px] font-black text-outline uppercase">보관 위치</p><p className="text-xl font-black">{item.location || '미지정'}</p></div>
          </div>
          
          {canViewPrices && (
            <div className="grid grid-cols-2 gap-6 pb-6 border-b border-outline-variant">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-outline uppercase">매입 단가 (W)</p>
                {canEditPrices ? (
                  <input type="number" value={priceForm.purchasePrice} onChange={e => setPriceForm({...priceForm, purchasePrice: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold" />
                ) : (
                  <p className="text-xl font-black text-[#0f172a]">{item.purchasePrice?.toLocaleString()} W</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-outline uppercase">판매 단가 (W)</p>
                {canEditPrices ? (
                  <input type="number" value={priceForm.salesPrice} onChange={e => setPriceForm({...priceForm, salesPrice: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold" />
                ) : (
                  <p className="text-xl font-black text-[#0f172a]">{item.salesPrice?.toLocaleString()} W</p>
                )}
              </div>
            </div>
          )}

          {canEditItems ? (
            <div className="pt-2 space-y-4">
              <h3 className="text-lg font-black uppercase font-bold">재고 수정</h3>
              <div className="flex gap-4">
                <input type="number" value={stock} onChange={e => setStock(e.target.value)} className="flex-1 h-14 px-6 bg-surface-container border-2 border-outline-variant rounded-2xl outline-none font-black text-2xl" />
                <button onClick={handleUpdate} disabled={loading} className="bg-primary text-white h-14 px-8 rounded-2xl font-black uppercase shadow-lg hover:bg-[#0f172a] transition-colors">{loading ? 'Saving...' : '저장하기'}</button>
              </div>
            </div>
          ) : (
             <div className="pt-2">
                <p className="text-[10px] font-black text-outline uppercase">현재 재고</p>
                <p className="text-4xl font-black text-primary">{item.currentStock?.toLocaleString()} {item.unit}</p>
             </div>
          )}
        </div>
        <div className="space-y-6">
          <h3 className="text-xl font-black uppercase font-bold flex items-center gap-2"><History className="w-5 h-5" /> 활동 내역</h3>
          <div className="space-y-4">
            {activities.map((a: any, i: number) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-outline-variant flex justify-between items-center group">
                <div><p className="text-xs font-black text-outline uppercase">{a.date} {a.time}</p><p className="font-bold text-on-surface">{a.partner}</p></div>
                <div className="text-right flex items-center gap-2"><span className={`text-lg font-black ${a.type === '입고' ? 'text-emerald-600' : 'text-error'}`}>{a.type === '입고' ? '+' : '-'}{a.weight}kg</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemDetailContent;
