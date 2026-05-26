/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { loginWithGoogle, logout } from './lib/firebase';
import { ViewType } from './types';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';

// Components
import AppLogo from './components/common/AppLogo';
import Sidebar from './components/common/Sidebar';
import MobileNav from './components/common/MobileNav';

// Sections
import DashboardContent from './components/sections/DashboardContent';
import InventoryContent from './components/sections/InventoryContent';
import ItemDetailContent from './components/sections/ItemDetailContent';
import LogisticsContent from './components/sections/LogisticsContent';
import ProductionContent from './components/sections/ProductionContent';
import SettingsContent from './components/sections/SettingsContent';

// --- Main App Component ---

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const { 
    user, 
    userData, 
    loading, 
    isSuperAdmin, 
    permissions 
  } = useAuth();

  const {
    inventory,
    production,
    logistics,
    partners,
    allUsers,
    settings
  } = useAppData(user, isSuperAdmin);

  // Dynamic Favicon & Title Update
  React.useEffect(() => {
    if (settings?.logoUrl) {
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (link) {
        link.href = settings.logoUrl;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = settings.logoUrl;
        document.head.appendChild(newLink);
      }
      
      const appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
      if (appleLink) {
        appleLink.href = settings.logoUrl;
      }
    }
  }, [settings?.logoUrl]);

  const handleLogin = async () => {
    try { await loginWithGoogle(); } catch (error) { console.error("Login failed:", error); }
  };

  const handleLogout = async () => {
    try { await logout(); } catch (error) { console.error("Logout failed:", error); }
  };

  const handleNavigate = (view: ViewType, item?: any) => {
    setSelectedItem(item || null);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    const appLogo = settings?.logoUrl || "/IMA512.png";
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="max-w-md w-full bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100 text-center space-y-10"
        >
          <div className="space-y-6">
            <div 
              onClick={() => window.location.reload()}
              className="w-24 h-24 mx-auto bg-slate-50 rounded-3xl p-4 flex items-center justify-center shadow-inner cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
            >
              <img src={appLogo} className="w-full h-full object-contain" alt="Logo" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">{settings?.appName || "재고 관리 시스템"}</h1>
              <p className="text-slate-500 font-bold text-sm tracking-[0.2em]">MIN IMA INVENTORY MANAGEMENT</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <p className="text-xl font-black text-[#0f172a]">관리자 시스템 로그인이</p>
              <p className="text-xl font-black text-[#0f172a]">필요합니다.</p>
            </div>

            <button 
              onClick={handleLogin} 
              className="w-full h-16 bg-[#0f172a] text-white rounded-2xl flex items-center justify-center gap-3 font-black text-lg hover:bg-slate-800 transition-all active:scale-[0.98] shadow-xl shadow-slate-900/10"
            >
              <img src="https://www.google.com/favicon.ico" className="w-6 h-6 grayscale brightness-200" alt="Google" />
              구글 계정으로 로그인
            </button>
          </div>

          <p className="text-[11px] font-bold text-slate-400">
            승인된 사용자만 접근 가능합니다.
          </p>
        </motion.div>
      </div>
    );
  }

  const { canEditItems, canViewPrices, canEditPrices, canManageUsers } = permissions;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex overflow-x-hidden">
      {/* Sidebar for Desktop */}
      <div className="hidden lg:block">
        <Sidebar 
          view={currentView} 
          setView={(v) => handleNavigate(v)} 
          user={{...user, ...userData}} 
          onLogout={handleLogout} 
          logoSrc={settings?.logoUrl}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-80 min-h-screen flex flex-col items-center min-w-0 w-full overflow-x-hidden">
        {/* Content Body */}
        <main className="w-full max-w-screen-2xl p-4 md:p-10 lg:p-12 mb-24 lg:mb-0">
          <div className="w-full">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentView} 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                transition={{ duration: 0.2 }}
              >
                {currentView === 'dashboard' && (
                  <DashboardContent 
                    inventory={inventory} 
                    production={production} 
                    logistics={logistics} 
                    partners={partners} 
                    onNavigate={handleNavigate} 
                    canEditItems={canEditItems}
                  />
                )}
                {currentView === 'inventory' && (
                  <InventoryContent 
                    inventory={inventory} 
                    logistics={logistics}
                    production={production}
                    partners={partners}
                    onNavigate={handleNavigate} 
                    canEditItems={canEditItems} 
                    initialCategory={typeof selectedItem === 'string' ? selectedItem : null}
                  />
                )}
                {currentView === 'detail' && selectedItem && (
                  <ItemDetailContent 
                    item={selectedItem} 
                    logistics={logistics} 
                    production={production}
                    inventory={inventory}
                    onNavigate={handleNavigate} 
                    canEditItems={canEditItems} 
                    canViewPrices={canViewPrices} 
                    canEditPrices={canEditPrices} 
                  />
                )}
                {currentView === 'logistics' && (
                  <LogisticsContent 
                    logistics={logistics} 
                    inventory={inventory} 
                    partners={partners} 
                    onNavigate={handleNavigate} 
                    canEditItems={canEditItems} 
                  />
                )}
                {currentView === 'production' && (
                  <ProductionContent 
                    production={production} 
                    inventory={inventory} 
                    onNavigate={handleNavigate} 
                    canEditItems={canEditItems} 
                  />
                )}
                {currentView === 'settings' && (
                  <SettingsContent 
                    inventory={inventory} 
                    partners={partners} 
                    allUsers={allUsers} 
                    user={user} 
                    canEditPrices={canEditPrices} 
                    canEditItems={canEditItems} 
                    canManageUsers={canManageUsers} 
                    onNavigate={handleNavigate} 
                    settings={settings}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <MobileNav view={currentView} setView={(v) => handleNavigate(v)} />
      </div>
    </div>
  );
}
