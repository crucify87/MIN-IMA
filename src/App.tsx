/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ArrowLeftRight, 
  Cpu, 
  Users, 
  Search, 
  Bell, 
  Settings, 
  Plus, 
  FileText, 
  Download, 
  CalendarDays, 
  Calendar,
  TrendingUp, 
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Edit,
  Edit2,
  Edit3,
  History,
  Lock,
  Verified,
  MapPin,
  Clock,
  Warehouse,
  Truck,
  User as UserIcon,
  Factory,
  Scissors,
  Tag,
  Trash2,
  MoreVertical,
  CheckCircle2,
  LogOut,
  LogIn,
  X,
  TrendingDown,
  ArrowLeft,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, loginWithGoogle, logout, db, User } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, increment, serverTimestamp, collection, onSnapshot, query, orderBy, deleteDoc, addDoc } from 'firebase/firestore';
import { seedDatabase, isDatabaseEmpty } from './lib/seedData';

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type ViewType = 'dashboard' | 'inventory' | 'logistics' | 'production' | 'settings' | 'detail';

interface StatItem {
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  trendDir?: 'up' | 'down';
  color?: string;
  icon: any;
}

// --- Icons ---

const AppLogo = ({ className = "w-12 h-12" }: { className?: string }) => {
  return (
    <div className={`${className} relative flex items-center justify-center overflow-hidden rounded-2xl p-1 bg-white`}>
      <svg viewBox="0 0 512 512" className="w-full h-full">
        <defs>
          <linearGradient id="cowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" /> {/* emerald-500 */}
            <stop offset="50%" stopColor="#4b5563" /> {/* gray-600 */}
            <stop offset="100%" stopColor="#ef4444" /> {/* red-500 */}
          </linearGradient>
        </defs>
        
        {/* Professional Cow Silhouette based on provided reference */}
        <path 
          d="M480,240 c0,-60 -40,-85 -70,-85 c-15,0 -25,10 -30,20 c-40,-25 -110,-35 -170,-20 c-70,15 -120,60 -135,140 c-5,30 -10,140 -5,170 c2,15 15,25 30,25 c15,0 25,-10 30,-25 l15,-100 l40,100 c5,15 20,25 35,25 c15,0 25,-10 30,-25 l30,-120 l30,120 c5,15 20,25 35,25 c15,0 25,-10 30,-25 l40,-150 c10,-10 50,0 65,15 c15,15 20,50 10,70 c20,0 40,-10 50,-30 c10,-20 10,-80 -10,-110 Z" 
          fill="url(#cowGradient)"
        />
        
        {/* Internal Flowing Arrow and Icons */}
        <g fill="white">
          {/* Main Flow Path */}
          <path d="M130,260 c20,-5 40,-5 50,15 s20,50 60,50 h120 l-30,-40 h30 l60,50 l-60,50 h-30 l30,-40 h-120 c-60,0 -80,-60 -110,-60 c-10,0 -20,5 -30,15 Z" opacity="0.9" />
          
          {/* Barn */}
          <path d="M150,220 l15,-12 l15,12 v18 h-30 z M160,228 h10 v10 h-10 z" />
          
          {/* Leaf */}
          <path d="M200,210 c15,-15 30,0 15,15 c-15,15 -30,0 -15,-15" transform="rotate(-15, 215, 217)" />
          
          {/* Gears */}
          <circle cx="260" cy="275" r="10" />
          <circle cx="285" cy="295" r="10" />
        </g>
      </svg>
    </div>
  );
};

// --- Components ---

const StatCard = ({ item }: { item: StatItem, key?: React.Key }) => {
  return (
    <div className="bg-white border-2 border-outline-variant/30 p-8 rounded-[40px] flex flex-col items-center text-center shadow-lg hover:border-primary transition-all group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-primary/10 group-hover:h-2 transition-all" />
      <p className="text-[10px] md:text-xs font-black text-outline uppercase tracking-[0.3em] mb-4">{item.label}</p>
      <div className="flex items-baseline gap-1">
        <p className="text-4xl md:text-6xl font-black text-on-surface tabular-nums tracking-tighter leading-none">
          {item.value}
        </p>
        <span className="text-sm md:text-xl font-black text-outline-variant uppercase tracking-widest">{item.unit}</span>
      </div>
    </div>
  );
};

// --- Views ---

// --- Views ---

const DashboardView = ({ 
  onNavigate, 
  inventory, 
  production, 
  logistics,
  partners
}: { 
  onNavigate: (view: ViewType, item?: any) => void,
  inventory: any[],
  production: any[],
  logistics: any[],
  partners: any[]
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('주간');

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate based on timeFilter
    const filteredLogs = logistics.filter(l => {
      const logDate = l.date || l.createdAt?.toDate().toISOString().split('T')[0];
      if (!logDate) return false;
      
      if (timeFilter === '일간') {
        return logDate === selectedDate;
      } else if (timeFilter === '주간') {
        const d = new Date(selectedDate);
        const start = new Date(d.setDate(d.getDate() - 7)).toISOString().split('T')[0];
        return logDate >= start && logDate <= selectedDate;
      } else {
        const d = new Date(selectedDate);
        const start = new Date(d.setMonth(d.getMonth() - 1)).toISOString().split('T')[0];
        return logDate >= start && logDate <= selectedDate;
      }
    });

    const inWeight = filteredLogs
      .filter(l => l.type === '입고')
      .reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);
    
    const outWeight = filteredLogs
      .filter(l => l.type === '출고')
      .reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);

    return [
      { label: `${timeFilter} 입고`, value: inWeight.toLocaleString(), unit: 'kg', icon: ArrowDownToLine },
      { label: `${timeFilter} 출고`, value: outWeight.toLocaleString(), unit: 'kg', icon: ArrowUpFromLine },
      { label: '생산 관리', value: production.length.toString(), unit: '건', icon: Factory },
    ];
  }, [logistics, production, timeFilter, selectedDate]);

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-10">
      {/* Header with Search & Filters */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-4xl font-black text-primary tracking-tighter">대시보드</h2>
            <p className="text-sm font-black text-outline uppercase tracking-widest">{selectedDate} 실시간 현황</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative group flex-1 sm:flex-none">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">
                <Search className="w-5 h-5" />
              </div>
              <input 
                type="text" 
                placeholder="품목 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-48 h-12 pl-12 pr-6 bg-white border-2 border-outline-variant/30 rounded-2xl font-black text-sm tracking-widest focus:border-primary outline-none shadow-sm transition-all appearance-none"
              />
            </div>

            {/* Calendar */}
            <div className="relative group flex-1 sm:flex-none">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary">
                <Calendar className="w-5 h-5" />
              </div>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-48 h-12 pl-12 pr-6 bg-white border-2 border-outline-variant/30 rounded-2xl font-black text-sm uppercase tracking-widest focus:border-primary outline-none shadow-sm transition-all appearance-none cursor-pointer"
              />
            </div>

            {/* Tabs */}
            <div className="bg-surface-container p-1 rounded-2xl flex items-center border-2 border-outline-variant/30 w-fit">
              {['일간', '주간', '월간'].map((t) => (
                <button 
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    timeFilter === t 
                      ? 'bg-primary text-white shadow-lg' 
                      : 'text-outline hover:bg-surface-container-high'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((s, i) => <StatCard key={i} item={s} />)}
      </section>

      {/* Horizontal Inventory List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="space-y-1">
            
            <p className="text-2xl font-black text-on-surface tracking-tight">재고 현황 리스트</p>
          </div>
          <button 
            onClick={() => onNavigate('inventory')}
            className="text-primary font-black text-sm uppercase tracking-widest hover:underline decoration-2 underline-offset-4 flex items-center gap-2"
          >
            전체 보기 <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
          {filteredInventory.length === 0 ? (
            <div className="w-full bg-surface-container py-12 rounded-[32px] border-2 border-dashed border-outline-variant/50 flex flex-col items-center justify-center gap-3">
              <Package className="w-10 h-10 text-outline/30" />
              <p className="font-black text-outline uppercase tracking-widest">품목을 찾을 수 없습니다</p>
            </div>
          ) : (
            filteredInventory.map((item, idx) => {
              const isAlert = item.currentStock < item.safetyStock;
              return (
                <motion.div 
                  key={idx}
                  whileHover={{ y: -2 }}
                  className={`min-w-[200px] md:min-w-[240px] p-4 md:p-5 bg-white border-2 rounded-[24px] shadow-sm snap-start cursor-pointer hover:border-primary transition-all relative overflow-hidden group ${isAlert ? 'border-error/20' : 'border-outline-variant/20'}`}
                  onClick={() => onNavigate('detail', item)}
                >
                  <div className="space-y-3">
                    <div className="overflow-hidden items-end flex justify-between gap-2">
                       <div>
                         <p className="font-black text-lg truncate leading-tight group-hover:text-primary transition-colors">{item.name}</p>
                       </div>
                    </div>
                    <div className="flex justify-between items-end border-t border-outline-variant/10 pt-3">
                      <div>
                        <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">실재고 수량</p>
                        <p className={`text-3xl font-black tabular-nums ${isAlert ? 'text-error' : 'text-primary'}`}>
                          {item.currentStock}<span className="text-sm ml-0.5 font-bold uppercase">{item.unit}</span>
                        </p>
                      </div>
                      {isAlert && <AlertTriangle className="w-5 h-5 text-error absolute top-4 right-4 animate-pulse" />}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </section>

      {/* Production Logs Section */}
      <section className="space-y-6">
        <div className="flex justify-between items-center group">
          <div className="space-y-1">
         
            <p className="text-2xl font-black text-on-surface tracking-tight">최근 생산 활동</p>
          </div>
          <button 
            onClick={() => onNavigate('production')}
            className="text-primary font-black text-sm uppercase tracking-widest hover:underline decoration-2 underline-offset-4"
          >
            기록 더보기
          </button>
        </div>
        
        <div className="overflow-hidden border-2 border-outline-variant/20 rounded-[40px] bg-white shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container/30 border-b border-outline-variant/30 text-xs md:text-[15px] uppercase font-black text-outline tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">BATCH/SKU</th>
                  <th className="px-8 py-6">품목 (ITEM)</th>
                  <th className="px-8 py-6 text-center">생산량 (QTY)</th>
                  <th className="px-8 py-6 text-center">수율 지표</th>
                  <th className="px-8 py-6 text-right">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {production.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-primary/[0.02] transition-colors group/row">
                    <td className="px-8 py-7">
                      <span className="text-lg md:text-[21px] font-mono text-outline font-black tracking-widest px-3 py-1 bg-surface-container rounded-lg">{row.batchId || row.sku}</span>
                    </td>
                    <td className="px-8 py-7">
                       <p className="text-3xl md:text-4xl font-black text-on-surface leading-none tracking-tighter group-hover/row:text-primary transition-colors">{row.title}</p>
                       <p className="text-xs md:text-[15px] font-bold text-outline-variant uppercase tracking-widest mt-2 px-1">PRODUCTION LINE A1</p>
                    </td>
                    <td className="px-8 py-7 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-4xl md:text-5xl font-black text-primary tracking-tighter tabular-nums">
                          {row.weight?.toString().toLowerCase().includes('kg') ? row.weight.replace('kg', '') : row.weight}
                          <span className="text-base md:text-xl ml-1 text-outline uppercase tracking-widest">kg</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-7 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-3xl md:text-4xl font-black tabular-nums tracking-tight ${row.yield && parseFloat(row.yield) < 95 ? 'text-error' : 'text-emerald-600'}`}>
                          {row.yield || (row.loss ? `${100 - parseFloat(row.loss)}%` : '-')}
                        </span>
                        {row.loss && <span className="text-[14px] font-black text-error/50 uppercase tracking-widest mt-1">Loss {row.loss}%</span>}
                      </div>
                    </td>
                    <td className="px-8 py-7 text-right">
                      <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs md:text-[15px] font-black uppercase tracking-widest border-2 ${
                        row.status === '완료' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                        row.status === '진행중' ? 'bg-primary/5 text-primary border-primary/20 animate-pulse' : 
                        'bg-surface-container text-outline border-outline-variant/30'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${row.status === '완료' ? 'bg-emerald-500' : row.status === '진행중' ? 'bg-primary' : 'bg-outline'}`} />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

const InventoryView = ({ onNavigate, inventory, logistics, isAuthorized = false }: { onNavigate: (view: ViewType, item?: any) => void, inventory: any[], logistics: any[], isAuthorized?: boolean }) => {
  const [timeFilter, setTimeFilter] = useState('주간');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const stats = useMemo(() => {
    // InventoryView gets logistics from props now (I will update props in main App)
    const inWeight = (logistics || []).filter(l => l.type === '입고').reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);
    const outWeight = (logistics || []).filter(l => l.type === '출고').reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);

    return [
      { label: '총 SKU', value: inventory.length.toLocaleString(), color: 'text-primary' },
      { label: '재고 부족', value: inventory.filter(i => i.currentStock < i.safetyStock).length.toString(), color: 'text-error' },
      { label: `${timeFilter} 입고`, value: inWeight.toLocaleString(), unit: 'kg', color: 'text-secondary' },
      { label: `${timeFilter} 출고`, value: outWeight.toLocaleString(), unit: 'kg', color: 'text-emerald-500' },
    ];
  }, [inventory, logistics, timeFilter]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('dashboard')}
            className="p-3 bg-surface-container hover:bg-surface-container-high rounded-full transition-all text-outline"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-on-surface tracking-tighter">재고관리</h2>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative group flex-1 sm:flex-none">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              placeholder="품목 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-48 h-12 pl-12 pr-6 bg-white border-2 border-outline-variant/30 rounded-2xl font-black text-sm tracking-widest focus:border-primary outline-none shadow-sm transition-all appearance-none"
            />
          </div>

          {/* Calendar Picker */}
          <div className="relative group flex-1 sm:flex-none">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary">
              <Calendar className="w-5 h-5" />
            </div>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto h-12 pl-12 pr-6 bg-white border-2 border-outline-variant/30 rounded-2xl font-black text-sm uppercase tracking-widest focus:border-primary outline-none shadow-sm transition-all appearance-none"
            />
          </div>

          {/* Time Filter Tabs */}
          <div className="bg-surface-container p-1 rounded-2xl flex items-center border-2 border-outline-variant/30 w-fit">
          {['일간', '주간', '월간'].map((t) => (
            <button 
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                timeFilter === t 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'text-outline hover:bg-surface-container-high'
              }`}
            >
              {t}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((item, i) => (
          <div key={i} className="bg-white border-2 border-outline-variant/30 p-8 rounded-[40px] flex flex-col items-center text-center shadow-lg hover:border-primary transition-all group relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 group-hover:h-2 transition-all ${
              item.label.includes('부족') ? 'bg-error/20' : 
              item.label.includes('입고') ? 'bg-secondary/20' :
              item.label.includes('출고') ? 'bg-emerald-600/20' : 'bg-primary/20'
            }`} />
            <p className="text-[10px] md:text-xs font-black text-outline uppercase tracking-[0.3em] mb-4">{item.label}</p>
            <div className="flex items-baseline gap-1">
              <p className={`text-4xl md:text-6xl font-black tabular-nums tracking-tighter leading-none ${item.color}`}>
                {item.value}
              </p>
              {item.unit && <span className={`text-sm md:text-xl font-black uppercase tracking-widest ${item.color === 'text-on-surface' ? 'text-outline-variant' : item.color.replace('text-', 'text-/40')}`}>{item.unit}</span>}
              {!item.unit && item.label.includes('SKU') && <span className="text-sm md:text-xl font-black text-outline-variant uppercase tracking-widest">종</span>}
              {!item.unit && item.label.includes('부족') && <span className="text-sm md:text-xl font-black text-error/40 uppercase tracking-widest">건</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border-2 border-outline-variant/30 rounded-[40px] shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container/50 border-b-2 border-outline-variant/10">
                <th className="px-4 py-4 text-center text-sm font-black text-outline uppercase tracking-[0.2em]">SKU/위치</th>
                <th className="px-4 py-4 text-left text-sm font-black text-outline uppercase tracking-[0.2em]">품목 정보</th>
                <th className="px-4 py-4 text-left text-sm font-black text-outline uppercase tracking-[0.2em]">카테고리</th>
                <th className="px-4 py-4 text-right text-sm font-black text-outline uppercase tracking-[0.2em]">현재 재고</th>
                <th className="px-4 py-4 text-center text-sm font-black text-outline uppercase tracking-[0.2em]">상태</th>
                <th className="px-4 py-4 text-right text-sm font-black text-outline uppercase tracking-[0.2em]">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item, i) => (
                <tr 
                  key={i} 
                  onClick={() => onNavigate('detail', item)}
                  className={`border-b border-outline-variant/5 hover:bg-surface-container/30 transition-colors cursor-pointer group ${item.currentStock < item.safetyStock ? 'bg-error/[0.02]' : ''}`}
                >
                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm md:text-base text-outline font-mono font-black tracking-widest">{item.sku}</span>
                      <span className="text-xs text-outline/60 font-black uppercase tracking-widest mt-1">{item.location}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110 ${item.currentStock < item.safetyStock ? 'bg-error text-white' : 'bg-primary/10 text-primary'}`}>
                        {item.currentStock < item.safetyStock ? <AlertTriangle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                      </div>
                      <p className="font-black text-xl md:text-2xl text-on-surface group-hover:text-primary transition-colors tracking-tighter truncate max-w-[300px]">
                        {item.name}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="px-5 py-2 bg-surface-container text-on-surface-variant rounded-full text-sm font-black uppercase tracking-widest border border-outline-variant/30">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-baseline justify-end gap-1">
                      <p className={`font-black text-2xl md:text-3xl tabular-nums tracking-tighter ${item.currentStock < item.safetyStock ? 'text-error' : 'text-primary'}`}>
                        {item.currentStock.toLocaleString()}
                      </p>
                      <span className="text-sm font-black text-outline uppercase">{item.unit}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border-2 ${
                      item.currentStock < item.safetyStock 
                        ? 'bg-error/5 border-error/20 text-error' 
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${item.currentStock < item.safetyStock ? 'bg-error animate-pulse' : 'bg-emerald-500'}`} />
                      <span className="text-sm font-black uppercase tracking-widest">{item.currentStock < item.safetyStock ? '재고 부족' : '정상 운영'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex flex-col items-center gap-1 group/edit">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('detail', item);
                          }}
                          className="w-10 h-10 md:w-12 md:h-12 bg-white border-2 border-outline-variant/30 rounded-xl text-outline hover:border-primary hover:text-primary transition-all active:scale-95 flex items-center justify-center shadow-sm"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex flex-col items-center gap-1 group/delete">
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('정말로 이 재고 항목을 삭제하시겠습니까?')) {
                              try {
                                await deleteDoc(doc(db, 'inventory', item.id));
                              } catch (error) {
                                handleFirestoreError(error, OperationType.DELETE, 'inventory');
                              }
                            }
                          }}
                          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-outline hover:text-error hover:bg-error/5 rounded-xl transition-all border-2 border-transparent hover:border-error/20"
                        >
                          <Trash2 className="w-5 h-5" />

                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ItemDetailView = ({ onNavigate, userData, item, isAuthorized = false }: { onNavigate: (view: ViewType, item?: any) => void, userData: any, item: any, isAuthorized?: boolean }) => {
  const isAdmin = userData?.role === 'admin';
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit states
  const [editData, setEditData] = useState({
    name: '',
    sku: '',
    category: '',
    unit: '',
    currentStock: 0,
    safetyStock: 0,
    location: '',
    purchasePrice: 0,
    salesPrice: 0,
    ...item
  });
  const [newStock, setNewStock] = useState(item?.currentStock || 0);
  
  if (!item) return <div>상품 정보가 없습니다.</div>;

  const handleUpdateInfo = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'inventory', item.id);
      await updateDoc(docRef, {
        ...editData,
        updatedAt: serverTimestamp()
      });
      setIsEditingInfo(false);
      alert('품목 정보가 수정되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'inventory', item.id);
      await updateDoc(docRef, {
        currentStock: Number(newStock),
        updatedAt: serverTimestamp()
      });
      setIsUpdatingStock(false);
      alert('재고가 업데이트되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inventory');
    } finally {
      setLoading(false);
    }
  };

  const margin = item.salesPrice - item.purchasePrice;
  const marginPercent = ((margin / item.purchasePrice) * 100).toFixed(1);

  const displayStock = isUpdatingStock ? Number(newStock) : item.currentStock;
  const safeStock = item.safetyStock || 1;
  const supplyRate = Math.round((displayStock / safeStock) * 100);

  return (
    <div className="space-y-4 md:space-y-6 px-1 md:px-0">
      <div className="flex items-center gap-4 md:gap-8">
        <button 
          onClick={() => onNavigate('inventory')}
          className="p-3 md:p-5 bg-surface-container hover:bg-surface-container-high rounded-full transition-all text-outline shadow-sm active:scale-90 shrink-0"
        >
          <ArrowLeft className="w-5 h-5 md:w-8 h-8" />
        </button>
        <nav className="flex items-center gap-2 md:gap-3 text-on-surface-variant text-sm md:text-xl font-black uppercase tracking-widest overflow-hidden">
          <button onClick={() => onNavigate('inventory')} className="hover:text-primary transition-colors tracking-widest whitespace-nowrap truncate max-w-[120px] md:max-w-none">{item.category}</button>
          <ChevronRight className="w-4 h-4 md:w-6 md:h-6 shrink-0" />
          <span className="text-primary whitespace-nowrap">상세 정보 (DETAIL)</span>
        </nav>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-10">
        <div className="space-y-2 md:space-y-4 flex-1 w-full">
          {isEditingInfo ? (
            <div className="space-y-4 bg-white p-5 md:p-6 rounded-[24px] border-2 border-primary shadow-lg animate-in fade-in slide-in-from-top-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">품목명</label>
                  <input 
                    type="text" 
                    value={editData.name} 
                    onChange={e => setEditData({...editData, name: e.target.value})}
                    className="w-full h-10 md:h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-lg md:text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">SKU</label>
                  <input 
                    type="text" 
                    value={editData.sku} 
                    onChange={e => setEditData({...editData, sku: e.target.value})}
                    className="w-full h-10 md:h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-mono font-bold text-lg md:text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">카테고리</label>
                  <input 
                    type="text" 
                    value={editData.category} 
                    onChange={e => setEditData({...editData, category: e.target.value})}
                    className="w-full h-10 md:h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-lg md:text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">단위</label>
                  <input 
                    type="text" 
                    value={editData.unit} 
                    onChange={e => setEditData({...editData, unit: e.target.value})}
                    className="w-full h-10 md:h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-lg md:text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">안전 재고</label>
                  <input 
                    type="number" 
                    value={editData.safetyStock} 
                    onChange={e => setEditData({...editData, safetyStock: Number(e.target.value)})}
                    className="w-full h-10 md:h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-lg md:text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">보관 위치</label>
                  <input 
                    type="text" 
                    value={editData.location} 
                    onChange={e => setEditData({...editData, location: e.target.value})}
                    className="w-full h-10 md:h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-lg md:text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-secondary uppercase px-1">매입 단가 (Cost)</label>
                  <input 
                    type="number" 
                    value={editData.purchasePrice} 
                    onChange={e => setEditData({...editData, purchasePrice: Number(e.target.value)})}
                    className="w-full h-10 md:h-12 px-4 rounded-xl border border-outline-variant focus:border-secondary outline-none font-bold text-lg md:text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-secondary uppercase px-1">판매 단가 (Price)</label>
                  <input 
                    type="number" 
                    value={editData.salesPrice} 
                    onChange={e => setEditData({...editData, salesPrice: Number(e.target.value)})}
                    className="w-full h-10 md:h-12 px-4 rounded-xl border border-outline-variant focus:border-secondary outline-none font-bold text-lg md:text-xl"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2 md:pt-4">
                <button 
                  onClick={handleUpdateInfo}
                  disabled={loading}
                  className="flex-1 bg-primary text-white h-12 md:h-14 rounded-xl font-black uppercase tracking-widest text-base md:text-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? '저장 중...' : '품목 정보 저장'}
                </button>
                <button 
                  onClick={() => {
                    setIsEditingInfo(false);
                    setEditData({ ...item });
                  }}
                  className="px-6 md:px-8 bg-surface-container text-outline h-12 md:h-14 rounded-xl font-black uppercase tracking-widest text-base md:text-lg hover:bg-surface-container-high transition-all"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl md:text-5xl font-black text-primary tracking-tighter leading-tight md:leading-none">{item.name}</h1>
              <p className="text-base md:text-2xl font-mono text-outline font-black mt-1 md:mt-2 tracking-[0.1em] md:tracking-[0.2em]">{item.sku}</p>
            </>
          )}
        </div>
        {!isEditingInfo && (
          <div className="flex flex-col items-end gap-3 md:gap-4 w-full md:w-auto">
            <button 
              onClick={() => setIsEditingInfo(true)}
              className="flex items-center gap-2 md:gap-3 text-primary text-lg md:text-2xl font-black hover:underline uppercase tracking-widest decoration-4 underline-offset-8"
            >
              <Edit className="w-5 h-5 md:w-7 h-7" /> 정보 수정
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* 재고 현황 지표 (LARGE HEADER) */}
        <div className="bg-white border-2 md:border-4 border-primary/20 rounded-[24px] md:rounded-[40px] p-6 md:p-10 shadow-xl md:shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5 md:opacity-10 translate-x-1/4 -translate-y-1/4">
            <TrendingUp className="w-48 h-48 md:w-64 md:h-64 text-primary" />
          </div>
          
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-center">
            <div className="space-y-2 md:space-y-4">
              <h3 className="text-sm md:text-xl font-black text-primary uppercase tracking-[0.2em] md:tracking-[0.3em]">현재 재고 현황</h3>
              <div className="flex items-baseline gap-2">
                <p className={`text-5xl md:text-8xl font-black tracking-tighter tabular-nums transition-colors ${isUpdatingStock && displayStock !== item.currentStock ? 'text-secondary' : 'text-primary'}`}>
                  {displayStock.toLocaleString()}
                </p>
                <span className="text-xl md:text-3xl font-black text-outline uppercase">{item.unit}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:gap-10 md:border-l-4 md:border-outline-variant/30 md:pl-12">
              <div className="space-y-1 md:space-y-3">
                <p className="text-[10px] md:text-sm font-black text-outline uppercase tracking-widest">안전 재고</p>
                <p className="text-2xl md:text-4xl font-black text-on-surface tracking-tight tabular-nums">{item.safetyStock.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-surface-container p-5 md:p-8 rounded-[24px] md:rounded-[32px] border-2 border-outline-variant/30 flex flex-col justify-center items-center gap-1 md:gap-2">
              <span className="text-[10px] md:text-xs font-black text-outline uppercase tracking-widest text-center">적정 재고 대비 공급율</span>
              <div className="flex items-baseline gap-2 md:gap-3">
                <span className={`text-3xl md:text-5xl font-black tabular-nums tracking-tighter ${displayStock < safeStock ? 'text-error' : 'text-primary'}`}>
                  {supplyRate}%
                </span>
                <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full ${displayStock < safeStock ? 'bg-error animate-pulse shadow-[0_0_10px_rgba(255,0,0,0.5)]' : 'bg-primary'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* 재고 업데이트 영역 */}
        <div className="flex flex-col gap-6">
          {isUpdatingStock ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-primary/5 p-6 md:p-10 rounded-[24px] md:rounded-[40px] border-2 md:border-4 border-primary shadow-2xl space-y-6 md:space-y-8"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl md:text-3xl font-black text-primary uppercase tracking-tight flex items-center gap-3 md:gap-4">
                  <Package className="w-6 h-6 md:w-10 md:h-10" /> 실재고 수량 수정
                </h3>
                <p className="text-sm md:text-xl font-black text-outline">기본 실적: {item.currentStock}{item.unit}</p>
              </div>
              <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-8">
                <div className="flex-1 w-full relative">
                  <input 
                    type="number" 
                    value={newStock}
                    onChange={e => setNewStock(e.target.value)}
                    className="w-full h-20 md:h-32 px-6 md:px-10 rounded-[20px] md:rounded-[32px] border-2 md:border-4 border-primary text-4xl md:text-7xl font-black focus:outline-none shadow-inner tracking-tighter tabular-nums"
                    autoFocus
                  />
                  <span className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 text-xl md:text-4xl font-black text-primary/40 uppercase">{item.unit}</span>
                </div>
                <div className="flex flex-row lg:flex-col gap-3 w-full lg:w-72">
                  <button 
                    onClick={handleUpdateStock}
                    disabled={loading}
                    className="h-16 md:h-20 flex-1 bg-primary text-white rounded-[16px] md:rounded-[24px] font-black text-lg md:text-2xl uppercase tracking-widest shadow-xl hover:translate-y-[-4px] active:translate-y-0 transition-all disabled:opacity-50"
                  >
                    {loading ? '저장 중...' : '변경 완료'}
                  </button>
                  <button 
                    onClick={() => {
                      setIsUpdatingStock(false);
                      setNewStock(item.currentStock);
                    }}
                    className="h-16 md:h-20 flex-1 bg-white text-outline border-2 md:border-4 border-outline-variant rounded-[16px] md:rounded-[24px] font-black text-base md:text-xl uppercase tracking-widest hover:bg-surface-container transition-all"
                  >
                    취소
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 md:gap-4">
                {[
                  { label: '+1', val: 1, color: 'border-primary text-primary' },
                  { label: '+10', val: 10, color: 'border-primary text-primary' },
                  { label: '+50', val: 50, color: 'border-primary text-primary' },
                  { label: '-1', val: -1, color: 'border-error text-error' },
                  { label: '-10', val: -10, color: 'border-error text-error' },
                ].map((btn, i) => (
                  <button 
                    key={i}
                    onClick={() => setNewStock(Math.max(0, Number(newStock) + btn.val))} 
                    className={`h-12 md:h-16 bg-white border-2 rounded-xl md:rounded-2xl font-black text-sm md:text-2xl hover:bg-surface-container transition-all shadow-sm ${btn.color}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <button 
              onClick={() => setIsUpdatingStock(true)}
              className="w-full bg-primary text-white h-16 md:h-24 rounded-[20px] md:rounded-[32px] flex items-center justify-center gap-4 md:gap-6 font-black text-xl md:text-3xl shadow-[0_10px_30px_rgba(var(--primary-rgb),0.2)] hover:scale-[1.01] active:scale-[0.98] transition-all uppercase tracking-[0.15em] md:tracking-[0.2em]"
            >
              <Package className="w-6 h-6 md:w-10 md:h-10" /> 재고 수량 업데이트
            </button>
          )}
        </div>

        {/* Financial Info Section (New, only for authorized) */}
        {isAuthorized && (
          <div className="bg-white border-2 border-secondary/20 rounded-[24px] md:rounded-[40px] p-6 md:p-10 shadow-lg md:shadow-xl space-y-8">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-6">
              <div className="space-y-1">
                <h3 className="text-[10px] md:text-sm font-black text-secondary uppercase tracking-[0.2em] md:tracking-[0.3em]">FINANCIAL PERFORMANCE</h3>
                <p className="text-xl md:text-3xl font-black text-on-surface tracking-tight">수익성 및 단가 지표</p>
              </div>
              <div className="w-12 h-12 md:w-16 md:h-16 bg-secondary/10 rounded-2xl md:rounded-[24px] flex items-center justify-center">
                <TrendingUp className="w-7 h-7 md:w-10 md:h-10 text-secondary" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Purchase Price Box */}
              <div className="p-6 bg-surface-container/20 rounded-3xl border-2 border-outline-variant/30 hover:border-primary/30 transition-all group/cost">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ArrowDownToLine className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-outline uppercase tracking-widest">매입 단가</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-primary tracking-tighter tabular-nums">
                    ₩{item.purchasePrice?.toLocaleString()}
                  </p>
                  <p className="text-[9px] font-bold text-outline/60 uppercase tracking-widest leading-none">Cost per Unit</p>
                </div>
              </div>

              {/* Sales Price Box */}
              <div className="p-6 bg-surface-container/20 rounded-3xl border-2 border-outline-variant/30 hover:border-secondary/30 transition-all group/price">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-outline uppercase tracking-widest">판매 단가</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-secondary tracking-tighter tabular-nums">
                    ₩{item.salesPrice?.toLocaleString()}
                  </p>
                  <p className="text-[9px] font-bold text-outline/60 uppercase tracking-widest leading-none">Price per Unit</p>
                </div>
              </div>

              {/* Profit Amount Box */}
              <div className="p-6 bg-emerald-50 rounded-3xl border-2 border-emerald-100 hover:border-emerald-300 transition-all group/profit">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">기대 수익 (Profit)</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-emerald-600 tracking-tighter tabular-nums">
                    +₩{margin.toLocaleString()}
                  </p>
                  <p className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-widest leading-none">Earnings per Unit</p>
                </div>
              </div>

              {/* Margin Percentage Box */}
              <div className="p-6 bg-primary/5 rounded-3xl border-2 border-primary/20 hover:border-primary/40 transition-all group/margin">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">수익률 (Margin)</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-primary tracking-tighter tabular-nums">
                    {marginPercent}%
                  </p>
                  <p className="text-[9px] font-bold text-primary/60 uppercase tracking-widest leading-none">Net Margin Rate</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 하단 2열 정보 섹션 */}
        <div className="bg-white border-2 border-outline-variant rounded-[24px] md:rounded-[40px] p-6 md:p-10 shadow-lg md:shadow-xl group hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between mb-8 md:mb-10">
            <div className="space-y-1">
              <h3 className="text-[10px] md:text-sm font-black text-outline uppercase tracking-[0.2em] md:tracking-[0.3em]">RECENT ACTIVITY</h3>
              <p className="text-xl md:text-3xl font-black text-on-surface tracking-tight">최근 활동 내역</p>
            </div>
            <History className="w-6 h-6 md:w-10 md:h-10 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
          </div>
          
          <div className="relative pt-6 md:pt-8 w-full overflow-x-auto pb-4 custom-scrollbar">
            <div className="absolute top-[35px] md:top-[43px] left-0 right-0 h-1 bg-outline-variant/30 rounded-full min-w-[800px]" />
            
            <div className="flex gap-6 md:gap-10 min-w-max px-2">
            {[
              { title: '신규 입고: #B-9021', time: '오전 10:45 · 2024.03.20', type: 'in', desc: '냉동창고 A-1 입고 완료', color: 'bg-emerald-500' },
              { title: '재고 조사 완료', time: '오후 03:20 · 2024.03.18', type: 'check', desc: '실재고 합치 확인됨', color: 'bg-outline' },
              { title: '가공 출하', time: '오후 01:15 · 2024.03.15', type: 'out', desc: '육정가공센터 박스 출하', color: 'bg-primary' },
              { title: '품질 검수 완료', time: '오전 09:00 · 2024.03.12', type: 'check', desc: 'A등급 판정', color: 'bg-secondary' }
            ].map((activity, idx) => (
              <div key={idx} className="relative group/item w-[280px] shrink-0">
                <div className={`absolute top-0 left-4 w-4 h-4 md:w-5 md:h-5 rounded-full ring-4 md:ring-8 ring-white shadow-md transition-transform group-hover/item:scale-150 ${activity.color} z-10`} />
                <div className="pt-10 md:pt-14 space-y-1 md:space-y-2">
                  <p className="text-base md:text-xl font-black text-on-surface tracking-tight">{activity.title}</p>
                  <p className="text-[10px] md:text-xs font-black text-outline uppercase tracking-widest">{activity.time}</p>
                  <div className="p-3 md:p-4 bg-surface-container/50 rounded-xl md:rounded-2xl border border-outline-variant/20 mt-3 italic text-on-surface-variant font-bold text-xs md:text-sm">
                    "{activity.desc}"
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LogisticsView = ({ 
  logistics, 
  inventory, 
  partners, 
  onNavigate 
}: { 
  logistics: any[], 
  inventory: any[],
  partners: any[],
  onNavigate?: (view: ViewType) => void 
}) => {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    type: '입고' as '입고' | '출고',
    item: '',
    partner: '',
    weight: '',
    freightType: '선불',
    status: '완료'
  });

  // Filter state
  const [filters, setFilters] = useState({
    item: '',
    startDate: '',
    endDate: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        weight: Number(formData.weight),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        const ref = doc(db, 'logistics', editingId);
        await setDoc(ref, dataToSave, { merge: true });
        alert('물류 기록이 수정되었습니다.');
      } else {
        const ref = collection(db, 'logistics');
        await addDoc(ref, {
          ...dataToSave,
          createdAt: serverTimestamp(),
          color: formData.type === '입고' ? 'bg-emerald-500' : 'bg-error'
        });
        alert('물류 기록이 등록되었습니다.');
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'logistics');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      type: '입고',
      item: '',
      partner: '',
      weight: '',
      freightType: '선불',
      status: '완료'
    });
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말로 이 물류 기록을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'logistics', id));
      alert('물류 기록이 삭제되었습니다.');
      if (editingId === id) resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'logistics');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (record: any) => {
    setEditingId(record.id);
    setFormData({
      date: record.date || record.createdAt?.toDate().toISOString().split('T')[0] || '',
      time: record.time || '',
      type: record.type || '입고',
      item: record.item || record.title || '',
      partner: record.partner || '',
      weight: record.weight?.toString() || '',
      freightType: record.freightType || '선불',
      status: record.status || '완료'
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredLogistics = useMemo(() => {
    return logistics.filter(l => {
      const matchItem = !filters.item || l.item?.toLowerCase().includes(filters.item.toLowerCase()) || l.title?.toLowerCase().includes(filters.item.toLowerCase());
      const recordDate = l.date || l.createdAt?.toDate().toISOString().split('T')[0];
      const matchStartDate = !filters.startDate || recordDate >= filters.startDate;
      const matchEndDate = !filters.endDate || recordDate <= filters.endDate;
      return matchItem && matchStartDate && matchEndDate;
    }).sort((a, b) => {
      const dateA = a.date || a.createdAt?.toDate().toISOString().split('T')[0];
      const dateB = b.date || b.createdAt?.toDate().toISOString().split('T')[0];
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return b.time.localeCompare(a.time);
    });
  }, [logistics, filters]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecs = logistics.filter(l => (l.date || l.createdAt?.toDate().toISOString().split('T')[0]) === today);
    const weight = todayRecs.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);
    const inCount = todayRecs.filter(l => l.type === '입고').length;
    const outCount = todayRecs.filter(l => l.type === '출고').length;
    return { weight, inCount, outCount };
  }, [logistics]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate?.('dashboard')}
            className="p-4 bg-surface-container hover:bg-surface-container-high rounded-full transition-all text-outline"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-on-surface tracking-tighter">물류현황</h2>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowForm(!showForm)}
            className={`${showForm ? 'bg-secondary' : 'bg-primary'} text-white h-14 px-8 rounded-2xl flex items-center gap-3 text-base font-black shadow-lg transition-all hover:opacity-90 active:scale-95 uppercase tracking-widest`}
          >
            {showForm ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            {showForm ? (editingId ? '수정 취소' : '닫기') : '신규 입고/출고'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border-2 border-outline-variant/30 shadow-2xl overflow-hidden">
              <div className="bg-surface-container/50 px-6 py-4 border-b border-outline-variant/30">
                <h3 className="text-lg font-black text-primary uppercase tracking-widest">
                  {editingId ? '물류 기록 수정' : '신규 입고/출고 등록'}
                </h3>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4 space-y-2">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest">날짜/시간</label>
                    <div className="flex gap-2">
                      <input required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} type="date" className="flex-2 h-10 px-2 rounded-xl border border-outline-variant focus:border-primary outline-none text-sm font-bold bg-surface-container/50 shadow-inner" />
                      <input required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} type="time" className="flex-1 h-10 px-2 rounded-xl border border-outline-variant focus:border-primary outline-none text-sm font-bold bg-surface-container/50 shadow-inner" />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest">구분</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full h-10 px-2 rounded-xl border border-outline-variant focus:border-primary outline-none text-[11px] font-black bg-surface-container/50 shadow-inner cursor-pointer">
                      <option value="입고">입고 (IN)</option>
                      <option value="출고">출고 (OUT)</option>
                    </select>
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest">품목 (Item)</label>
                    <div className="relative">
                      <input 
                        required 
                        list="items-list"
                        value={formData.item} 
                        onChange={e => setFormData({...formData, item: e.target.value})} 
                        placeholder="제품명 입력" 
                        className="w-full h-10 px-3 rounded-xl border border-outline-variant focus:border-primary outline-none text-sm font-black bg-white shadow-inner" 
                      />
                      <datalist id="items-list">
                        {inventory.map((item, i) => <option key={i} value={item.name} />)}
                      </datalist>
                    </div>
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest">거래처 (Partner)</label>
                    <select required value={formData.partner} onChange={e => setFormData({...formData, partner: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-outline-variant focus:border-primary outline-none text-sm font-black bg-white shadow-inner cursor-pointer">
                      <option value="">선택</option>
                      {partners.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest">중량 (KG)</label>
                    <input required value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} type="number" step="0.01" placeholder="0.0" className="w-full h-10 px-3 rounded-xl border border-outline-variant focus:border-primary outline-none text-base font-black text-primary bg-white shadow-inner" />
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest">운임 형태</label>
                    <select value={formData.freightType} onChange={e => setFormData({...formData, freightType: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-outline-variant focus:border-primary outline-none text-sm font-bold bg-white shadow-inner cursor-pointer">
                      <option value="선불">선불</option>
                      <option value="착불">착불</option>
                      <option value="당사부담">당사부담</option>
                      <option value="무료">무료</option>
                    </select>
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest">상태</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-outline-variant focus:border-primary outline-none text-sm font-bold bg-white shadow-inner cursor-pointer">
                      <option value="완료">완료</option>
                      <option value="진행중">진행중</option>
                      <option value="대기">대기</option>
                    </select>
                  </div>

                  <div className="md:col-span-4 flex items-end">
                    <button disabled={loading} type="submit" className="w-full h-10 bg-primary text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
                      {loading ? '기록 중...' : (editingId ? '수정 저장' : '등록 완료')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white border-2 border-outline-variant/30 p-8 rounded-[40px] flex flex-col items-center text-center shadow-lg hover:border-primary transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary/10 group-hover:h-2 transition-all" />
          <p className="text-[10px] md:text-xs font-black text-outline uppercase tracking-[0.3em] mb-4">금일 총 물동량</p>
          <div className="flex items-baseline gap-1">
            <p className="text-4xl md:text-6xl font-black text-on-surface tabular-nums tracking-tighter leading-none">{stats.weight.toLocaleString()}</p>
            <span className="text-sm md:text-xl font-black text-outline-variant uppercase tracking-widest">kg</span>
          </div>
        </div>

        <div className="bg-white border-2 border-outline-variant/30 p-8 rounded-[40px] flex flex-col items-center text-center shadow-lg hover:border-primary transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/10 group-hover:h-2 transition-all" />
          <p className="text-[10px] md:text-xs font-black text-outline uppercase tracking-[0.3em] mb-4">금일 입고</p>
          <div className="flex items-baseline gap-1">
            <p className="text-4xl md:text-6xl font-black text-on-surface tabular-nums tracking-tighter leading-none">{stats.inCount}</p>
            <span className="text-sm md:text-xl font-black text-outline-variant uppercase tracking-widest">건</span>
          </div>
        </div>

        <div className="bg-white border-2 border-outline-variant/30 p-8 rounded-[40px] flex flex-col items-center text-center shadow-lg hover:border-primary transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/10 group-hover:h-2 transition-all" />
          <p className="text-[10px] md:text-xs font-black text-outline uppercase tracking-[0.3em] mb-4">금일 출고</p>
          <div className="flex items-baseline gap-1">
            <p className="text-4xl md:text-6xl font-black text-on-surface tabular-nums tracking-tighter leading-none">{stats.outCount}</p>
            <span className="text-sm md:text-xl font-black text-outline-variant uppercase tracking-widest">건</span>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-surface-container p-4 rounded-2xl flex flex-wrap items-center gap-4">
        <div className="relative w-1/3 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
          <input 
            type="text" 
            placeholder="품목명으로 필터..." 
            value={filters.item}
            onChange={e => setFilters({...filters, item: e.target.value})}
            className="w-full h-10 pl-10 pr-4 bg-white border border-outline-variant rounded-xl outline-none text-sm font-medium focus:border-primary"
          />
        </div>
        <div className="flex-1 flex items-center gap-2 min-w-[300px]">
          <CalendarDays className="w-4 h-4 text-outline" />
          <input 
            type="date" 
            value={filters.startDate}
            onChange={e => setFilters({...filters, startDate: e.target.value})}
            className="flex-1 h-10 px-3 bg-white border border-outline-variant rounded-lg text-xs font-bold outline-none text-center" 
          />
          <span className="text-outline text-xs px-1">~</span>
          <input 
            type="date" 
            value={filters.endDate}
            onChange={e => setFilters({...filters, endDate: e.target.value})}
            className="flex-1 h-10 px-3 bg-white border border-outline-variant rounded-lg text-xs font-bold outline-none text-center" 
          />
        </div>
        {(filters.item || filters.startDate || filters.endDate) && (
          <button 
            onClick={() => setFilters({ item: '', startDate: '', endDate: '' })}
            className="text-[9px] font-black text-primary uppercase hover:underline"
          >
            초기화
          </button>
        )}
      </div>

      <div className="space-y-4">
        {filteredLogistics.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredLogistics.map((item, i) => (
              <div 
                key={item.id} 
                className="bg-white p-4 border-2 rounded-2xl shadow-sm hover:border-primary transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4 border-outline-variant/30"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.type === '입고' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-error/10 text-error'}`}>
                    {item.type === '입고' ? <ArrowDownToLine className="w-5 h-5" /> : <ArrowUpFromLine className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-black text-outline uppercase tracking-tighter">{item.date || item.createdAt?.toDate().toISOString().split('T')[0]} · {item.time}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md text-white uppercase tracking-widest ${item.type === '입고' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/20' : 'bg-error shadow-sm shadow-error/20'}`}>{item.type}</span>
                    </div>
                    <h3 className="text-xl font-black text-on-surface group-hover:text-primary transition-colors tracking-tight">{item.item || item.title}</h3>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      <p className="flex items-center gap-2 text-sm text-on-surface-variant font-bold"><Truck className="w-4 h-4 text-outline" /> {item.partner}</p>
                      <p className="text-lg font-black text-primary uppercase tracking-widest">
                        {item.weight ? (item.weight.toString().toLowerCase().includes('kg') ? item.weight.toUpperCase() : `${item.weight} KG`) : item.qty}
                      </p>
                      <p className="text-[9px] font-black text-outline uppercase bg-surface-container px-3 py-1 rounded-lg tracking-widest">{item.freightType || '운임미지정'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 pl-2 lg:pl-0 border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="flex flex-col items-end">
                    <span className={`text-sm font-black flex items-center gap-2 uppercase tracking-widest ${item.status === '완료' ? (item.type === '입고' ? 'text-emerald-700' : 'text-error') : 'text-outline'}`}>
                      <span className={`w-3 h-3 rounded-full shadow-sm ${item.status === '완료' ? (item.type === '입고' ? 'bg-emerald-500' : 'bg-error') : 'bg-outline-variant'}`} />
                      {item.status}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(item);
                      }}
                      className="h-10 px-6 border-2 border-primary text-primary rounded-xl text-sm font-black uppercase hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
                    >
                      수정
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="h-10 px-4 border-2 border-error text-error rounded-xl text-sm font-black uppercase hover:bg-error hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-20 text-center bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant">
            <Package className="w-12 h-12 text-outline/30 mx-auto mb-4" />
            <p className="text-outline font-bold">물류 기록이 존재하지 않거나 필터 결과와 일치하지 않습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ProductionView = ({ production, inventory, onNavigate }: { production: any[], inventory: any[], onNavigate?: (view: ViewType) => void }) => {
  const [showForm, setShowForm] = useState(false);
  const [productionLine, setProductionLine] = useState('삼산공장');
  const [items, setItems] = useState([{ title: '', rawMeat: '', input: '', production: '', yield: '', loss: '', manufDate: '', expiryDate: '' }]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [originalProduction, setOriginalProduction] = useState<number | null>(null);

  const filteredProduction = useMemo(() => {
    return production.filter(batch => {
      const matchesName = batch.title?.toLowerCase().includes(searchName.toLowerCase());
      const matchesDate = !searchDate || batch.manufDate === searchDate;
      return matchesName && matchesDate;
    });
  }, [production, searchName, searchDate]);

  const handleDeleteProduction = async (id: string, batchTitle: string, productionQty: any) => {
    if (!window.confirm('정말로 이 생산 기록을 삭제하시겠습니까? 관련 재고가 자동으로 차감됩니다.')) return;
    setLoading(true);
    try {
      // 1. Delete the batch
      await deleteDoc(doc(db, 'production_batches', id));

      // 2. Adjust inventory (decrease stock)
      const prodValue = parseFloat(productionQty.toString().replace(/[^0-9.]/g, '')) || 0;
      const existingInvItem = inventory.find(i => i.name === batchTitle);
      if (existingInvItem) {
        const invDocRef = doc(db, 'inventory', existingInvItem.id);
        await updateDoc(invDocRef, {
          currentStock: increment(-prodValue),
          updatedAt: serverTimestamp()
        });
      }
      
      alert('생산 기록이 삭제되고 재고가 조정되었습니다.');
      if (editingId === id) cancelEdit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'production_batches');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (batch: any) => {
    setEditingId(batch.id);
    setProductionLine(batch.productionLine);
    const prodVal = parseFloat((batch.production || batch.weight || '0').toString().replace(/[^0-9.]/g, '')) || 0;
    setOriginalProduction(prodVal);
    setItems([{
      title: batch.title || '',
      rawMeat: batch.rawMeat || '',
      input: batch.input || '',
      production: (batch.production || batch.weight || '').toString().toLowerCase().replace('kg', '').trim(),
      yield: batch.yield || '',
      loss: batch.loss || '',
      manufDate: batch.manufDate || '',
      expiryDate: batch.expiryDate || ''
    }]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setItems([{ title: '', rawMeat: '', input: '', production: '', yield: '', loss: '', manufDate: '', expiryDate: '' }]);
    setShowForm(false);
  };

  const addItem = () => {
    setItems([...items, { title: '', rawMeat: '', input: '', production: '', yield: '', loss: '', manufDate: '', expiryDate: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    // Auto calculate yield and loss
    if (field === 'input' || field === 'production') {
      const inputVal = parseFloat(field === 'input' ? value : item.input) || 0;
      const prodVal = parseFloat(field === 'production' ? value : item.production) || 0;
      
      if (inputVal > 0) {
        const yieldVal = (prodVal / inputVal) * 100;
        item.yield = yieldVal.toFixed(1);
        item.loss = (100 - yieldVal).toFixed(1);
      } else if (prodVal > 0) {
        item.yield = '100'; // Default if production exists but input is 0 (or not yet entered)
        item.loss = '0';
      } else {
        item.yield = '0';
        item.loss = '0';
      }
    }
    
    newItems[index] = item;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        // Update single batch
        const ref = doc(db, 'production_batches', editingId);
        const item = items[0];
        const newProd = parseFloat(item.production.toString().replace(/[^0-9.]/g, '')) || 0;
        const prodDiff = newProd - (originalProduction || 0);

        // Map production to weight for inventory compatibility if needed, but best to save both
        await setDoc(ref, {
          ...item,
          weight: item.production, // Still save as weight for dashboard cards etc
          productionLine,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Update inventory if production quantity changed
        if (prodDiff !== 0) {
          const existingInvItem = inventory.find(i => i.name === item.title);
          if (existingInvItem) {
            const invDocRef = doc(db, 'inventory', existingInvItem.id);
            await updateDoc(invDocRef, {
              currentStock: increment(prodDiff),
              updatedAt: serverTimestamp()
            });
          }
        }

        alert('생산일지가 성공적으로 수정되었습니다.');
      } else {
        // Create multiple batches
        const batchRef = collection(db, 'production_batches');
        const inventoryRef = collection(db, 'inventory');
        
        const promises = items.map(async (item) => {
          const batchId = `PRD-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
          const ref = doc(batchRef);
          
          // 1. Save production batch
          const existingInvItem = inventory.find(i => i.name === item.title);
          await setDoc(ref, {
            ...item,
            weight: item.production, // Compatibility
            productionLine,
            batchId,
            sku: existingInvItem?.sku || `SKU-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            status: '완료',
            createdAt: serverTimestamp(),
          });

          // 2. Pass to inventory
          const prodValue = parseFloat(item.production.toString().replace(/[^0-9.]/g, '')) || 0;

          if (existingInvItem) {
            // Update existing stock
            const invDocRef = doc(db, 'inventory', existingInvItem.id);
            const updateData: any = {
              currentStock: increment(prodValue),
              updatedAt: serverTimestamp(),
            };
            
            if (item.manufDate) updateData.manufactureDate = item.manufDate;
            if (item.expiryDate) updateData.expiryDate = item.expiryDate;

            await updateDoc(invDocRef, updateData);
          } else {
            // Create new inventory item
            const newInvDocRef = doc(inventoryRef);
            await setDoc(newInvDocRef, {
              sku: `SKU-AUTO-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
              name: item.title,
              category: '기타',
              unit: 'kg',
              currentStock: prodValue,
              safetyStock: Math.floor(prodValue * 0.2),
              location: '생산라인',
              purchasePrice: 0,
              salesPrice: 0,
              status: '정상',
              loss: item.loss + '%',
              manufactureDate: item.manufDate || '',
              expiryDate: item.expiryDate || '',
              updatedAt: serverTimestamp(),
            });
          }
        });

        await Promise.all(promises);
        
        alert('생산일지와 재고 데이터가 시스템에 연동되었습니다.');
      }
      
      setItems([{ title: '', rawMeat: '', input: '', production: '', yield: '', loss: '', manufDate: '', expiryDate: '' }]);
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'production_batches');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate?.('dashboard')}
            className="p-3 bg-surface-container hover:bg-surface-container-high rounded-full transition-all text-outline"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tighter uppercase">생산관리</h1>
            <p className="text-1xl font-bold text-on-surface-variant mt-1">생산공정 작업일지</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              if (editingId) {
                cancelEdit();
              } else {
                setShowForm(!showForm);
              }
            }}
            className={`${editingId ? 'bg-secondary' : 'bg-primary'} text-white h-12 px-6 rounded-2xl text-base font-black flex items-center gap-3 shadow-lg hover:opacity-90 transition-all active:scale-95 uppercase tracking-widest shadow-primary/20`}
          >
            {showForm ? (editingId ? <X className="w-6 h-6" /> : <ChevronRight className="w-6 h-6 rotate-90" />) : <Plus className="w-6 h-6" />}
            {showForm ? (editingId ? '수정 닫기' : '닫기') : '생산일지 등록'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`bg-white p-6 rounded-3xl border-4 ${editingId ? 'border-secondary/20 shadow-secondary/5' : 'border-primary/10 shadow-primary/5'} shadow-2xl space-y-6 relative`}>
              {editingId && (
                <div className="absolute top-4 right-4">
                  <span className="bg-secondary text-white text-xs font-black px-4 py-2 rounded-xl uppercase tracking-[0.2em] animate-pulse shadow-md">EDITING MODE</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-black text-primary uppercase tracking-widest">
                  {editingId ? '생산 일지 개별 수정' : '일지 정보 입력'}
                </h3>
                <div className="flex items-center gap-4">
                  <span className="text-base font-black text-outline uppercase tracking-widest">생산 라인:</span>
                  <select 
                    value={productionLine} 
                    onChange={e => setProductionLine(e.target.value)}
                    className="h-12 px-6 rounded-xl border-2 border-outline-variant focus:border-primary outline-none text-base font-black transition-colors bg-white shadow-sm"
                  >
                    <option value="삼산공장">삼산공장</option>
                    <option value="언양공장 식육가공">언양공장 식육가공</option>
                    <option value="언양공장 식육포장">언양공장 식육포장</option>
                  </select>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-x-4 px-6 text-sm font-black text-outline uppercase tracking-[0.2em]">
                  <div className="col-span-2 text-center">품목명</div>
                  <div className="col-span-2 text-center">원육정보</div>
                  <div className="col-span-2 text-center text-primary">투입량 (kg)</div>
                  <div className="col-span-2 text-center text-primary-600">생산량 (kg)</div>
                  <div className="col-span-2 text-center text-emerald-600">수율 (%)</div>
                  <div className="col-span-1 text-center text-error">로스 (%)</div>
                  <div className="col-span-1"></div>
                </div>
                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-surface-container rounded-2xl border-2 border-outline-variant/30 flex flex-col md:grid md:grid-cols-12 gap-4 items-center group/item hover:border-primary/30 transition-all shadow-sm"
                    >
                      <div className="w-full md:col-span-2">
                        <input required value={item.title} onChange={e => updateItem(idx, 'title', e.target.value)} type="text" placeholder="품목명" className="w-full h-12 px-4 rounded-xl bg-white border-2 border-transparent focus:border-primary outline-none text-base transition-all font-black shadow-inner" />
                      </div>
                      <div className="w-full md:col-span-2">
                        <input value={item.rawMeat} onChange={e => updateItem(idx, 'rawMeat', e.target.value)} type="text" placeholder="원육 정보" className="w-full h-12 px-4 rounded-xl bg-white border-2 border-transparent focus:border-primary outline-none text-sm transition-all font-bold shadow-inner text-outline" />
                      </div>
                      <div className="w-full md:col-span-2">
                        <input required value={item.input} onChange={e => updateItem(idx, 'input', e.target.value)} type="text" placeholder="투입량" className="w-full h-12 px-2 text-center rounded-xl bg-white border-2 border-primary/20 focus:border-primary outline-none text-lg transition-all font-mono font-black text-primary shadow-inner" />
                      </div>
                      <div className="w-full md:col-span-2">
                        <input required value={item.production} onChange={e => updateItem(idx, 'production', e.target.value)} type="text" placeholder="생산량" className="w-full h-12 px-2 text-center rounded-xl bg-white border-2 border-primary/20 focus:border-primary outline-none text-lg transition-all font-mono font-black text-primary shadow-inner" />
                      </div>
                      <div className="w-full md:col-span-2">
                        <div className="w-full h-12 flex items-center justify-center rounded-xl bg-emerald-50 border-2 border-emerald-100 text-lg font-mono font-black text-emerald-600 shadow-inner">
                          {item.yield || '0'}%
                        </div>
                      </div>
                      <div className="w-full md:col-span-1">
                        <div className="w-full h-12 flex items-center justify-center rounded-xl bg-error/5 border-2 border-error/10 text-lg font-mono font-black text-error shadow-inner">
                          {item.loss || '0'}%
                        </div>
                      </div>
                      <div className="w-full md:col-span-1 flex justify-center">
                        {items.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeItem(idx)}
                            className="p-2 text-outline hover:text-error hover:bg-error/5 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="flex flex-col md:flex-row gap-4 pt-4">
                  {!editingId && (
                    <button 
                      type="button" 
                      onClick={addItem}
                      className="flex-1 h-14 border-2 border-dashed border-outline-variant rounded-2xl text-xs font-black uppercase tracking-widest text-outline hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-3 shadow-sm"
                    >
                      <Plus className="w-5 h-5" /> 품목 추가 (행 추가)
                    </button>
                  )}
                  <button 
                    disabled={loading} 
                    type="submit" 
                    className={`h-14 rounded-2xl font-black text-lg uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 ${editingId ? 'flex-1 bg-secondary text-white' : 'flex-[2] bg-primary text-white'}`}
                  >
                    {loading ? '기록 중...' : (editingId ? '수정 사항 저장 및 시스템 업데이트' : `${items.length}건의 생산 데이터 시스템 등록`)}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border-2 border-outline-variant/30 p-8 rounded-[40px] flex flex-col items-center text-center shadow-lg hover:border-primary transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary/10 group-hover:h-2 transition-all" />
          <p className="text-[10px] md:text-xs font-black text-outline uppercase tracking-[0.3em] mb-4">생산 건수</p>
          <div className="flex items-baseline gap-1">
            <p className="text-4xl md:text-6xl font-black text-on-surface tabular-nums tracking-tighter leading-none">{production.length}</p>
            <span className="text-sm md:text-xl font-black text-outline-variant uppercase tracking-widest">건</span>
          </div>
        </div>

        <div className="bg-white border-2 border-outline-variant/30 p-8 rounded-[40px] flex flex-col items-center text-center shadow-lg hover:border-primary transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 group-hover:h-2 transition-all" />
          <p className="text-[10px] md:text-xs font-black text-outline uppercase tracking-[0.3em] mb-4">총 투입량</p>
          <div className="flex items-baseline gap-1">
            <p className="text-4xl md:text-6xl font-black text-on-surface tabular-nums tracking-tighter leading-none">
              {(production.reduce((acc, curr) => acc + (parseFloat(curr.input) || 0), 0)).toLocaleString()}
            </p>
            <span className="text-sm md:text-xl font-black text-outline-variant uppercase tracking-widest">kg</span>
          </div>
        </div>

        <div className="bg-white border-2 border-outline-variant/30 p-8 rounded-[40px] flex flex-col items-center text-center shadow-lg hover:border-primary transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/10 group-hover:h-2 transition-all" />
          <p className="text-[10px] md:text-xs font-black text-outline uppercase tracking-[0.3em] mb-4">총 생산량</p>
          <div className="flex items-baseline gap-1">
            <p className="text-4xl md:text-6xl font-black text-on-surface tabular-nums tracking-tighter leading-none">
              {(production.reduce((acc, curr) => {
                const val = parseFloat((curr.production || curr.weight || '0').toString().toLowerCase().replace('kg', '').trim());
                return acc + (isNaN(val) ? 0 : val);
              }, 0)).toLocaleString()}
            </p>
            <span className="text-sm md:text-xl font-black text-outline-variant uppercase tracking-widest">kg</span>
          </div>
        </div>

        <div className="bg-white border-2 border-outline-variant/30 p-8 rounded-[40px] flex flex-col items-center text-center shadow-lg hover:border-primary transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-600/20 group-hover:h-2 transition-all" />
          <p className="text-[10px] md:text-xs font-black text-outline uppercase tracking-[0.3em] mb-4">총 수율</p>
          <div className="flex items-baseline gap-1">
            <p className="text-4xl md:text-6xl font-black text-emerald-600 tabular-nums tracking-tighter leading-none">
              {(() => {
                const totalInput = production.reduce((acc, curr) => acc + (parseFloat(curr.input) || 0), 0);
                const totalProd = production.reduce((acc, curr) => {
                  const val = parseFloat((curr.production || curr.weight || '0').toString().toLowerCase().replace('kg', '').trim());
                  return acc + (isNaN(val) ? 0 : val);
                }, 0);
                return totalInput > 0 ? ((totalProd / totalInput) * 100).toFixed(1) : '0.0';
              })()}
            </p>
            <span className="text-sm md:text-xl font-black text-emerald-600/40 uppercase tracking-widest">%</span>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <h3 className="text-2xl font-black text-primary uppercase flex items-center gap-3">
          <History className="w-8 h-8" /> 최근 생산 일지
        </h3>

        <div className="flex flex-col md:flex-row gap-4 bg-white p-4 border-2 border-outline-variant rounded-2xl shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
            <input 
              type="text" 
              placeholder="품목명으로 검색..." 
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full pl-12 pr-4 h-12 rounded-xl bg-surface-container border-2 border-transparent focus:border-primary outline-none transition-all font-black text-on-surface"
            />
          </div>
          <div className="flex-1 relative">
            <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
            <input 
              type="date" 
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="w-full pl-12 pr-4 h-12 rounded-xl bg-surface-container border-2 border-transparent focus:border-primary outline-none transition-all font-black uppercase text-on-surface"
            />
          </div>
          { (searchName || searchDate) && (
            <button 
              onClick={() => { setSearchName(''); setSearchDate(''); }}
              className="px-6 h-12 rounded-xl bg-error/10 text-error font-black uppercase tracking-widest hover:bg-error hover:text-white transition-all flex items-center gap-2"
            >
              <X className="w-5 h-5" /> 필터 초기화
            </button>
          )}
        </div>
        <div className="overflow-hidden border-2 border-outline-variant rounded-2xl bg-white shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container border-b border-outline-variant text-base uppercase font-black text-outline">
                <tr>
                  <th className="p-4 whitespace-nowrap">SKU/라인</th>
                  <th className="p-4 whitespace-nowrap">품목명</th>
                  <th className="p-4 text-center whitespace-nowrap">투입량</th>
                  <th className="p-4 text-center whitespace-nowrap text-primary">생산량</th>
                  <th className="p-4 text-center whitespace-nowrap">수율</th>
                  <th className="p-4 text-center whitespace-nowrap">Loss율</th>
                  <th className="p-4 text-right whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {[...filteredProduction].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((batch, i) => {
                  const invItem = inventory.find(inv => inv.name === batch.title);
                  const displaySku = invItem?.sku || batch.sku || batch.batchId;
                  
                  return (
                    <tr key={i} className="hover:bg-surface-container transition-colors group">
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="text-base font-mono text-outline font-black tracking-widest">{displaySku}</span>
                          <span className="w-fit px-3 py-1 bg-primary/10 rounded-lg text-xs font-black text-primary uppercase tracking-widest">{batch.productionLine}</span>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-on-surface group-hover:text-primary transition-colors tracking-tight">{batch.title}</p>
                          <p className="text-xs font-bold text-outline-variant uppercase tracking-widest">{batch.rawMeat}</p>
                        </div>
                      </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <span className="text-xl font-black text-outline-variant tabular-nums">
                        {batch.input ? `${batch.input}kg` : '-'}
                      </span>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <p className="text-2xl font-black text-primary tabular-nums">
                        {(batch.production || batch.weight || '0').toString().toLowerCase().includes('kg') ? (batch.production || batch.weight) : `${(batch.production || batch.weight)}kg`}
                      </p>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <p className="text-2xl font-black text-emerald-600">
                        {batch.yield || (100 - parseFloat(batch.loss || '0'))}%
                      </p>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl font-black text-error">{batch.loss || '0'}%</span>
                        <div className="w-24 h-2 bg-error/10 rounded-full overflow-hidden">
                          <div className="h-full bg-error" style={{ width: `${Math.min(parseFloat(batch.loss || '0') * 5, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-6">
                        <div className="text-right space-y-0.5">
                          <p className="text-xs font-black text-outline uppercase tracking-widest">
                            {batch.manufDate && `제조: ${batch.manufDate}`}
                          </p>
                          <p className="text-xs font-black text-primary uppercase tracking-widest">
                            {batch.expiryDate && `소비: ${batch.expiryDate}`}
                          </p>
                          <p className="text-[10px] font-bold text-outline-variant uppercase tracking-widest">
                            등록: {batch.createdAt?.toDate().toLocaleDateString() || '오늘'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => startEdit(batch)}
                            className="p-3 bg-secondary/10 text-secondary rounded-xl hover:bg-secondary hover:text-white transition-all shadow-sm active:scale-90"
                            title="기록 수정"
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduction(batch.id, batch.title, (batch.production || batch.weight))}
                            className="p-3 bg-error/10 text-error rounded-xl hover:bg-error hover:text-white transition-all shadow-sm active:scale-90"
                            title="기록 삭제"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ onNavigate, partners, logistics = [], production = [], adminEmails = [], user }: { onNavigate?: (view: ViewType) => void, partners: any[], logistics: any[], production: any[], adminEmails?: any[], user: User | null }) => {
  const [activeTab, setActiveTab] = useState<'product' | 'partner' | 'admin'>('product');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adminEmailInput, setAdminEmailInput] = useState('');

  const filteredPartners = useMemo(() => {
    return partners.filter(p => 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.contact?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.type?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [partners, searchQuery]);

  // Form states
  const [product, setProduct] = useState({ 
    sku: '', 
    name: '', 
    category: '', 
    currentStock: '', 
    unit: '', 
    safetyStock: '', 
    location: '', 
    purchasePrice: '', 
    salesPrice: '',
    manufactureDate: '',
    expiryDate: ''
  });
  const [partner, setPartner] = useState({ name: '', contact: '', address: '', type: '공급사' });

  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const ref = doc(collection(db, 'inventory'));
      await setDoc(ref, {
        ...product,
        currentStock: Number(product.currentStock),
        safetyStock: Number(product.safetyStock),
        purchasePrice: Number(product.purchasePrice),
        salesPrice: Number(product.salesPrice),
        status: '정상',
        loss: '0%',
        updatedAt: serverTimestamp(),
      });
      alert('상품이 등록되었습니다.');
      setProduct({ 
        sku: '', 
        name: '', 
        category: '', 
        currentStock: '', 
        unit: '', 
        safetyStock: '', 
        location: '', 
        purchasePrice: '', 
        salesPrice: '',
        manufactureDate: '',
        expiryDate: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingPartner) {
        const ref = doc(db, 'partners', editingPartner.id);
        await setDoc(ref, {
          ...partner,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        alert('거래처 정보가 수정되었습니다.');
        setEditingPartner(null);
      } else {
        const ref = doc(collection(db, 'partners'));
        await setDoc(ref, {
          ...partner,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        alert('거래처가 등록되었습니다.');
      }
      setPartner({ name: '', contact: '', address: '', type: '공급사' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'partners');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmailInput.includes('@')) {
      alert('유효한 이메일을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      // Use email as document ID for easy lookup in rules if needed, 
      // but firestore rules matches path variables. 
      // The rules check exists(/admin_emails/$(email)).
      const ref = doc(db, 'admin_emails', adminEmailInput.trim());
      await setDoc(ref, {
        email: adminEmailInput.trim(),
        registeredBy: user?.email || 'unknown',
        createdAt: serverTimestamp(),
      });
      alert('관리자 이메일이 등록되었습니다.');
      setAdminEmailInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'admin_emails');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminDelete = async (email: string) => {
    if (!confirm(`${email}을(를) 관리자 목록에서 삭제하시겠습니까?`)) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'admin_emails', email));
      alert('관리자 권한이 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'admin_emails');
    } finally {
      setLoading(false);
    }
  };

  const startEditPartner = (p: any) => {
    setEditingPartner(p);
    setPartner({
      name: p.name || '',
      contact: p.contact || '',
      address: p.address || '',
      type: p.type || '공급사'
    });
    // Scroll to form or ensure it's visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePartners = async (ids: string[]) => {
    if (!confirm(`선택한 ${ids.length}개의 거래처를 정말로 삭제하시겠습니까?`)) return;
    
    setLoading(true);
    try {
      const promises = ids.map(id => deleteDoc(doc(db, 'partners', id)));
      await Promise.all(promises);
      alert('거래처가 삭제되었습니다.');
      setSelectedIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'partners');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPartners.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPartners.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-6">
        <button 
          onClick={() => onNavigate?.('dashboard')}
          className="p-5 bg-surface-container hover:bg-surface-container-high rounded-full transition-all text-outline shadow-sm active:scale-90"
        >
          <ArrowLeft className="w-8 h-8" />
        </button>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-primary tracking-tighter uppercase leading-none">시스템 설정</h2>
          <p className="text-1xl text-on-surface-variant font-black tracking-tight pt-1">관리자 데이터 및 환경 설정</p>
        </div>
      </div>

      <div className="flex gap-3 p-2 bg-surface-container rounded-[24px] w-fit shadow-inner">
        <button 
          onClick={() => setActiveTab('product')}
          className={`px-10 py-4 rounded-2xl text-xl font-black transition-all uppercase tracking-widest ${activeTab === 'product' ? 'bg-white shadow-xl text-primary scale-105' : 'text-outline hover:text-on-surface'}`}
        >
          상품 등록
        </button>
        <button 
          onClick={() => setActiveTab('partner')}
          className={`px-10 py-4 rounded-2xl text-xl font-black transition-all uppercase tracking-widest ${activeTab === 'partner' ? 'bg-white shadow-xl text-primary scale-105' : 'text-outline hover:text-on-surface'}`}
        >
          거래처 관리
        </button>
        <button 
          onClick={() => setActiveTab('admin')}
          className={`px-10 py-4 rounded-2xl text-xl font-black transition-all uppercase tracking-widest ${activeTab === 'admin' ? 'bg-white shadow-xl text-primary scale-105' : 'text-outline hover:text-on-surface'}`}
        >
          관리자 설정
        </button>
      </div>

      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white p-8 rounded-3xl border border-outline-variant shadow-sm"
      >
        {activeTab === 'product' && (
          <form onSubmit={handleRegisterProduct} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2 text-center pb-2">
              <h3 className="text-sm font-black text-primary uppercase tracking-widest">신규 상품(Master) 등록</h3>
            </div>
            {/* ... product form fields ... */}
            <div className="space-y-2">
              <label className="text-xs font-black text-primary uppercase tracking-widest px-1">SKU 번호</label>
              <input required value={product.sku} onChange={e => setProduct({...product, sku: e.target.value})} type="text" placeholder="예: SKU-BF-001" className="w-full h-14 px-5 rounded-2xl border border-outline-variant focus:border-primary outline-none text-base transition-colors font-bold bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-primary uppercase tracking-widest px-1">품목명</label>
              <input required value={product.name} onChange={e => setProduct({...product, name: e.target.value})} type="text" placeholder="예: 프리미엄 티본" className="w-full h-14 px-5 rounded-2xl border border-outline-variant focus:border-primary outline-none text-base transition-colors font-bold bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-primary uppercase tracking-widest px-1">카테고리</label>
              <input required value={product.category} onChange={e => setProduct({...product, category: e.target.value})} type="text" placeholder="예: 소고기" className="w-full h-14 px-5 rounded-2xl border border-outline-variant focus:border-primary outline-none text-base transition-colors font-bold bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-primary uppercase tracking-widest px-1">단위</label>
              <input required value={product.unit} onChange={e => setProduct({...product, unit: e.target.value})} type="text" placeholder="예: kg" className="w-full h-14 px-5 rounded-2xl border border-outline-variant focus:border-primary outline-none text-base transition-colors font-bold bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-primary uppercase tracking-widest px-1">현재 재고</label>
              <input required value={product.currentStock} onChange={e => setProduct({...product, currentStock: e.target.value})} type="number" className="w-full h-14 px-5 rounded-2xl border border-outline-variant focus:border-primary outline-none text-base transition-colors font-bold bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-primary uppercase tracking-widest px-1">안전 재고</label>
              <input required value={product.safetyStock} onChange={e => setProduct({...product, safetyStock: e.target.value})} type="number" className="w-full h-14 px-5 rounded-2xl border border-outline-variant focus:border-primary outline-none text-base transition-colors font-bold bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-primary uppercase tracking-widest px-1">매입 단가 (₩)</label>
              <input required value={product.purchasePrice} onChange={e => setProduct({...product, purchasePrice: e.target.value})} type="number" placeholder="예: 25000" className="w-full h-14 px-5 rounded-2xl border border-outline-variant focus:border-primary outline-none text-base transition-colors font-bold bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-primary uppercase tracking-widest px-1">판매 단가 (₩)</label>
              <input required value={product.salesPrice} onChange={e => setProduct({...product, salesPrice: e.target.value})} type="number" placeholder="예: 38000" className="w-full h-14 px-5 rounded-2xl border border-outline-variant focus:border-primary outline-none text-base transition-colors font-bold bg-white" />
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-8 border-y border-outline-variant/30 py-6 my-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-primary uppercase tracking-widest px-1 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-600" /> 생산(제조) 일자
                </label>
                <input value={product.manufactureDate} onChange={e => setProduct({...product, manufactureDate: e.target.value})} type="date" className="w-full h-14 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none text-base transition-colors bg-surface-container/30" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-primary uppercase tracking-widest px-1 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-error" /> 소비기한
                </label>
                <input value={product.expiryDate} onChange={e => setProduct({...product, expiryDate: e.target.value})} type="date" className="w-full h-14 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none text-base transition-colors bg-surface-container/30" />
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-primary uppercase tracking-widest px-1">보관 주요 위치</label>
                <input value={product.location} onChange={e => setProduct({...product, location: e.target.value})} type="text" placeholder="예: A창고 1구역" className="w-full h-14 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none text-base transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-primary uppercase tracking-widest px-1">상세 선반/칸</label>
                <input type="text" placeholder="예: 3단 4번 칸" className="w-full h-14 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none text-base transition-all" />
              </div>
            </div>

            <div className="md:col-span-2 pt-8">
              <button disabled={loading} type="submit" className="w-full h-16 bg-primary text-white rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
                {loading ? '시스템 처리 중...' : '상품 시스템 등록'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'partner' && (
          <div className="space-y-12">
            <form onSubmit={handlePartnerSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-surface-container/20 p-6 rounded-2xl border border-outline-variant/30 relative">
              {editingPartner && (
                <div className="absolute top-4 right-4 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Edit3 className="w-3 h-3" /> 수정 중
                </div>
              )}
              {/* ... partner form ... */}
              <div className="md:col-span-2">
                <h3 className="text-base font-black text-primary uppercase tracking-widest mb-4 text-center">
                  {editingPartner ? '거래처 정보 수정' : '신규 거래처 등록'}
                </h3>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-primary uppercase tracking-widest px-1">거래처명</label>
                <input required value={partner.name} onChange={e => setPartner({...partner, name: e.target.value})} type="text" placeholder="예: (주)한울미트" className="w-full h-14 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none text-lg transition-colors font-bold bg-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-primary uppercase tracking-widest px-1">유형</label>
                <select value={partner.type} onChange={e => setPartner({...partner, type: e.target.value})} className="w-full h-14 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none text-lg transition-colors appearance-none bg-white font-bold">
                  <option value="공급사">공급사</option>
                  <option value="고객사">고객사</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-primary uppercase tracking-widest px-1">연락처</label>
                <input value={partner.contact} onChange={e => setPartner({...partner, contact: e.target.value})} type="text" placeholder="예: 010-1234-5678" className="w-full h-14 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none text-lg transition-colors bg-white font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-primary uppercase tracking-widest px-1">주소</label>
                <input value={partner.address} onChange={e => setPartner({...partner, address: e.target.value})} type="text" placeholder="예: 경기도 안양시..." className="w-full h-14 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none text-lg transition-colors bg-white font-bold" />
              </div>
              <div className="md:col-span-2 flex gap-4 pt-4">
                <button disabled={loading} type="submit" className="flex-1 h-16 bg-secondary text-white rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
                  {loading ? '시스템 처리 중...' : editingPartner ? '수정 완료' : '거래처 등록 완료'}
                </button>
                {editingPartner && (
                  <button 
                    type="button"
                    onClick={() => {
                      setEditingPartner(null);
                      setPartner({ name: '', contact: '', address: '', type: '공급사' });
                    }}
                    className="h-16 px-8 bg-surface-container text-outline rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-surface-container-high transition-all"
                  >
                    취소
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-xl font-black text-primary uppercase tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5" /> 등록된 거래처 목록
                </h3>
                <div className="flex items-center gap-3">
                  {selectedIds.length > 0 && (
                    <button 
                      onClick={() => handleDeletePartners(selectedIds)}
                      className="h-10 px-4 bg-error text-white rounded-xl text-sm font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      선택 삭제 ({selectedIds.length})
                    </button>
                  )}
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="거래처명 검색..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 bg-white border border-outline-variant rounded-xl focus:border-primary outline-none text-base font-medium"
                    />
                  </div>
                  <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-12 px-5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-base font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isExpanded ? '접기' : '펼쳐서 보기'}
                  </button>
                </div>
              </div>

              <motion.div 
                initial={false}
                animate={{ height: isExpanded ? 'auto' : '400px' }}
                className="overflow-hidden border border-outline-variant rounded-2xl bg-white shadow-sm"
              >
                <div className={`overflow-x-auto ${isExpanded ? '' : 'max-h-[400px] overflow-y-auto custom-scrollbar'}`}>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-low border-b border-outline-variant text-base uppercase font-black text-outline sticky top-0 z-10">
                      <tr>
                        <th className="p-4 bg-surface-container-low w-12">
                          <input 
                            type="checkbox" 
                            checked={filteredPartners.length > 0 && selectedIds.length === filteredPartners.length}
                            onChange={toggleSelectAll}
                            className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                          />
                        </th>
                        <th className="p-4 bg-surface-container-low">거래처명</th>
                        <th className="p-4 bg-surface-container-low">유형</th>
                        <th className="p-4 bg-surface-container-low">연락처</th>
                        <th className="p-4 bg-surface-container-low">주소</th>
                        <th className="p-4 text-right bg-surface-container-low">기능</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {filteredPartners.length > 0 ? (
                        filteredPartners.map((p, i) => (
                          <tr key={i} className={`transition-colors group ${selectedIds.includes(p.id) ? 'bg-primary/5' : 'hover:bg-surface-container'}`}>
                            <td className="p-4">
                              <input 
                                type="checkbox" 
                                checked={selectedIds.includes(p.id)}
                                onChange={() => toggleSelect(p.id)}
                                className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                              />
                            </td>
                            <td className="p-4 font-bold text-on-surface text-lg">{p.name}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-sm font-black uppercase ${p.type === '공급사' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                                {p.type}
                              </span>
                            </td>
                            <td className="p-4 text-base text-on-surface-variant font-medium">{p.contact || '-'}</td>
                            <td className="p-4 text-base text-on-surface-variant font-medium max-w-xs truncate">{p.address || '-'}</td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => startEditPartner(p)}
                                  className="p-2 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                  title="수정"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeletePartners([p.id])}
                                  className="p-2 text-outline hover:text-error hover:bg-error/10 rounded-lg transition-all"
                                  title="삭제"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-outline font-bold">등록된 거래처가 없거나 검색 결과가 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* --- Admin Tab Interface --- */}
        {activeTab === 'admin' && (
          <div className="space-y-12">
            <form onSubmit={handleAdminRegister} className="bg-surface-container/20 p-8 rounded-3xl border border-outline-variant/30 space-y-6">
              <div className="text-center space-y-2">
                <Lock className="w-10 h-10 text-primary mx-auto mb-2" />
                <h3 className="text-2xl font-black text-primary uppercase tracking-tight">관리자 계정 등록</h3>
                <p className="text-sm text-outline font-bold uppercase tracking-widest">구글 이메일을 등록하여 관리자 권한을 부여합니다.</p>
              </div>

              <div className="max-w-2xl mx-auto space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-black text-primary uppercase tracking-widest px-1">등록할 구글 이메일</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <input 
                      required 
                      type="email" 
                      value={adminEmailInput}
                      onChange={(e) => setAdminEmailInput(e.target.value)}
                      placeholder="example@gmail.com"
                      className="flex-1 h-14 px-6 rounded-2xl border border-outline-variant focus:border-primary outline-none text-lg font-bold shadow-inner"
                    />
                    <button 
                      disabled={loading}
                      type="submit"
                      className="h-14 px-10 bg-primary text-white rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? '등록 중...' : <><Plus className="w-5 h-5" /> 등록</>}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <div className="space-y-6">
              <h3 className="text-xl font-black text-primary uppercase tracking-tight flex items-center gap-2">
                <Verified className="w-6 h-6" /> 현재 관리자 목록
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Default Master Admin from system instructions */}
                <div className="p-6 bg-primary/5 border-2 border-primary/20 rounded-[28px] flex items-center justify-between group shadow-sm transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-lg text-primary tracking-tight">crucify87@gmail.com</p>
                      <p className="text-[10px] font-black text-outline uppercase tracking-widest">Master Administrator (System)</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-primary text-white rounded-lg text-[10px] font-black uppercase tracking-widest">Master</span>
                </div>

                {/* Dynamic Admin List */}
                {adminEmails.map((admin, idx) => (
                  <div key={idx} className="p-6 bg-white border-2 border-outline-variant/30 rounded-[28px] flex items-center justify-between group hover:border-primary/30 shadow-sm transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-surface-container text-outline rounded-xl flex items-center justify-center group-hover:text-primary transition-colors">
                        <UserIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black text-lg text-on-surface tracking-tight truncate max-w-[180px] lg:max-w-none">{admin.email}</p>
                        <p className="text-[10px] font-black text-outline uppercase tracking-widest">Registered Admin</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAdminDelete(admin.email)}
                      disabled={loading}
                      className="w-10 h-10 flex items-center justify-center text-outline hover:text-error hover:bg-error/5 rounded-xl transition-all border border-transparent hover:border-error/20"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// --- Main Layout ---

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isFabOpen, setIsFabOpen] = useState(false);
  
  const [inventory, setInventory] = useState<any[]>([]);
  const [production, setProduction] = useState<any[]>([]);
  const [logistics, setLogistics] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [adminEmails, setAdminEmails] = useState<any[]>([]);

  const isAuthorized = useMemo(() => {
    if (!user?.email) return false;
    if (user.email === 'crucify87@gmail.com') return true;
    return adminEmails.some(a => a.email === user.email);
  }, [user, adminEmails]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          setUserData(snap.data());
        } else {
          // If profile doesn't exist yet, we'll create it below
          setUserData({ role: 'staff' });
        }
        setLoading(false);
      });
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // Sync user profile
      const syncProfile = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            // role is usually set manually or via some logic, defaulting to staff if new
            updatedAt: serverTimestamp(),
          }, { merge: true });

          // Automatic seeding removed per user request to start with 0 data
          // const empty = await isDatabaseEmpty();
          // if (empty) {
          //   console.log("Database is empty, seeding...");
          //   await seedDatabase();
          // }
        } catch (error) {
          console.error("Error syncing profile or seeding:", error);
        }
      };
      
      syncProfile();
    }
  }, [user]);

  // Listen to collections
  useEffect(() => {
    if (!user) return;

    const unsubInv = onSnapshot(collection(db, 'inventory'), (snap) => {
      setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'inventory'));

    const unsubProd = onSnapshot(collection(db, 'production_batches'), (snap) => {
      setProduction(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'production_batches'));

    const unsubLog = onSnapshot(collection(db, 'logistics'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogistics(data);
    }, error => handleFirestoreError(error, OperationType.LIST, 'logistics'));

    const unsubPartners = onSnapshot(collection(db, 'partners'), (snap) => {
      setPartners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'partners'));

    const unsubAdmins = onSnapshot(collection(db, 'admin_emails'), (snap) => {
      setAdminEmails(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'admin_emails'));

    return () => {
      unsubInv();
      unsubProd();
      unsubLog();
      unsubPartners();
      unsubAdmins();
    };
  }, [user]);

  // One-time cleanup for specific production batches
  useEffect(() => {
    if (production.length > 0) {
      const targets = ['와규 차돌박이 정육', '목초 사육 다짐육', '프리미엄 앵거스 등심'];
      const batchesToDelete = production.filter(p => targets.includes(p.title));
      
      batchesToDelete.forEach(async (batch) => {
        try {
          await deleteDoc(doc(db, 'production_batches', batch.id));
          console.log(`Deleted production batch: ${batch.title}`);
        } catch (error) {
          console.error("Error deleting old production batch:", error);
        }
      });
    }
  }, [production]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navItems = [
    { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
    { id: 'inventory', label: '재고관리', icon: Package },
    { id: 'logistics', label: '물류현황', icon: ArrowLeftRight },
    { id: 'production', label: '생산관리', icon: Cpu },
    { id: 'settings', label: '설정', icon: Settings },
  ];

  const handleNavigate = (view: ViewType, item?: any) => {
    if (item) setSelectedItem(item);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl w-full bg-white p-12 rounded-[48px] shadow-2xl border-4 border-outline-variant/30 text-center space-y-10"
        >
          {/* App Icon (Optimized for 512x512 viewport) */}
          <div className="bg-white p-4 rounded-[40px] flex items-center justify-center mx-auto shadow-2xl shadow-primary/20 scale-125 mb-6">
            <AppLogo className="w-32 h-32" />
          </div>
          <div className="space-y-4">
            <h1 className="text-6xl font-black text-primary tracking-tighter uppercase leading-none">MIN IMA</h1>
            <p className="text-2xl text-on-surface-variant font-black tracking-tight pt-2">관리자 시스템 로그인이 필요합니다.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full h-20 bg-white border-4 border-outline-variant rounded-3xl flex items-center justify-center gap-4 font-black text-xl text-on-surface hover:bg-surface-container transition-all active:scale-95 shadow-lg"
          >
            <img src="https://www.google.com/favicon.ico" className="w-8 h-8" alt="Google" />
            구글 계정으로 로그인
          </button>
          <p className="text-lg text-outline uppercase font-black tracking-[0.3em] leading-relaxed opacity-60">
            INDUSTRIAL INVENTORY & PRODUCTION MANAGEMENT DASHBOARD
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-outline-variant fixed top-0 w-full z-50 h-[88px] md:h-20 shadow-xs">
        <div className="w-full px-6 md:px-10 h-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-lg shadow-sm border border-outline-variant/30">
              <AppLogo className="w-8 h-8" />
            </div>
            <span className="text-xl font-black text-primary tracking-tighter uppercase">MIN IMA</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full border border-outline-variant/30">
              <Search className="w-4 h-4 text-outline" />
              <input type="text" placeholder="통합 검색..." className="bg-transparent text-[8px] outline-none w-32 border-none ring-0 p-0" />
            </div>
            <button className="relative p-2 text-outline hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 border-l border-outline-variant/30 pl-4 ml-2">
              <div className="text-right hidden sm:block">
                <p className="text-base font-black text-on-surface">{user.displayName || '사용자'}</p>
                <p className="text-[9px] text-outline uppercase font-black tracking-widest">현장 관리자</p>
              </div>
              <div className="group relative">
                <div className="w-12 h-12 rounded-full border-2 border-outline-variant overflow-hidden ring-4 ring-primary/5 shadow-md">
                  <img 
                    src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop'} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <button 
                  onClick={handleLogout}
                  className="absolute top-full right-0 mt-3 bg-white border-2 border-outline-variant rounded-2xl p-4 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3 text-lg font-black text-error whitespace-nowrap z-[100]"
                >
                  <LogOut className="w-5 h-5" /> 로그아웃
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 pt-[88px] md:pt-20">
        {/* Desktop Sidebar Sidebar */}
        <aside className="hidden lg:flex flex-col fixed left-0 top-[88px] md:top-20 bottom-0 w-20 bg-white border-r border-outline-variant items-center py-8 gap-10">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id as ViewType)}
              className={`p-3 rounded-xl transition-all relative group ${currentView === item.id || (currentView === 'detail' && item.id === 'inventory') ? 'bg-primary text-white shadow-lg' : 'text-outline hover:text-primary hover:bg-surface-container'}`}
              title={item.label}
            >
              <item.icon className="w-6 h-6" />
              {currentView === item.id && (
                <motion.div layoutId="active-indicator" className="absolute -left-1 top-2 bottom-2 w-1 bg-primary rounded-full" />
              )}
            </button>
          ))}
          <div className="mt-auto space-y-6">
          </div>
        </aside>

        {/* Content Body */}
        <main className="flex-1 lg:ml-20 px-4 py-8 mb-20 lg:mb-0">
          <div className="max-w-5xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {currentView === 'dashboard' && <DashboardView onNavigate={handleNavigate} inventory={inventory} production={production} logistics={logistics} partners={partners} />}
                {currentView === 'inventory' && <InventoryView onNavigate={handleNavigate} inventory={inventory} logistics={logistics} isAuthorized={isAuthorized} />}
                {currentView === 'detail' && <ItemDetailView onNavigate={handleNavigate} userData={userData} item={selectedItem} isAuthorized={isAuthorized} />}
                {currentView === 'logistics' && <LogisticsView logistics={logistics} inventory={inventory} partners={partners} onNavigate={handleNavigate} />}
                {currentView === 'production' && <ProductionView production={production} inventory={inventory} onNavigate={handleNavigate} />}
                {currentView === 'settings' && <SettingsView onNavigate={handleNavigate} partners={partners} logistics={logistics} production={production} adminEmails={adminEmails} user={user} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-white border-t border-outline-variant h-16 flex justify-around items-center lg:hidden shadow-2xl px-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id as ViewType)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${currentView === item.id || (currentView === 'detail' && item.id === 'inventory') ? 'text-primary' : 'text-outline/70'}`}
          >
            <item.icon className={`w-5 h-5 ${currentView === item.id ? 'fill-primary/10' : ''}`} />
            <span className="text-[11px] font-black uppercase tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Floating Action Button (Mobile Only) */}
      <div className="lg:hidden fixed right-6 bottom-24 z-50">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 50 }}
              className="absolute bottom-20 right-0 flex flex-col gap-3 items-end"
            >
              {navItems.map((item, idx) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => {
                    handleNavigate(item.id as ViewType);
                    setIsFabOpen(false);
                  }}
                  className={`min-w-[160px] px-8 py-4 rounded-2xl text-base font-black shadow-2xl transition-all border-2 active:scale-95 ${currentView === item.id || (currentView === 'detail' && item.id === 'inventory') ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-outline-variant'}`}
                >
                  {item.label}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <button 
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`w-16 h-16 rounded-[24px] shadow-[0_20px_40px_rgba(var(--primary-rgb),0.3)] flex items-center justify-center transition-all active:scale-90 ${isFabOpen ? 'bg-error text-white rotate-45' : 'bg-primary text-white'}`}
        >
          <Plus className="w-10 h-10" />
        </button>
      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
