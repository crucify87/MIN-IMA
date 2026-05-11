import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft,
  Plus,
  ChevronDown,
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
    { id: Date.now(), title: '', rawMaterial: '', rawQty: '', production: '', manufDate: new Date().toISOString().split('T')[0], expiryDate: '' }
  ]);

  const [showAllLogs, setShowAllLogs] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const count = production.length;
    const totalInput = production.reduce((acc: number, curr: any) => acc + (Number(curr.rawQty) || 0), 0);
    const totalOutput = production.reduce((acc: number, curr: any) => acc + (Number(curr.production) || 0), 0);
    const yieldRate = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;
    
    return [
      { label: '생산 건수', value: count, unit: '건' },
      { label: '총 투입량', value: totalInput.toLocaleString(), unit: 'KG' },
      { label: '총 생산량', value: totalOutput.toLocaleString(), unit: 'KG' },
      { label: '총 수율', value: yieldRate.toFixed(1), unit: '%' },
    ];
  }, [production]);

  const filtered = useMemo(() => {
    return production.filter((p: any) => {
      const matchesSearch = (p.title || '').toLowerCase().includes(search.toLowerCase());
      const matchesDate = !date || p.manufDate === date;
      return matchesSearch && matchesDate;
    });
  }, [production, search, date]);

  const addRow = () => {
    setRows([...rows, { id: Date.now(), title: '', rawMaterial: '', rawQty: '', production: '', manufDate: new Date().toISOString().split('T')[0], expiryDate: '' }]);
  };

  const removeRow = (id: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: string, value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleAdd = async (e: any) => {
    e.preventDefault();
    try {
      if (editingId) {
        const row = rows[0];
        const prodNum = Number(row.production);
        const rawNum = Number(row.rawQty);
        const lossRate = rawNum > 0 ? ((rawNum - prodNum) / rawNum) * 100 : 0;
        const yieldRate = rawNum > 0 ? (prodNum / rawNum) * 100 : 0;

        const oldRecord = production.find((p: any) => p.id === editingId);
        if (oldRecord) {
          const oldPItem = inventory.find((i: any) => i.name === oldRecord.title);
          if (oldPItem) await updateDoc(doc(db, 'inventory', oldPItem.id), { currentStock: increment(-oldRecord.production), updatedAt: serverTimestamp() });
          
          const oldRItem = inventory.find((i: any) => i.name === oldRecord.rawMaterial);
          if (oldRItem) await updateDoc(doc(db, 'inventory', oldRItem.id), { currentStock: increment(oldRecord.rawQty), updatedAt: serverTimestamp() });
        }

        await updateDoc(doc(db, 'production_batches', editingId), {
          ...row,
          line,
          production: prodNum,
          rawQty: rawNum,
          yield: yieldRate,
          loss: lossRate,
          updatedAt: serverTimestamp()
        });

        const newPItem = inventory.find((i: any) => i.name === row.title);
        if (newPItem) await updateDoc(doc(db, 'inventory', newPItem.id), { currentStock: increment(prodNum), updatedAt: serverTimestamp() });

        const newRItem = inventory.find((i: any) => i.name === row.rawMaterial);
        if (newRItem) await updateDoc(doc(db, 'inventory', newRItem.id), { currentStock: increment(-rawNum), updatedAt: serverTimestamp() });

        alert('생산 실적 수정 완료');
        setEditingId(null);
        setShowForm(false);
        setRows([{ id: Date.now(), title: '', rawMaterial: '', rawQty: '', production: '', manufDate: new Date().toISOString().split('T')[0], expiryDate: '' }]);
        return;
      }

      for (const row of rows) {
        if (!row.title || !row.rawQty || !row.production) continue;
        
        const prodNum = Number(row.production); 
        const rawNum = Number(row.rawQty);
        const lossRate = rawNum > 0 ? ((rawNum - prodNum) / rawNum) * 100 : 0;
        const yieldRate = rawNum > 0 ? (prodNum / rawNum) * 100 : 0;

        await addDoc(collection(db, 'production_batches'), { 
          ...row, 
          line,
          production: prodNum, 
          rawQty: rawNum, 
          yield: yieldRate,
          loss: lossRate, 
          createdAt: serverTimestamp() 
        });

        const pItem = inventory.find((i: any) => i.name === row.title);
        if (pItem) await updateDoc(doc(db, 'inventory', pItem.id), { currentStock: increment(prodNum), updatedAt: serverTimestamp() });
        
        const rItem = inventory.find((i: any) => i.name === row.rawMaterial);
        if (rItem) await updateDoc(doc(db, 'inventory', rItem.id), { currentStock: increment(-rawNum), updatedAt: serverTimestamp() });
      }
      alert('생산 실적 등록 완료'); 
      setShowForm(false);
      setRows([{ id: Date.now(), title: '', rawMaterial: '', rawQty: '', production: '', manufDate: new Date().toISOString().split('T')[0], expiryDate: '' }]);
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'production_batches'); }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setLine(item.line || '삼산공장');
    setRows([{
      id: Date.now(),
      title: item.title,
      rawMaterial: item.rawMaterial,
      rawQty: item.rawQty,
      production: item.production,
      manufDate: item.manufDate,
      expiryDate: item.expiryDate || ''
    }]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string, title: string) => {
    if (!canEditItems) return;
    if (!window.confirm(`[${title}] 생산 실적을 삭제하시겠습니까? (재고가 같이 조정됩니다)`)) return;
    try {
      const record = production.find((p: any) => p.id === id);
      await deleteDoc(doc(db, 'production_batches', id));
      
      if (record) {
        const pItem = inventory.find((i: any) => i.name === record.title);
        if (pItem) await updateDoc(doc(db, 'inventory', pItem.id), { currentStock: increment(-record.production), updatedAt: serverTimestamp() });
        
        const rItem = inventory.find((i: any) => i.name === record.rawMaterial);
        if (rItem) await updateDoc(doc(db, 'inventory', rItem.id), { currentStock: increment(record.rawQty), updatedAt: serverTimestamp() });
      }
      
      alert('생산 실적이 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'production_batches');
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-3 bg-[#e8effd] hover:bg-[#d0e0fb] text-[#0f172a] rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter">생산관리</h1>
          </div>
        </div>
        
        {canEditItems && (
          <button 
            onClick={() => setShowForm(!showForm)} 
            className={`h-14 px-8 bg-[#0f172a] text-white rounded-2xl font-black flex items-center gap-3 shadow-xl hover:bg-slate-800 transition-all active:scale-95`}
          >
            {showForm ? <ChevronDown className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            {showForm ? '닫기' : '생산일지 등록'}
          </button>
        )}
      </header>

      {/* Entry Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[48px] border border-outline-variant/30 shadow-2xl p-10 space-y-10">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-[#0f172a] tracking-tight">일지 정보 입력</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm font-black text-outline uppercase">생산 라인:</span>
              <select value={line} onChange={e => setLine(e.target.value)} className="h-14 px-8 bg-white border border-outline-variant rounded-2xl font-black text-sm shadow-sm outline-none cursor-pointer hover:border-primary transition-all">
                <option value="삼산공장">삼산공장</option>
                <option value="언양공장 부속물">언양공장 부속물</option>
                <option value="언양공장 식육가공">언양공장 식육가공</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
             <div className="grid grid-cols-6 gap-6 px-4">
                {['품목명', '원육정보', '투입량 (KG)', '생산량 (KG)', '수율 (%)', '로스 (%)'].map((label, idx) => (
                   <p key={idx} className={`text-center text-[12px] font-black tracking-tight ${idx === 4 ? 'text-emerald-700' : idx === 5 ? 'text-rose-700' : 'text-outline'}`}>{label}</p>
                ))}
             </div>

             {rows.map((row, index) => {
                const raw = Number(row.rawQty) || 0;
                const prod = Number(row.production) || 0;
                const yieldRate = raw > 0 ? (prod / raw) * 100 : 0;
                const lossRate = raw > 0 ? ((raw - prod) / raw) * 100 : 0;

                return (
                   <div key={row.id} className="relative bg-[#f1f5f9] p-2 rounded-[32px] border border-outline-variant/30 space-y-4">
                      {index > 0 && <button onClick={() => removeRow(row.id)} className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-all z-10"><X className="w-4 h-4" /></button>}
                      
                      <div className="grid grid-cols-6 gap-3">
                         <input list="p-items" placeholder="품목명" value={row.title} onChange={e => updateRow(row.id, 'title', e.target.value)} className="h-16 px-6 bg-white border border-outline-variant rounded-2xl font-bold outline-none focus:border-primary transition-all shadow-sm" />
                         <input placeholder="원육 정보" value={row.rawMaterial} onChange={e => updateRow(row.id, 'rawMaterial', e.target.value)} className="h-16 px-6 bg-white border border-outline-variant rounded-2xl font-bold outline-none focus:border-primary transition-all shadow-sm" />
                         <input type="number" placeholder="0" value={row.rawQty} onChange={e => updateRow(row.id, 'rawQty', e.target.value)} className="h-16 px-6 bg-white border border-outline-variant rounded-2xl font-bold text-center outline-none focus:border-primary transition-all shadow-sm" />
                         <input type="number" placeholder="0" value={row.production} onChange={e => updateRow(row.id, 'production', e.target.value)} className="h-16 px-6 bg-white border border-outline-variant rounded-2xl font-bold text-center outline-none focus:border-primary transition-all shadow-sm" />
                         <div className="h-16 flex items-center justify-center bg-emerald-50 rounded-2xl font-black text-emerald-600 border border-emerald-100 shadow-sm">{yieldRate.toFixed(0)}%</div>
                         <div className="h-16 flex items-center justify-center bg-rose-50 rounded-2xl font-black text-rose-600 border border-rose-100 shadow-sm">{lossRate.toFixed(0)}%</div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="flex items-center gap-3 bg-white px-6 h-14 rounded-2xl border border-outline-variant shadow-sm flex-1">
                            <span className="text-[11px] font-black text-outline whitespace-nowrap">제조일자</span>
                            <input type="date" value={row.manufDate} onChange={e => updateRow(row.id, 'manufDate', e.target.value)} className="flex-1 bg-transparent font-bold text-sm outline-none" />
                            <CalendarDays className="w-4 h-4 text-outline-variant" />
                         </div>
                         <div className="flex items-center gap-3 bg-white px-6 h-14 rounded-2xl border border-outline-variant shadow-sm flex-1">
                            <span className="text-[11px] font-black text-outline whitespace-nowrap">소비기한</span>
                            <input type="date" value={row.expiryDate} onChange={e => updateRow(row.id, 'expiryDate', e.target.value)} className="flex-1 bg-transparent font-bold text-sm outline-none" placeholder="연도-월-일" />
                            <CalendarDays className="w-4 h-4 text-outline-variant" />
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
                <button onClick={() => { setEditingId(null); setShowForm(false); }} className="flex-1 h-16 bg-rose-50 text-rose-600 rounded-2xl font-black text-lg hover:bg-rose-100 transition-all">취소</button>
             )}
          </div>
          <datalist id="p-items">{inventory.map((i: any) => <option key={i.id} value={i.name} />)}</datalist>
        </motion.div>
      )}

      {/* Summary Stats */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[40px] shadow-sm border border-outline-variant/30 flex flex-col items-center justify-center gap-4 transition-all hover:shadow-md">
            <p className="text-[11px] font-black text-outline uppercase tracking-tight">{stat.label}</p>
            <div className={`flex items-baseline gap-2 ${idx === 3 ? 'text-emerald-600' : 'text-[#0f172a]'}`}>
              <span className="text-5xl font-black tabular-nums tracking-tighter leading-none">{stat.value}</span>
              <span className="text-sm font-black text-outline uppercase">{stat.unit}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Recent Production Log */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-[#0f172a]" />
            <h3 className="text-2xl font-black text-[#0f172a] tracking-tight">생산 일지</h3>
          </div>
          <button 
            onClick={() => setShowAllLogs(!showAllLogs)} 
            className="flex items-center gap-2 px-6 h-11 bg-white border border-outline-variant/50 rounded-xl text-sm font-black text-[#0f172a] hover:bg-slate-50 transition-all shadow-sm"
          >
            {showAllLogs ? <History className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAllLogs ? '' : '더보기'}
          </button>
        </div>

        <section className="bg-[#e8f1ff] p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input type="text" placeholder="품목명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-12 pl-11 pr-4 bg-white border border-outline-variant/50 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all shadow-sm" />
          </div>
          <div className="flex items-center gap-2 px-4 h-12 bg-white border border-outline-variant/50 rounded-xl text-sm font-bold text-on-surface shadow-sm w-full md:w-64">
            <CalendarDays className="w-4 h-4 text-outline" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent border-none outline-none text-sm flex-1" />
          </div>
        </section>

        <div className="bg-white rounded-[40px] border border-outline-variant overflow-hidden shadow-xl shadow-surface-container-high/50">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead className="bg-[#f1f4f9] text-[11px] font-black text-outline uppercase tracking-widest border-b border-outline-variant">
                <tr>
                   <th className="px-6 py-8">SKU / 라인</th>
                   <th className="px-6 py-8">품목명</th>
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
                {filtered.slice(0, showAllLogs ? undefined : 10).map((item: any, idx: number) => {
                  const itemData = inventory.find((inv: any) => inv.name === item.title);
                  return (
                    <tr key={item.id || idx} className="hover:bg-surface-container/5 transition-colors">
                      <td className="px-6 py-6">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-primary font-mono">{itemData?.sku || 'N/A'}</span>
                          <span className="text-[11px] font-black text-[#0f172a]">{item.line || '기본'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6 font-black text-[#0f172a]">{item.title}</td>
                      <td className="px-6 py-6 font-bold text-outline-variant">{item.rawQty?.toLocaleString()} KG</td>
                      <td className="px-6 py-6 font-black text-[#0f172a]">{item.production?.toLocaleString()} KG</td>
                      <td className="px-6 py-6"><span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-xs">{item.yield?.toFixed(1) || 0}%</span></td>
                      <td className="px-6 py-6"><span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg font-black text-xs">{item.loss?.toFixed(1) || 0}%</span></td>
                      <td className="px-6 py-6 text-sm font-bold text-outline">{item.manufDate}</td>
                      <td className="px-6 py-6 text-sm font-bold text-outline">{item.expiryDate || '-'}</td>
                      <td className="px-6 py-6">
                        {canEditItems && (
                          <div className="flex items-center justify-center gap-2">
                             <button onClick={() => handleEdit(item)} className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all" title="수정"><Edit className="w-5 h-5" /></button>
                             <button onClick={() => handleDelete(item.id, item.title)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="삭제"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProductionContent;
