import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  Settings, 
  Factory, 
  LogOut,
  MessageSquarePlus
} from 'lucide-react';
import AppLogo from './AppLogo';
import { ViewType } from '../../types';
import { FeedbackModal } from './FeedbackModal';

interface SidebarProps {
  view: ViewType;
  setView: (view: ViewType) => void;
  user: any;
  onLogout: () => void;
  logoSrc?: string;
}

const Sidebar = ({ view, setView, user, onLogout, logoSrc }: SidebarProps) => {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: '대시보드' },
    { id: 'inventory', icon: Package, label: '재고현황' },
    { id: 'logistics', icon: Truck, label: '물류현황' },
    { id: 'production', icon: Factory, label: '생산현황' },
    { id: 'settings', icon: Settings, label: '설정' },
  ] as const;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-80 bg-white border-r-2 border-outline-variant/30 flex flex-col p-8 z-50">
      <div className="mb-12">
        <AppLogo className="w-full h-auto" src={logoSrc || "/sidebarlogo.png"} />
      </div>

      <nav className="flex-1 space-y-3">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full group relative flex items-center gap-4 px-6 py-5 rounded-[24px] transition-all duration-300 ${
              view === item.id || (view === 'detail' && item.id === 'inventory')
                ? 'bg-primary text-white shadow-xl shadow-primary/20 translate-x-2'
                : 'text-outline hover:text-primary hover:bg-surface-container'
            }`}
          >
            <item.icon className={`w-6 h-6 transition-transform group-hover:scale-110 ${
              view === item.id || (view === 'detail' && item.id === 'inventory') ? 'text-white' : 'text-outline'
            }`} />
            <span className="font-black text-sm tracking-tight">{item.label}</span>
            {(view === item.id || (view === 'detail' && item.id === 'inventory')) && (
              <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,1)]"></div>
            )}
          </button>
        ))}
        
        {/* 개선사항 건의 버튼 */}
        <button
          onClick={() => setFeedbackOpen(true)}
          className="w-full group relative flex items-center gap-4 px-6 py-4 rounded-[24px] transition-all duration-300 hover:bg-emerald-50/60 border border-dashed border-transparent hover:border-emerald-100/80 text-outline hover:text-emerald-600 mt-2"
        >
          <MessageSquarePlus className="w-6 h-6 transition-transform group-hover:scale-110 text-outline group-hover:text-emerald-500" />
          <span className="font-extrabold text-sm tracking-tight text-slate-500 group-hover:text-slate-700">개선사항 건의</span>
          <div className="absolute right-4 px-1.5 py-0.5 rounded bg-slate-100 text-[8px] font-black text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
            제안
          </div>
        </button>
      </nav>

      <div className="mt-auto space-y-4 pt-10 border-t-2 border-outline-variant/30">
        <div className="flex items-center gap-4 px-2">
          <img
            src={user?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200'}
            className="w-12 h-12 rounded-2xl border-2 border-primary object-cover"
            alt=""
          />
          <div className="flex-1 min-w-0">
            <p className="font-black text-on-surface tracking-tight truncate">{user?.displayName}</p>
            <p className="text-[10px] font-black text-outline uppercase truncate">{user?.role}</p>
          </div>
          <button onClick={onLogout} className="p-2 hover:bg-surface-container rounded-xl text-outline hover:text-error transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="text-center text-[9px] text-slate-400 font-black tracking-widest pt-1 uppercase">
          IMA SYSTEM v1.2.1 STABLE
        </div>
      </div>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </aside>
  );
};

export default Sidebar;
