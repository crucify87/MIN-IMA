import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  Settings, 
  Factory, 
  LogOut 
} from 'lucide-react';
import AppLogo from './AppLogo';
import { ViewType } from '../../types';

interface SidebarProps {
  view: ViewType;
  setView: (view: ViewType) => void;
  user: any;
  onLogout: () => void;
}

const Sidebar = ({ view, setView, user, onLogout }: SidebarProps) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: '대시보드' },
    { id: 'inventory', icon: Package, label: '재고현황' },
    { id: 'logistics', icon: Truck, label: '물류현황' },
    { id: 'production', icon: Factory, label: '생산관리' },
    { id: 'settings', icon: Settings, label: '시스템설정' },
  ] as const;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-80 bg-white border-r-2 border-outline-variant/30 flex flex-col p-8 z-50">
      <div className="mb-12">
        <AppLogo className="w-full h-auto" />
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
      </div>
    </aside>
  );
};

export default Sidebar;
