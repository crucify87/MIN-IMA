import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  Settings, 
  Factory 
} from 'lucide-react';
import { ViewType } from '../../types';

interface MobileNavProps {
  view: ViewType;
  setView: (view: ViewType) => void;
}

const MobileNav = ({ view, setView }: MobileNavProps) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: '홈' },
    { id: 'inventory', icon: Package, label: '재고' },
    { id: 'logistics', icon: Truck, label: '물류' },
    { id: 'production', icon: Factory, label: '생산' },
    { id: 'settings', icon: Settings, label: '설정' },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white/95 backdrop-blur-xl border-t border-outline-variant/30 flex items-center justify-around pt-3 pb-[calc(env(safe-area-inset-bottom,16px)+12px)] px-3 z-[60] shadow-2xl">
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setView(item.id)}
          className={`relative flex-1 flex flex-col items-center gap-1 py-1.5 transition-all text-center min-h-[48px] justify-center ${
            view === item.id || (view === 'detail' && item.id === 'inventory') ? 'text-primary scale-105' : 'text-outline hover:text-on-surface'
          }`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <item.icon className="w-5.5 h-5.5" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none whitespace-nowrap">{item.label}</span>
          {(view === item.id || (view === 'detail' && item.id === 'inventory')) && <div className="w-1.5 h-1.5 rounded-full bg-primary absolute -bottom-0.5" />}
        </button>
      ))}
    </nav>
  );
};

export default MobileNav;
