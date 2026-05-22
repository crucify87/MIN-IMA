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
  Trash2,
  FileDown
} from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../../lib/firebase';
import { handleFirestoreError } from '../../lib/firestoreUtils';
import { OperationType } from '../../types';

function InventoryContent({ inventory, onNavigate, canEditItems, logistics = [], partners = [], initialCategory }: any) {
  const today = new Date().toLocaleDateString('sv-SE');
  const [search, setSearch] = useState(() => sessionStorage.getItem('inventory_search') || '');
  const [filterCategory, setFilterCategory] = useState(() => initialCategory || sessionStorage.getItem('inventory_filterCategory') || '');
  const [filterBrand, setFilterBrand] = useState(() => sessionStorage.getItem('inventory_filterBrand') || '');
  const [filterPartner, setFilterPartner] = useState(() => sessionStorage.getItem('inventory_filterPartner') || '');
  const [filterStartDate, setFilterStartDate] = useState(() => sessionStorage.getItem('inventory_filterStartDate') || today);
  const [filterEndDate, setFilterEndDate] = useState(() => sessionStorage.getItem('inventory_filterEndDate') || today);
  const startDatePickerRef = React.useRef<HTMLInputElement>(null);
  const endDatePickerRef = React.useRef<HTMLInputElement>(null);

  const handleStartDateClick = () => {
    if (startDatePickerRef.current) {
      if ('showPicker' in startDatePickerRef.current) {
        try {
          (startDatePickerRef.current as any).showPicker();
        } catch (e) {
          startDatePickerRef.current.click();
        }
      } else {
        startDatePickerRef.current.click();
      }
    }
  };

  const handleEndDateClick = () => {
    if (endDatePickerRef.current) {
      if ('showPicker' in endDatePickerRef.current) {
        try {
          (endDatePickerRef.current as any).showPicker();
        } catch (e) {
          endDatePickerRef.current.click();
        }
      } else {
        endDatePickerRef.current.click();
      }
    }
  };
  const [activeShift, setActiveShift] = useState(() => sessionStorage.getItem('inventory_activeShift') || '일간');
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem('inventory_currentPage');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'shortage' | 'replenish' | 'normal'>(() => {
    return (sessionStorage.getItem('inventory_stockStatusFilter') as any) || 'all';
  });

  const isFirstRender = React.useRef(true);

  // Reset page when filters change (ignoring the initial mount render)
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setCurrentPage(1);
  }, [search, filterCategory, filterBrand, filterPartner, filterStartDate, filterEndDate, stockStatusFilter]);

  React.useEffect(() => {
    if (initialCategory) {
      setFilterCategory(initialCategory);
      sessionStorage.setItem('inventory_filterCategory', initialCategory);
    }
  }, [initialCategory]);

  // Sync state changes to sessionStorage
  React.useEffect(() => {
    sessionStorage.setItem('inventory_search', search);
  }, [search]);

  React.useEffect(() => {
    sessionStorage.setItem('inventory_filterCategory', filterCategory);
  }, [filterCategory]);

  React.useEffect(() => {
    sessionStorage.setItem('inventory_filterBrand', filterBrand);
  }, [filterBrand]);

  React.useEffect(() => {
    sessionStorage.setItem('inventory_filterPartner', filterPartner);
  }, [filterPartner]);

  React.useEffect(() => {
    sessionStorage.setItem('inventory_filterStartDate', filterStartDate);
  }, [filterStartDate]);

  React.useEffect(() => {
    sessionStorage.setItem('inventory_filterEndDate', filterEndDate);
  }, [filterEndDate]);

  React.useEffect(() => {
    sessionStorage.setItem('inventory_activeShift', activeShift);
  }, [activeShift]);

  React.useEffect(() => {
    sessionStorage.setItem('inventory_stockStatusFilter', stockStatusFilter);
  }, [stockStatusFilter]);

  React.useEffect(() => {
    sessionStorage.setItem('inventory_currentPage', String(currentPage));
  }, [currentPage]);

  const ITEMS_PER_PAGE = 10;

  const handleDownloadExcel = () => {
    try {
      const fileName = `재고관리_리포트_${today}_${activeShift}.xlsx`;
      
      const data = filtered.map(item => {
        const unit = (item.unit || 'KG').toUpperCase();
        return {
          '날짜': item.updatedAt?.seconds ? new Date(item.updatedAt.seconds * 1000).toISOString().split('T')[0] : '-',
          '품목명': item.name,
          'SKU': item.sku || '-',
          '카테고리': item.category || '-',
          '규격': item.specs || '-',
          '브랜드': item.brand || '-',
          '현재고': item.currentStock || 0,
          '안전재고': item.safetyStock || 0,
          '단위': unit,
          '상태': item.currentStock < (item.safetyStock || 0) ? '재고부족' : '정상'
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "재고리스트");
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Excel download failed:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  const categories = useMemo(() => {
    const cats = inventory
      .map((i: any) => i.category)
      .filter((cat: any) => cat && cat !== '완제품');
    return Array.from(new Set(cats));
  }, [inventory]);

  const brands = useMemo(() => {
    const bnds = inventory
      .filter((i: any) => i.category !== '완제품')
      .map((i: any) => i.brand)
      .filter(Boolean);
    return Array.from(new Set(bnds));
  }, [inventory]);

  const partnersList = useMemo(() => {
    const pts = new Set<string>();
    if (partners && partners.length > 0) {
      partners.forEach((p: any) => {
        if (p.name) pts.add(p.name);
      });
    }
    inventory.forEach((i: any) => {
      if (i.partner && i.category !== '완제품') pts.add(i.partner);
    });
    return Array.from(pts).sort();
  }, [partners, inventory]);

  const baseFiltered = useMemo(() => {
    return inventory
      .filter((i: any) => i.category !== '완제품')
      .filter((i: any) => {
        const matchesSearch = (i.name || '').toLowerCase().includes(search.toLowerCase()) || 
                             (i.sku || '').toLowerCase().includes(search.toLowerCase()) ||
                             (i.brand || '').toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !filterCategory || i.category === filterCategory;
        const matchesBrand = !filterBrand || i.brand === filterBrand;
        const matchesPartner = !filterPartner || i.partner === filterPartner;
        return matchesSearch && matchesCategory && matchesBrand && matchesPartner;
      });
  }, [inventory, search, filterCategory, filterBrand, filterPartner]);

  const statusCounts = useMemo(() => {
    let shortage = 0;
    let replenish = 0;
    let normal = 0;

    baseFiltered.forEach((item: any) => {
      const current = item.currentStock || 0;
      const safety = item.safetyStock || 0;
      const isShortage = current < safety;
      const isReplenish = safety > 0 && current >= safety && current <= safety * 1.2;

      if (isShortage) {
        shortage++;
      } else if (isReplenish) {
        replenish++;
      } else {
        normal++;
      }
    });

    return {
      all: baseFiltered.length,
      shortage,
      replenish,
      normal
    };
  }, [baseFiltered]);

  const filtered = useMemo(() => {
    let result = baseFiltered;

    if (stockStatusFilter !== 'all') {
      result = result.filter((item: any) => {
        const current = item.currentStock || 0;
        const safety = item.safetyStock || 0;
        const isShortage = current < safety;
        const isReplenish = safety > 0 && current >= safety && current <= safety * 1.2;
        
        if (stockStatusFilter === 'shortage') return isShortage;
        if (stockStatusFilter === 'replenish') return isReplenish;
        if (stockStatusFilter === 'normal') return !isShortage && !isReplenish;
        return true;
      });
    }

    // Sort by shortage/replenish/normal priority, then by latest update
    return [...result].sort((a: any, b: any) => {
      const getPriority = (item: any) => {
        const current = item.currentStock || 0;
        const safety = item.safetyStock || 0;
        if (current < safety) return 1;
        if (safety > 0 && current >= safety && current <= safety * 1.2) return 2;
        return 3;
      };

      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      const timeA = a.updatedAt?.seconds || 0;
      const timeB = b.updatedAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [baseFiltered, stockStatusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const Pagination = ({ current, total, totalItems, itemsPerPage, onChange }: { current: number; total: number; totalItems: number; itemsPerPage: number; onChange: (p: number) => void }) => {
    if (total <= 1) return null;
    
    const startItem = (current - 1) * itemsPerPage + 1;
    const endItem = Math.min(current * itemsPerPage, totalItems);

    const getVisiblePages = () => {
      const pages = [];
      const delta = 1;
      for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
          pages.push(i);
        }
      }
      return pages;
    };

    const visiblePages = getVisiblePages();

    return (
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4">
        <div className="text-[10px] md:text-xs font-black text-outline uppercase tracking-widest order-2 md:order-1">
          {totalItems.toLocaleString()}개 항목 중 {startItem}-{endItem} 번호 표시 중
        </div>
        <div className="flex items-center gap-2 order-1 md:order-2">
          <button 
            disabled={current === 1}
            onClick={() => onChange(current - 1)}
            className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="flex items-center gap-1.5">
            {visiblePages.map((p, i) => (
              <React.Fragment key={p}>
                {i > 0 && visiblePages[i - 1] !== p - 1 && (
                  <span className="text-outline/40 font-black px-1">...</span>
                )}
                <button
                  onClick={() => onChange(p)}
                  className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${current === p ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white border border-outline-variant text-outline hover:border-primary hover:text-primary'}`}
                >
                  {p}
                </button>
              </React.Fragment>
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
      </div>
    );
  };

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
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-6 px-1 md:px-0">
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 md:p-3 bg-[#e8effd] hover:bg-[#d0e0fb] text-[#0f172a] rounded-full transition-colors shrink-0 active:scale-90">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl md:text-5xl font-black text-on-surface tracking-tighter">재고관리</h1>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={handleDownloadExcel}
            className="flex-none flex items-center justify-center gap-2 px-4 h-11 bg-white border border-outline-variant rounded-xl text-sm font-bold text-on-surface hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95"
            title="엑셀 다운"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline font-black">엑셀 다운</span>
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
        {summaryStats.map((stat, idx) => (
          <div 
            key={idx} 
            className="bg-white p-3 md:p-10 rounded-[20px] md:rounded-[32px] border border-outline-variant shadow-sm transition-all flex flex-col items-center justify-center gap-1 md:gap-4 group hover:shadow-md relative overflow-hidden min-h-[90px] sm:min-h-[180px] md:min-h-[220px]"
          >
            <div className={`absolute top-0 left-0 w-full h-1 md:h-1.5 ${stat.isAlert ? 'bg-rose-500' : stat.isSuccess ? 'bg-emerald-500' : idx === 0 ? 'bg-[#94a3b8]' : 'bg-[#3b82f6]'}`} />
            <p className="text-[8px] md:text-[11px] font-black text-outline uppercase tracking-tight text-center truncate w-full px-1">{stat.label}</p>
            <div className="flex items-baseline justify-center gap-1 md:gap-2 w-full overflow-hidden">
              <span className={`text-xl md:text-5xl font-black tabular-nums tracking-tighter leading-none truncate ${stat.isAlert ? 'text-rose-600' : stat.isSuccess ? 'text-emerald-600' : 'text-on-surface'}`}>
                {Math.round(stat.value).toLocaleString()}
              </span>
              <span className="text-[8px] md:text-sm font-black text-outline uppercase shrink-0">{stat.unit}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Inventory Table */}
      <section className="space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 px-1 md:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black text-[#0f172a] tracking-tight whitespace-nowrap">재고리스트</h3>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 flex-1">
              <select 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
                className="h-11 px-3 bg-white border border-outline-variant rounded-xl text-[11px] font-bold focus:border-primary outline-none cursor-pointer shadow-sm appearance-none min-w-[120px]"
              >
                <option value="">전체 카테고리</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select 
                value={filterBrand} 
                onChange={(e) => setFilterBrand(e.target.value)}
                className="h-11 px-3 bg-white border border-outline-variant rounded-xl text-[11px] font-bold focus:border-primary outline-none cursor-pointer shadow-sm appearance-none min-w-[100px]"
              >
                <option value="">전체 브랜드</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>

              <select 
                value={filterPartner} 
                onChange={(e) => setFilterPartner(e.target.value)}
                className="h-11 px-3 bg-white border border-outline-variant rounded-xl text-[11px] font-bold focus:border-primary outline-none cursor-pointer shadow-sm appearance-none min-w-[110px]"
              >
                <option value="">전체 거래처</option>
                {partnersList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <div className="relative flex-1 md:flex-none md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                <input 
                  type="text" 
                  placeholder="품목명/SKU..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-white border border-outline-variant rounded-xl text-xs font-bold outline-none focus:border-primary transition-all shadow-sm" 
                />
              </div>

              <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                <div className="relative group flex-1 sm:flex-none">
                  <input 
                    ref={startDatePickerRef}
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => {
                      setFilterStartDate(e.target.value);
                      setActiveShift('');
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 pointer-events-none appearance-none"
                  />
                  <button 
                    onClick={handleStartDateClick}
                    className="w-full flex items-center justify-center gap-2 px-3 h-11 bg-white border border-outline-variant rounded-xl text-xs font-bold text-on-surface group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/10 transition-all whitespace-nowrap cursor-pointer"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-primary" />
                    <span className="font-black">{filterStartDate.split('-').slice(1).join('/')}</span>
                  </button>
                </div>

                <span className="text-outline font-black text-xs">~</span>

                <div className="relative group flex-1 sm:flex-none">
                  <input 
                    ref={endDatePickerRef}
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => {
                      setFilterEndDate(e.target.value);
                      setActiveShift('');
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 pointer-events-none appearance-none"
                  />
                  <button 
                    onClick={handleEndDateClick}
                    className="w-full flex items-center justify-center gap-2 px-3 h-11 bg-white border border-outline-variant rounded-xl text-xs font-bold text-on-surface group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/10 transition-all whitespace-nowrap cursor-pointer"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-primary" />
                    <span className="font-black">{filterEndDate.split('-').slice(1).join('/')}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 sm:flex-none flex bg-surface-container p-1 rounded-xl border border-outline-variant h-11 items-center shrink-0">
                {[
                  { label: '일간', action: () => {
                    setFilterStartDate(today);
                    setFilterEndDate(today);
                  }},
                  { label: '주간', action: () => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setFilterStartDate(d.toISOString().split('T')[0]);
                    setFilterEndDate(today);
                  }},
                  { label: '월간', action: () => {
                    const d = new Date();
                    const first = new Date(d.getFullYear(), d.getMonth(), 1);
                    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                    setFilterStartDate(first.toISOString().split('T')[0]);
                    setFilterEndDate(last.toISOString().split('T')[0]);
                  }}
                ].map((shift) => (
                  <button
                    key={shift.label}
                    onClick={() => {
                      setActiveShift(shift.label);
                      shift.action();
                    }}
                    className={`flex-1 sm:flex-none px-4 md:px-5 h-full rounded-lg text-[10px] md:text-xs font-black transition-all whitespace-nowrap flex items-center justify-center ${activeShift === shift.label ? 'bg-primary text-white shadow-sm' : 'text-outline hover:text-primary'}`}
                  >
                    {shift.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setStockStatusFilter('all'); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all flex items-center gap-1.5 ${
              stockStatusFilter === 'all'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-slate-100 text-[#0f172a] hover:bg-slate-200'
            }`}
          >
            전체
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${stockStatusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {statusCounts.all}
            </span>
          </button>
          <button
            onClick={() => { setStockStatusFilter('shortage'); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all flex items-center gap-1.5 ${
              stockStatusFilter === 'shortage'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
            }`}
          >
            부족
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${stockStatusFilter === 'shortage' ? 'bg-white/20 text-rose-100' : 'bg-rose-100 text-rose-600'}`}>
              {statusCounts.shortage}
            </span>
          </button>
          <button
            onClick={() => { setStockStatusFilter('replenish'); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all flex items-center gap-1.5 ${
              stockStatusFilter === 'replenish'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            보충
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${stockStatusFilter === 'replenish' ? 'bg-white/20 text-blue-100' : 'bg-blue-100 text-blue-600'}`}>
              {statusCounts.replenish}
            </span>
          </button>
          <button
            onClick={() => { setStockStatusFilter('normal'); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all flex items-center gap-1.5 ${
              stockStatusFilter === 'normal'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            정상
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${stockStatusFilter === 'normal' ? 'bg-white/20 text-emerald-100' : 'bg-emerald-100 text-emerald-600'}`}>
              {statusCounts.normal}
            </span>
          </button>
        </div>

        <div className="bg-white rounded-[40px] border border-outline-variant overflow-hidden shadow-xl shadow-surface-container-high/50 p-2 md:p-0">
          <div className="w-full">
            {/* Desktop View Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead className="bg-[#f1f4f9] text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-5">날짜</th>
                    <th className="px-4 py-5 font-medium text-left">품목 정보</th>
                    <th className="px-4 py-5 font-medium">규격</th>
                    <th className="px-4 py-5 font-medium">카테고리</th>
                    <th className="px-4 py-5 font-medium text-right pr-8">현재 재고</th>
                    <th className="px-4 py-5 font-medium text-right pr-8">박스 수</th>
                    <th className="px-4 py-5 font-medium">상태</th>
                    <th className="px-4 py-5 font-medium">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-surface-container/5 transition-colors">
                        <td className="px-4 py-4 text-[11px] font-bold text-outline tabular-nums whitespace-nowrap">
                          {item.updatedAt?.seconds ? new Date(item.updatedAt.seconds * 1000).toISOString().split('T')[0] : '-'}
                        </td>
                      <td className="px-4 py-4 text-left">
                        <div className="font-black text-on-surface text-base leading-tight">{item.name}</div>
                        {item.brand && <div className="text-[10px] font-bold text-primary mt-1">{item.brand}</div>}
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-outline">
                        {item.specs || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 bg-surface-container rounded-lg text-[9px] font-black text-outline uppercase">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-black text-lg text-right pr-8">
                        {Math.round(item.currentStock || 0).toLocaleString()}
                        <span className="text-[11px] font-semibold text-primary bg-primary/5 dark:bg-primary/10 px-1.5 py-0.5 rounded-md ml-1.5 align-middle uppercase">
                          {(item.unit || 'KG').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-black text-lg text-slate-700 text-right pr-8">
                        {item.category === '원육' ? (
                          <span>
                            {(item.boxes || 0).toLocaleString()}
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md ml-1.5 align-middle uppercase">
                              BOX
                            </span>
                          </span>
                        ) : '-'}
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
                              <button onClick={() => onNavigate('detail', item)} className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-all active:scale-90" title="상세/수정">
                                <Edit className="w-5 h-5" />
                              </button>
                              <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-all active:scale-90" title="삭제">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => onNavigate('detail', item)} className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-all active:scale-90">
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

            <div className="md:hidden space-y-3 p-1">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item: any, i: number) => (
                  <div key={i} className="bg-white p-4 rounded-[24px] border border-outline-variant/60 shadow-sm space-y-3 relative overflow-hidden group transition-all active:scale-[0.98] active:bg-slate-50">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.currentStock < (item.safetyStock || 0) ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[8px] font-black text-primary font-mono bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                            {item.updatedAt?.seconds ? new Date(item.updatedAt.seconds * 1000).toISOString().split('T')[0] : '날짜미정'}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-[8px] font-black text-outline uppercase">{item.category}</span>
                        </div>
                        <h4 className="text-sm font-black text-[#0f172a] leading-tight break-all">{item.name}</h4>
                        {item.brand && <div className="text-[10px] font-bold text-primary mt-0.5">{item.brand}</div>}
                        <div className="flex items-center gap-2 flex-wrap opacity-70 mt-1">
                          <div className="text-[9px] font-black text-outline">{item.specs || '-'}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => onNavigate('detail', item)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl active:bg-primary/10 active:text-primary transition-all">
                          <Edit className="w-4 h-4" />
                        </button>
                        {canEditItems && (
                          <button onClick={() => handleDeleteItem(item.id, item.name)} className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-400 rounded-xl active:bg-rose-100 active:text-rose-600 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-lg font-black tracking-tight ${item.currentStock < (item.safetyStock || 0) ? 'text-rose-600' : 'text-[#0f172a]'}`}>
                          {Math.round(item.currentStock || 0).toLocaleString()}
                        </span>
                        <span className="text-[9px] font-bold text-outline">{item.unit}</span>
                        {item.category === '원육' && (
                          <span className="text-[11px] font-black text-slate-400 ml-1">/ {(item.boxes || 0).toLocaleString()} BOX</span>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[8px] font-black tracking-tighter uppercase inline-flex items-center gap-1 shadow-sm ${item.currentStock < (item.safetyStock || 0) ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                        <Package className="w-2.5 h-2.5" />
                        {item.currentStock < (item.safetyStock || 0) ? '재고부족' : '정상상태'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center flex flex-col items-center gap-3 opacity-40">
                  <Package className="w-10 h-10" />
                  <p className="text-sm font-black">품목 내역이 없습니다</p>
                </div>
              )}
            </div>
          </div>
          <Pagination 
            current={currentPage} 
            total={totalPages} 
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onChange={setCurrentPage} 
          />
        </div>
    </section>
  </div>
);
}

export default InventoryContent;
