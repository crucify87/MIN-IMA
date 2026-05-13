import React, { useState, useMemo } from 'react';
import { 
  Search, 
  CalendarDays, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight, 
  Package,
  ArrowLeft,
  Edit,
  Trash2
} from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError } from '../../lib/firestoreUtils';
import { OperationType } from '../../types';

function InventoryContent({ inventory, onNavigate, canEditItems, logistics = [] }: any) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [activeShift, setActiveShift] = useState('일간');
  const [showAll, setShowAll] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const categories = useMemo(() => {
    const cats = inventory.map((i: any) => i.category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [inventory]);

  const brands = useMemo(() => {
    const bnds = inventory.map((i: any) => i.brand).filter(Boolean);
    return Array.from(new Set(bnds));
  }, [inventory]);

  const filtered = useMemo(() => {
    return inventory.filter((i: any) => {
      const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) || 
                           i.sku?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !filterCategory || i.category === filterCategory;
      const matchesBrand = !filterBrand || i.brand === filterBrand;
      
      let matchesDate = true;
      if (filterStartDate || filterEndDate) {
        const itemLogistics = logistics.filter((l: any) => l.item === i.name);
        matchesDate = itemLogistics.some((l: any) => {
          const d = l.date;
          return (!filterStartDate || d >= filterStartDate) && (!filterEndDate || d <= filterEndDate);
        });
      }

      return matchesSearch && matchesCategory && matchesBrand && matchesDate;
    });
  }, [inventory, search, filterCategory, filterBrand, filterStartDate, filterEndDate, logistics]);

  const handleDeleteItem = async (id: string, name: string) => {
    if (!canEditItems) return;
    if (!window.confirm(`[${name}] 품목을 영구 삭제하시겠습니까? 관련 재고 데이터가 사라집니다.`)) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
      alert('삭제 되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  };

  const summaryStats = useMemo(() => {
    const skuCount = inventory.length;
    const lowStockCount = inventory.filter((i: any) => i.currentStock < (i.safetyStock || 0)).length;
    
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

    const periodInput = logistics
      .filter((l: any) => isInRange(l.date) && l.type === '입고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    const periodOutput = logistics
      .filter((l: any) => isInRange(l.date) && l.type === '출고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);

    return [
      { label: '총 SKU', value: skuCount, unit: '종' },
      { label: '재고 부족', value: lowStockCount, unit: '건', isAlert: true },
      { label: `${activeShift} 입고`, value: periodInput, unit: 'KG' },
      { label: `${activeShift} 출고`, value: periodOutput, unit: 'KG', isSuccess: true },
    ];
  }, [inventory, logistics, today, activeShift]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 md:p-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tighter">재고관리</h1>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group flex-1 sm:flex-initial">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input 
              type="text" 
              placeholder="품목 검색" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

      {/* Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {summaryStats.map((stat, idx) => (
          <div 
            key={idx} 
            className="bg-white p-6 md:p-10 rounded-[32px] border border-outline-variant shadow-sm transition-all flex flex-col items-center justify-center gap-2 md:gap-4 group hover:shadow-md relative overflow-hidden min-h-[140px] sm:min-h-[180px] md:min-h-[220px]"
          >
            <div className={`absolute top-0 left-0 w-full h-1 md:h-1.5 ${stat.isAlert ? 'bg-rose-500' : stat.isSuccess ? 'bg-emerald-500' : idx === 0 ? 'bg-[#94a3b8]' : 'bg-[#3b82f6]'}`} />
            <p className="text-[10px] md:text-[11px] font-black text-outline uppercase tracking-tight text-center">{stat.label}</p>
            <div className="flex items-baseline justify-center gap-2 w-full">
              <span className={`text-4xl md:text-5xl font-black tabular-nums tracking-tighter leading-none ${stat.isAlert ? 'text-rose-600' : stat.isSuccess ? 'text-emerald-600' : 'text-on-surface'}`}>
                {stat.value.toLocaleString()}
              </span>
              <span className="text-xs md:text-sm font-black text-outline uppercase shrink-0">{stat.unit}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Inventory Filter Bar */}
      <section className="bg-[#e8f1ff] p-4 md:p-6 rounded-[24px] md:rounded-[32px] space-y-4 shadow-inner border border-primary/5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="품목명/SKU..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 px-4 bg-white border border-outline-variant/30 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all shadow-sm" 
            />
          </div>
          
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-12 px-4 bg-white border border-outline-variant/30 rounded-xl text-xs font-bold focus:border-primary outline-none cursor-pointer shadow-sm appearance-none"
          >
            <option value="">전체 카테고리</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            value={filterBrand} 
            onChange={(e) => setFilterBrand(e.target.value)}
            className="h-12 px-4 bg-white border border-outline-variant/30 rounded-xl text-xs font-bold focus:border-primary outline-none cursor-pointer shadow-sm appearance-none"
          >
            <option value="">전체 브랜드</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <input 
            type="date" 
            value={filterStartDate} 
            onChange={e => setFilterStartDate(e.target.value)} 
            className="h-12 px-3 bg-white border border-outline-variant/30 rounded-xl text-[11px] font-bold outline-none focus:border-primary shadow-sm w-full"
          />
          <input 
            type="date" 
            value={filterEndDate} 
            onChange={e => setFilterEndDate(e.target.value)} 
            className="h-12 px-3 bg-white border border-outline-variant/30 rounded-xl text-[11px] font-bold outline-none focus:border-primary shadow-sm w-full"
          />
        </div>
      </section>

      {/* Inventory Table */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-[#0f172a]" />
            <h3 className="text-2xl font-black text-[#0f172a] tracking-tight">재고 기록</h3>
          </div>
          <button 
            onClick={() => setShowAll(!showAll)} 
            className="flex items-center gap-2 px-6 h-11 bg-white border border-outline-variant/60 rounded-xl text-sm font-black text-[#0f172a] hover:bg-slate-50 transition-all shadow-sm"
          >
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAll ? '' : '더보기'}
          </button>
        </div>

        <div className="bg-white rounded-[40px] border border-outline-variant overflow-hidden shadow-xl shadow-surface-container-high/50">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse min-w-[800px] md:min-w-0">
              <thead className="bg-[#f1f4f9] text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant">
                <tr>
                  <th className="px-4 py-5">SKU / 위치 / 라인</th>
                  <th className="px-4 py-5 font-medium">품목 정보</th>
                  <th className="px-4 py-5 font-medium">카테고리</th>
                  <th className="px-4 py-5 font-medium">현재 재고</th>
                  <th className="px-4 py-5 font-medium">상태</th>
                  <th className="px-4 py-5 font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtered.length > 0 ? (
                  filtered.slice(0, showAll ? undefined : 15).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-surface-container/5 transition-colors">
                      <td className="px-4 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-primary font-mono">{item.sku}</span>
                        <span className="text-[9px] font-black text-outline uppercase">{item.location || '미지정'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-black text-on-surface text-base">
                      {item.name}
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 bg-surface-container rounded-lg text-[9px] font-black text-outline uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-black text-lg">
                      {item.currentStock?.toLocaleString()} <span className="text-[10px] text-outline font-medium">{item.unit}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest ${item.currentStock < (item.safetyStock || 0) ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {item.currentStock < (item.safetyStock || 0) ? '재고부족' : '정상'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {canEditItems ? (
                          <>
                            <button onClick={() => onNavigate('detail', item)} className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" title="상세/수정">
                              <Edit className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors" title="삭제">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => onNavigate('detail', item)} className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors">
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                      <Package className="w-12 h-12" />
                      <p className="text-xl font-black tracking-tight">품목 내역이 없습니다</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
);
}

export default InventoryContent;
