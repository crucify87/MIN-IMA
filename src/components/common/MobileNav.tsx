import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  Settings, 
  Factory,
  Plus,
  X,
  MessageSquarePlus,
  ChevronRight
} from 'lucide-react';
import { ViewType } from '../../types';
import { FeedbackModal } from './FeedbackModal';

interface MobileNavProps {
  view: ViewType;
  setView: (view: ViewType) => void;
}

const MobileNav = ({ view, setView }: MobileNavProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const menuItems = [
    { 
      id: 'dashboard', 
      icon: LayoutDashboard, 
      label: '대시보드', 
      desc: '실시간 현황 & 일간 입출고 통계', 
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100' 
    },
    { 
      id: 'inventory', 
      icon: Package, 
      label: '재고 현황', 
      desc: '원육 및 완제품 실시간 재고', 
      color: 'bg-amber-50 text-amber-600 border-amber-100' 
    },
    { 
      id: 'logistics', 
      icon: Truck, 
      label: '물류현황', 
      desc: '실시간 원육 원물 입출고 기록', 
      color: 'bg-sky-50 text-sky-600 border-sky-100' 
    },
    { 
      id: 'production', 
      icon: Factory, 
      label: '생산현황', 
      desc: '생산 지시서 및 생산 실적 기록', 
      color: 'bg-rose-50 text-rose-600 border-rose-100' 
    },
    { 
      id: 'settings', 
      icon: Settings, 
      label: '시스템 설정', 
      desc: '마스터 코드, 거래처 & 권한 관리', 
      color: 'bg-slate-100 text-slate-600 border-slate-200' 
    },
  ] as const;

  const currentActiveItem = menuItems.find(item => item.id === view || (view === 'detail' && item.id === 'inventory'));

  const handleSelectMenu = (id: ViewType) => {
    setView(id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Bottom Navigation Bar (Simplified with single Plus Button) */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white/90 backdrop-blur-xl border-t border-slate-100/80 flex items-center justify-between px-6 py-4.5 z-[54] safe-area-inset-bottom shadow-[0_-10px_30px_rgba(15,23,42,0.04)]">
        {/* Active view indicator */}
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">현재 화면</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl">
            {currentActiveItem ? (
              <>
                <currentActiveItem.icon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-black text-slate-800">{currentActiveItem.label}</span>
              </>
            ) : (
              <span className="text-xs font-black text-slate-800">화면 상세</span>
            )}
          </div>
        </div>

        {/* Central Plus Menu Triger FAB */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative w-13 h-13 rounded-full flex items-center justify-center text-white transition-all shadow-lg active:scale-95 ${
            isOpen 
              ? 'bg-slate-900 shadow-slate-900/10 rotate-45' 
              : 'bg-primary shadow-primary/20 hover:scale-[1.03]'
          }`}
          aria-label="메뉴 열기"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white"></span>
          </span>
        </button>
      </nav>

      {/* Navigation Overlay Sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-md lg:hidden z-[55]"
            />

            {/* Bottom Drawer Overlay */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 max-h-[90vh] bg-white/95 backdrop-blur-3xl rounded-t-[40px] border-t border-slate-100 px-6 pt-5 pb-12 z-[56] lg:hidden shadow-[0_-20px_50px_rgba(15,23,42,0.12)] overflow-y-auto"
            >
              {/* Grab bar */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />

              {/* Title Header */}
              <div className="flex items-center justify-between mb-6 px-1.5">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">전체 서비스 메뉴</h3>
                  <p className="text-xs font-bold text-slate-400">IMA 생산 및 안전 재고 실시간 관리 시스템</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400 active:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4 stroke-[3.5]" />
                </button>
              </div>

              {/* Grid List of Navigation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                {menuItems.map((item, index) => {
                  const isActive = view === item.id || (view === 'detail' && item.id === 'inventory');
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleSelectMenu(item.id)}
                      className={`relative flex items-center gap-4 p-4.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                        isActive
                          ? 'bg-primary/5 border-primary/20 shadow-sm'
                          : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100'
                      }`}
                    >
                      {/* Icon container */}
                      <div className={`w-11 h-11 rounded-1.5xl border shrink-0 flex items-center justify-center transition-all ${
                        isActive ? 'bg-primary text-white border-primary' : `${item.color}`
                      }`}>
                        <item.icon className="w-5.5 h-5.5" />
                      </div>

                      {/* Labels and description */}
                      <div className="flex-1 space-y-0.5 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-black tracking-tight ${isActive ? 'text-primary' : 'text-slate-800'}`}>
                            {item.label}
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-slate-350'}`} />
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 truncate leading-none">
                          {item.desc}
                        </p>
                      </div>

                      {/* Active green dot */}
                      {isActive && (
                        <span className="absolute top-3 right-3 flex h-2 w-2">
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Improvement suggestion feature button for mobile */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: menuItems.length * 0.05 }}
                className="px-0.5 pt-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setFeedbackOpen(true);
                  }}
                  className="w-full relative flex items-center gap-4 p-4.5 rounded-2.5xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100/70 text-left transition-all active:scale-[0.98]"
                >
                  <div className="w-11 h-11 rounded-1.5xl bg-emerald-500 border border-emerald-400 shadow-md shadow-emerald-500/20 text-white shrink-0 flex items-center justify-center">
                    <MessageSquarePlus className="w-5.5 h-5.5" />
                  </div>
                  <div className="flex-grow space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black tracking-tight text-emerald-800">
                        개선사항 및 피드백 건의
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <p className="text-[11px] font-bold text-emerald-600/80 leading-none">
                      시스템 버그 접수, 고도화 및 품질 개선 제안
                    </p>
                  </div>
                </button>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Integration and triggering of the beautiful suggestion modal */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
};

export default MobileNav;
