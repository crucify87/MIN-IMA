import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  CalendarDays,
  X,
  History,
  Edit,
  Trash2
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

function ProductionContent({ production, inventory, onNavigate, canEditItems }: any) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [line, setLine] = useState('삼산공장');
  const [rows, setRows] = useState([
    { id: Date.now(), title: '', rawMaterial: '', brand: '', rawQty: '', production: '', manufDate: new Date().toISOString().split('T')[0], expiryDate: '' }
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [loading, setLoading] = useState(false);

  const [filterLine, setFilterLine] = useState('전체');

  const formatWithCommas = (value: string | number) => {
    if (value === '' || value === null || value === undefined) return '';
    const num = String(value).replace(/[^0-9.]/g, '');
    if (!num) return '';
    const parts = num.split('.');
    parts[0] = parseInt(parts[0]).toLocaleString();
    return parts.join('.');
  };

  const filtered = useMemo(() => {
    const result = production.filter((p: any) => {
      const matchesSearch = (p.title || '').toLowerCase().includes(search.toLowerCase());
      const matchesDate = !date || p.manufDate === date;
      const matchesLine = filterLine === '전체' || p.line === filterLine;
      return matchesSearch && matchesDate && matchesLine;
    });

    // Sort by manufDate descending then createdAt (latest first)
    return [...result].sort((a: any, b: any) => {
      if (a.manufDate !== b.manufDate) return b.manufDate.localeCompare(a.manufDate);
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [production, search, date, filterLine]);

  const stats = useMemo(() => {
    const count = filtered.length;
    const totalInput = filtered.reduce((acc: number, curr: any) => acc + (Number(curr.rawQty) || 0), 0);
    const totalOutput = filtered.reduce((acc: number, curr: any) => acc + (Number(curr.production) || 0), 0);
    const yieldRate = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;
    
    return [
      { label: '생산 건수', value: count, unit: '건' },
      { label: '총 투입량', value: totalInput.toLocaleString(), unit: 'KG' },
      { label: '총 생산량', value: totalOutput.toLocaleString(), unit: 'KG' },
      { label: '총 수율', value: yieldRate.toFixed(1), unit: '%' },
    ];
  }, [filtered]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, date, filterLine]);

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
            window.scrollTo({ top: (document.getElementById('production-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
          }}
          className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: total }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => {
                onChange(p);
                window.scrollTo({ top: (document.getElementById('production-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
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
            window.scrollTo({ top: (document.getElementById('production-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
          }}
          className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const addRow = () => {
    setRows([...rows, { id: Date.now(), title: '', rawMaterial: '', brand: '', rawQty: '', production: '', manufDate: new Date().toISOString().split('T')[0], expiryDate: '' }]);
  };

  const removeRow = (id: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: string, value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const setExpiryShortcut = (rowId: number, manufDate: string, months: number) => {
    if (!manufDate) return;
    const date = new Date(manufDate);
    if (isNaN(date.getTime())) return;
    date.setMonth(date.getMonth() + months);
    date.setDate(date.getDate() - 1);
    const expiryDate = date.toISOString().split('T')[0];
    updateRow(rowId, 'expiryDate', expiryDate);
  };

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const updateInventoryStock = async (name: string, diff: number, isRaw: boolean = false) => {
        if (!name) return;
        const trimmedName = name.trim();
        const item = inventory.find((i: any) => i.name === trimmedName);
        if (item) {
          await updateDoc(doc(db, 'inventory', item.id), {
            currentStock: increment(diff),
            updatedAt: serverTimestamp()
          });
        } else {
          // If item doesn't exist, create it
          await addDoc(collection(db, 'inventory'), {
            name: trimmedName,
            currentStock: diff,
            sku: `NEW-${Math.random().toString(36).substring(7).toUpperCase()}`,
            category: isRaw ? '원부재료' : '완제품',
            unit: 'KG',
            minStock: 0,
            location: '미지정',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      };

      if (editingId) {
        const row = rows[0];
        const prodNum = Number(row.production);
        const rawNum = Number(row.rawQty);
        const lossRate = rawNum > 0 ? ((rawNum - prodNum) / rawNum) * 100 : 0;
        const yieldRate = rawNum > 0 ? (prodNum / rawNum) * 100 : 0;

        const oldRecord = production.find((p: any) => p.id === editingId);
        if (oldRecord) {
          // Revert old inventory change
          await updateInventoryStock(oldRecord.title, -oldRecord.production);
          await updateInventoryStock(oldRecord.rawMaterial, oldRecord.rawQty, true);
        }

        // Clean up row data for Firestore
        const { id: _, ...cleanRow } = row;

        await updateDoc(doc(db, 'production_batches', String(editingId)), {
          ...cleanRow,
          line,
          production: prodNum,
          rawQty: rawNum,
          yield: yieldRate,
          loss: lossRate,
          updatedAt: serverTimestamp()
        });

        // Apply new inventory change
        await updateInventoryStock(row.title, prodNum);
        await updateInventoryStock(row.rawMaterial, -rawNum, true);

        alert('생산 실적 수정 완료');
        setEditingId(null);
        setShowForm(false);
        setRows([{ id: Date.now(), title: '', rawMaterial: '', brand: '', rawQty: '', production: '', manufDate: new Date().toISOString().split('T')[0], expiryDate: '' }]);
        return;
      }

      for (const row of rows) {
        if (!row.title || !row.rawQty || !row.production) continue;
        
        const prodNum = Number(row.production); 
        const rawNum = Number(row.rawQty);
        const lossRate = rawNum > 0 ? ((rawNum - prodNum) / rawNum) * 100 : 0;
        const yieldRate = rawNum > 0 ? (prodNum / rawNum) * 100 : 0;

        // Clean up row data for Firestore
        const { id: _, ...cleanRow } = row;

        await addDoc(collection(db, 'production_batches'), { 
          ...cleanRow, 
          line,
          production: prodNum, 
          rawQty: rawNum, 
          yield: yieldRate,
          loss: lossRate, 
          createdAt: serverTimestamp() 
        });

        // Apply inventory change
        await updateInventoryStock(row.title, prodNum);
        await updateInventoryStock(row.rawMaterial, -rawNum, true);
      }
      alert('생산 실적 등록 완료'); 
      setShowForm(false);
      setRows([{ id: Date.now(), title: '', rawMaterial: '', brand: '', rawQty: '', production: '', manufDate: new Date().toISOString().split('T')[0], expiryDate: '' }]);
    } catch (error) { 
      handleFirestoreError(error, OperationType.WRITE, 'production_batches'); 
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setLine(item.line || '삼산공장');
    setRows([{
      id: Date.now(),
      title: item.title,
      rawMaterial: item.rawMaterial,
      brand: item.brand || '',
      rawQty: item.rawQty,
      production: item.production,
      manufDate: item.manufDate,
      expiryDate: item.expiryDate || ''
    }]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string, title: string) => {
    if (!canEditItems || loading) return;
    
    setLoading(true);
    try {
      const updateInventoryStock = async (name: string, diff: number) => {
        if (!name) return;
        const item = inventory.find((i: any) => i.name === name);
        if (item) {
          await updateDoc(doc(db, 'inventory', item.id), {
            currentStock: increment(diff),
            updatedAt: serverTimestamp()
          });
        }
      };

      const record = production.find((p: any) => p.id === id);
      
      // Perform deletion
      await deleteDoc(doc(db, 'production_batches', String(id)));
      
      // Revert inventory changes if record existed
      if (record) {
        await updateInventoryStock(record.title, -record.production);
        await updateInventoryStock(record.rawMaterial, record.rawQty);
      }
      
      if (editingId === id) {
        setEditingId(null);
        setShowForm(false);
      }
      
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'production_batches');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 md:p-3 bg-[#e8effd] hover:bg-[#d0e0fb] text-[#0f172a] rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl md:text-4xl font-black text-[#0f172a] tracking-tighter">생산관리</h1>
        </div>
        
        {canEditItems && (
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="h-12 md:h-14 px-6 md:px-8 bg-[#0f172a] text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 transition-all active:scale-95 w-full md:w-auto"
          >
            {showForm ? <ChevronDown className="w-5 h-5 md:w-6 md:h-6" /> : <Plus className="w-5 h-5 md:w-6 md:h-6" />}
            {showForm ? '닫기' : '생산일지 등록'}
          </button>
        )}
      </header>

      {/* Entry Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[32px] md:rounded-[48px] border border-outline-variant/30 shadow-2xl p-6 md:p-10 space-y-8 md:space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
            <h2 className="text-2xl md:text-3xl font-black text-[#0f172a] tracking-tight">일지 정보 입력</h2>
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <span className="text-[10px] md:text-sm font-black text-outline uppercase">생산 라인:</span>
              <select value={line} onChange={e => setLine(e.target.value)} className="h-12 md:h-14 px-6 md:px-8 bg-white border border-outline-variant rounded-2xl font-black text-xs md:text-sm shadow-sm outline-none cursor-pointer hover:border-primary transition-all w-full md:w-auto">
                <option value="삼산공장">삼산공장</option>
                <option value="언양공장 부속물">언양공장 부속물</option>
                <option value="언양공장 식육가공">언양공장 식육가공</option>
              </select>
            </div>
          </div>

          <div className="space-y-6">
             <div className="hidden md:grid grid-cols-7 gap-4 px-4">
                {['품목명', '원육정보', '브랜드', '투입량 (KG)', '생산량 (KG)', '수율 (%)', '로스 (%)'].map((label, idx) => (
                   <p key={idx} className={`text-center text-[12px] font-black tracking-tight ${idx === 5 ? 'text-emerald-700' : idx === 6 ? 'text-rose-700' : 'text-outline'}`}>{label}</p>
                ))}
             </div>

             {rows.map((row, index) => {
                const raw = Number(row.rawQty) || 0;
                const prod = Number(row.production) || 0;
                const yieldRate = raw > 0 ? (prod / raw) * 100 : 0;
                const lossRate = raw > 0 ? ((raw - prod) / raw) * 100 : 0;

                return (
                   <div key={row.id} className="relative bg-[#f1f5f9] p-4 md:p-2 rounded-[24px] md:rounded-[32px] border border-outline-variant/30 space-y-4">
                      {index > 0 && <button onClick={() => removeRow(row.id)} className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-all z-10"><X className="w-4 h-4" /></button>}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3">
                         <div className="md:contents space-y-1">
                           <label className="md:hidden text-[10px] font-black text-outline">품목명</label>
                           <div className="flex flex-col gap-1 w-full">
                             <input list="p-items" placeholder="품목명" value={row.title} onChange={e => updateRow(row.id, 'title', e.target.value)} className="h-14 md:h-16 px-4 md:px-6 bg-white border border-outline-variant rounded-2xl font-bold outline-none focus:border-primary transition-all shadow-sm w-full" />
                             {row.title && (
                               <div className="px-2 flex items-center justify-between">
                                 <span className="text-[10px] font-black text-outline uppercase shrink-0">생산품 재고</span>
                                 <span className="text-[10px] font-black text-emerald-600">
                                   {inventory.find((i: any) => i.name === row.title)?.currentStock?.toLocaleString() || 0} KG
                                 </span>
                               </div>
                             )}
                           </div>
                         </div>
                         <div className="md:contents space-y-1">
                           <label className="md:hidden text-[10px] font-black text-outline">원육 정보</label>
                           <div className="flex flex-col gap-1 w-full">
                             <input list="p-items" placeholder="원육 정보" value={row.rawMaterial} onChange={e => updateRow(row.id, 'rawMaterial', e.target.value)} className="h-14 md:h-16 px-4 md:px-6 bg-white border border-outline-variant rounded-2xl font-bold outline-none focus:border-primary transition-all shadow-sm w-full" />
                             {row.rawMaterial && (
                               <div className="px-2 flex items-center justify-between">
                                 <span className="text-[10px] font-black text-outline uppercase shrink-0">원육 재고</span>
                                 {(() => {
                                   const inv = inventory.find((i: any) => i.name === row.rawMaterial);
                                   const stock = inv?.currentStock || 0;
                                   const isLow = stock < (Number(row.rawQty) || 0);
                                   return (
                                     <span className={`text-[10px] font-black ${isLow ? 'text-rose-600' : 'text-blue-600'}`}>
                                       {stock.toLocaleString()} KG
                                     </span>
                                   );
                                 })()}
                               </div>
                             )}
                           </div>
                         </div>
                         <div className="md:contents space-y-1">
                           <label className="md:hidden text-[10px] font-black text-outline">브랜드</label>
                           <input placeholder="브랜드" value={row.brand} onChange={e => updateRow(row.id, 'brand', e.target.value)} className="h-14 md:h-16 px-4 md:px-6 bg-white border border-outline-variant rounded-2xl font-bold outline-none focus:border-primary transition-all shadow-sm w-full" />
                         </div>
                         <div className="md:contents space-y-1">
                           <label className="md:hidden text-[10px] font-black text-outline">투입량 (KG)</label>
                           <input 
                              type="text" 
                              placeholder="0" 
                              value={formatWithCommas(row.rawQty)} 
                              onChange={e => updateRow(row.id, 'rawQty', e.target.value.replace(/[^0-9.]/g, ''))} 
                              className="h-14 md:h-16 px-4 md:px-6 bg-white border border-outline-variant rounded-2xl font-bold text-center outline-none focus:border-primary transition-all shadow-sm w-full" 
                           />
                         </div>
                         <div className="md:contents space-y-1">
                           <label className="md:hidden text-[10px] font-black text-outline">생산량 (KG)</label>
                           <input 
                              type="text" 
                              placeholder="0" 
                              value={formatWithCommas(row.production)} 
                              onChange={e => updateRow(row.id, 'production', e.target.value.replace(/[^0-9.]/g, ''))} 
                              className="h-14 md:h-16 px-4 md:px-6 bg-white border border-outline-variant rounded-2xl font-bold text-center outline-none focus:border-primary transition-all shadow-sm w-full" 
                           />
                         </div>
                         <div className="grid grid-cols-2 md:contents gap-2">
                           <div className="space-y-1 md:contents">
                             <label className="md:hidden text-[10px] font-black text-outline">수율 (%)</label>
                             <div className="h-14 md:h-16 flex items-center justify-center bg-emerald-50 rounded-2xl font-black text-emerald-600 border border-emerald-100 shadow-sm">{yieldRate.toFixed(0)}%</div>
                           </div>
                           <div className="space-y-1 md:contents">
                             <label className="md:hidden text-[10px] font-black text-outline">로스 (%)</label>
                             <div className="h-14 md:h-16 flex items-center justify-center bg-rose-50 rounded-2xl font-black text-rose-600 border border-rose-100 shadow-sm">{lossRate.toFixed(0)}%</div>
                           </div>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div className="flex items-center gap-3 bg-white px-4 md:px-6 h-12 md:h-14 rounded-2xl border border-outline-variant shadow-sm self-start">
                            <span className="text-[10px] font-black text-outline whitespace-nowrap">제조일자</span>
                            <input type="date" value={row.manufDate} onChange={e => updateRow(row.id, 'manufDate', e.target.value)} className="flex-1 bg-transparent font-bold text-xs md:text-sm outline-none" />
                            <CalendarDays className="w-4 h-4 text-outline-variant" />
                         </div>
                         <div className="flex flex-col gap-2">
                           <div className="flex items-center gap-3 bg-white px-4 md:px-6 h-12 md:h-14 rounded-2xl border border-outline-variant shadow-sm">
                              <span className="text-[10px] font-black text-outline whitespace-nowrap">소비기한</span>
                              <input type="date" value={row.expiryDate} onChange={e => updateRow(row.id, 'expiryDate', e.target.value)} className="flex-1 bg-transparent font-bold text-xs md:text-sm outline-none" placeholder="연도-월-일" />
                              <CalendarDays className="w-4 h-4 text-outline-variant" />
                           </div>
                           <div className="flex flex-wrap gap-1.5 px-1">
                             {[1, 3, 6, 12, 24].map((m) => (
                               <button
                                 key={m}
                                 type="button"
                                 onClick={() => setExpiryShortcut(row.id, row.manufDate, m)}
                                 className="px-3 py-1.5 bg-white border border-outline-variant/30 rounded-lg text-[10px] font-black text-on-surface hover:border-primary hover:text-primary transition-all shadow-sm"
                               >
                                 {m >= 12 ? `${m / 12}년` : `${m}개월`}
                               </button>
                             ))}
                           </div>
                         </div>
                      </div>
                   </div>
                );
             })}
          </div>

          <div className="flex flex-col md:flex-row gap-6 pt-4">
             {!editingId && (
                <button onClick={addRow} className="flex-1 h-16 border-2 border-dashed border-outline-variant/50 rounded-2xl font-black text-[#0f172a] hover:bg-slate-50 transition-all flex items-center justify-center gap-3">
                   <Plus className="w-6 h-6" /> 품목 추가 (행 추가)
                </button>
             )}
             <button onClick={handleAdd} className="flex-[2] h-16 bg-[#0f172a] text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-900/10 hover:bg-slate-800 transition-all active:scale-95">
                {editingId ? '수정 사항 저장' : `${rows.length}건 생산 등록`}
             </button>
             {editingId && (
                <>
                  <button 
                    onClick={() => {
                        const rec = production.find((p: any) => p.id === editingId);
                        if (rec) handleDelete(editingId, rec.title);
                    }} 
                    className="flex-1 h-16 bg-rose-50 text-rose-600 rounded-2xl font-black text-lg hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" /> 삭제
                  </button>
                  <button onClick={() => { setEditingId(null); setShowForm(false); }} className="flex-1 h-16 bg-slate-100 text-slate-600 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all">취소</button>
                </>
             )}
          </div>
          <datalist id="p-items">{inventory.map((i: any) => <option key={i.id} value={i.name} />)}</datalist>
        </motion.div>
      )}

      {/* Summary Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-4 md:p-8 rounded-[24px] md:rounded-[40px] shadow-sm border border-outline-variant/30 flex flex-col items-center justify-center gap-2 md:gap-4 transition-all hover:shadow-md min-h-[140px] md:min-h-[200px]">
            <p className="text-[10px] md:text-[11px] font-black text-outline uppercase tracking-tight text-center">{stat.label}</p>
            <div className={`flex items-baseline justify-center gap-2 w-full ${idx === 3 ? 'text-emerald-600' : 'text-[#0f172a]'}`}>
              <span className="text-3xl md:text-5xl font-black tabular-nums tracking-tighter leading-none">{stat.value}</span>
              <span className="text-xs md:text-sm font-black text-outline uppercase shrink-0">{stat.unit}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Recent Production Log */}
      <section id="production-list" className="space-y-6">
        <section className="bg-[#e8f1ff] p-4 md:p-6 rounded-[24px] md:rounded-[32px] shadow-inner border border-primary/5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="품목명 검색..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="w-full h-12 pl-11 pr-4 bg-white border border-outline-variant/30 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all shadow-sm" 
              />
            </div>
            
            <div className="relative">
              <select 
                value={filterLine} 
                onChange={(e) => setFilterLine(e.target.value)}
                className="w-full h-12 px-4 bg-white border border-outline-variant/30 rounded-xl text-xs font-black appearance-none focus:border-primary outline-none shadow-sm cursor-pointer"
              >
                {['전체', '삼산공장', '언양공장 부속물', '언양공장 식육가공'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-outline" />
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 h-12 bg-white border border-outline-variant/30 rounded-xl text-sm font-bold text-on-surface shadow-sm w-full">
              <CalendarDays className="w-4 h-4 text-outline" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent border-none outline-none text-sm font-bold flex-1" />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-black text-[#0f172a] tracking-tight">생산리스트</h3>
          </div>
        </div>

        <div className="bg-white rounded-[32px] md:rounded-[40px] border border-outline-variant overflow-hidden shadow-xl shadow-surface-container-high/50 p-2 md:p-0">
          <div className="w-full">
            {/* Desktop View Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead className="bg-[#f1f4f9] text-[10px] md:text-[11px] font-black text-outline uppercase tracking-widest border-b border-outline-variant">
                  <tr>
                    <th className="px-6 py-8">SKU / 라인</th>
                    <th className="px-6 py-8">품목명</th>
                    <th className="px-6 py-8">원육/브랜드</th>
                    <th className="px-6 py-8">투입량</th>
                    <th className="px-6 py-8">생산량</th>
                    <th className="px-6 py-8">수율</th>
                    <th className="px-6 py-8">로스</th>
                    <th className="px-6 py-8">제조일자</th>
                    <th className="px-6 py-8">소비기한</th>
                    <th className="px-6 py-8">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {paginatedItems.map((item: any, idx: number) => {
                    const itemData = inventory.find((inv: any) => inv.name === item.title);
                    return (
                      <tr key={item.id || idx} className="hover:bg-surface-container/5 transition-colors">
                        <td className="px-6 py-6">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-bold text-primary font-mono">{itemData?.sku || 'N/A'}</span>
                            <span className="text-[11px] font-black text-[#0f172a]">{item.line || '기본'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="font-black text-[#0f172a]">{item.title}</div>
                          <div className="text-[10px] font-bold text-outline uppercase tracking-tight">{itemData?.specs || ''}</div>
                        </td>
                        <td className="px-6 py-6 text-sm">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-[#0f172a]">{item.rawMaterial || '-'}</span>
                            <span className="text-[10px] text-outline-variant">{item.brand || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-6 font-bold text-outline-variant">{item.rawQty?.toLocaleString()} KG</td>
                        <td className="px-6 py-6 font-black text-[#0f172a]">{item.production?.toLocaleString()} KG</td>
                        <td className="px-6 py-6"><span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-xs">{item.yield?.toFixed(1) || 0}%</span></td>
                        <td className="px-6 py-6"><span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg font-black text-xs">{item.loss?.toFixed(1) || 0}%</span></td>
                        <td className="px-6 py-6 text-sm font-bold text-outline">{item.manufDate}</td>
                        <td className="px-6 py-6 text-sm font-bold text-outline">{item.expiryDate || '-'}</td>
                        <td className="px-6 py-6">
                          {canEditItems && (
                            <div className="flex items-center justify-center gap-2">
                               <button onClick={() => handleEdit(item)} disabled={loading} className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all disabled:opacity-30" title="수정"><Edit className="w-5 h-5" /></button>
                               <button onClick={() => handleDelete(item.id, item.title)} disabled={loading} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-30" title="삭제"><Trash2 className="w-5 h-5" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-3">
              {paginatedItems.map((item: any, idx: number) => {
                const itemData = inventory.find((inv: any) => inv.name === item.title);
                return (
                  <div key={item.id || idx} className="bg-white p-5 rounded-[28px] border border-outline-variant/60 shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-primary font-mono">{itemData?.sku || 'N/A'}</span>
                          <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[8px] font-black text-outline uppercase">{item.line}</span>
                        </div>
                        <h4 className="text-base font-black text-[#0f172a]">{item.title}</h4>
                        {itemData?.specs && <div className="text-[10px] font-black text-emerald-600/70 uppercase tracking-tight">{itemData.specs}</div>}
                        <div className="text-[10px] font-bold text-outline flex gap-2">
                          <span>원육: {item.rawMaterial || '-'}</span>
                          <span>브랜드: {item.brand || '-'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(item)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl active:bg-primary/10 active:text-primary transition-all">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(item.id, item.title)} className="p-2.5 bg-rose-50 text-rose-400 rounded-xl active:bg-rose-100 active:text-rose-600 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                      <div className="bg-slate-50/50 p-3 rounded-2xl">
                        <div className="text-[9px] font-black text-outline uppercase tracking-wider mb-1">투입 / 생산</div>
                        <div className="text-sm font-black text-[#0f172a]">
                          {item.rawQty?.toLocaleString()} <span className="text-[10px]">→</span> {item.production?.toLocaleString()} <span className="text-[10px]">KG</span>
                        </div>
                      </div>
                      <div className="bg-emerald-50/50 p-3 rounded-2xl">
                        <div className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mb-1">수율 / 로스</div>
                        <div className="text-sm font-black text-emerald-700">
                          {item.yield?.toFixed(1)}% <span className="text-[10px] text-rose-600">({item.loss?.toFixed(1)}%)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold text-outline pt-1">
                      <div>제조: <span className="text-[#0f172a]">{item.manufDate}</span></div>
                      <div>기한: <span className="text-[#0f172a]">{item.expiryDate || '-'}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProductionContent;
