import React, { useState, useMemo, useRef } from 'react';
import { 
  ArrowLeft,
  Plus,
  X,
  Search,
  CalendarDays,
  Edit,
  Trash2,
  Package,
  ChevronDown,
  History,
  FileDown
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
import * as XLSX from 'xlsx';
import { db } from '../../lib/firebase';
import { handleFirestoreError } from '../../lib/firestoreUtils';
import { OperationType } from '../../types';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';

function LogisticsContent({ logistics, inventory, partners, onNavigate, canEditItems }: any) {
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeRange, setActiveRange] = useState('일간');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null as any });
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterPartner, setFilterPartner] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
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

  const startDatePickerRef = useRef<HTMLInputElement>(null);
  const endDatePickerRef = useRef<HTMLInputElement>(null);

  const [startDate, setStartDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString('sv-SE'));

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterBrand, filterPartner, startDate, endDate, activeRange]);

  const today = new Date().toLocaleDateString('sv-SE');

  const filtered = useMemo(() => {
    const result = logistics
      .filter((l: any) => {
        const matchesSearch = (l.item || '').toLowerCase().includes(search.toLowerCase()) ||
                             (l.partner || '').toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !filterCategory || l.category === filterCategory;
        const matchesBrand = !filterBrand || l.brand === filterBrand;
        const matchesPartner = !filterPartner || l.partner === filterPartner;
        const matchesDate = l.date >= startDate && l.date <= endDate;
        return matchesSearch && matchesCategory && matchesBrand && matchesPartner && matchesDate;
      });

    // Sort by date then time in reverse (latest first)
    return [...result].sort((a: any, b: any) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });
  }, [logistics, search, filterCategory, filterBrand, filterPartner, startDate, endDate]);

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
            onClick={() => {
              onChange(current - 1);
              window.scrollTo({ top: (document.getElementById('logistics-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
            }}
            className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <div className="flex items-center gap-1.5">
            {visiblePages.map((p, i) => (
              <React.Fragment key={p}>
                {i > 0 && visiblePages[i - 1] !== p - 1 && (
                  <span className="text-outline/40 font-black px-1">...</span>
                )}
                <button
                  onClick={() => {
                    onChange(p);
                    window.scrollTo({ top: (document.getElementById('logistics-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
                  }}
                  className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${current === p ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white border border-outline-variant text-outline hover:border-primary hover:text-primary'}`}
                >
                  {p}
                </button>
              </React.Fragment>
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
    
    setStartDate(start.toLocaleDateString('sv-SE'));
    setEndDate(end.toLocaleDateString('sv-SE'));
  }, [activeRange]);

  const [form, setForm] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), 
    type: '입고', 
    item: '', 
    brand: '',
    category: '',
    partner: '', 
    boxes: '',
    weight: '', 
    freightType: '선불' 
  });

  const formatWithCommas = (value: string | number) => {
    if (value === '' || value === null || value === undefined) return '';
    const num = String(value).replace(/[^0-9]/g, '');
    if (!num) return '';
    return parseInt(num).toLocaleString();
  };

  const handleDownloadExcel = () => {
    try {
      const fileName = `물류관리_리포트_${today}_${activeRange}.xlsx`;
      
      const data = filtered.map(item => {
        const invItem = inventory.find((i: any) => i.name === item.item);
        const unit = (invItem?.unit || 'BOX').toUpperCase();
        return {
          '일자': item.date,
          '시간': item.time,
          '구분': item.type,
          '카테고리': item.category || '-',
          '브랜드': item.brand || '-',
          '품목명': item.item,
          [`수량 (${unit})`]: item.boxes || '-',
          '중량 (KG)': item.weight,
          '거래처': item.partner || '-',
          '운송구분': item.freightType || '-'
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "물류내역");
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Excel download failed:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  const summary = useMemo(() => {
    const totalWeight = filtered.reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    const inputCount = filtered.filter((l: any) => l.type === '입고').length;
    const outputCount = filtered.filter((l: any) => l.type === '출고').length;
    return { totalWeight, inputCount, outputCount };
  }, [filtered]);

  const categories = useMemo(() => {
    const cats = inventory
      .map((i: any) => i.category)
      .filter((cat: any) => cat);
    return Array.from(new Set(cats));
  }, [inventory]);

  const brands = useMemo(() => {
    const bnds = inventory
      .map((i: any) => i.brand)
      .filter(Boolean);
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
      const boxesNum = Number(form.boxes) || 0;
      
      const updateInventoryStock = async (name: string, weightDiff: number, boxesDiff: number) => {
        const item = inventory.find((i: any) => i.name === name);
        if (item) {
          await updateDoc(doc(db, 'inventory', item.id), {
            currentStock: increment(weightDiff),
            boxes: increment(boxesDiff),
            brand: form.brand || item.brand || '',
            category: form.category || item.category || '미분류',
            updatedAt: serverTimestamp()
          });
        } else {
          // If item doesn't exist in inventory, create it
          await addDoc(collection(db, 'inventory'), {
            name: name,
            currentStock: weightDiff,
            boxes: boxesDiff,
            brand: form.brand || '',
            category: form.category || '미분류',
            partner: form.partner || '',
            sku: `NEW-${Math.random().toString(36).substring(7).toUpperCase()}`,
            unit: 'BOX',
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
          await updateInventoryStock(
            oldRecord.item, 
            oldRecord.type === '입고' ? -oldRecord.weight : oldRecord.weight,
            oldRecord.type === '입고' ? -Number(oldRecord.boxes || 0) : Number(oldRecord.boxes || 0)
          );
        }
        
        await updateDoc(doc(db, 'logistics', editingId), { 
          ...form,
          item: itemName,
          weight: weightNum, 
          boxes: boxesNum,
          updatedAt: serverTimestamp() 
        });

        // Apply new inventory change
        await updateInventoryStock(
          itemName, 
          form.type === '입고' ? weightNum : -weightNum,
          form.type === '입고' ? boxesNum : -boxesNum
        );

        alert('수정 완료');
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'logistics'), { 
          ...form, 
          item: itemName,
          weight: weightNum, 
          boxes: boxesNum,
          status: '완료', 
          createdAt: serverTimestamp() 
        });

        await updateInventoryStock(
          itemName, 
          form.type === '입고' ? weightNum : -weightNum,
          form.type === '입고' ? boxesNum : -boxesNum
        );
        
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
        boxes: '',
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
      boxes: l.boxes || '',
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
          boxes: increment(l.type === '입고' ? -Number(l.boxes || 0) : Number(l.boxes || 0)),
          updatedAt: serverTimestamp()
        });
      }
      alert('삭제 완료');
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'logistics'); }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-6 px-1 md:px-0">
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 md:p-3 bg-[#e8effd] hover:bg-[#d0e0fb] text-[#0f172a] rounded-full transition-colors shrink-0 active:scale-90">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="space-y-0.5 md:space-y-1">
            <h1 className="text-3xl md:text-5xl font-black text-on-surface tracking-tighter">물류관리</h1>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full xl:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleDownloadExcel}
              className="flex-none flex items-center justify-center h-11 w-11 sm:w-auto sm:px-4 bg-white border border-outline-variant rounded-xl text-sm font-bold text-on-surface hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95"
              title="엑셀 다운"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline font-black ml-2">엑셀 다운</span>
            </button>

            {canEditItems && (
              <button 
                onClick={() => setShowForm(!showForm)} 
                className="h-11 px-4 sm:px-6 bg-[#0f172a] text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap flex-1 sm:flex-none"
              >
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span className="hidden sm:inline">{showForm ? '닫기' : '신규 입고/출고'}</span>
                <span className="sm:hidden font-black">{showForm ? '닫기' : '등록'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="empty:hidden">
      </div>

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
               <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">품목명 (완제품/원물)</label>
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
                       category: invItem.category || prev.category,
                       partner: invItem.partner || prev.partner
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
               <input 
                  required 
                  type="text" 
                  value={formatWithCommas(form.weight)} 
                  onChange={e => setForm({...form, weight: e.target.value.replace(/[^0-9]/g, '')})} 
                  className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all" 
                />
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">
                 {(() => {
                   const invItem = inventory.find((it: any) => it.name === form.item);
                   const unit = (invItem?.unit || 'BOX').toUpperCase();
                   return unit === 'KG' || unit === 'G' ? '수량' : `${unit} 수`;
                 })()}
               </label>
               <input 
                  type="text" 
                  value={formatWithCommas(form.boxes)} 
                  onChange={e => setForm({...form, boxes: e.target.value.replace(/[^0-9]/g, '')})} 
                  className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all" 
                  placeholder="0"
               />
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-black text-outline uppercase tracking-wider ml-1">거래처</label>
               <select value={form.partner} onChange={e => setForm({...form, partner: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold focus:ring-2 ring-primary/20 outline-none transition-all">
                 <option value="">거래처 선택</option>
                 {partners.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>

              <div className="flex items-end">
                <button type="submit" className="w-full h-12 bg-[#0f172a] text-white rounded-xl font-black uppercase shadow-lg shadow-[#0f172a]/20 hover:bg-slate-800 transition-all active:scale-[0.98]">
                  {editingId ? '수정 내용 저장' : '등록 완료'}
                </button>
              </div>
           </form>
           <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={() => handleDelete(deleteModal.item)}
        title="물류 기록 삭제"
        message={`${deleteModal.item?.item} (${deleteModal.item?.type}) 기록을 삭제하시겠습니까?\n\n※ 삭제 시 해당 품목의 재고가 반창 처리됩니다.`}
      />
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

      {/* Table Area */}
      <section id="logistics-list" className="space-y-6 lg:space-y-8">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 px-1 md:px-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xl md:text-3xl font-black text-[#0f172a] tracking-tight whitespace-nowrap">물류리스트</h3>
            <span className="md:hidden px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-outline uppercase tracking-widest mt-1">LOGISTICS LOGS</span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 w-full xl:w-auto flex-1">
            <select 
              value={filterCategory} 
              onChange={e => setFilterCategory(e.target.value)}
              className="h-11 md:h-12 px-4 bg-white border border-outline-variant rounded-xl font-bold text-[11px] appearance-none focus:border-primary outline-none shadow-sm cursor-pointer flex-1 md:flex-none"
            >
              <option value="">전체 카테고리</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select 
              value={filterBrand} 
              onChange={e => setFilterBrand(e.target.value)}
              className="h-11 md:h-12 px-4 bg-white border border-outline-variant rounded-xl font-bold text-[11px] appearance-none focus:border-primary outline-none shadow-sm cursor-pointer flex-1 md:flex-none"
            >
              <option value="">전체 브랜드</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <select 
              value={filterPartner} 
              onChange={e => setFilterPartner(e.target.value)}
              className="h-11 md:h-12 px-4 bg-white border border-outline-variant rounded-xl font-bold text-[11px] appearance-none focus:border-primary outline-none shadow-sm cursor-pointer flex-1 md:flex-none"
            >
              <option value="">전체 거래처</option>
              {partners.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>

            <div className="relative group flex-1 md:flex-none md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input 
                type="text" 
                placeholder="품목명, 거래처 검색..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="w-full h-11 md:h-12 pl-11 pr-4 bg-white border border-outline-variant rounded-xl text-xs md:text-sm font-bold outline-none focus:border-primary transition-all shadow-sm" 
              />
            </div>

            <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
              <div className="relative group flex-1 sm:flex-none">
                <input 
                  ref={startDatePickerRef}
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActiveRange('');
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none"
                />
                <button 
                  onClick={handleStartDateClick}
                  className="w-full flex items-center justify-center gap-2 px-3 h-11 bg-white border border-outline-variant rounded-xl text-xs font-bold text-on-surface group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/10 transition-all whitespace-nowrap"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-primary" />
                  <span className="font-black">{startDate.split('-').slice(1).join('/')}</span>
                </button>
              </div>

              <span className="text-outline font-black text-xs">~</span>

              <div className="relative group flex-1 sm:flex-none">
                <input 
                  ref={endDatePickerRef}
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActiveRange('');
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none"
                />
                <button 
                  onClick={handleEndDateClick}
                  className="w-full flex items-center justify-center gap-2 px-3 h-11 bg-white border border-outline-variant rounded-xl text-xs font-bold text-on-surface group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/10 transition-all whitespace-nowrap"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-primary" />
                  <span className="font-black">{endDate.split('-').slice(1).join('/')}</span>
                </button>
              </div>
            </div>

            <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant h-11 items-center flex-1 sm:flex-none shrink-0">
              {[
                { label: '일간', action: () => {
                  setStartDate(today);
                  setEndDate(today);
                }},
                { label: '주간', action: () => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setStartDate(d.toISOString().split('T')[0]);
                  setEndDate(today);
                }},
                { label: '월간', action: () => {
                  const d = new Date();
                  const first = new Date(d.getFullYear(), d.getMonth(), 1);
                  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                  setStartDate(first.toISOString().split('T')[0]);
                  setEndDate(last.toISOString().split('T')[0]);
                }}
              ].map((range) => (
                <button
                  key={range.label}
                  onClick={() => {
                    setActiveRange(range.label);
                    range.action();
                  }}
                  className={`flex-1 sm:flex-none px-3 md:px-4 h-full rounded-lg text-[10px] md:text-xs font-black transition-all whitespace-nowrap flex items-center justify-center ${activeRange === range.label ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-[400px] flex flex-col rounded-[28px] md:rounded-[48px] border-2 border-dashed border-[#d1d5db] bg-[#f8fafc] p-1.5 md:p-10">
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
                      <th className="px-4 py-8">규격</th>
                      <th className="px-4 py-8">품목</th>
                      <th className="px-4 py-8">중량</th>
                      <th className="px-4 py-8">수량(단위)</th>
                      <th className="px-4 py-8">거래처</th>
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
                        <td className="px-4 py-6 text-sm font-bold text-slate-500">
                          {l.category ? (
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-600">
                              {l.category}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-6 text-sm font-bold text-primary">{l.brand || '-'}</td>
                        <td className="px-4 py-6 text-xs font-bold text-outline">
                          {inventory?.find((i: any) => i.name === l.item)?.specs || '-'}
                        </td>
                        <td className="px-4 py-6 font-black text-on-surface">{l.item}</td>
                        <td className={`px-4 py-6 font-black text-lg ${l.type === '입고' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {l.type === '입고' ? '+' : '-'}{Number(l.weight || 0).toLocaleString()} KG
                        </td>
                        <td className="px-4 py-6 text-sm font-bold text-slate-500 whitespace-nowrap uppercase">
                          {(() => {
                            const invItem = inventory?.find((i: any) => i.name === l.item);
                            const unit = (invItem?.unit || 'BOX').toUpperCase();
                            return `${Number(l.boxes || 0).toLocaleString()} ${unit}`;
                          })()}
                        </td>
                        <td className="px-4 py-6 text-sm font-bold text-slate-500 whitespace-nowrap">
                          {l.partner || '-'}
                        </td>
                        <td className="px-4 py-6 text-right pr-8">
                          <div className="flex items-center justify-end gap-1">
                             <button onClick={() => handleEdit(l)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-primary rounded-xl transition-all">
                               <Edit className="w-5 h-5" />
                             </button>
                             <button onClick={() => setDeleteModal({ isOpen: true, item: l })} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all">
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
              <div className="md:hidden space-y-3 p-1">
                {paginatedItems.map((l: any, i: number) => (
                  <div key={l.id || i} className="bg-white p-4 rounded-[24px] border border-outline-variant/60 shadow-sm space-y-3 relative overflow-hidden active:scale-[0.98] active:bg-slate-50 transition-all">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${l.type === '입고' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase shadow-sm ${l.type === '입고' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                            {l.type}
                          </span>
                          <div className="text-[10px] font-bold text-outline uppercase tracking-tight font-mono">
                            {l.date} <span className="opacity-40">{l.time}</span>
                          </div>
                        </div>
                        <h4 className="text-sm font-black text-[#0f172a] leading-tight break-all">{l.item}</h4>
                        {l.brand && <div className="text-[10px] font-bold text-primary mt-0.5">{l.brand}</div>}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[9px] font-bold text-outline opacity-70">{l.category}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase">
                            / {Number(l.boxes || 0).toLocaleString()} {(inventory?.find((i: any) => i.name === l.item)?.unit || 'BOX').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 shrink-0">
                         <div className={`text-lg font-black tracking-tighter ${l.type === '입고' ? 'text-emerald-600' : 'text-rose-600'}`}>
                           {l.type === '입고' ? '+' : '-'}{Number(l.weight || 0).toLocaleString()} <span className="text-[10px] font-bold text-outline">KG</span>
                         </div>
                         <div className="flex items-center gap-1">
                           <button onClick={() => handleEdit(l)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl active:bg-primary/10 active:text-primary transition-all">
                             <Edit className="w-4 h-4" />
                           </button>
                           <button onClick={() => setDeleteModal({ isOpen: true, item: l })} className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-400 rounded-xl active:bg-rose-100 active:text-rose-600 transition-all">
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                       <p className="text-[9px] font-bold text-slate-400 truncate flex-1 mr-4">
                         거래처: <span className="text-on-surface font-black">{l.partner || '-'}</span>
                       </p>
                       <span className="text-[8px] font-black text-primary/70 bg-primary/5 px-2 py-0.5 rounded border border-primary/10 uppercase">
                         {inventory?.find((i: any) => i.name === l.item)?.specs || '규격미정'}
                       </span>
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

export default LogisticsContent;
