import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, 
  CalendarDays, 
  ChevronDown, 
  ChevronRight, 
  Package,
  Trash2,
  FileDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  doc, 
  deleteDoc, 
  updateDoc, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
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

  const handleDownloadExcel = () => {
    try {
      const selectedViewLabel = activeShift;
      const fileName = `재고현황_리포트_${filterDate}_${selectedViewLabel}.xlsx`;

      // 1. Summary Data
      const summaryData = row1.concat(row2).map(s => ({
        '구분': s.label,
        '수량 (KG)': s.value,
        '비고': s.subtitle || ''
      }));

      // 2. Activity Data
      const activityData = combinedActivity.map(l => ({
        '일시': l.time,
        '구분': l.type,
        '품목명': l.item,
        '중량 (KG)': l.weight,
        '출처': l.source,
        '수율 (%)': l.yield || '',
        '로스 (%)': l.loss || ''
      }));

      // 3. Inventory Data
      const inventoryData = filteredInventory.map(i => ({
        '품목명': i.name,
        '카테고리': i.category || '',
        '규격': i.specs || '',
        '브랜드': i.brand || '',
        '현재고 (KG)': i.currentStock,
        '안전재고 (KG)': i.safetyStock || 0,
        '상태': i.currentStock < (i.safetyStock || 0) ? '부족' : '정상'
      }));

      const wb = XLSX.utils.book_new();
      
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "요약");

      const wsActivity = XLSX.utils.json_to_sheet(activityData);
      XLSX.utils.book_append_sheet(wb, wsActivity, "활동내역");

      const wsInventory = XLSX.utils.json_to_sheet(inventoryData);
      XLSX.utils.book_append_sheet(wb, wsInventory, "현재고");

      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Excel download failed:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

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
    const selectedDate = new Date(filterDate);
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - 7);
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

    const isInRange = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (activeShift === '일간') return dateStr === filterDate;
      if (activeShift === '주간') {
        return d >= startOfWeek && d <= selectedDate;
      }
      if (activeShift === '월간') {
        const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        return d >= startOfMonth && d <= monthEnd;
      }
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

  const { row1, row2 } = useMemo(() => {
    const selectedDate = new Date(filterDate);
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - 7);
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

    const isInRange = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (activeShift === '일간') return dateStr === filterDate;
      if (activeShift === '주간') {
        // From startOfWeek to selectedDate
        return d >= startOfWeek && d <= selectedDate;
      }
      if (activeShift === '월간') {
        const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        return d >= startOfMonth && d <= monthEnd;
      }
      return false;
    };

    // Calculate main stats
    const activeActivity = combinedActivity.filter(a => isInRange(a.date));
    const input = activeActivity
      .filter((l: any) => l.type === '입고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    const output = activeActivity
      .filter((l: any) => l.type === '출고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
      
    const activeProduction = production.filter((p: any) => isInRange(p.manufDate));
    const productionQty = activeProduction
      .reduce((acc: number, curr: any) => acc + (Number(curr.production) || 0), 0);

    // Calculate category totals
    const categoryTotals = filteredInventory.reduce((acc: Record<string, number>, item: any) => {
      const cat = item.category || '기타';
      if (cat === '완제품') return acc;
      acc[cat] = (acc[cat] || 0) + (Number(item.currentStock) || 0);
      return acc;
    }, {});

    const order = ['원육', '부속물', '돼지고기', '소고기', '기타'];
    const sortedCategories = Object.entries(categoryTotals)
      .sort(([a], [b]) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });

    const rawMeatEntry = sortedCategories.find(([cat]) => cat === '원육');
    const otherCategories = sortedCategories.filter(([cat]) => cat !== '원육');

    const firstRow = [
      { label: '원육 총 재고', value: rawMeatEntry ? rawMeatEntry[1] : 0, isCategory: true },
      { label: `${activeShift} 입고`, value: input },
      { label: `${activeShift} 출고`, value: output, active: true },
      { label: `${activeShift} 생산`, value: productionQty, subtitle: '완제품' },
    ];

    const secondRow = otherCategories.map(([category, total]) => ({
      label: category,
      value: total,
      isCategory: true
    }));

    return { row1: firstRow, row2: secondRow };
  }, [inventory, combinedActivity, production, filterDate, activeShift, filteredInventory]);

  const StatCard = ({ stat, idx }: { stat: any, idx: number, key?: string }) => {
    const handleCardClick = () => {
      if (stat.isCategory || stat.label.includes('재고')) {
        const category = stat.label === '원육 총 재고' ? '원육' : (stat.isCategory ? stat.label : null);
        onNavigate('inventory', category);
      } else if (stat.label.includes('입고') || stat.label.includes('출고')) {
        onNavigate('logistics');
      } else if (stat.label.includes('생산')) {
        onNavigate('production');
      }
    };

    return (
      <div 
        onClick={handleCardClick}
        className={`bg-white p-4 md:p-8 rounded-[24px] md:rounded-[40px] border-2 transition-all flex flex-col items-center justify-center gap-1.5 md:gap-4 min-h-[120px] md:min-h-[200px] cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${stat.active ? 'border-primary shadow-xl shadow-primary/10' : 'border-outline-variant/30 shadow-sm'} ${stat.isCategory ? 'hover:border-primary/50' : 'hover:border-primary/30'}`}
      >
        <div className="text-center space-y-0.5 md:space-y-1.5">
          <p className={`text-[10px] md:text-xs font-black uppercase tracking-tight ${stat.active ? 'text-primary' : 'text-outline'} line-clamp-1`}>{stat.label}</p>
          {stat.subtitle && (
            <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mx-auto w-fit ${
              stat.subtitle === '완제품' 
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' 
                : 'text-outline-variant'
            }`}>
              {stat.subtitle}
            </p>
          )}
        </div>
        <div className="flex items-baseline justify-center gap-1 md:gap-2 w-full px-2 overflow-hidden">
          <span className={`text-xl md:text-5xl font-black tabular-nums tracking-tighter leading-none truncate ${stat.active ? 'text-primary' : 'text-on-surface'}`}>
            {(stat.value as number).toLocaleString()}
          </span>
          <span className="text-[10px] md:text-sm font-black text-outline uppercase shrink-0">KG</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* Dashboard Header */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-6 px-1 md:px-0">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-black text-on-surface tracking-tighter">대시보드</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="relative group w-full sm:w-48 lg:w-48">
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
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none group">
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
                className="w-full flex items-center justify-center gap-2 px-4 h-11 bg-white border border-outline-variant rounded-xl text-sm font-bold text-on-surface group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/10 transition-all whitespace-nowrap"
              >
                <CalendarDays className="w-4 h-4 text-primary transition-colors" />
                <span className="hidden sm:inline font-black">{filterDate}</span>
                <span className="sm:hidden font-black">{filterDate.split('-').slice(1).join('/')}</span>
                <ChevronDown className="w-3 h-3 text-outline group-hover:text-primary transition-colors ml-1" />
              </button>
            </div>

            <div className="flex-1 sm:flex-none flex bg-surface-container p-1 rounded-xl border border-outline-variant h-11 items-center">
              {['일간', '주간', '월간'].map((shift) => (
                <button
                  key={shift}
                  onClick={() => setActiveShift(shift)}
                  className={`flex-1 sm:flex-none px-3 md:px-6 h-full rounded-lg text-[10px] md:text-xs font-black transition-all whitespace-nowrap flex items-center justify-center ${activeShift === shift ? 'bg-primary text-white shadow-sm' : 'text-outline hover:text-primary'}`}
                >
                  {shift}
                </button>
              ))}
            </div>

            <button
              onClick={handleDownloadExcel}
              className="flex-none flex items-center justify-center w-11 h-11 sm:w-auto sm:px-4 bg-white border border-outline-variant rounded-xl text-on-surface hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95"
              title="엑셀 다운"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline font-black ml-2">엑셀 다운</span>
            </button>
          </div>
        </div>
      </header>

      {/* Statistics Grid */}
      <section className="space-y-4 md:space-y-8">
        {/* Row 1: Raw Meat + Main Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
          {row1.map((stat, idx) => (
            <StatCard key={`row1-${idx}`} stat={stat} idx={idx} />
          ))}
        </div>

        {/* Row 2: Remaining Categories */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
          {row2.map((stat, idx) => (
            <StatCard key={`row2-${idx}`} stat={stat} idx={idx} />
          ))}
          {row2.length === 0 && (
            <div className="col-span-full text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-outline-variant/30">
              <span className="text-xs font-bold text-outline uppercase tracking-widest">부속물, 돼지고기, 소고기, 기타 재고 정보가 없습니다</span>
            </div>
          )}
        </div>
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
                          <tr key={k} className="hover:bg-surface-container/50 transition-colors group cursor-pointer" onClick={() => onNavigate('detail', item)}>
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
                      <div key={i} className="p-4 flex items-center justify-between active:bg-slate-50 transition-colors" onClick={() => onNavigate('detail', item)}>
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
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`px-2 py-1 rounded text-[10px] font-black ${l.type === '입고' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {l.type}
                            </span>
                            {l.source?.includes('생산') && (
                              <span className="text-[9px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded shadow-sm">
                                생산
                              </span>
                            )}
                          </div>
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
                          {l.source?.includes('생산') && (
                            <span className="text-[8px] font-black bg-indigo-500 text-white px-1.5 py-0.5 rounded shadow-sm">
                              생산
                            </span>
                          )}
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
