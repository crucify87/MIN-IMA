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
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), type: '입고', item: '', partner: '', weight: '', freightType: '선불' });
  
  const today = new Date().toISOString().split('T')[0];

  const summary = useMemo(() => {
    const todayLogistics = logistics.filter((l: any) => l.date === today);
    const totalWeight = todayLogistics.reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    const inputCount = todayLogistics.filter((l: any) => l.type === '입고').length;
    const outputCount = todayLogistics.filter((l: any) => l.type === '출고').length;
    return { totalWeight, inputCount, outputCount };
  }, [logistics, today]);

  const filtered = useMemo(() => {
    return logistics.filter((l: any) => {
      const matchesSearch = l.item.toLowerCase().includes(search.toLowerCase());
      const matchesDate = l.date >= startDate && l.date <= endDate;
      return matchesSearch && matchesDate;
    });
  }, [logistics, search, startDate, endDate]);
  
  const handleAdd = async (e: any) => {
    e.preventDefault();
    try {
      const weightNum = Number(form.weight);
      
      if (editingId) {
        const oldRecord = logistics.find((l: any) => l.id === editingId);
        if (oldRecord) {
          // Revert old inventory change
          const oldItem = inventory.find((i: any) => i.name === oldRecord.item);
          if (oldItem) {
            await updateDoc(doc(db, 'inventory', oldItem.id), {
              currentStock: increment(oldRecord.type === '입고' ? -oldRecord.weight : oldRecord.weight),
              updatedAt: serverTimestamp()
            });
          }
        }
        
        await updateDoc(doc(db, 'logistics', editingId), { 
          ...form, 
          weight: weightNum, 
          updatedAt: serverTimestamp() 
        });

        // Apply new inventory change
        const newItem = inventory.find((i: any) => i.name === form.item);
        if (newItem) {
          await updateDoc(doc(db, 'inventory', newItem.id), {
            currentStock: increment(form.type === '입고' ? weightNum : -weightNum),
            updatedAt: serverTimestamp()
          });
        }

        alert('수정 완료');
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'logistics'), { ...form, weight: weightNum, status: '완료', createdAt: serverTimestamp() });
        const item = inventory.find((i: any) => i.name === form.item);
        if (item) { 
          await updateDoc(doc(db, 'inventory', item.id), { 
            currentStock: increment(form.type === '입고' ? weightNum : -weightNum), 
            updatedAt: serverTimestamp() 
          }); 
        }
        alert('등록 완료');
      }
      
      setShowForm(false);
      setForm({ date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), type: '입고', item: '', partner: '', weight: '', freightType: '선불' });
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'logistics'); }
  };

  const handleEdit = (l: any) => {
    setEditingId(l.id);
    setForm({
      date: l.date,
      time: l.time,
      type: l.type,
      item: l.item,
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
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-3 bg-[#e8effd] hover:bg-[#d0e0fb] text-[#0f172a] rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter">물류현황</h1>
        </div>
        
        {canEditItems && (
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="h-14 px-8 bg-[#0f172a] text-white rounded-2xl font-black flex items-center gap-3 shadow-lg hover:bg-slate-800 transition-all active:scale-95"
          >
            <Plus className="w-6 h-6" /> 
            {showForm ? '닫기' : '신규 입고/출고'}
          </button>
        )}
      </header>

      {/* Form Overlay */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[40px] border-2 border-[#0f172a]/10 shadow-2xl space-y-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-1"><label className="text-[10px] font-black text-outline">날짜</label><input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold" /></div>
             <div className="space-y-1"><label className="text-[10px] font-black text-outline">품목</label><input required list="l-items" value={form.item} onChange={e => setForm({...form, item: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold" /><datalist id="l-items">{inventory.map((i: any) => <option key={i.id} value={i.name} />)}</datalist></div>
             <div className="space-y-1"><label className="text-[10px] font-black text-outline">구분</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold font-black"><option value="입고">입고</option><option value="출고">출고</option></select></div>
             <div className="space-y-1"><label className="text-[10px] font-black text-outline">중량 (KG)</label><input required type="number" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold" /></div>
             <div className="space-y-1"><label className="text-[10px] font-black text-outline">거래처</label><select required value={form.partner} onChange={e => setForm({...form, partner: e.target.value})} className="w-full h-12 px-4 bg-surface-container rounded-xl font-bold font-black"><option value="">선택</option>{partners.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
             <div className="flex items-end"><button type="submit" className="w-full h-12 bg-[#0f172a] text-white rounded-xl font-black uppercase shadow-lg shadow-[#0f172a]/20">저장 완료</button></div>
          </form>
        </motion.div>
      )}

      {/* Summary Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: '금일 총 물동량', value: summary.totalWeight, unit: 'KG' },
          { label: '금일 입고', value: summary.inputCount, unit: '건' },
          { label: '금일 출고', value: summary.outputCount, unit: '건' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-10 rounded-[40px] shadow-sm border border-outline-variant/30 flex flex-col items-center justify-center gap-4 transition-all hover:shadow-md">
            <p className="text-[11px] font-black text-outline uppercase tracking-tight">{stat.label}</p>
            <div className="flex items-baseline gap-2 text-[#0f172a]">
              <span className="text-5xl font-black tabular-nums tracking-tighter leading-none">{stat.value.toLocaleString()}</span>
              <span className="text-sm font-black text-outline uppercase">{stat.unit}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Filter Bar */}
      <section className="bg-[#e8f1ff] p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input 
            type="text" 
            placeholder="품목명 필터..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-11 pr-4 bg-white border border-outline-variant/50 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all shadow-sm" 
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 px-4 h-12 bg-white border border-outline-variant/50 rounded-xl text-sm font-bold text-on-surface shadow-sm w-full">
            <CalendarDays className="w-4 h-4 text-outline" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none outline-none text-xs flex-1" />
          </div>
          <span className="text-outline font-bold">~</span>
          <div className="flex items-center gap-2 px-4 h-12 bg-white border border-outline-variant/50 rounded-xl text-sm font-bold text-on-surface shadow-sm w-full">
            <CalendarDays className="w-4 h-4 text-outline" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none outline-none text-xs flex-1" />
          </div>
        </div>
      </section>

      {/* Table Area */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-[#0f172a]" />
            <h3 className="text-2xl font-black text-[#0f172a] tracking-tight">등록된 물류</h3>
          </div>
          <button 
            onClick={() => setShowAll(!showAll)} 
            className="flex items-center gap-2 px-6 h-11 bg-white border border-outline-variant/50 rounded-xl text-sm font-black text-[#0f172a] hover:bg-slate-50 transition-all shadow-sm"
          >
            {showAll ? <History className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAll ? '' : '더보기'}
          </button>
        </div>

        <div className="min-h-[400px] flex flex-col rounded-[48px] border-2 border-dashed border-[#d1d5db] bg-[#f8fafc] p-10">
          {filtered.length > 0 ? (
            <div className="w-full bg-white rounded-[32px] border border-outline-variant overflow-hidden shadow-2xl shadow-indigo-900/5">
              <table className="w-full text-center border-collapse">
                <thead className="bg-[#f1f4f9] text-[11px] font-black text-outline uppercase tracking-widest border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-8 text-left pl-8">시간 (TIME)</th>
                    <th className="px-4 py-8">구분</th>
                    <th className="px-4 py-8">품목 (ITEM)</th>
                    <th className="px-4 py-8">재고 변동량</th>
                    <th className="px-4 py-8">상태</th>
                    <th className="px-4 py-8">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filtered.slice(0, showAll ? undefined : 15).map((l: any, i: number) => (
                    <tr key={l.id || i} className="hover:bg-surface-container/5 transition-colors">
                      <td className="px-4 py-6 text-sm font-bold text-outline text-left pl-8">{l.date} {l.time}</td>
                      <td className="px-4 py-6">
                        <span className={`px-2 py-1 rounded text-[10px] font-black ${l.type === '입고' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {l.type}
                        </span>
                      </td>
                      <td className="px-4 py-6 font-black text-on-surface">{l.item}</td>
                      <td className={`px-4 py-6 font-black text-xl ${l.type === '입고' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {l.type === '입고' ? '+' : '-'}{l.weight?.toLocaleString()} KG
                      </td>
                      <td className="px-4 py-6">
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{l.status || '완료'}</span>
                      </td>
                      <td className="px-4 py-6">
                        <div className="flex items-center justify-center gap-2">
                           <button onClick={() => handleEdit(l)} className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors">
                             <Edit className="w-4 h-4" />
                           </button>
                           <button onClick={() => handleDelete(l)} className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors">
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        </div>
      </section>
    </div>
  );
}

export default LogisticsContent;
