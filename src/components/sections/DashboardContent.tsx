import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, 
  CalendarDays, 
  ChevronDown, 
  ChevronRight, 
  Package,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
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
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const handleDateClick = () => {
    if (dateInputRef.current) {
      if ('showPicker' in dateInputRef.current) {
        try {
          (dateInputRef.current as any).showPicker();
        } catch (e) {
          dateInputRef.current.click();
        }
      } else {
        dateInputRef.current.click();
      }
    }
  };
  
  const [activeShift, setActiveShift] = useState('일간');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const ITEMS_PER_PAGE = 10;
  const [loading, setLoading] = useState(false);

  const filteredInventory = useMemo(() => {
    let result = !searchQuery ? inventory : inventory.filter((item: any) => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Sort by shortage status first, then by latest update
    return [...result].sort((a: any, b: any) => {
      const aShortage = a.currentStock < (a.safetyStock || 0);
      const bShortage = b.currentStock < (b.safetyStock || 0);
      
      if (aShortage && !bShortage) return -1;
      if (!aShortage && bShortage) return 1;
      
      const timeA = a.updatedAt?.seconds || 0;
      const timeB = b.updatedAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [inventory, searchQuery]);

  const paginatedInventory = useMemo(() => {
    const startIndex = (inventoryPage - 1) * ITEMS_PER_PAGE;
    return filteredInventory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredInventory, inventoryPage]);

  const totalInventoryPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);

  const combinedActivity = useMemo(() => {
    const startOfWeek = new Date();
    startOfWeek.setDate(new Date().getDate() - 7);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const isInRange = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (activeShift === '일간') return dateStr === filterDate;
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
          date: p.manufDate,
          yield: p.yield,
          loss: p.loss
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
    .sort((a, b) => {
      // Sort by date then time in reverse (latest first)
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      if (a.time !== b.time) return b.time.localeCompare(a.time);
      return b.rawTime - a.rawTime;
    });

    return combined;
  }, [logistics, production, activeShift, filterDate]);

  const paginatedActivity = useMemo(() => {
    const startIndex = (activityPage - 1) * ITEMS_PER_PAGE;
    return combinedActivity.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [combinedActivity, activityPage]);

  const totalActivityPages = Math.ceil(combinedActivity.length / ITEMS_PER_PAGE);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Explicit refresh feel
    setTimeout(() => setIsRefreshing(false), 1000);
  };

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
      if (activeShift === '일간') return dateStr === filterDate;
      if (activeShift === '주간') return d >= startOfWeek;
      if (activeShift === '월간') return d >= startOfMonth;
      return false;
    };

    const totalInventoryCount = filteredInventory.reduce((acc: number, curr: any) => acc + (Number(curr.currentStock) || 0), 0);
    
    // Calculate stats based on combined activity (includes both Logistics and Production)
    const activeActivity = combinedActivity.filter(a => isInRange(a.date));
    const input = activeActivity
      .filter((l: any) => l.type === '입고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    const output = activeActivity
      .filter((l: any) => l.type === '출고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
      
    // Production stat specifically from production records
    const activeProduction = production.filter((p: any) => isInRange(p.manufDate));
    const productionQty = activeProduction
      .reduce((acc: number, curr: any) => acc + (Number(curr.production) || 0), 0);
    
    // Calculate average yield
    const avgYield = activeProduction.length > 0 
      ? activeProduction.reduce((acc: number, curr: any) => acc + (Number(curr.yield) || 0), 0) / activeProduction.length
      : 0;

    return [
      { label: searchQuery ? '검색 필터 재고' : '현재 총 재고', value: totalInventoryCount },
      { label: `${activeShift} 입고`, value: input },
      { label: `${activeShift} 생산`, value: productionQty },
      { label: `${activeShift} 평균 수율`, value: avgYield.toFixed(1), unit: '%', active: true },
    ];
  }, [filteredInventory, combinedActivity, production, filterDate, activeShift, searchQuery]);

  return (
    <div className="space-y-10">
      {/* Dashboard Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 md:px-0">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-black text-on-surface tracking-tighter">대시보드</h1>
        </div>
        
        <div className="flex flex-row items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar pb-1 px-1 -mx-1">
          <div className="relative group shrink-0 w-40 md:w-48">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input 
              type="text" 
              placeholder="품목 검색" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setInventoryPage(1);
              }}
              className="h-11 pl-11 pr-4 bg-white border border-outline-variant rounded-xl text-sm font-bold outline-none focus:border-primary transition-all w-full" 
            />
          </div>
          
          <div className="relative flex-none group">
            <input 
              ref={dateInputRef}
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setActiveShift('일간');
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none"
              title="날짜 선택"
            />
            <button 
              onClick={handleDateClick}
              className="flex items-center justify-center gap-2 px-4 h-11 bg-white border border-outline-variant rounded-xl text-sm font-bold text-on-surface group-hover:border-primary transition-all whitespace-nowrap"
            >
              <CalendarDays className="w-4 h-4 text-outline group-hover:text-primary transition-colors" />
              <span className="hidden sm:inline">{filterDate}</span>
              <span className="sm:hidden">{filterDate.split('-').slice(1).join('/')}</span>
            </button>
          </div>

          <div className="flex-none flex bg-surface-container p-1 rounded-xl border border-outline-variant h-11 items-center">
            {['일간', '주간', '월간'].map((shift) => (
              <button
                key={shift}
                onClick={() => setActiveShift(shift)}
                className={`px-4 md:px-6 h-full rounded-lg text-[11px] md:text-xs font-black transition-all whitespace-nowrap flex items-center justify-center ${activeShift === shift ? 'bg-primary text-white shadow-sm' : 'text-outline hover:text-primary'}`}
              >
                {shift}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Stat Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {stats.map((stat, idx) => (
          <div 
            key={idx} 
            className={`bg-white p-5 md:p-10 rounded-[28px] md:rounded-[32px] border-2 transition-all flex flex-col items-center justify-center gap-2 md:gap-4 min-h-[120px] sm:min-h-[180px] md:min-h-[220px] ${stat.active ? 'border-primary shadow-lg shadow-primary/5' : 'border-outline-variant/30 shadow-sm'}`}
          >
            <p className={`text-[9px] md:text-[11px] font-black uppercase tracking-tight text-center ${stat.active ? 'text-primary' : 'text-outline'}`}>{stat.label}</p>
            <div className="flex items-baseline justify-center gap-1.5 md:gap-2 w-full">
              <span className={`text-2xl md:text-5xl font-black tabular-nums tracking-tighter leading-none ${stat.active ? 'text-primary' : 'text-on-surface'}`}>
                {stat.value.toLocaleString()}
              </span>
              <span className="text-[9px] md:text-sm font-black text-outline uppercase shrink-0">KG</span>
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
                    <table className="w-full text-left table-fixed">
                      <thead className="bg-surface-container border-b border-outline-variant text-[11px] font-black text-outline uppercase tracking-widest">
                        <tr>
                          <th className="px-6 md:px-8 py-5 text-center w-[15%]">날짜</th>
                          <th className="px-6 md:px-8 py-5 w-[30%]">품목 명칭</th>
                          <th className="px-6 md:px-8 py-5 text-center w-[15%]">규격</th>
                          <th className="px-6 md:px-8 py-5 w-[20%]">현재고 (KG)</th>
                          <th className="px-6 md:px-8 py-5 text-center w-[15%] text-nowrap">상태</th>
                          <th className="px-6 md:px-8 py-5 w-[5%] tracking-normal"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {paginatedInventory.map((item: any, k: number) => (
                          <tr key={k} className="hover:bg-surface-container/50 transition-colors group cursor-pointer" onClick={() => onNavigate('inventory')}>
                            <td className="px-6 md:px-8 py-5 text-center text-[11px] font-bold text-outline tabular-nums">
                              {item.updatedAt?.seconds ? new Date(item.updatedAt.seconds * 1000).toISOString().split('T')[0] : '-'}
                            </td>
                            <td className="px-6 md:px-8 py-5 truncate">
                              <span className="font-black text-on-surface tracking-tight text-sm md:text-base truncate block" title={item.name}>{item.name}</span>
                            </td>
                            <td className="px-6 md:px-8 py-5 text-center text-xs font-bold text-outline truncate" title={item.specs || ''}>{item.specs || '-'}</td>
                            <td className="px-6 md:px-8 py-5 text-lg md:text-xl font-black text-nowrap">{item.currentStock?.toLocaleString()} KG</td>
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
                      <div key={i} className="p-4 flex items-center justify-between active:bg-slate-50 transition-colors" onClick={() => onNavigate('inventory')}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="text-left min-w-0">
                              <div className="text-[10px] font-bold text-outline mb-0.5">
                                {item.updatedAt?.seconds ? new Date(item.updatedAt.seconds * 1000).toISOString().split('T')[0] : '-'}
                              </div>
                              <div className="font-black text-[#0f172a] text-sm truncate">{item.name}</div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="text-[10px] font-bold text-emerald-600/70">{item.specs || '-'}</div>
                                <div className="text-[10px] font-bold text-outline">{item.currentStock?.toLocaleString()} KG</div>
                              </div>
                            </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0 ${item.currentStock < (item.safetyStock || 0) ? 'bg-error/10 text-error' : 'bg-emerald-500/10 text-emerald-600'}`}>
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
                    <th className="px-4 py-8">날짜</th>
                    <th className="px-4 py-8">구분</th>
                    <th className="px-4 py-8">품목 (ITEM)</th>
                    <th className="px-4 py-8 text-nowrap">재고 변동량 / 수율</th>
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
                        <td className="px-4 py-6">
                          <div className="font-black text-on-surface">{l.item}</div>
                          <div className="text-[10px] font-bold text-outline mt-0.5">{itemInfo?.specs || ''}</div>
                        </td>
                        <td className="px-4 py-6">
                          <div className={`font-black text-xl ${l.type === '입고' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {l.type === '입고' ? '+' : '-'}{Number(l.weight)?.toLocaleString()} KG
                          </div>
                          {l.yield !== undefined && (
                            <div className="flex items-center justify-center gap-2 mt-1">
                              <span className="text-[10px] font-black text-emerald-600">수율 {l.yield?.toFixed(1)}%</span>
                              <span className="text-[10px] font-bold text-rose-500">로스 {l.loss?.toFixed(1)}%</span>
                            </div>
                          )}
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
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-[#0f172a]">{l.item}</span>
                        <span className="text-[10px] font-bold text-outline">{itemInfo?.specs || ''}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className={`text-base font-black ${l.type === '입고' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {l.type === '입고' ? '+' : '-'}{Number(l.weight)?.toLocaleString()} KG
                          </span>
                          {l.yield !== undefined && (
                            <span className="text-[9px] font-black text-emerald-600">
                              수율 {l.yield?.toFixed(1)}% (로스 {l.loss?.toFixed(1)}%)
                            </span>
                          )}
                        </div>
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
