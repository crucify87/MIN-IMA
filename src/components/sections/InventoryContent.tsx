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
  const [activeShift, setActiveShift] = useState('일간');
  const [showAll, setShowAll] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const filtered = inventory.filter((i: any) => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.sku?.toLowerCase().includes(search.toLowerCase())
  );

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
    const dailyInput = logistics
      .filter((l: any) => l.date === today && l.type === '입고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    const dailyOutput = logistics
      .filter((l: any) => l.date === today && l.type === '출고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);

    return [
      { label: '총 SKU', value: skuCount, unit: '종' },
      { label: '재고 부족', value: lowStockCount, unit: '건', isAlert: true },
      { label: '일간 입고', value: dailyInput, unit: 'KG' },
      { label: '일간 출고', value: dailyOutput, unit: 'KG', isSuccess: true },
    ];
  }, [inventory, logistics, today]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-4xl font-black text-on-surface tracking-tighter">재고관리</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
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
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryStats.map((stat, idx) => (
          <div 
            key={idx} 
            className="bg-white p-8 rounded-[32px] border border-outline-variant shadow-sm transition-all flex flex-col items-center justify-center gap-4 group hover:shadow-md relative overflow-hidden"
          >
            <div className={`absolute top-0 left-0 w-full h-1.5 ${stat.isAlert ? 'bg-rose-500' : stat.isSuccess ? 'bg-emerald-500' : idx === 0 ? 'bg-[#94a3b8]' : 'bg-[#3b82f6]'}`} />
            <p className="text-[11px] font-black text-outline uppercase tracking-tight">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-black tabular-nums tracking-tighter leading-none ${stat.isAlert ? 'text-rose-600' : stat.isSuccess ? 'text-emerald-600' : 'text-on-surface'}`}>
                {stat.value.toLocaleString()}
              </span>
              <span className="text-sm font-black text-outline uppercase">{stat.unit}</span>
            </div>
          </div>
        ))}
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
            <table className="w-full text-center border-collapse">
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
