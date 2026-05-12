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
    allUsers
  } = useAppData(user, isSuperAdmin);

  const handleLogin = async () => {
    try { await loginWithGoogle(); } catch (error) { console.error("Login failed:", error); }
  };

  const handleLogout = async () => {
    try { await logout(); } catch (error) { console.error("Logout failed:", error); }
  };

  const handleNavigate = (view: ViewType, item?: any) => {
    if (item) setSelectedItem(item);
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
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl w-full bg-white p-12 rounded-[48px] shadow-2xl border-4 border-outline-variant/30 text-center space-y-10">
          <div className="bg-white p-4 rounded-xl flex items-center justify-center mx-auto shadow-xl shadow-primary/10 mb-6">
            <AppLogo className="w-20 h-20" />
          </div>
          <div className="space-y-4">
            <h1 className="text-6xl font-black text-primary tracking-tighter uppercase leading-none">MIN IMA</h1>
            <p className="text-xl font-black text-outline uppercase tracking-[0.3em] pb-4 border-b-2 border-outline-variant/30">INVENTORY MANAGEMENT</p>
            <p className="text-2xl text-on-surface-variant font-black tracking-tight pt-2">관리자 시스템 로그인이 필요합니다.</p>
          </div>
          <button onClick={handleLogin} className="w-full h-20 bg-white border-4 border-outline-variant rounded-3xl flex items-center justify-center gap-4 font-black text-base md:text-xl text-on-surface hover:bg-surface-container transition-all active:scale-95 shadow-lg">
            <img src="https://www.google.com/favicon.ico" className="w-8 h-8" alt="Google" />
            구글 계정으로 로그인
          </button>
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
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-80 min-h-screen flex flex-col items-center">
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
                  />
                )}
                {currentView === 'inventory' && (
                  <InventoryContent 
                    inventory={inventory} 
                    logistics={logistics}
                    onNavigate={handleNavigate} 
                    canEditItems={canEditItems} 
                  />
                )}
                {currentView === 'detail' && selectedItem && (
                  <ItemDetailContent 
                    item={selectedItem} 
                    logistics={logistics} 
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
