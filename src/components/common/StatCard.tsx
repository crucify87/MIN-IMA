import React from 'react';
import { TrendingUp } from 'lucide-react';
import { StatItem } from '../../types';

const StatCard = ({ item }: { item: StatItem }) => (
  <div className="bg-white p-6 md:p-8 rounded-[32px] border-2 border-outline-variant/30 shadow-lg relative overflow-hidden group hover:border-primary transition-all">
    <div className="flex justify-between items-start">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-outline uppercase tracking-[0.3em]">{item.label}</p>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl md:text-4xl font-black text-on-surface tracking-tighter tabular-nums leading-none">{item.value}</h3>
            {item.unit && <span className="text-xs md:text-sm font-black text-outline uppercase shrink-0 leading-none">{item.unit}</span>}
          </div>
        </div>
        {item.trend && (
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full inline-flex ${item.trendDir === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-error/5 text-error'}`}>
            <TrendingUp className={`w-3 h-3 ${item.trendDir === 'down' ? 'rotate-180' : ''}`} />
            <span className="text-[10px] font-black tracking-widest">{item.trend}</span>
          </div>
        )}
      </div>
      <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl md:rounded-[24px] flex items-center justify-center shadow-lg transition-transform group-hover:rotate-12 ${item.color || 'bg-surface-container text-primary'}`}>
        <item.icon className="w-7 h-7 md:w-9 md:h-9" />
      </div>
    </div>
  </div>
);

export default StatCard;
