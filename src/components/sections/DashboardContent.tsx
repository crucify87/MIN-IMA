import React, { useState, useMemo } from 'react';
import { 
  Search, 
  CalendarDays, 
  ChevronDown, 
  ChevronRight, 
  Package 
} from 'lucide-react';
import { ViewType } from '../../types';

function DashboardContent({ inventory, production, logistics, partners, onNavigate }: any) {
  const today = new Date().toISOString().split('T')[0];
  
  const dailyStats = useMemo(() => {
    const totalInventory = inventory.reduce((acc: number, curr: any) => acc + (Number(curr.currentStock) || 0), 0);
    const dailyInput = logistics
      .filter((l: any) => l.date === today && l.type === '입고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    const dailyOutput = logistics
      .filter((l: any) => l.date === today && l.type === '출고')
      .reduce((acc: number, curr: any) => acc + (Number(curr.weight) || 0), 0);
    const dailyProduction = production
      .filter((p: any) => p.manufDate === today)
      .reduce((acc: number, curr: any) => acc + (Number(curr.production) || 0), 0);

    return [
      { label: '현재 총 재고', value: totalInventory },
      { label: '일간 입고', value: dailyInput },
      { label: '일간 출고', value: dailyOutput, active: true },
      { label: '일간 생산', value: dailyProduction },
    ];
  }, [inventory, logistics, production, today]);

  const [activeShift, setActiveShift] = useState('일간');

  return (
    <div className="space-y-10">
      {/* Dashboard Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-on-surface tracking-tighter">대시보드</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input 
              type="text" 
              placeholder="품목 검색" 
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

      {/* Stat Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {dailyStats.map((stat, idx) => (
          <div 
            key={idx} 
            className={`bg-white p-8 rounded-[32px] border-2 transition-all flex flex-col items-center justify-center gap-4 ${stat.active ? 'border-primary shadow-lg shadow-primary/5' : 'border-outline-variant/30 shadow-sm'}`}
          >
            <p className={`text-[11px] font-black uppercase tracking-tight ${stat.active ? 'text-primary' : 'text-outline'}`}>{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-black tabular-nums tracking-tighter leading-none ${stat.active ? 'text-primary' : 'text-on-surface'}`}>
                {stat.value.toLocaleString()}
              </span>
              <span className="text-sm font-black text-outline uppercase">KG</span>
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
        
        <div className="bg-surface-container/30 border border-dashed border-outline-variant/50 rounded-[40px] min-h-[240px] flex flex-col items-center justify-center p-12 text-center group">
          {inventory.length > 0 ? (
            <div className="w-full bg-white rounded-[32px] border border-outline-variant overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-surface-container border-b border-outline-variant text-[11px] font-black text-outline uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">품목 명칭</th>
                    <th className="px-8 py-5">현재고 (KG)</th>
                    <th className="px-8 py-5">상태</th>
                    <th className="px-8 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {inventory.slice(0, 5).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-surface-container/50 transition-colors group cursor-pointer" onClick={() => onNavigate('detail', item)}>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                            <Package className="w-5 h-5" />
                          </div>
                          <span className="font-black text-on-surface tracking-tight">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-xl font-black">{item.currentStock?.toLocaleString()} KG</td>
                      <td className="px-8 py-5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${item.currentStock < (item.safetyStock || 0) ? 'bg-error/10 text-error' : 'bg-emerald-500/10 text-emerald-600'}`}>
                          {item.currentStock < (item.safetyStock || 0) ? '부족' : '정상'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right"><ChevronRight className="w-5 h-5 text-outline" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          <h3 className="text-2xl font-black text-on-surface tracking-tight">최근 재고 변동 내역 (통합)</h3>
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

        <div className="bg-white rounded-[40px] border border-outline-variant overflow-hidden shadow-xl shadow-surface-container-high/50">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead className="bg-surface-container/50 text-[11px] font-black text-outline uppercase tracking-widest border-b border-outline-variant">
                <tr>
                  <th className="px-4 py-8">시간 (TIME)</th>
                  <th className="px-4 py-8">구분</th>
                  <th className="px-4 py-8">품목 (ITEM)</th>
                  <th className="px-4 py-8">재고 변동량</th>
                  <th className="px-4 py-8">출처</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {useMemo(() => {
                  const combined = [
                    ...logistics.map((l: any) => ({
                      time: `${l.date} ${l.time}`,
                      type: l.type,
                      item: l.item,
                      weight: l.weight,
                      source: '물류',
                      rawTime: l.createdAt?.seconds || 0
                    })),
                    ...production.flatMap((p: any) => [
                      {
                        time: p.manufDate,
                        type: '입고',
                        item: p.title,
                        weight: p.production,
                        source: '생산(완성)',
                        rawTime: p.createdAt?.seconds || 0
                      },
                      {
                        time: p.manufDate,
                        type: '출고',
                        item: p.rawMaterial,
                        weight: p.rawQty,
                        source: '생산(투입)',
                        rawTime: p.createdAt?.seconds || 0
                      }
                    ]).filter(i => i.item)
                  ].sort((a, b) => b.rawTime - a.rawTime);

                  return combined.slice(0, 10);
                }, [logistics, production]).map((l, i) => (
                  <tr key={i} className="hover:bg-surface-container/10 transition-colors">
                    <td className="px-4 py-6 text-sm font-bold text-outline">{l.time}</td>
                    <td className="px-4 py-6">
                      <span className={`px-2 py-1 rounded text-[10px] font-black ${l.type === '입고' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {l.type}
                      </span>
                    </td>
                    <td className="px-4 py-6 font-black text-on-surface">{l.item}</td>
                    <td className={`px-4 py-6 font-black text-xl ${l.type === '입고' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {l.type === '입고' ? '+' : '-'}{Number(l.weight)?.toLocaleString()} KG
                    </td>
                    <td className="px-4 py-6">
                      <span className={`text-[10px] font-black px-2 py-1 rounded ${
                        l.source.includes('생산') ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'
                      }`}>
                        {l.source}
                      </span>
                    </td>
                  </tr>
                ))}
                {logistics.length === 0 && production.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-24 text-center">
                      <p className="text-xl font-black text-outline/40 tracking-tight">활동 내역이 없습니다</p>
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

export default DashboardContent;
