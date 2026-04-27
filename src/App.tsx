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
  Edit,
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
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, loginWithGoogle, logout, db, User } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

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

type ViewType = 'dashboard' | 'inventory' | 'logistics' | 'production' | 'partners' | 'detail';

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
      <p className="text-[10px] font-bold text-outline uppercase tracking-wider">{item.label}</p>
      <p className="text-xl font-bold mt-1 text-on-surface">
        {item.value}<span className="text-xs font-normal ml-0.5">{item.unit}</span>
      </p>
      {item.trend && (
        <div className={`flex items-center gap-1 text-[10px] mt-1 font-bold ${item.trendDir === 'up' ? 'text-emerald-600' : 'text-error'}`}>
          {item.trendDir === 'up' ? <TrendingUp className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {item.trend}
        </div>
      )}
    </div>
  );
};

// --- Views ---

const DashboardView = ({ onNavigate }: { onNavigate: (view: ViewType) => void }) => {
  const stats: StatItem[] = [
    { label: '전체 상품', value: '1,248', unit: '개', icon: Package },
    { label: '유통기한', value: '14', unit: '건', icon: CalendarDays, color: 'bg-secondary' },
    { label: '오늘 입고', value: '4,250', unit: 'kg', icon: ArrowDownToLine, color: 'bg-primary-container' },
    { label: '오늘 출고', value: '3,890', unit: 'kg', icon: ArrowUpFromLine, color: 'bg-secondary-container' },
    { label: '주의 필요', value: '5', unit: '개', icon: AlertTriangle, color: 'bg-error' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">대시보드</h1>
          <p className="text-on-surface-variant">2024년 3월 24일 실시간 재고 및 생산 현황</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white border border-outline px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm hover:bg-surface-variant transition-colors">
            <FileText className="w-4 h-4" /> PDF 내보내기
          </button>
          <button className="bg-white border border-outline px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm hover:bg-surface-variant transition-colors">
            <Download className="w-4 h-4" /> 엑셀 내보내기
          </button>
          <button className="bg-primary text-white px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm shadow-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> 신규 등록
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s, i) => <StatCard key={i} item={s} />)}
      </section>

      {/* Main Content */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="text-error w-5 h-5" /> 안전 재고 알림
          </h3>
          <div className="space-y-3">
            <div className="bg-error-container p-4 rounded-xl border border-error/20 space-y-2">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-on-error-container">소고기 스트립로인</h4>
                <span className="bg-error text-white px-1.5 py-0.5 rounded text-[10px] font-bold">위험</span>
              </div>
              <p className="text-sm text-on-error-container/80">현재고: 120kg | 기준치: 500kg</p>
              <div className="flex gap-2 pt-1">
                <button className="bg-on-error-container text-white px-3 py-1 rounded text-xs font-bold">지금 발주</button>
                <button className="border border-on-error-container/30 text-on-error-container px-3 py-1 rounded text-xs font-bold">무시</button>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-outline-variant space-y-1">
              <div className="flex justify-between items-start">
                <h4 className="font-bold">돼지고기 안심</h4>
                <span className="bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded text-[10px] font-bold">부족</span>
              </div>
              <p className="text-sm text-on-surface-variant">현재고: 450kg | 기준치: 600kg</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-outline-variant opacity-60">
              <div className="flex justify-between items-start">
                <h4 className="font-bold">훈제 베이컨 스트랩</h4>
                <span className="bg-surface-container-highest text-on-surface-variant px-1.5 py-0.5 rounded text-[10px] font-bold">정상</span>
              </div>
              <p className="text-sm text-on-surface-variant">재고 수준 회복 중 (850kg)</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">최근 생산 활동</h3>
            <button onClick={() => onNavigate('production')} className="text-primary text-sm font-bold">전체 보기</button>
          </div>
          <div className="overflow-hidden border border-outline-variant rounded-xl bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase font-bold text-outline">
                <tr>
                  <th className="p-4">SKU</th>
                  <th className="p-4">품목</th>
                  <th className="p-4">생산량</th>
                  <th className="p-4">로스율</th>
                  <th className="p-4 text-right">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {[
                  { sku: 'SKU-99201', name: '훈제 살라미', qty: '452 KG', loss: '2.4%', status: '진행 중', color: 'bg-secondary-fixed' },
                  { sku: 'SKU-99198', name: '와규 다짐육', qty: '890 KG', loss: '1.8%', status: '완료', color: 'bg-surface-container-highest' },
                  { sku: 'SKU-99195', name: '소갈비 (대량)', qty: '1,240 KG', loss: '0.5%', status: '입고 완료', color: 'bg-surface-container-highest' },
                  { sku: 'SKU-99192', name: '냉장 양지', qty: '315 KG', loss: '3.1%', status: '보류 중', color: 'bg-error-container' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-surface-container transition-colors">
                    <td className="p-4 text-xs font-mono text-outline">{row.sku}</td>
                    <td className="p-4 text-sm font-bold">{row.name}</td>
                    <td className="p-4 text-xs font-mono font-bold">{row.qty}</td>
                    <td className={`p-4 text-xs font-mono font-bold ${row.loss > '2%' ? 'text-error' : 'text-primary'}`}>{row.loss}</td>
                    <td className="p-4 text-right">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${row.color}`}>{row.status}</span>
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

const InventoryView = ({ onNavigate }: { onNavigate: (view: ViewType) => void }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">운영 센터</p>
        <h2 className="text-3xl font-bold text-on-surface">재고 관리 현황</h2>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
          <input 
            type="text" 
            placeholder="SKU 또는 제품명으로 검색..." 
            className="w-full h-11 pl-10 pr-4 bg-white border border-outline-variant rounded-lg focus:border-primary outline-none text-sm"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select className="h-11 px-4 bg-white border border-outline-variant rounded-lg text-sm focus:border-primary outline-none min-w-[140px]">
            <option>전체 카테고리</option>
            <option>소고기</option>
            <option>돼지고기</option>
            <option>가금류</option>
          </select>
          <button className="h-11 px-4 bg-primary text-white rounded-lg flex items-center gap-2 text-xs font-bold uppercase transition-all hover:bg-primary-container">
            <Bell className="w-4 h-4" /> 필터
          </button>
          <button className="h-11 px-4 border border-outline text-on-surface-variant rounded-lg flex items-center gap-2 text-xs font-bold uppercase transition-all hover:bg-surface-container">
            <Download className="w-4 h-4" /> 엑셀
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '총 SKU', value: '124', color: 'text-primary' },
          { label: '재고 부족', value: '12', color: 'text-error' },
          { label: '금일 입고', value: '4.2k', unit: 'kg', color: 'text-secondary' },
          { label: '금일 출고', value: '1.8k', unit: 'kg', color: 'text-tertiary' },
        ].map((item, i) => (
          <div key={i} className="bg-surface-container p-4 rounded-xl border border-outline-variant/30">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>
              {item.value}<span className="text-xs font-normal ml-0.5">{item.unit || ''}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {[
          { icon: <Warehouse className="w-4 h-4 text-primary" />, name: '프리미엄 등심 스테이크', sku: 'SKU-BF-4402', cat: '소고기', stock: '1,240kg', loss: '1.2%', status: '정상', color: 'text-emerald-700' },
          { icon: <AlertTriangle className="w-4 h-4 text-error" />, name: '돼지 삼겹살 슬라브', sku: 'SKU-PK-8812', cat: '돼지고기', stock: '125kg', loss: '4.8%', status: '재고 부족', color: 'text-error', urgent: true },
          { icon: <Package className="w-4 h-4 text-primary" />, name: '유기농 닭가슴살', sku: 'SKU-PY-1109', cat: '가금류', stock: '840kg', loss: '2.1%', status: '정상', color: 'text-emerald-700' },
          { icon: <Package className="w-4 h-4 text-primary" />, name: '다짐육 소고기 80/20', sku: 'SKU-BF-4410', cat: '소고기', stock: '2,100kg', loss: '0.8%', status: '정상', color: 'text-emerald-700' },
        ].map((item, i) => (
          <div 
            key={i} 
            onClick={() => onNavigate('detail')}
            className={`grid grid-cols-1 md:grid-cols-12 items-center gap-4 p-4 bg-white border rounded-xl hover:border-primary transition-all cursor-pointer group shadow-sm ${item.urgent ? 'border-error-container' : 'border-outline-variant'}`}
          >
            <div className="col-span-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">{item.name}</p>
                <p className="text-[10px] text-outline font-mono uppercase">{item.sku}</p>
              </div>
            </div>
            <div className="col-span-2 flex md:block justify-between">
              <span className="md:hidden text-[10px] font-bold text-outline">카테고리</span>
              <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant rounded text-[10px] font-bold">{item.cat}</span>
            </div>
            <div className="col-span-2 flex md:block justify-between md:text-right">
              <span className="md:hidden text-[10px] font-bold text-outline">현재 재고</span>
              <div>
                <p className={`font-bold ${item.urgent ? 'text-error' : ''}`}>{item.stock}</p>
                <p className="text-[10px] text-outline">로스율: {item.loss}</p>
              </div>
            </div>
            <div className="col-span-2 flex md:justify-center items-center gap-1">
              <CheckCircle2 className={`w-4 h-4 ${item.color}`} />
              <span className={`text-[10px] font-bold uppercase ${item.color}`}>{item.status}</span>
            </div>
            <div className="col-span-2 text-right">
              <button className="px-3 py-1 border border-primary text-primary rounded text-[10px] font-bold uppercase hover:bg-surface-container transition-colors">수정</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ItemDetailView = ({ onNavigate }: { onNavigate: (view: ViewType) => void }) => {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-on-surface-variant text-xs">
        <button onClick={() => onNavigate('inventory')} className="hover:text-primary">소고기</button>
        <ChevronRight className="w-3 h-3" />
        <span>냉동</span>
      </nav>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">프리미엄 소갈비</h1>
          <p className="text-sm font-mono text-outline">SKU-10023</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm text-xs font-bold">
            <CheckCircle2 className="w-3 h-3 fill-emerald-800 text-emerald-100" /> NORMAL STATUS
          </div>
          <button className="flex items-center gap-1 text-primary text-sm font-bold hover:underline">
            <Edit className="w-4 h-4" /> 정보 수정
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <button className="flex-1 bg-primary text-white h-14 rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-lg active:scale-95 transition-transform">
          <Package className="w-6 h-6" /> 재고 업데이트
        </button>
        <button className="flex-1 border-2 border-primary text-primary h-14 rounded-xl flex items-center justify-center gap-2 font-bold text-lg bg-white active:scale-95 transition-transform">
          <Download className="w-6 h-6" /> 데이터 내보내기
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Admin Section */}
        <div className="border border-outline-variant rounded-2xl p-6 space-y-4 shadow-sm bg-surface-container-low relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest">관리자 전용 관리</h3>
              <span className="bg-primary/10 text-primary text-[8px] px-1.5 py-0.5 rounded font-bold">ADMIN ONLY</span>
            </div>
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-y-4 pt-2 blur-[6px] select-none pointer-events-none opacity-40">
            <div>
              <p className="text-[10px] font-bold text-outline uppercase tracking-wider">매입 단가</p>
              <p className="text-lg font-bold">₩ 25,000</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-outline uppercase tracking-wider">판매 단가</p>
              <p className="text-lg font-bold">₩ 38,000</p>
            </div>
            <div className="col-span-2 p-4 bg-white rounded-xl border border-outline-variant flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">마진율</p>
                <p className="text-xl font-bold text-primary">+34.2%</p>
              </div>
              <p className="text-2xl font-black text-emerald-600">₩ 13,000</p>
            </div>
          </div>
          <div className="absolute inset-0 top-12 flex flex-col items-center justify-center bg-white/10 backdrop-blur-[1px] z-10 transition-all group-hover:backdrop-blur-none">
            <div className="text-center space-y-3 bg-white/80 p-4 rounded-xl shadow-xl backdrop-blur-md">
              <p className="text-primary font-bold text-xs">권한 확인 후 열람 가능</p>
              <button className="bg-primary text-white px-4 py-2 rounded-lg text-[10px] font-bold shadow-md flex items-center gap-2 mx-auto">
                <Verified className="w-4 h-4" /> 관리자 인증하기
              </button>
            </div>
          </div>
        </div>

        {/* Health */}
        <div className="bg-white border border-outline-variant rounded-2xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">재고 현황</h3>
            <TrendingUp className="w-4 h-4 text-outline" />
          </div>
          <div className="grid grid-cols-3 gap-4 items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-outline uppercase">현재 재고</p>
              <p className="text-5xl font-black text-primary leading-none">124</p>
            </div>
            <div className="space-y-1 border-l border-outline-variant/30 pl-4">
              <p className="text-[10px] font-bold text-outline uppercase">안전 재고</p>
              <p className="text-2xl font-bold text-on-surface-variant">45</p>
            </div>
            <div className="space-y-1 border-l border-outline-variant/30 pl-4">
              <p className="text-[10px] font-bold text-outline uppercase">평균 로스율</p>
              <p className="text-2xl font-bold text-error">1.8%</p>
            </div>
          </div>
          <div className="bg-surface-container-highest p-3 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant">적정 재고 대비</span>
            <span className="text-sm font-mono text-primary font-black">+175%</span>
          </div>
        </div>
      </div>

      {/* Specs */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-surface-variant pb-4">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">제품 규격 및 보관 정보</h3>
          <Warehouse className="w-4 h-4 text-outline" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <p className="text-4xl font-black text-primary">10 kg/박스</p>
            <div className="flex items-start gap-4 p-4 bg-surface-container-low rounded-xl border border-surface-variant">
              <MapPin className="text-secondary w-6 h-6 mt-1" />
              <div>
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">주요 보관 위치</p>
                <p className="text-lg font-bold">A창고, 3구역, 4번 선반</p>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {[
                { l: '재고 관리 방식', v: '선입선출 (FIFO)' },
                { l: '최근 입고일', v: '2023-11-20' },
                { l: '출고 예정일', v: '2023-11-28' },
                { l: '유통기한', v: '2024-05-20', c: 'text-error' },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-[10px] font-bold text-outline uppercase mb-0.5">{item.l}</p>
                  <p className={`text-md font-bold ${item.c || ''}`}>{item.v}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
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
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">최근 활동 내역</h3>
          <History className="w-4 h-4 text-outline" />
        </div>
        <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-surface-variant">
          <div className="relative">
            <div className="absolute -left-[20px] top-1.5 w-[10px] h-[10px] rounded-full bg-primary ring-4 ring-white shadow-sm"></div>
            <p className="text-sm font-bold text-primary">신규 입고: #B-9021</p>
            <p className="text-[10px] font-bold text-outline uppercase">오전 10:45 · 2023.11.20</p>
          </div>
          <div className="relative">
            <div className="absolute -left-[20px] top-1.5 w-[10px] h-[10px] rounded-full bg-outline-variant ring-4 ring-white shadow-sm"></div>
            <p className="text-sm font-bold text-on-surface">정기 재고 조사 완료</p>
            <p className="text-[10px] font-bold text-outline uppercase">오후 03:20 · 2023.11.18</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const LogisticsView = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">운영 현황</p>
          <h2 className="text-3xl font-bold text-on-surface">물류 관리 현황</h2>
        </div>
        <div className="flex gap-2">
          <button className="bg-white border border-outline px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-surface-variant transition-colors">
            <Bell className="w-4 h-4" /> 필터
          </button>
          <button className="bg-white border border-outline px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-surface-variant transition-colors">
            <Download className="w-4 h-4" /> 엑셀
          </button>
          <button className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> 신규 입하/출하
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        <div className="bg-white p-5 border border-outline-variant rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider">금일 총 물동량</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black">12,480</span>
            <span className="text-xs text-outline font-bold">KG</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-600 font-mono text-[10px] font-bold">
            <TrendingUp className="w-3 h-3" /> 전일 대비 +4.2%
          </div>
        </div>
        <div className="bg-white p-5 border border-outline-variant border-l-4 border-l-emerald-500 rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider text-emerald-700">입고 대기</span>
          <div className="flex items-baseline gap-1 text-emerald-700">
            <span className="text-3xl font-black">08</span>
            <span className="text-xs text-outline font-bold">건</span>
          </div>
          <span className="text-[10px] text-outline font-bold">예상 도착 시간 &lt; 4시간</span>
        </div>
        <div className="bg-white p-5 border border-outline-variant border-l-4 border-l-blue-500 rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider text-blue-700">출고 예정</span>
          <div className="flex items-baseline gap-1 text-blue-700">
            <span className="text-3xl font-black">14</span>
            <span className="text-xs text-outline font-bold">건</span>
          </div>
          <span className="text-[10px] text-outline font-bold">다음 픽업: 14:30</span>
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex justify-center">
          <div className="bg-surface-container-high px-4 py-1 rounded-full border border-outline-variant z-10 text-[10px] font-bold text-primary uppercase tracking-widest">
            오늘, 10월 24일
          </div>
        </div>

        <div className="space-y-8 relative">
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-[2px] bg-outline-variant/30 -translate-x-1/2 hidden md:block" />
          
          {[
            { time: '08:45 AM', type: '입고', title: '프리미엄 소고기 하프', supplier: '밸리 랜치 Co.', qty: '24 유닛 (3,200 KG)', status: '도크 4 • 하역 중', color: 'bg-emerald-500', side: 'left', icon: <ArrowDownToLine className="w-4 h-4 text-white" /> },
            { time: '10:15 AM', type: '출고', title: '모둠 프라임 컷', supplier: '메트로폴리탄 스테이크하우스 그룹', qty: '145 박스 (840 KG)', status: '도크 1 • 준비 중', color: 'bg-blue-500', side: 'right', icon: <ArrowUpFromLine className="w-4 h-4 text-white" /> },
            { time: '11:30 AM', type: '출고', title: '분쇄육 벌크 (산업용)', supplier: '센트럴 물류 허브', qty: '1,200 KG (파렛트 적재)', status: '스케줄 확정 • 대기 중', color: 'bg-blue-500', side: 'right', icon: <ArrowUpFromLine className="w-4 h-4 text-white" /> },
          ].map((item, i) => (
            <div key={i} className={`flex flex-col md:flex-row gap-6 relative ${item.side === 'right' ? 'md:flex-row-reverse' : ''}`}>
              <div className={`flex flex-col gap-2 md:w-1/2 ${item.side === 'left' ? 'md:text-right' : 'md:text-left'}`}>
                <div className={`flex items-center gap-2 ${item.side === 'left' ? 'md:justify-end' : ''}`}>
                  <span className="text-xs font-mono text-outline font-bold">{item.time}</span>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded text-white uppercase ${item.color}`}>{item.type}</span>
                </div>
                <div className="bg-white p-5 border border-outline-variant rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                  <h3 className="text-lg font-black text-on-surface group-hover:text-primary transition-colors">{item.title}</h3>
                  <div className="mt-2 space-y-1 text-sm text-on-surface-variant font-bold">
                    <p className="flex items-center gap-2 md:justify-end">
                      <Truck className="w-4 h-4" /> {item.supplier}
                    </p>
                    <p className="text-primary">{item.qty}</p>
                  </div>
                  <div className={`mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between ${item.side === 'left' ? 'md:flex-row-reverse' : ''}`}>
                    <span className="text-[10px] font-black flex items-center gap-1.5 uppercase">
                      <span className={`w-2 h-2 rounded-full ${item.color}`} />
                      {item.status}
                    </span>
                    <button className="text-primary text-[10px] font-black hover:underline uppercase tracking-tighter">상세 보기</button>
                  </div>
                </div>
              </div>
              <div className="absolute left-4 md:left-1/2 top-2 w-10 h-10 -translate-x-1/2 bg-white border-4 border-surface ring-2 ring-outline-variant rounded-full flex items-center justify-center z-10 hidden md:flex">
                <div className={`w-full h-full rounded-full flex items-center justify-center ${item.color}`}>
                  {item.icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ProductionView = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">생산 현황</p>
          <h2 className="text-3xl font-bold text-on-surface">생산 관리 대시보드</h2>
        </div>
        <div className="flex gap-2">
          <button className="bg-white border border-outline px-4 py-2 rounded-lg text-sm font-bold shadow-xs hover:bg-surface-variant">엑셀 다운로드</button>
          <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2"><Plus className="w-4 h-4" /> 새 배치 등록</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 bg-white p-6 border border-outline-variant rounded-2xl flex flex-col justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">현재 처리량</span>
            <h2 className="text-4xl font-black mt-2 text-primary">12,450 kg</h2>
            <p className="text-sm font-bold text-on-surface-variant mt-1">가동률 84%</p>
          </div>
          <div className="h-2.5 w-full bg-surface-container rounded-full mt-6 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: '84%' }} className="h-full bg-primary" />
          </div>
        </div>
        <div className="bg-white p-6 border border-outline-variant rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider">진행 중인 배치</span>
          <div className="flex items-end justify-between mt-4">
            <span className="text-4xl font-black text-primary">14</span>
            <Factory className="text-secondary w-10 h-10" />
          </div>
          <p className="text-xs font-bold text-emerald-600 mt-4 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> 이전 대비 +2</p>
        </div>
        <div className="bg-white p-6 border border-outline-variant rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider">평균 수율</span>
          <div className="flex items-end justify-between mt-4">
            <span className="text-4xl font-black text-primary">96.4%</span>
            <TrendingUp className="text-secondary w-10 h-10" />
          </div>
          <p className="text-xs font-bold text-on-surface-variant mt-4">최적 범위 (95-98%)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-xl font-black text-primary uppercase">현재 생산 배치</h3>
          <div className="space-y-4">
            {[
              { id: '#PRD-2024-089', title: '프리미엄 앵거스 등심', weight: '850.0 kg', yield: '94.2%', step: '1차 발골 (4번 작업대)', status: '처리 중', color: 'text-blue-700 bg-blue-50 border-blue-200' },
              { id: '#PRD-2024-092', title: '와규 차돌박이 정육', weight: '420.5 kg', yield: '97.8%', step: '진행 포장 (B 라인)', status: '포장 중', color: 'text-amber-800 bg-amber-50 border-amber-200' },
              { id: '#PRD-2024-095', title: '목초 사육 다짐육', weight: '1,200 kg', yield: '99.1%', step: '배송 준비 완료', status: '완료', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
            ].map((batch, i) => (
              <div key={i} className="bg-white border border-outline-variant rounded-2xl p-5 space-y-4 shadow-sm hover:border-primary transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono text-outline font-bold">{batch.id}</span>
                    <h4 className="text-xl font-black mt-1 group-hover:text-primary transition-colors">{batch.title}</h4>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${batch.color}`}>{batch.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 py-3 border-y border-outline-variant/10">
                  <div>
                    <span className="text-[10px] font-bold text-outline uppercase block">입고 중량</span>
                    <span className="text-lg font-black text-primary">{batch.weight}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-outline uppercase block">수율</span>
                    <span className="text-lg font-black text-primary">{batch.yield}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant">
                    <Factory className="w-4 h-4" /> {batch.step}
                  </div>
                  <button className="text-primary border border-primary px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-surface-container transition-colors">상세 정보</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-primary uppercase">제품별 수율 분석</h3>
          <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-[10px] font-black uppercase text-outline">
                <tr>
                  <th className="p-4">제품 유형</th>
                  <th className="p-4">원료 중량</th>
                  <th className="p-4">정육 중량</th>
                  <th className="p-4 text-right">수율 %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {[
                  { name: '우둔살', raw: '2,450 kg', yield: '2,320 kg', pct: '94.7%' },
                  { name: '목심', raw: '1,890 kg', yield: '1,825 kg', pct: '96.5%' },
                  { name: '안심', raw: '840 kg', yield: '795 kg', pct: '94.6%' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-surface-container transition-colors font-bold">
                    <td className="p-4 text-sm">{row.name}</td>
                    <td className="p-4 text-xs font-mono text-outline">{row.raw}</td>
                    <td className="p-4 text-xs font-mono text-outline">{row.yield}</td>
                    <td className="p-4 text-sm font-black text-primary text-right">{row.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-primary" />
                <h4 className="font-black text-primary uppercase">시설 공정 현황</h4>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> NORMAL
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" /> ACTIVE
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { label: '입고', icon: ArrowDownToLine, active: false },
                { label: '정육', icon: Scissors, active: true },
                { label: '가공', icon: Factory, active: false },
                { label: '포장', icon: Package, active: false },
                { label: '출고', icon: Truck, active: false },
              ].map((s, i) => (
                <div key={i} className={`bg-white p-3 rounded-xl border text-center space-y-2 ${s.active ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-outline-variant opacity-60'}`}>
                  <p className="text-[8px] font-black text-outline border-b pb-1 uppercase">STATION {i+1}</p>
                  <s.icon className={`w-5 h-5 mx-auto ${s.active ? 'text-primary' : 'text-outline'}`} />
                  <p className={`text-[10px] font-black ${s.active ? 'text-primary' : ''}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PartnersView = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">거래처 관리</h1>
          <p className="text-sm font-bold text-on-surface-variant">공급업체 및 구매자 네트워크를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button className="border border-outline px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-surface-variant"><Download className="w-4 h-4" /> 엑셀 다운로드</button>
          <button className="bg-primary text-white px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 shadow-lg"><Plus className="w-4 h-4" /> 파트너 추가</button>
        </div>
      </div>

      <div className="bg-white border border-outline-variant rounded-2xl p-4 flex items-center gap-4 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
          <input type="text" placeholder="회사명, 담당자 또는 SKU 검색..." className="w-full pl-10 h-11 bg-surface-bright border border-outline-variant rounded-xl font-bold text-sm outline-none focus:border-primary transition-colors" />
        </div>
        <button className="h-11 px-6 border border-outline-variant rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-surface-container transition-colors">
          <Bell className="w-4 h-4" /> 필터
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 bg-white border border-outline-variant rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow group">
          <div className="p-8 flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3 space-y-4">
              <div className="aspect-square rounded-2xl overflow-hidden bg-surface-container relative">
                <img src="https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=2670&auto=format&fit=crop" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="Supplier" />
              </div>
              <div className="bg-secondary-container/10 p-4 rounded-2xl border border-secondary-container/20">
                <span className="text-[10px] font-black text-outline block uppercase tracking-widest ">주요 공급업체</span>
                <span className="text-2xl font-black text-primary">Global Meats Inc.</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-between py-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-[10px] font-bold text-outline mb-1 uppercase tracking-widest">담당자</h3>
                  <p className="text-xl font-black text-on-surface">로버트 첸 (Robert Chen)</p>
                </div>
                <div className="flex gap-2">
                  <button className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all"><ArrowLeftRight className="w-5 h-5" /></button>
                  <button className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all"><Users className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <h3 className="text-[10px] font-bold text-outline mb-1 uppercase tracking-widest">전화번호</h3>
                  <p className="text-sm font-mono font-black text-on-surface">+1 (555) 012-9988</p>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-outline mb-1 uppercase tracking-widest">최근 거래액</h3>
                  <p className="text-sm font-mono font-black text-on-surface">$12,450.00</p>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-outline-variant/30">
                <h3 className="text-[10px] font-bold text-outline mb-2 uppercase tracking-widest">최근 배송 현황</h3>
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-secondary" />
                  <span className="text-sm font-bold">42개 품목 - Grade A 소고기 양지머리</span>
                  <span className="ml-auto text-[10px] font-black bg-surface-container px-3 py-1 rounded-full uppercase">도착 완료</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-4 bg-primary text-white p-8 rounded-3xl shadow-xl flex flex-col justify-between">
          <div className="space-y-8">
            <h2 className="text-[10px] font-black text-primary-fixed uppercase tracking-[0.2em]">파트너 네트워크</h2>
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-6xl font-black block tracking-tighter">24</span>
                <span className="text-sm font-bold opacity-60">활성 공급업체</span>
              </div>
              <div className="space-y-1 pt-4 border-t border-white/10">
                <span className="text-6xl font-black block tracking-tighter">118</span>
                <span className="text-sm font-bold opacity-60">소매 거래처</span>
              </div>
            </div>
          </div>
          <button className="w-full h-14 bg-white text-primary font-black text-xs rounded-2xl flex items-center justify-center gap-2 hover:bg-primary-fixed-dim transition-colors mt-8 group uppercase tracking-widest">
            분석 보고서 보기 <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Layout ---

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (currentUser) {
        // Sync user profile to Firestore
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(userRef, {
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            role: 'staff', // Default role
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (error) {
          console.error("Error syncing user profile:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

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
    { id: 'inventory', label: '재고 관리', icon: Package },
    { id: 'logistics', label: '물류 현황', icon: ArrowLeftRight },
    { id: 'production', label: '생산 관리', icon: Cpu },
    { id: 'partners', label: '거래처', icon: Users },
  ];

  const handleNavigate = (view: ViewType) => {
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
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-outline-variant text-center space-y-6"
        >
          <div className="bg-primary text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <Warehouse className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tighter uppercase">MIN IMA</h1>
            <p className="text-on-surface-variant mt-2 font-medium">관리자 시스템 로그인이 필요합니다.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full h-14 bg-white border-2 border-outline-variant rounded-2xl flex items-center justify-center gap-3 font-bold text-on-surface hover:bg-surface-container transition-all active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            구글 계정으로 로그인
          </button>
          <p className="text-[10px] text-outline uppercase font-bold tracking-widest leading-relaxed">
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
              <input type="text" placeholder="통합 검색..." className="bg-transparent text-xs outline-none w-32 border-none ring-0 p-0" />
            </div>
            <button className="relative p-2 text-outline hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 border-l border-outline-variant/30 pl-4 ml-2">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-on-surface">{user.displayName || '사용자'}</p>
                <p className="text-[10px] text-outline uppercase font-bold tracking-tight">현장 관리자</p>
              </div>
              <div className="group relative">
                <div className="w-10 h-10 rounded-full border border-outline-variant overflow-hidden ring-2 ring-primary/5 shadow-sm">
                  <img 
                    src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop'} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <button 
                  onClick={handleLogout}
                  className="absolute top-full right-0 mt-2 bg-white border border-outline-variant rounded-xl p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-[10px] font-bold text-error whitespace-nowrap"
                >
                  <LogOut className="w-3 h-3" /> 로그아웃
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
            <button className="p-3 text-outline hover:text-primary transition-colors"><Settings className="w-6 h-6" /></button>
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
                {currentView === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}
                {currentView === 'inventory' && <InventoryView onNavigate={handleNavigate} />}
                {currentView === 'detail' && <ItemDetailView onNavigate={handleNavigate} />}
                {currentView === 'logistics' && <LogisticsView />}
                {currentView === 'production' && <ProductionView />}
                {currentView === 'partners' && <PartnersView />}
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
            <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
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
