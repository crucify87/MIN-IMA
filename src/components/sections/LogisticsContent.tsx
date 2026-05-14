import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft,
  Plus,
  Search,
  CalendarDays,
  Edit,
  Trash2,
  Package,
  ChevronDown,
  History
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  doc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  collection, 
  addDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError } from '../../lib/firestoreUtils';
import { OperationType } from '../../types';

function LogisticsContent({ logistics, inventory, partners, onNavigate, canEditItems }: any) {
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeRange, setActiveRange] = useState('일간');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterBrand, startDate, endDate, activeRange]);

  const today = new Date().toISOString().split('T')[0];

  const filtered = useMemo(() => {
    return logistics.filter((l: any) => {
      const matchesSearch = l.item.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !filterCategory || l.category === filterCategory;
      const matchesBrand = !filterBrand || l.brand === filterBrand;
      const matchesDate = l.date >= startDate && l.date <= endDate;
      return matchesSearch && matchesCategory && matchesBrand && matchesDate;
    });
  }, [logistics, search, filterCategory, filterBrand, startDate, endDate]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const Pagination = ({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) => {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-8 pb-4">
        <button 
          disabled={current === 1}
          onClick={() => {
            onChange(current - 1);
            window.scrollTo({ top: (document.getElementById('logistics-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
          }}
          className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: total }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => {
                onChange(p);
                window.scrollTo({ top: (document.getElementById('logistics-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
              }}
              className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${current === p ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white border border-outline-variant text-outline hover:border-primary hover:text-primary'}`}
            >
              {p}
            </button>
          ))}
        </div>
        <button 
          disabled={current === total}
          onClick={() => {
            onChange(current + 1);
            window.scrollTo({ top: (document.getElementById('logistics-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
          }}
          className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
        >
          <ChevronDown className="w-4 h-4 -rotate-90" />
        </button>
      </div>
    );
  };

  React.useEffect(() => {
    const end = new Date();
    let start = new Date();
    
    if (activeRange === '일간') {
      // today only
    } else if (activeRange === '주간') {
      start.setDate(end.getDate() - 7);
    } else if (activeRange === '월간') {
      start.setMonth(end.getMonth() - 1);
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, [activeRange]);

  const [form, setForm] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), 
    type: '입고', 
    item: '', 
    brand: '',
    category: '',
    partner: '', 
    weight: '', 
    freightType: '선불' 
  });

  const summary = useMemo(() => {
    const totalWeight = filtered.reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    const inputCount = filtered.filter((l: any) => l.type === '입고').length;
    const outputCount = filtered.filter((l: any) => l.type === '출고').length;
    return { totalWeight, inputCount, outputCount };
  }, [filtered]);

  const categories = useMemo(() => {
    const cats = inventory.map((i: any) => i.category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [inventory]);

  const brands = useMemo(() => {
    const bnds = inventory.map((i: any) => i.brand).filter(Boolean);
    return Array.from(new Set(bnds));
  }, [inventory]);

  const filteredCategories = useMemo(() => {
    if (!form.category) return categories;
    return categories.filter(c => c.toLowerCase().includes(form.category.toLowerCase()));
  }, [categories, form.category]);

  const filteredBrands = useMemo(() => {
    if (!form.brand) return brands;
    return brands.filter(b => b.toLowerCase().includes(form.brand.toLowerCase()));
  }, [brands, form.brand]);
  
  const handleAdd = async (e: any) => {
    e.preventDefault();
    try {
      const itemName = form.item.trim();
      const weightNum = Number(form.weight);
      
      const updateInventoryStock = async (name: string, diff: number) => {
        const item = inventory.find((i: any) => i.name === name);
        if (item) {
          await updateDoc(doc(db, 'inventory', item.id), {
            currentStock: increment(diff),
            brand: form.brand || item.brand || '',
            category: form.category || item.category || '미분류',
            updatedAt: serverTimestamp()
          });
        } else {
          // If item doesn't exist in inventory, create it
          await addDoc(collection(db, 'inventory'), {
            name: name,
            currentStock: diff,
            brand: form.brand || '',
            category: form.category || '미분류',
            sku: `NEW-${Math.random().toString(36).substring(7).toUpperCase()}`,
            unit: 'KG',
            minStock: 0,
            location: '미지정',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      };

      if (editingId) {
        const oldRecord = logistics.find((l: any) => l.id === editingId);
        if (oldRecord) {
          // Revert old inventory change
          await updateInventoryStock(oldRecord.item, oldRecord.type === '입고' ? -oldRecord.weight : oldRecord.weight);
        }
        
        await updateDoc(doc(db, 'logistics', editingId), { 
          ...form,
          item: itemName,
          weight: weightNum, 
          updatedAt: serverTimestamp() 
        });

        // Apply new inventory change
        await updateInventoryStock(itemName, form.type === '입고' ? weightNum : -weightNum);

        alert('수정 완료');
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'logistics'), { 
          ...form, 
          item: itemName,
          weight: weightNum, 
          status: '완료', 
          createdAt: serverTimestamp() 
        });

        await updateInventoryStock(itemName, form.type === '입고' ? weightNum : -weightNum);
        
        alert('등록 완료');
      }
      
      setShowForm(false);
      setForm({ 
        date: new Date().toISOString().split('T')[0], 
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), 
        type: '입고', 
        item: '', 
        brand: '',
        category: '',
        partner: '', 
        weight: '', 
        freightType: '선불' 
      });
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'logistics'); }
  };

  const handleEdit = (l: any) => {
    setEditingId(l.id);
    setForm({
      date: l.date,
      time: l.time,
      type: l.type,
      item: l.item,
      brand: l.brand || '',
      category: l.category || '',
      partner: l.partner,
      weight: l.weight.toString(),
      freightType: l.freightType || '선불'
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (l: any) => {
    if (!window.confirm(`[${l.item}] 물류 기록을 삭제하시겠습니까? (재고가 같이 조정됩니다)`)) return;
    try {
      await deleteDoc(doc(db, 'logistics', l.id));
      const item = inventory.find((i: any) => i.name === l.item);
      if (item) {
        await updateDoc(doc(db, 'inventory', item.id), {
          currentStock: increment(l.type === '입고' ? -l.weight : l.weight),
          updatedAt: serverTimestamp()
        });
      }
      alert('삭제 완료');
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'logistics'); }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 md:p-3 bg-[#e8effd] hover:bg-[#d0e0fb] text-[#0f172a] rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl md:text-4xl font-black text-[#0f172a] tracking-tighter">물류현황</h1>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant shadow-sm shrink-0">
            {['일간', '주간', '월간'].map((range) => (
              <button
                key={range}
                onClick={() => setActiveRange(range)}
                className={`px-5 py-2 rounded-lg font-black text-xs transition-all ${activeRange === range ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}
              >
                {range}
              </button>
            ))}
          </div>

          {canEditItems && (
            <button 
              onClick={() => setShowForm(!showForm)} 
              className="h-12 md:h-14 px-6 md:px-8 bg-[#0f172a] text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg hover:bg-slate-800 transition-all active:scale-95 w-full md:w-auto"
            >
              <Plus className="w-5 h-5 md:w-6 md:h-6" /> 
              {showForm ? '닫기' : '신규 입고/출고'}
            </button>
          )}
        </div>
      </header>

      {/* Form Overlay */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[40px] border-2 border-[#0f172a]/10 shadow-2xl space-y-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
             <div className="space-y-1">
               <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">날짜</label>
               <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all" />
             </div>
             
             <div className="space-y-1">
               <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">구분</label>
               <div className="flex bg-surface-container p-1 rounded-xl h-12">
                 {['입고', '출고'].map((t) => (
                   <button 
                     key={t}
                     type="button"
                     onClick={() => setForm({...form, type: t})}
                     className={`flex-1 rounded-lg font-black text-xs transition-all ${form.type === t ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}
                   >
                     {t}
                   </button>
                 ))}
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">품목명</label>
               <input 
                 required 
                 list="l-items" 
                 placeholder="품목 선택 또는 입력"
                 value={form.item} 
                 onChange={e => {
                   const val = e.target.value;
                   setForm(prev => ({ ...prev, item: val }));
                   
                   // Attempt auto-fill if an inventory item is matched
                   const invItem = inventory.find((it: any) => it.name === val);
                   if (invItem) {
                     setForm(prev => ({
                       ...prev,
                       brand: invItem.brand || prev.brand,
                       category: invItem.category || prev.category
                     }));
                   }
                 }} 
                 className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all" 
               />
               <datalist id="l-items">{inventory.map((i: any) => <option key={i.id} value={i.name} />)}</datalist>
             </div>

             <div className="space-y-1 relative">
               <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">원육 / 생산</label>
               <div className="relative">
                 <input 
                   placeholder="선택 또는 입력"
                   value={form.category} 
                   onChange={e => setForm({...form, category: e.target.value})} 
                   onFocus={() => setShowCategoryDropdown(true)}
                   onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                   className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all pr-10" 
                 />
                 <button 
                   type="button" 
                   onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                   className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-primary transition-colors"
                 >
                   <ChevronDown className={`w-4 h-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                 </button>
               </div>
               {showCategoryDropdown && filteredCategories.length > 0 && (
                 <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-xl z-[60] overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200 max-h-48 overflow-y-auto">
                   {filteredCategories.map((c: string) => (
                     <button
                       key={c}
                       type="button"
                       onClick={() => {
                         setForm({...form, category: c});
                         setShowCategoryDropdown(false);
                       }}
                       className="w-full h-10 flex items-center px-4 text-xs font-bold text-slate-600 hover:bg-[#f1f4f9] hover:text-primary transition-colors text-left"
                     >
                       {c}
                     </button>
                   ))}
                 </div>
               )}
             </div>

             <div className="space-y-1 relative">
               <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">브랜드</label>
               <div className="relative">
                 <input 
                   placeholder="선택 또는 입력"
                   value={form.brand} 
                   onChange={e => setForm({...form, brand: e.target.value})} 
                   onFocus={() => setShowBrandDropdown(true)}
                   onBlur={() => setTimeout(() => setShowBrandDropdown(false), 200)}
                   className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all pr-10" 
                 />
                 <button 
                   type="button" 
                   onClick={() => setShowBrandDropdown(!showBrandDropdown)}
                   className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-primary transition-colors"
                 >
                   <ChevronDown className={`w-4 h-4 transition-transform ${showBrandDropdown ? 'rotate-180' : ''}`} />
                 </button>
               </div>
               {showBrandDropdown && filteredBrands.length > 0 && (
                 <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-xl z-[60] overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200 max-h-48 overflow-y-auto">
                   {filteredBrands.map((b: string) => (
                     <button
                       key={b}
                       type="button"
                       onClick={() => {
                         setForm({...form, brand: b});
                         setShowBrandDropdown(false);
                       }}
                       className="w-full h-10 flex items-center px-4 text-xs font-bold text-slate-600 hover:bg-[#f1f4f9] hover:text-primary transition-colors text-left"
                     >
                       {b}
                     </button>
                   ))}
                 </div>
               )}
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">중량 (KG)</label>
               <input required type="number" step="0.01" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all" />
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">거래처</label>
               <select value={form.partner} onChange={e => setForm({...form, partner: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all">
                 <option value="">거래처 선택</option>
                 {partners.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
               </select>
             </div>

             <div className="lg:col-span-2 flex items-end">
               <button type="submit" className="w-full h-12 bg-[#0f172a] text-white rounded-xl font-black uppercase shadow-lg shadow-[#0f172a]/20 hover:bg-slate-800 transition-all active:scale-[0.98]">
                 {editingId ? '수정 내용 저장' : '등록 완료'}
               </button>
             </div>
          </form>
        </motion.div>
      )}

      {/* Summary Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {[
          { label: `${activeRange} 총 물동량`, value: summary.totalWeight, unit: 'KG' },
          { label: `${activeRange} 입고`, value: summary.inputCount, unit: '건' },
          { label: `${activeRange} 출고`, value: summary.outputCount, unit: '건' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] shadow-sm border border-outline-variant/30 flex flex-col items-center justify-center gap-2 md:gap-4 transition-all hover:shadow-md min-h-[140px] sm:min-h-[180px] md:min-h-[220px]">
            <p className="text-[10px] md:text-[11px] font-black text-outline uppercase tracking-tight text-center">{stat.label}</p>
            <div className="flex items-baseline justify-center gap-2 text-[#0f172a] w-full">
              <span className="text-4xl md:text-5xl font-black tabular-nums tracking-tighter leading-none">{stat.value.toLocaleString()}</span>
              <span className="text-xs md:text-sm font-black text-outline uppercase shrink-0">{stat.unit}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Filter Bar */}
      <section className="bg-[#e8f1ff] p-4 md:p-6 rounded-[24px] md:rounded-[32px] space-y-4 shadow-inner border border-primary/5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="품목명 필터..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-11 pr-4 bg-white border border-outline-variant/30 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all shadow-sm" 
            />
          </div>

          <select 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full h-12 px-4 bg-white border border-outline-variant/30 rounded-xl font-bold text-xs appearance-none focus:border-primary outline-none shadow-sm cursor-pointer"
          >
            <option value="">전체 카테고리</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            value={filterBrand} 
            onChange={e => setFilterBrand(e.target.value)}
            className="w-full h-12 px-4 bg-white border border-outline-variant/30 rounded-xl font-bold text-xs appearance-none focus:border-primary outline-none shadow-sm cursor-pointer"
          >
            <option value="">전체 브랜드</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-12 px-3 bg-white border border-outline-variant/30 rounded-xl text-[11px] font-bold shadow-sm outline-none focus:border-primary transition-all" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12 px-3 bg-white border border-outline-variant/30 rounded-xl text-[11px] font-bold shadow-sm outline-none focus:border-primary transition-all w-full" />
        </div>
      </section>

      {/* Table Area */}
      <section id="logistics-list" className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-[#0f172a]" />
            <h3 className="text-2xl font-black text-[#0f172a] tracking-tight">등록된 물류</h3>
          </div>
        </div>

        <div className="min-h-[400px] flex flex-col rounded-[32px] md:rounded-[48px] border-2 border-dashed border-[#d1d5db] bg-[#f8fafc] p-2 md:p-10">
          {paginatedItems.length > 0 ? (
            <div className="w-full space-y-4">
              {/* Desktop View Table */}
              <div className="hidden md:block bg-white rounded-[32px] border border-outline-variant overflow-hidden shadow-2xl shadow-indigo-900/5">
                <table className="w-full text-center border-collapse">
                  <thead className="bg-[#f1f4f9] text-[11px] font-black text-outline uppercase tracking-widest border-b border-outline-variant">
                    <tr>
                      <th className="px-4 py-8 text-left pl-8">시간</th>
                      <th className="px-4 py-8">구분</th>
                      <th className="px-4 py-8">원육/생산</th>
                      <th className="px-4 py-8">브랜드</th>
                      <th className="px-4 py-8">품목</th>
                      <th className="px-4 py-8">중량</th>
                      <th className="px-4 py-8 text-right pr-8">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {paginatedItems.map((l: any, i: number) => (
                      <tr key={l.id || i} className="hover:bg-surface-container/5 transition-colors">
                        <td className="px-4 py-6 text-xs font-bold text-outline text-left pl-8 whitespace-nowrap">
                          <div className="text-on-surface">{l.date}</div>
                          <div className="text-[10px] opacity-60">{l.time}</div>
                        </td>
                        <td className="px-4 py-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black ${l.type === '입고' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {l.type}
                          </span>
                        </td>
                        <td className="px-4 py-6 text-sm font-bold text-slate-500">{l.category || '-'}</td>
                        <td className="px-4 py-6 text-sm font-bold text-primary">{l.brand || '-'}</td>
                        <td className="px-4 py-6 font-black text-on-surface">{l.item}</td>
                        <td className={`px-4 py-6 font-black text-lg ${l.type === '입고' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {l.type === '입고' ? '+' : '-'}{Number(l.weight || 0).toLocaleString()} KG
                        </td>
                        <td className="px-4 py-6 text-right pr-8">
                          <div className="flex items-center justify-end gap-1">
                             <button onClick={() => handleEdit(l)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-primary rounded-xl transition-all">
                               <Edit className="w-5 h-5" />
                             </button>
                             <button onClick={() => handleDelete(l)} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all">
                               <Trash2 className="w-5 h-5" />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {paginatedItems.map((l: any, i: number) => (
                  <div key={l.id || i} className="bg-white p-5 rounded-[24px] border border-outline-variant shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${l.type === '입고' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {l.type}
                        </span>
                        <div className="text-[10px] font-black text-outline uppercase">{l.date} <span className="opacity-50 ml-1">{l.time}</span></div>
                      </div>
                      <div className="flex items-center gap-1">
                         <button onClick={() => handleEdit(l)} className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                           <Edit className="w-4 h-4" />
                         </button>
                         <button onClick={() => handleDelete(l)} className="p-2 bg-rose-50 text-rose-400 rounded-lg">
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] font-black text-outline uppercase tracking-widest">{l.brand} | {l.category}</div>
                      <div className="text-lg font-black text-[#0f172a]">{l.item}</div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="text-xs font-bold text-slate-400">거래처: <span className="text-[#0f172a]">{l.partner || '-'}</span></div>
                      <div className={`text-xl font-black ${l.type === '입고' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {l.type === '입고' ? '+' : '-'}{Number(l.weight || 0).toLocaleString()} <span className="text-xs uppercase ml-1">KG</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-70">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-md border border-outline-variant/20">
                <Package className="w-10 h-10 text-outline/30" />
              </div>
              <p className="text-xl font-black text-[#0f172a]/50 tracking-tight">
                물류 기록이 존재하지 않거나 필터 결과와 일치하지 않습니다.
              </p>
            </div>
          )}
          <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />
        </div>
      </section>
    </div>
  );
}

export default LogisticsContent;
