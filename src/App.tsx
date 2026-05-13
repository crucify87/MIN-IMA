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

  const isApproved = isSuperAdmin || userData?.status === 'approved';

  const {
    inventory,
    production,
    logistics,
    partners,
    allUsers,
    settings
  } = useAppData(user, isSuperAdmin, isApproved);

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
    const appLogo = settings?.logoUrl || "/512x512.png?v=3";
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        {/* Background Decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-3xl opacity-50" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="max-w-md w-full bg-white rounded-[48px] shadow-2xl border border-slate-100 overflow-hidden relative z-10"
        >
          {/* Header Part */}
          <div className="p-10 pb-6 text-center space-y-6">
            <div className="w-24 h-24 mx-auto bg-slate-50 rounded-3xl p-4 flex items-center justify-center shadow-inner">
              <img src={appLogo} className="w-full h-full object-contain" alt="Logo" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">ERP 시스템 로그인</h1>
              <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Administrator Portal</p>
            </div>
          </div>

          {/* "Form" Part (Simulated Inputs for looks) */}
          <div className="px-10 pb-10 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">ID / Email</label>
                <div className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center px-5 text-slate-300 font-bold overflow-hidden cursor-not-allowed">
                  example@company.com
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Password</label>
                <div className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center px-5 text-slate-300 font-bold overflow-hidden cursor-not-allowed">
                  ••••••••••••
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={handleLogin} 
                className="w-full h-16 bg-[#0f172a] text-white rounded-2xl flex items-center justify-center gap-3 font-black text-lg hover:bg-slate-800 transition-all active:scale-[0.98] shadow-xl shadow-slate-900/10"
              >
                <img src="https://www.google.com/favicon.ico" className="w-6 h-6 grayscale brightness-200" alt="Google" />
                Google 계정으로 사내 로그인
              </button>
            </div>

            <p className="text-center text-[11px] font-bold text-slate-400 leading-relaxed">
              사내 인트라넷 계정 전용 시스템입니다.<br/>
              문의: IT 지원팀 (내선 1004)
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Handle Unauthorized/Pending Users
  if (!isApproved) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full bg-white p-12 rounded-[40px] shadow-2xl border-4 border-rose-100 text-center space-y-8">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
            <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-[#0f172a]">접근 권한이 없습니다</h2>
            <p className="text-slate-500 font-bold leading-relaxed">
              사내 전용 시스템입니다. 관리자의 승인이 필요합니다.<br/>
              현재 로그인 계정: <span className="text-primary">{user.email}</span>
            </p>
          </div>
          <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
             <button onClick={handleLogout} className="w-full h-14 bg-slate-50 text-slate-500 rounded-2xl font-black hover:bg-slate-100 transition-all">
               다른 계정으로 로그인
             </button>
          </div>
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
                    canEditItems={canEditItems}
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
