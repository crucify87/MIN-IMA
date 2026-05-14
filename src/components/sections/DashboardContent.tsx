import React, { useState, useMemo } from 'react';
import { 
  Search, 
  CalendarDays, 
  ChevronDown, 
  ChevronRight, 
  Package,
  Trash2
} from 'lucide-react';
import { 
  doc, 
  deleteDoc, 
  updateDoc, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError } from '../../lib/firestoreUtils';
import { ViewType, OperationType } from '../../types';

function DashboardContent({ inventory, production, logistics, partners, onNavigate, canEditItems }: any) {
  const today = new Date().toISOString().split('T')[0];
  
  const [activeShift, setActiveShift] = useState('일간');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [loading, setLoading] = useState(false);

  const paginatedInventory = useMemo(() => {
    const startIndex = (inventoryPage - 1) * ITEMS_PER_PAGE;
    return inventory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [inventory, inventoryPage]);

  const totalInventoryPages = Math.ceil(inventory.length / ITEMS_PER_PAGE);

  const combinedActivity = useMemo(() => {
    const startOfWeek = new Date();
    startOfWeek.setDate(new Date().getDate() - 7);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const isInRange = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (activeShift === '일간') return dateStr === today;
      if (activeShift === '주간') return d >= startOfWeek;
      if (activeShift === '월간') return d >= startOfMonth;
      return false;
    };

    const combined = [
      ...logistics.map((l: any) => ({
        originalId: l.id,
        time: `${l.date} ${l.time}`,
        type: l.type,
        item: l.item,
        weight: l.weight,
        source: '물류',
        rawTime: l.createdAt?.seconds || 0,
        date: l.date
      })),
      ...production.flatMap((p: any) => [
        {
          originalId: p.id,
          time: p.manufDate,
          type: '입고',
          item: p.title,
          weight: p.production,
          source: '생산(완성)',
          rawTime: p.createdAt?.seconds || 0,
          date: p.manufDate
        },
        {
          originalId: p.id,
          time: p.manufDate,
          type: '출고',
          item: p.rawMaterial,
          weight: p.rawQty,
          source: '생산(투입)',
          rawTime: p.createdAt?.seconds || 0,
          date: p.manufDate
        }
      ]).filter(i => i.item)
    ].filter(item => isInRange(item.date))
    .sort((a, b) => b.rawTime - a.rawTime);

    return combined;
  }, [logistics, production, activeShift, today]);

  const paginatedActivity = useMemo(() => {
    const startIndex = (activityPage - 1) * ITEMS_PER_PAGE;
    return combinedActivity.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [combinedActivity, activityPage]);

  const totalActivityPages = Math.ceil(combinedActivity.length / ITEMS_PER_PAGE);

  const Pagination = ({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) => {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <button 
          disabled={current === 1}
          onClick={() => onChange(current - 1)}
          className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: total }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${current === p ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white border border-outline-variant text-outline hover:border-primary hover:text-primary'}`}
            >
              {p}
            </button>
          ))}
        </div>
        <button 
          disabled={current === total}
          onClick={() => onChange(current + 1)}
          className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const handleDelete = async (l: any) => {
    if (!canEditItems || loading) return;
    
    const isProduction = l.source.includes('생산');
    const confirmMsg = isProduction 
      ? `[${l.item}] 관련 생산 일지 전체를 삭제하시겠습니까? (투입/생산 재고가 모두 복구됩니다)`
      : `[${l.item}] 물류 기록을 삭제하시겠습니까? (재고가 같이 조정됩니다)`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      if (isProduction) {
        // Find the full production record using the original ID
        const record = production.find((p: any) => p.id === l.originalId);
        if (record) {
          await deleteDoc(doc(db, 'production_batches', record.id));
          
          // Revert production output
          const prodItem = inventory.find((i: any) => i.name === record.title);
          if (prodItem) {
            await updateDoc(doc(db, 'inventory', prodItem.id), {
              currentStock: increment(-record.production),
              updatedAt: serverTimestamp()
            });
          }
          
          // Revert raw material input
          const rawItem = inventory.find((i: any) => i.name === record.rawMaterial);
          if (rawItem) {
            await updateDoc(doc(db, 'inventory', rawItem.id), {
              currentStock: increment(record.rawQty),
              updatedAt: serverTimestamp()
            });
          }
        }
      } else {
        // Logistics delete
        await deleteDoc(doc(db, 'logistics', l.originalId));
        const item = inventory.find((i: any) => i.name === l.item);
        if (item) {
          await updateDoc(doc(db, 'inventory', item.id), {
            currentStock: increment(l.type === '입고' ? -l.weight : l.weight),
            updatedAt: serverTimestamp()
          });
        }
      }
      alert('삭제 완료');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, isProduction ? 'production_batches' : 'logistics');
    } finally {
      setLoading(true); // Small delay before allowing next click
      setTimeout(() => setLoading(false), 500);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const isInRange = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (activeShift === '일간') return dateStr === today;
      if (activeShift === '주간') return d >= startOfWeek;
      if (activeShift === '월간') return d >= startOfMonth;
      return false;
    };

    const totalInventory = inventory.reduce((acc: number, curr: any) => acc + (Number(curr.currentStock) || 0), 0);
    
    const filteredLogistics = logistics.filter((l: any) => isInRange(l.date));
    const input = filteredLogistics
      .filter((l: any) => l.type === '입고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    const output = filteredLogistics
      .filter((l: any) => l.type === '출고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
      
    const productionQty = production
      .filter((p: any) => isInRange(p.manufDate))
      .reduce((acc: number, curr: any) => acc + (Number(curr.production) || 0), 0);

    return [
      { label: '현재 총 재고', value: totalInventory },
      { label: `${activeShift} 입고`, value: input },
      { label: `${activeShift} 출고`, value: output, active: true },
      { label: `${activeShift} 생산`, value: productionQty },
    ];
  }, [inventory, logistics, production, today, activeShift]);

  return (
    <div className="space-y-10">
      {/* Dashboard Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tighter">대시보드</h1>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group flex-1 sm:flex-initial">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input 
              type="text" 
              placeholder="품목 검색" 
              className="h-11 pl-11 pr-4 bg-white border border-outline-variant rounded-xl text-sm font-bold outline-none focus:border-primary transition-all w-full md:w-48" 
            />
          </div>
          
          <div className="flex items-center gap-2 px-4 h-11 bg-white border border-outline-variant rounded-xl text-sm font-bold text-on-surface">
            <CalendarDays className="w-4 h-4 text-outline" />
            <span>{today}</span>
            <ChevronDown className="w-4 h-4 text-outline" />
          </div>

          <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant">
            {['일간', '주간', '월간'].map((shift) => (
              <button
                key={shift}
                onClick={() => setActiveShift(shift)}
                className={`px-6 py-1.5 rounded-lg text-xs font-black transition-all ${activeShift === shift ? 'bg-primary text-white shadow-sm' : 'text-outline hover:text-primary'}`}
              >
                {shift}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Stat Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, idx) => (
          <div 
            key={idx} 
            className={`bg-white p-6 md:p-10 rounded-[32px] border-2 transition-all flex flex-col items-center justify-center gap-2 md:gap-4 min-h-[140px] sm:min-h-[180px] md:min-h-[220px] ${stat.active ? 'border-primary shadow-lg shadow-primary/5' : 'border-outline-variant/30 shadow-sm'}`}
          >
            <p className={`text-[10px] md:text-[11px] font-black uppercase tracking-tight text-center ${stat.active ? 'text-primary' : 'text-outline'}`}>{stat.label}</p>
            <div className="flex items-baseline justify-center gap-2 w-full">
              <span className={`text-4xl md:text-5xl font-black tabular-nums tracking-tighter leading-none ${stat.active ? 'text-primary' : 'text-on-surface'}`}>
                {stat.value.toLocaleString()}
              </span>
              <span className="text-xs md:text-sm font-black text-outline uppercase shrink-0">KG</span>
            </div>
          </div>
        ))}
      </section>

      {/* Current Inventory Table */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-on-surface tracking-tight">현재 재고 현황</h3>
          <button 
            onClick={() => onNavigate('inventory')}
            className="flex items-center gap-1 text-sm font-bold text-outline hover:text-primary transition-colors"
          >
            전체 보기 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="bg-surface-container/30 border border-dashed border-outline-variant/50 rounded-[40px] min-h-[240px] flex flex-col items-center justify-center p-2 md:p-12 text-center group">
          {inventory.length > 0 ? (
            <>
              <div className="w-full bg-white rounded-[32px] border border-outline-variant overflow-hidden shadow-sm">
                <div className="w-full">
                  {/* Desktop View Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-surface-container border-b border-outline-variant text-[11px] font-black text-outline uppercase tracking-widest">
                        <tr>
                          <th className="px-6 md:px-8 py-5">품목 명칭</th>
                          <th className="px-6 md:px-8 py-5">현재고 (KG)</th>
                          <th className="px-6 md:px-8 py-5 text-center">상태</th>
                          <th className="px-6 md:px-8 py-5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {paginatedInventory.map((item: any, i: number) => (
                          <tr key={i} className="hover:bg-surface-container/50 transition-colors group cursor-pointer" onClick={() => onNavigate('inventory')}>
                            <td className="px-6 md:px-8 py-5">
                              <span className="font-black text-on-surface tracking-tight text-sm md:text-base">{item.name}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-lg md:text-xl font-black">{item.currentStock?.toLocaleString()} KG</td>
                            <td className="px-6 md:px-8 py-5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] md:text-[10px] font-black uppercase tracking-widest ${item.currentStock < (item.safetyStock || 0) ? 'bg-error/10 text-error' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                {item.currentStock < (item.safetyStock || 0) ? '부족' : '정상'}
                              </span>
                            </td>
                            <td className="px-4 md:px-8 py-5 text-right"><ChevronRight className="w-5 h-5 text-outline" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View Card */}
                  <div className="md:hidden divide-y divide-outline-variant/10 text-left">
                    {paginatedInventory.map((item: any, i: number) => (
                      <div key={i} className="p-5 flex items-center justify-between active:bg-slate-50 transition-colors" onClick={() => onNavigate('inventory')}>
                        <div className="flex items-center gap-3">
                           <div className="text-left">
                              <div className="font-black text-[#0f172a] text-sm">{item.name}</div>
                              <div className="text-xs font-bold text-outline">{item.currentStock?.toLocaleString()} KG</div>
                           </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${item.currentStock < (item.safetyStock || 0) ? 'bg-error/10 text-error' : 'bg-emerald-500/10 text-emerald-600'}`}>
                          {item.currentStock < (item.safetyStock || 0) ? '부족' : '정상'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Pagination current={inventoryPage} total={totalInventoryPages} onChange={setInventoryPage} />
            </>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-md border border-outline-variant/30">
                <Package className="w-8 h-8 text-outline/40" />
              </div>
              <p className="text-xl font-black text-outline/50 tracking-tight">품목을 찾을 수 없습니다</p>
            </div>
          )}
        </div>
      </section>

      {/* Stock Movement Activity */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-on-surface tracking-tight">재고 변동 내역</h3>
          <div className="flex gap-4">
            <button 
              onClick={() => onNavigate('production')}
              className="text-sm font-black text-on-surface-variant hover:text-primary transition-colors"
            >
              생산 상세
            </button>
            <button 
              onClick={() => onNavigate('logistics')}
              className="text-sm font-black text-on-surface-variant hover:text-primary transition-colors"
            >
              물류 상세
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-outline-variant overflow-hidden shadow-xl shadow-surface-container-high/50 p-2 md:p-0">
          <div className="w-full">
            {/* Desktop View Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead className="bg-surface-container/50 text-[11px] font-black text-outline uppercase tracking-widest border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-8">시간 (TIME)</th>
                    <th className="px-4 py-8">구분</th>
                    <th className="px-4 py-8">품목 (ITEM)</th>
                    <th className="px-4 py-8">재고 변동량</th>
                    <th className="px-4 py-8">재고 상태</th>
                    <th className="px-4 py-8">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {paginatedActivity.map((l: any, i: number) => {
                    const itemInfo = inventory.find((inv: any) => inv.name === l.item);
                    const isShortage = itemInfo ? itemInfo.currentStock < (itemInfo.safetyStock || 0) : false;
                    const status = l.type === '입고' ? '보충' : (isShortage ? '부족' : '정상');
                    
                    return (
                      <tr key={i} className="hover:bg-surface-container/10 transition-colors">
                        <td className="px-4 py-6 text-sm font-bold text-outline">{l.time}</td>
                        <td className="px-4 py-6">
                          <span className={`px-2 py-1 rounded text-[10px] font-black ${l.type === '입고' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {l.type}
                          </span>
                        </td>
                        <td className="px-4 py-6 font-black text-on-surface">{l.item}</td>
                        <td className={`px-4 py-6 font-black text-xl ${l.type === '입고' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {l.type === '입고' ? '+' : '-'}{Number(l.weight)?.toLocaleString()} KG
                        </td>
                        <td className="px-4 py-6">
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                            status === '부족' ? 'bg-rose-500 text-white' : 
                            status === '보충' ? 'bg-blue-500 text-white' : 
                            'bg-emerald-500 text-white'
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-6">
                           {canEditItems && (
                             <button 
                               onClick={() => handleDelete(l)} 
                               className="p-2.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all active:scale-90"
                               title="내역 삭제"
                             >
                               <Trash2 className="w-5 h-5" />
                             </button>
                           )}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedActivity.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-24 text-center">
                        <p className="text-xl font-black text-outline/40 tracking-tight">활동 내역이 없습니다</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View Activity Cards */}
            <div className="md:hidden divide-y divide-outline-variant/10 p-2">
              {paginatedActivity.map((l: any, i: number) => {
                const itemInfo = inventory.find((inv: any) => inv.name === l.item);
                const isShortage = itemInfo ? itemInfo.currentStock < (itemInfo.safetyStock || 0) : false;
                const status = l.type === '입고' ? '보충' : (isShortage ? '부족' : '정상');

                return (
                  <div key={i} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <span className={`px-2 py-0.5 rounded text-[8px] font-black ${l.type === '입고' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {l.type}
                          </span>
                          <span className="text-[10px] font-bold text-outline">{l.time}</span>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                            status === '부족' ? 'bg-rose-500 text-white' : 
                            status === '보충' ? 'bg-blue-500 text-white' : 
                            'bg-emerald-500 text-white'
                          }`}>
                            {status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-[#0f172a]">{l.item}</span>
                      <div className="flex items-center gap-4">
                        <span className={`text-base font-black ${l.type === '입고' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {l.type === '입고' ? '+' : '-'}{Number(l.weight)?.toLocaleString()} KG
                        </span>
                        {canEditItems && (
                          <button 
                             onClick={() => handleDelete(l)} 
                             className="p-2 bg-rose-50 text-rose-400 rounded-xl"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {paginatedActivity.length === 0 && (
                <div className="py-12 text-center opacity-40 text-sm font-black">활동 내역이 없습니다</div>
              )}
            </div>
          </div>
          
          <div className="p-4 bg-surface-container/10 border-t border-outline-variant">
            <Pagination current={activityPage} total={totalActivityPages} onChange={setActivityPage} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardContent;
