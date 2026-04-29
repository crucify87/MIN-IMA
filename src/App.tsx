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
  CheckCircle2,
  LogOut,
  LogIn,
  X,
  TrendingDown,
  Trash2,
  ArrowLeft
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

// --- Components ---

const StatCard = ({ item }: { item: StatItem, key?: React.Key }) => {
  const Icon = item.icon;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${item.color || 'bg-primary/10'}`}>
        <Icon className={`w-5 h-5 ${item.color ? 'text-white' : 'text-primary'}`} />
      </div>
      <p className="text-xl font-bold text-outline uppercase tracking-wider">{item.label}</p>
      <p className="text-3xl font-bold mt-1 text-on-surface">
        {item.value}<span className="text-xl font-normal ml-0.5">{item.unit}</span>
      </p>
      {item.trend && (
        <div className={`flex items-center gap-1 text-lg mt-1 font-bold ${item.trendDir === 'up' ? 'text-emerald-600' : 'text-error'}`}>
          {item.trendDir === 'up' ? <TrendingUp className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {item.trend}
        </div>
      )}
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
  onNavigate: (view: ViewType) => void,
  inventory: any[],
  production: any[],
  logistics: any[],
  partners: any[]
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExpanded, setIsExpanded] = useState(false);

  const lowStockItems = inventory.filter(item => item.currentStock < item.safetyStock);
  const cautionStockItems = inventory.filter(item => item.currentStock >= item.safetyStock && item.currentStock < item.safetyStock * 1.5);
  const allAlerts = [...lowStockItems, ...cautionStockItems];
  const displayedAlerts = isExpanded ? allAlerts : allAlerts.slice(0, 3);

  const stats: StatItem[] = [
    { label: '전체 상품', value: inventory.length.toLocaleString(), unit: '개', icon: Package },
    { label: '거래처', value: partners.length.toLocaleString(), unit: '개', icon: Users, color: 'bg-emerald-500' },
    { label: '오늘 입고', value: '0', unit: 'kg', icon: ArrowDownToLine, color: 'bg-primary-container' },
    { label: '오늘 출고', value: '0', unit: 'kg', icon: ArrowUpFromLine, color: 'bg-secondary-container' },
    { label: '주의 필요', value: inventory.filter(i => i.currentStock < i.safetyStock).length.toString(), unit: '개', icon: AlertTriangle, color: 'bg-error' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-2 border-outline-variant/30 pb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
          <h1 className="text-5xl font-black text-primary tracking-tight">대시보드</h1>
          <div className="flex items-center gap-3 bg-surface-container px-4 py-2.5 rounded-2xl border-2 border-outline-variant/50 shadow-sm hover:border-primary/30 transition-all group">
            <CalendarDays className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-outline uppercase tracking-widest hidden md:block">조회 기준일</span>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-mono font-black text-base outline-none cursor-pointer text-on-surface"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s, i) => <StatCard key={i} item={s} />)}
      </section>

      {/* Main Content */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts */}
        <div className="space-y-6">
          <h3 className="text-2xl font-black flex items-center gap-3">
            <AlertTriangle className="text-error w-6 h-6" /> 안전 재고 알림
          </h3>
          <div className="space-y-3">
            {displayedAlerts.length === 0 ? (
              <div className="bg-surface-container p-8 rounded-2xl border-2 border-dashed border-outline-variant/50 text-center">
                <p className="font-black text-outline uppercase tracking-widest">현재 재고 알림 없음</p>
              </div>
            ) : (
              <>
                {displayedAlerts.map((item, idx) => {
                  const isCritical = item.currentStock < item.safetyStock;
                  return (
                    <div 
                      key={idx} 
                      className={`p-5 rounded-2xl border transition-all ${
                        isCritical 
                          ? 'bg-error-container border-error/20' 
                          : 'bg-white border-outline-variant shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className={`font-black text-xl tracking-tight ${isCritical ? 'text-on-error-container' : 'text-on-surface'}`}>
                          {item.name}
                        </h4>
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          isCritical ? 'bg-error text-white' : 'bg-secondary-container text-on-secondary-container'
                        }`}>
                          {isCritical ? '위험' : '주의'}
                        </span>
                      </div>
                      <p className={`text-base font-bold ${isCritical ? 'text-on-error-container/80' : 'text-on-surface-variant'}`}>
                        현재: <span className="font-black">{item.currentStock}{item.unit}</span> | 
                        기준: <span className="font-black">{item.safetyStock}{item.unit}</span>
                      </p>
                    </div>
                  );
                })}
                
                {allAlerts.length > 3 && (
                  <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full py-4 bg-surface-container hover:bg-surface-variant transition-colors rounded-2xl border-2 border-outline-variant/30 text-sm font-black text-outline uppercase tracking-[0.2em] flex items-center justify-center gap-2 group"
                  >
                    {isExpanded ? (
                      <>접기 <ChevronUp className="w-4 h-4 group-hover:-translate-y-1 transition-transform" /></>
                    ) : (
                      <>전체 {allAlerts.length}개 펼쳐보기 <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" /></>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-on-surface">최근 생산 활동</h3>
          </div>
          <div className="overflow-hidden border border-outline-variant rounded-3xl bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-surface-container border-b border-outline-variant text-sm uppercase font-black text-outline">
                <tr>
                  <th className="p-6">SKU</th>
                  <th className="p-6">품목</th>
                  <th className="p-6 text-center">생산량</th>
                  <th className="p-6 text-center">수율/로스</th>
                  <th className="p-6 text-right">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {production.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-surface-container transition-colors">
                    <td className="p-6 text-xl font-mono text-outline font-black tracking-widest">{row.batchId || row.sku}</td>
                    <td className="p-6 text-3xl font-black text-on-surface leading-tight">{row.title}</td>
                    <td className="p-6 text-3xl font-mono font-black text-primary text-center">
                      {row.weight?.toString().toLowerCase().includes('kg') ? row.weight : `${row.weight}kg`}
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-2xl font-mono font-black ${row.yield && parseFloat(row.yield) < 95 ? 'text-error' : 'text-emerald-600'}`}>
                          {row.yield || (row.loss ? `${100 - parseFloat(row.loss)}%` : '-')}
                        </span>
                        {row.loss && <span className="text-sm font-black text-error/60">Loss: {row.loss}%</span>}
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <span className={`px-6 py-2 rounded-full text-lg font-black uppercase tracking-widest shadow-sm ${row.color || 'bg-primary/10 text-primary'}`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Production 활동 옆에 여백이 남을 수 있으므로 레이아웃을 조정하거나 해당 섹션만 제거합니다. */}
      </section>
    </div>
  );
};

const InventoryView = ({ onNavigate, inventory }: { onNavigate: (view: ViewType, item?: any) => void, inventory: any[] }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate('dashboard')}
          className="p-3 bg-surface-container hover:bg-surface-container-high rounded-full transition-all text-outline"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="space-y-2">
          <h2 className="text-5xl font-black text-on-surface tracking-tighter">재고관리</h2>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-outline w-8 h-8" />
          <input 
            type="text" 
            placeholder="SKU 또는 제품명으로 검색..." 
            className="w-full h-12 pl-12 pr-6 bg-white border-2 border-outline-variant rounded-xl focus:border-primary outline-none text-lg font-bold transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select className="h-12 px-6 bg-white border-2 border-outline-variant rounded-xl text-base font-black focus:border-primary outline-none min-w-[180px] shadow-sm">
            <option>전체 카테고리</option>
            <option>소고기</option>
            <option>돼지고기</option>
            <option>가금류</option>
          </select>
          <button className="h-12 px-8 bg-primary text-white rounded-xl flex items-center gap-3 text-base font-black uppercase transition-all hover:bg-primary-container shadow-lg active:scale-95">
            <Bell className="w-6 h-6" /> 필터
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: '총 SKU', value: inventory.length.toLocaleString(), color: 'text-primary' },
          { label: '재고 부족', value: inventory.filter(i => i.currentStock < i.safetyStock).length.toString(), color: 'text-error' },
          { label: '금일 입고', value: '0', unit: 'kg', color: 'text-secondary' },
          { label: '금일 출고', value: '0', unit: 'kg', color: 'text-tertiary' },
        ].map((item, i) => (
          <div key={i} className="bg-surface-container p-4 rounded-2xl border-2 border-outline-variant/30 flex flex-col gap-1">
            <p className="text-sm font-black text-on-surface-variant uppercase tracking-widest">{item.label}</p>
            <p className={`text-3xl font-black ${item.color}`}>
              {item.value}<span className="text-lg font-bold ml-1">{item.unit || ''}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {inventory.map((item, i) => (
          <div 
            key={i} 
            onClick={() => onNavigate('detail', item)}
            className={`grid grid-cols-1 md:grid-cols-12 items-center gap-4 p-4 bg-white border-2 rounded-2xl hover:border-primary transition-all cursor-pointer group shadow-sm ${item.currentStock < item.safetyStock ? 'border-error/30 bg-error/5' : 'border-outline-variant/30'}`}
          >
            <div className="col-span-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0 shadow-inner group-hover:bg-primary/5 transition-colors">
                {item.currentStock < item.safetyStock ? <AlertTriangle className="w-5 h-5 text-error" /> : <Package className="w-5 h-5 text-primary" />}
              </div>
              <div>
                <p className="font-black text-xl leading-tight group-hover:text-primary transition-colors tracking-tight">{item.name}</p>
                <p className="text-sm text-outline font-mono uppercase font-black tracking-widest mt-0.5">{item.sku}</p>
              </div>
            </div>
            <div className="col-span-2 flex md:block justify-between">
              <span className="md:hidden text-sm font-black text-outline uppercase tracking-widest">카테고리</span>
              <span className="px-3 py-1 bg-surface-container-high text-on-surface-variant rounded-lg text-sm font-black uppercase tracking-widest">{item.category}</span>
            </div>
            <div className="col-span-2 flex md:block justify-between md:text-right">
              <span className="md:hidden text-sm font-black text-outline uppercase tracking-widest">현재 재고</span>
              <div>
                <p className={`font-black text-xl ${item.currentStock < item.safetyStock ? 'text-error' : 'text-primary'}`}>{item.currentStock}{item.unit}</p>
                <p className="text-sm text-outline font-black mt-0.5">로스율: {item.loss}</p>
              </div>
            </div>
            <div className="col-span-2 flex md:justify-center items-center gap-2">
              <CheckCircle2 className={`w-5 h-5 ${item.currentStock < item.safetyStock ? 'text-error' : 'text-emerald-700'}`} />
              <span className={`text-sm font-black uppercase tracking-widest ${item.currentStock < item.safetyStock ? 'text-error' : 'text-emerald-700'}`}>{item.status}</span>
            </div>
            <div className="col-span-2 text-right flex items-center justify-end gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('detail', item);
                }}
                className="h-10 px-4 border-2 border-primary text-primary rounded-xl text-sm font-black uppercase hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
              >
                수정
              </button>
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm('정말로 이 재고 항목을 삭제하시겠습니까?')) {
                    try {
                      await deleteDoc(doc(db, 'inventory', item.id));
                      alert('삭제되었습니다.');
                    } catch (error) {
                      handleFirestoreError(error, OperationType.DELETE, 'inventory');
                    }
                  }
                }}
                className="p-2 text-outline hover:text-error hover:bg-error/5 rounded-xl transition-all"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ItemDetailView = ({ onNavigate, userData, item }: { onNavigate: (view: ViewType, item?: any) => void, userData: any, item: any }) => {
  const isAdmin = userData?.role === 'admin';
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit states
  const [editData, setEditData] = useState({ ...item });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-8">
        <button 
          onClick={() => onNavigate('inventory')}
          className="p-5 bg-surface-container hover:bg-surface-container-high rounded-full transition-all text-outline shadow-sm active:scale-90"
        >
          <ArrowLeft className="w-8 h-8" />
        </button>
        <nav className="flex items-center gap-3 text-on-surface-variant text-xl font-black uppercase tracking-widest">
          <button onClick={() => onNavigate('inventory')} className="hover:text-primary transition-colors tracking-widest">{item.category}</button>
          <ChevronRight className="w-6 h-6" />
          <span className="text-primary">상세 정보 (DETAIL)</span>
        </nav>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-10">
        <div className="space-y-4 flex-1 w-full">
          {isEditingInfo ? (
            <div className="space-y-4 bg-white p-6 rounded-2xl border-2 border-primary shadow-lg animate-in fade-in slide-in-from-top-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">품목명</label>
                  <input 
                    type="text" 
                    value={editData.name} 
                    onChange={e => setEditData({...editData, name: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">SKU</label>
                  <input 
                    type="text" 
                    value={editData.sku} 
                    onChange={e => setEditData({...editData, sku: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-mono font-bold text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">카테고리</label>
                  <input 
                    type="text" 
                    value={editData.category} 
                    onChange={e => setEditData({...editData, category: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">단위</label>
                  <input 
                    type="text" 
                    value={editData.unit} 
                    onChange={e => setEditData({...editData, unit: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">안전 재고</label>
                  <input 
                    type="number" 
                    value={editData.safetyStock} 
                    onChange={e => setEditData({...editData, safetyStock: Number(e.target.value)})}
                    className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">보관 위치</label>
                  <input 
                    type="text" 
                    value={editData.location} 
                    onChange={e => setEditData({...editData, location: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-xl"
                  />
                </div>
                {isAdmin && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-primary uppercase px-1">매입 단가</label>
                      <input 
                        type="number" 
                        value={editData.purchasePrice} 
                        onChange={e => setEditData({...editData, purchasePrice: Number(e.target.value)})}
                        className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-primary uppercase px-1">판매 단가</label>
                      <input 
                        type="number" 
                        value={editData.salesPrice} 
                        onChange={e => setEditData({...editData, salesPrice: Number(e.target.value)})}
                        className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-primary outline-none font-bold text-xl"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={handleUpdateInfo}
                  disabled={loading}
                  className="flex-1 bg-primary text-white h-14 rounded-xl font-black uppercase tracking-widest text-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? '저장 중...' : '품목 정보 저장'}
                </button>
                <button 
                  onClick={() => {
                    setIsEditingInfo(false);
                    setEditData({ ...item });
                  }}
                  className="px-8 bg-surface-container text-outline h-14 rounded-xl font-black uppercase tracking-widest text-lg hover:bg-surface-container-high transition-all"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-5xl font-black text-primary tracking-tighter leading-none">{item.name}</h1>
              <p className="text-2xl font-mono text-outline font-black mt-2 tracking-[0.2em]">{item.sku}</p>
            </>
          )}
        </div>
        {!isEditingInfo && (
          <div className="flex flex-col items-end gap-4 min-w-[240px]">
            <div className="bg-emerald-100 text-emerald-800 px-8 py-3 rounded-2xl flex items-center gap-3 shadow-md text-lg font-black uppercase tracking-widest border-2 border-emerald-200">
              <CheckCircle2 className="w-6 h-6 fill-emerald-800 text-emerald-100" /> {item.status.toUpperCase()} STATUS
            </div>
            <button 
              onClick={() => setIsEditingInfo(true)}
              className="flex items-center gap-3 text-primary text-2xl font-black hover:underline uppercase tracking-widest decoration-4 underline-offset-8"
            >
              <Edit className="w-7 h-7" /> 정보 수정
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {isUpdatingStock ? (
          <div className="bg-primary/5 p-8 rounded-[40px] border-4 border-primary shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="text-3xl font-black text-primary uppercase tracking-tight flex items-center gap-4">
                <Package className="w-10 h-10" /> 재고 수량 업데이트
              </h3>
              <p className="text-xl font-black text-outline">기존 재고: {item.currentStock}{item.unit}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex-1 relative">
                <input 
                  type="number" 
                  value={newStock}
                  onChange={e => setNewStock(e.target.value)}
                  className="w-full h-24 px-8 rounded-3xl border-4 border-primary text-5xl font-black focus:outline-none shadow-inner"
                  autoFocus
                />
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-4xl font-black text-primary">{item.unit}</span>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleUpdateStock}
                  disabled={loading}
                  className="h-24 px-12 bg-primary text-white rounded-3xl font-black text-2xl uppercase tracking-widest shadow-xl hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? '처리 중...' : '확인'}
                </button>
                <button 
                  onClick={() => {
                    setIsUpdatingStock(false);
                    setNewStock(item.currentStock);
                  }}
                  className="h-14 px-12 bg-white text-outline border-2 border-outline-variant rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-surface-container transition-all"
                >
                  취소
                </button>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setNewStock(Number(newStock) + 1)} className="flex-1 h-14 bg-white border-2 border-primary text-primary rounded-xl font-black text-xl hover:bg-primary/5">+1</button>
              <button onClick={() => setNewStock(Number(newStock) + 10)} className="flex-1 h-14 bg-white border-2 border-primary text-primary rounded-xl font-black text-xl hover:bg-primary/5">+10</button>
              <button onClick={() => setNewStock(Number(newStock) + 50)} className="flex-1 h-14 bg-white border-2 border-primary text-primary rounded-xl font-black text-xl hover:bg-primary/5">+50</button>
              <button onClick={() => setNewStock(Math.max(0, Number(newStock) - 1))} className="flex-1 h-14 bg-white border-2 border-error text-error rounded-xl font-black text-xl hover:bg-error/5">-1</button>
              <button onClick={() => setNewStock(Math.max(0, Number(newStock) - 10))} className="flex-1 h-14 bg-white border-2 border-error text-error rounded-xl font-black text-xl hover:bg-error/5">-10</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-6">
            <button 
              onClick={() => setIsUpdatingStock(true)}
              className="flex-1 bg-primary text-white h-20 rounded-[28px] flex items-center justify-center gap-4 font-black text-2xl shadow-xl hover:opacity-90 active:scale-95 transition-all uppercase tracking-widest"
            >
              <Package className="w-8 h-8" /> 재고 업데이트
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Admin Section */}
        <div className="border-2 border-outline-variant rounded-[40px] p-10 space-y-8 shadow-2xl bg-surface-container-low relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-black text-primary uppercase tracking-widest">관리자 전용 관리</h3>
              <h3 className={`bg-primary/10 text-primary text-[8px] px-4 py-1.5 rounded-xl font-black tracking-widest ${isAdmin ? 'bg-emerald-500 text-white shadow-lg' : ''}`}>{isAdmin ? 'VERIFIED ADMIN' : 'ADMIN ONLY'}</h3>
            </div>
            {isAdmin ? <Verified className="w-8 h-8 text-emerald-600" /> : <Lock className="w-8 h-8 text-primary" />}
          </div>
          <div className={`grid grid-cols-2 gap-y-10 pt-6 transition-all duration-700 ${isAdmin ? '' : 'blur-[12px] select-none pointer-events-none opacity-30 shadow-inner'}`}>
            <div>
              <p className="text-lg font-black text-outline uppercase tracking-widest mb-2">매입 단가</p>
              <p className="text-4xl font-black tracking-tight">₩ {item.purchasePrice?.toLocaleString() || '0'}</p>
            </div>
            <div>
              <p className="text-lg font-black text-outline uppercase tracking-widest mb-2">판매 단가</p>
              <p className="text-4xl font-black tracking-tight">₩ {item.salesPrice?.toLocaleString() || '0'}</p>
            </div>
            <div className="col-span-2 p-10 bg-white rounded-[32px] border-2 border-outline-variant flex justify-between items-center shadow-xl">
              <div>
                <p className="text-xl font-black text-outline uppercase tracking-widest mb-2">마진율</p>
                <p className="text-5xl font-black text-primary tracking-tighter">{margin > 0 ? '+' : ''}{marginPercent}%</p>
              </div>
              <p className="text-6xl font-black text-emerald-600 tracking-tighter">₩ {margin?.toLocaleString() || '0'}</p>
            </div>
          </div>
          {!isAdmin && (
            <div className="absolute inset-0 top-20 flex flex-col items-center justify-center bg-white/10 backdrop-blur-[4px] z-10 transition-all">
              <div className="text-center space-y-6 bg-white p-10 rounded-[32px] shadow-2xl border-4 border-outline-variant/30">
                <p className="text-primary font-black text-2xl uppercase tracking-widest">권한 확인 후 열람 가능</p>
                <button className="bg-primary text-white h-16 px-10 rounded-2xl text-lg font-black shadow-2xl flex items-center gap-4 mx-auto cursor-not-allowed opacity-60 uppercase tracking-widest scale-110">
                  <Verified className="w-6 h-6" /> 관리자 권한 필요
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Health */}
        <div className="bg-white border-2 border-outline-variant rounded-[40px] p-10 space-y-10 shadow-2xl flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-on-surface-variant uppercase tracking-widest">재고 현황 지표</h3>
            <TrendingUp className="w-8 h-8 text-outline" />
          </div>
          <div className="grid grid-cols-3 gap-8 items-end pb-4">
            <div className="space-y-4">
              <p className="text-lg font-black text-outline uppercase tracking-widest">현재 재고</p>
              <p className="text-6xl font-black text-primary leading-none tracking-tighter">{item.currentStock}</p>
            </div>
            <div className="space-y-2 border-l-2 border-outline-variant/30 pl-6">
              <p className="text-[8px] font-black text-outline uppercase tracking-widest">안전 재고</p>
              <p className="text-3xl font-black text-on-surface-variant tracking-tight">{item.safetyStock}</p>
            </div>
            <div className="space-y-2 border-l-2 border-outline-variant/30 pl-6">
              <p className="text-[8px] font-black text-outline uppercase tracking-widest">로스율</p>
              <p className="text-3xl font-black text-error tracking-tight">{item.loss}</p>
            </div>
          </div>
          <div className="bg-surface-container-highest p-4 rounded-2xl flex items-center justify-between mt-4">
            <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">적정 재고 대비</span>
            <span className="text-lg font-mono text-primary font-black tracking-widest">+175%</span>
          </div>
        </div>
      </div>

      {/* Specs */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-surface-variant pb-4">
          <h3 className="text-[7px] font-bold text-on-surface-variant uppercase tracking-widest">제품 규격 및 보관 정보</h3>
          <Warehouse className="w-4 h-4 text-outline" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <p className="text-4xl font-black text-primary">{item.unit || '단위 미정'}</p>
            <div className="flex items-start gap-4 p-4 bg-surface-container-low rounded-xl border border-surface-variant">
              <MapPin className="text-secondary w-6 h-6 mt-1" />
              <div>
                <p className="text-[7px] font-bold text-outline uppercase tracking-wider">주요 보관 위치</p>
                <p className="text-lg font-bold">{item.location || '위치 정보 없음'}</p>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {[
                { l: '재고 관리 방식', v: '선입선출 (FIFO)' },
                { l: '최근 입고일', v: '2023-11-20' },
                { l: '출고 예정일', v: '2023-11-28' },
                { l: '소비기한', v: '2024-05-20', c: 'text-error' },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-[7px] font-bold text-outline uppercase mb-0.5">{item.l}</p>
                  <p className={`text-md font-bold ${item.c || ''}`}>{item.v}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-[7px] font-bold uppercase tracking-wider">
                <span className="text-on-surface-variant">창고 점유율</span>
                <span className="text-primary">82%</span>
              </div>
              <div className="w-full bg-surface-variant h-3 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '82%' }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="bg-primary h-full rounded-full" 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-[7px] font-bold text-on-surface-variant uppercase tracking-widest">최근 활동 내역</h3>
          <History className="w-4 h-4 text-outline" />
        </div>
        <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-surface-variant">
          <div className="relative">
            <div className="absolute -left-[20px] top-1.5 w-[10px] h-[10px] rounded-full bg-primary ring-4 ring-white shadow-sm"></div>
            <p className="text-[9px] font-bold text-primary">신규 입고: #B-9021</p>
            <p className="text-[7px] font-bold text-outline uppercase">오전 10:45 · 2023.11.20</p>
          </div>
          <div className="relative">
            <div className="absolute -left-[20px] top-1.5 w-[10px] h-[10px] rounded-full bg-outline-variant ring-4 ring-white shadow-sm"></div>
            <p className="text-[9px] font-bold text-on-surface">정기 재고 조사 완료</p>
            <p className="text-[7px] font-bold text-outline uppercase">오후 03:20 · 2023.11.18</p>
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
            <h2 className="text-5xl font-black text-on-surface tracking-tighter">물류현황</h2>
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
                    <label className="text-[10px] font-black text-outline uppercase tracking-widest">무게 (KG)</label>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
        <div className="bg-white p-8 border border-outline-variant rounded-3xl shadow-sm flex flex-col gap-4">
          <span className="text-lg font-black text-outline uppercase tracking-widest">금일 총 물동량</span>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-on-surface">{stats.weight.toLocaleString()}</span>
            <span className="text-2xl text-outline font-black">KG</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-600 font-mono text-base font-black bg-emerald-50 w-fit px-4 py-2 rounded-xl">
            <TrendingUp className="w-5 h-5" /> 최근 업데이트: {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="bg-white p-8 border border-outline-variant border-l-8 border-l-emerald-500 rounded-3xl shadow-sm flex flex-col gap-4">
          <span className="text-xl font-black text-outline uppercase tracking-widest text-emerald-700">금일 입고</span>
          <div className="flex items-baseline gap-3 text-emerald-700">
            <span className="text-6xl font-black">{stats.inCount.toString().padStart(2, '0')}</span>
            <span className="text-3xl text-outline font-black">건</span>
          </div>
          <span className="text-base text-outline font-black uppercase tracking-widest opacity-70">오늘의 총 입고 작업 수</span>
        </div>
        <div className="bg-white p-8 border border-outline-variant border-l-8 border-l-blue-500 rounded-3xl shadow-sm flex flex-col gap-4">
          <span className="text-xl font-black text-outline uppercase tracking-widest text-blue-700">금일 출고</span>
          <div className="flex items-baseline gap-3 text-blue-700">
            <span className="text-6xl font-black">{stats.outCount.toString().padStart(2, '0')}</span>
            <span className="text-3xl text-outline font-black">건</span>
          </div>
          <span className="text-base text-outline font-black uppercase tracking-widest opacity-70">오늘의 총 출고 작업 수</span>
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
                      <p className="text-lg font-black text-primary uppercase tracking-widest">{item.weight ? `${item.weight} KG` : item.qty}</p>
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
  const [items, setItems] = useState([{ title: '', rawMeat: '', weight: '', loss: '', manufDate: '', expiryDate: '' }]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [originalWeight, setOriginalWeight] = useState<number | null>(null);

  const filteredProduction = useMemo(() => {
    return production.filter(batch => {
      const matchesName = batch.title?.toLowerCase().includes(searchName.toLowerCase());
      const matchesDate = !searchDate || batch.manufDate === searchDate;
      return matchesName && matchesDate;
    });
  }, [production, searchName, searchDate]);

  const handleDeleteProduction = async (id: string, batchTitle: string, weight: any) => {
    if (!window.confirm('정말로 이 생산 기록을 삭제하시겠습니까? 관련 재고가 자동으로 차감됩니다.')) return;
    setLoading(true);
    try {
      // 1. Delete the batch
      await deleteDoc(doc(db, 'production_batches', id));

      // 2. Adjust inventory (decrease stock)
      const weightValue = parseFloat(weight.toString().replace(/[^0-9.]/g, '')) || 0;
      const existingInvItem = inventory.find(i => i.name === batchTitle);
      if (existingInvItem) {
        const invDocRef = doc(db, 'inventory', existingInvItem.id);
        await updateDoc(invDocRef, {
          currentStock: increment(-weightValue),
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
    const weight = parseFloat(batch.weight.toString().replace(/[^0-9.]/g, '')) || 0;
    setOriginalWeight(weight);
    setItems([{
      title: batch.title,
      rawMeat: batch.rawMeat || '',
      weight: batch.weight.toString().toLowerCase().replace('kg', '').trim(),
      loss: batch.loss || '',
      manufDate: batch.manufDate || '',
      expiryDate: batch.expiryDate || ''
    }]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setItems([{ title: '', rawMeat: '', weight: '', loss: '', manufDate: '', expiryDate: '' }]);
    setShowForm(false);
  };

  const addItem = () => {
    setItems([...items, { title: '', rawMeat: '', weight: '', loss: '', manufDate: '', expiryDate: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
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
        const newWeight = parseFloat(item.weight.toString().replace(/[^0-9.]/g, '')) || 0;
        const weightDiff = newWeight - (originalWeight || 0);

        await setDoc(ref, {
          ...item,
          productionLine,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Update inventory if weight changed
        if (weightDiff !== 0) {
          const existingInvItem = inventory.find(i => i.name === item.title);
          if (existingInvItem) {
            const invDocRef = doc(db, 'inventory', existingInvItem.id);
            await updateDoc(invDocRef, {
              currentStock: increment(weightDiff),
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
            productionLine,
            batchId,
            sku: existingInvItem?.sku || `SKU-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            status: '완료',
            createdAt: serverTimestamp(),
          });

          // 2. Pass to inventory
          const weightValue = parseFloat(item.weight.toString().replace(/[^0-9.]/g, '')) || 0;

          if (existingInvItem) {
            // Update existing stock
            const invDocRef = doc(db, 'inventory', existingInvItem.id);
            const updateData: any = {
              currentStock: increment(weightValue),
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
              currentStock: weightValue,
              safetyStock: Math.floor(weightValue * 0.2),
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
      
      setItems([{ title: '', rawMeat: '', weight: '', loss: '', manufDate: '', expiryDate: '' }]);
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
            <h1 className="text-5xl font-black text-primary tracking-tighter uppercase">생산관리</h1>
            <p className="text-2xl font-bold text-on-surface-variant mt-1">생산 공정 및 작업 일지 관리</p>
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
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 text-base font-black text-outline uppercase tracking-[0.2em]">
                  <div className="col-span-3 text-center">품목명</div>
                  <div className="col-span-3 text-center">원육</div>
                  <div className="col-span-2 text-center text-primary">중량 (kg)</div>
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
                      <div className="w-full md:col-span-3">
                        <input required value={item.title} onChange={e => updateItem(idx, 'title', e.target.value)} type="text" placeholder="품목명 입력" className="w-full h-12 px-4 rounded-xl bg-white border-2 border-transparent focus:border-primary outline-none text-lg transition-all font-black shadow-inner" />
                      </div>
                      <div className="w-full md:col-span-3">
                        <input required value={item.rawMeat} onChange={e => updateItem(idx, 'rawMeat', e.target.value)} type="text" placeholder="원육 정보" className="w-full h-12 px-4 rounded-xl bg-white border-2 border-transparent focus:border-primary outline-none text-base transition-all font-bold shadow-inner" />
                      </div>
                      <div className="w-full md:col-span-2">
                        <input required value={item.weight} onChange={e => updateItem(idx, 'weight', e.target.value)} type="text" placeholder="0.0" className="w-full h-12 px-2 text-center rounded-xl bg-white border-2 border-transparent focus:border-primary outline-none text-lg transition-all font-mono font-black text-primary shadow-inner" />
                      </div>
                      <div className="w-full md:col-span-2">
                        <div className="w-full h-12 flex items-center justify-center rounded-xl bg-emerald-50 border-2 border-emerald-100 text-lg font-mono font-black text-emerald-600 shadow-inner">
                          {100 - (parseFloat(item.loss) || 0)}%
                        </div>
                      </div>
                      <div className="w-full md:col-span-1">
                        <input required value={item.loss} onChange={e => updateItem(idx, 'loss', e.target.value)} type="text" placeholder="0.0" className="w-full h-12 px-2 text-center rounded-xl bg-white border-2 border-transparent focus:border-primary outline-none text-lg transition-all font-mono font-black text-error shadow-inner" />
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
        <div className="bg-white p-6 border-2 border-outline-variant rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-base font-black text-outline uppercase tracking-widest">총 생산 배치</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-5xl font-black text-primary tracking-tighter">{production.length}</span>
            <Factory className="text-secondary w-10 h-10" />
          </div>
        </div>
        <div className="bg-white p-6 border-2 border-outline-variant rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-base font-black text-outline uppercase tracking-widest">평균 로스율</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-5xl font-black text-error tracking-tighter">
              {(production.reduce((acc, curr) => acc + parseFloat(curr.loss || '0'), 0) / (production.length || 1)).toFixed(1)}%
            </span>
            <AlertTriangle className="text-error w-10 h-10" />
          </div>
        </div>
        <div className="bg-white p-6 border-2 border-outline-variant rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-base font-black text-outline uppercase tracking-widest">전체 총 생산량</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-4xl font-black text-primary tracking-tighter">
              {(production.reduce((acc, curr) => {
                const val = parseFloat(curr.weight?.toString().toLowerCase().replace('kg', '').trim() || '0');
                return acc + (isNaN(val) ? 0 : val);
              }, 0)).toLocaleString()} <span className="text-xl font-black ml-1 text-outline">kg</span>
            </span>
            <TrendingUp className="text-emerald-600 w-10 h-10" />
          </div>
        </div>
        <div className="bg-white p-6 border-2 border-outline-variant rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-base font-black text-outline uppercase tracking-widest">가동 라인</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-5xl font-black text-primary">3</span>
            <CheckCircle2 className="text-emerald-500 w-10 h-10" />
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
                  <th className="p-4 whitespace-nowrap">SKU</th>
                  <th className="p-4 whitespace-nowrap">품목명</th>
                  <th className="p-4 whitespace-nowrap">원육</th>
                  <th className="p-4 text-center whitespace-nowrap">중량</th>
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
                      <p className="text-2xl font-black text-on-surface group-hover:text-primary transition-colors tracking-tight">{batch.title}</p>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-3 py-1.5 bg-surface-container rounded-xl text-base font-black text-on-surface-variant">
                        {batch.rawMeat || '미지정'}
                      </span>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <p className="text-2xl font-black text-primary">
                        {batch.weight.toString().toLowerCase().includes('kg') ? batch.weight : `${batch.weight}kg`}
                      </p>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <p className="text-2xl font-black text-emerald-600">
                        {100 - (parseFloat(batch.loss || '0'))}%
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
                            onClick={() => handleDeleteProduction(batch.id, batch.title, batch.weight)}
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

const SettingsView = ({ onNavigate, partners }: { onNavigate?: (view: ViewType) => void, partners: any[] }) => {
  const [activeTab, setActiveTab] = useState<'product' | 'partner'>('product');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
          <h2 className="text-5xl font-black text-primary tracking-tighter uppercase leading-none">시스템 설정</h2>
          <p className="text-2xl text-on-surface-variant font-black tracking-tight pt-1">마스터 데이터 및 환경 설정 관리</p>
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
      </div>

      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white p-8 rounded-3xl border border-outline-variant shadow-sm"
      >
        {activeTab === 'product' ? (
          <form onSubmit={handleRegisterProduct} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2 text-center pb-2">
              <h3 className="text-sm font-black text-primary uppercase tracking-widest">신규 상품(Master) 등록</h3>
            </div>
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

            {/* 생산일 및 소비기한 분리 */}
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

            {/* 보관 위치 분리 */}
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
        ) : (
          <div className="space-y-12">
            <form onSubmit={handlePartnerSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-surface-container/20 p-6 rounded-2xl border border-outline-variant/30 relative">
              {editingPartner && (
                <div className="absolute top-4 right-4 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Edit3 className="w-3 h-3" /> 수정 중
                </div>
              )}
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
  
  const [inventory, setInventory] = useState<any[]>([]);
  const [production, setProduction] = useState<any[]>([]);
  const [logistics, setLogistics] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);

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

          // Seed if empty
          const empty = await isDatabaseEmpty();
          if (empty) {
            console.log("Database is empty, seeding...");
            await seedDatabase();
          }
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

    return () => {
      unsubInv();
      unsubProd();
      unsubLog();
      unsubPartners();
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
          <div className="bg-primary text-white w-24 h-24 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-primary/30">
            <Warehouse className="w-12 h-12" />
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
      <header className="bg-white/80 backdrop-blur-md border-b border-outline-variant fixed top-0 w-full z-50 h-16 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-white p-2 rounded-lg shadow-inner">
              <Warehouse className="w-5 h-5" />
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
      <div className="flex flex-1 pt-16">
        {/* Desktop Sidebar Sidebar */}
        <aside className="hidden lg:flex flex-col fixed left-0 top-16 bottom-0 w-20 bg-white border-r border-outline-variant items-center py-8 gap-10">
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
                {currentView === 'inventory' && <InventoryView onNavigate={handleNavigate} inventory={inventory} />}
                {currentView === 'detail' && <ItemDetailView onNavigate={handleNavigate} userData={userData} item={selectedItem} />}
                {currentView === 'logistics' && <LogisticsView logistics={logistics} inventory={inventory} partners={partners} onNavigate={handleNavigate} />}
                {currentView === 'production' && <ProductionView production={production} inventory={inventory} onNavigate={handleNavigate} />}
                {currentView === 'settings' && <SettingsView onNavigate={handleNavigate} partners={partners} />}
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
      <button className="lg:hidden fixed right-6 bottom-20 w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform">
        <Plus className="w-8 h-8" />
      </button>

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
