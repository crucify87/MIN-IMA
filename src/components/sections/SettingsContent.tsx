import React, { useState } from 'react';
import { 
  ArrowLeft,
  Package,
  Edit,
  Trash2,
  CalendarDays,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  Users,
  Mail,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  addDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError } from '../../lib/firestoreUtils';
import { OperationType } from '../../types';

function SettingsContent({ 
  user,
  inventory, 
  partners, 
  allUsers, 
  onNavigate, 
  canEditItems, 
  canManageUsers, 
  canEditPrices 
}: any) {
  const [tab, setTab] = useState<'p' | 't' | 'u'>('p');
  const [search, setSearch] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showAllPartners, setShowAllPartners] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);

  // Item Form
  const [itemForm, setItemForm] = useState({
    sku: '', name: '', category: '돼지고기', brand: '', unit: 'kg', currentStock: '', safetyStock: '',
    purchasePrice: '', salesPrice: '', manufDate: '', expiryDate: '', location: '', detailLocation: ''
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showUnitOptions, setShowUnitOptions] = useState(false);
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);

  // Partner Form
  const [partnerForm, setPartnerForm] = useState({ name: '', type: '공급사', phone: '', address: '' });
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  
  // Admin Form
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const handleRegisterItem = async (e: any) => {
    e.preventDefault();
    if (!canEditItems) return;
    try {
      const data = {
        ...itemForm,
        currentStock: Number(itemForm.currentStock),
        safetyStock: Number(itemForm.safetyStock),
        purchasePrice: Number(itemForm.purchasePrice),
        salesPrice: Number(itemForm.salesPrice),
        updatedAt: serverTimestamp()
      };

      if (editingItemId) {
        await updateDoc(doc(db, 'inventory', editingItemId), data);
        alert('상품 정보가 수정되었습니다.');
        setEditingItemId(null);
      } else {
        await addDoc(collection(db, 'inventory'), {
          ...data,
          createdAt: serverTimestamp()
        });
        alert('상품 등록이 완료되었습니다.');
      }
      setItemForm({ sku: '', name: '', category: '돼지고기', brand: '', unit: 'kg', currentStock: '', safetyStock: '', purchasePrice: '', salesPrice: '', manufDate: '', expiryDate: '', location: '', detailLocation: '' });
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'inventory'); }
  };

  const handleEditItem = (item: any) => {
    setEditingItemId(item.id);
    setItemForm({
      sku: item.sku || '',
      name: item.name || '',
      category: item.category || '',
      brand: item.brand || '',
      unit: item.unit || 'kg',
      currentStock: String(item.currentStock || 0),
      safetyStock: String(item.safetyStock || 0),
      purchasePrice: String(item.purchasePrice || 0),
      salesPrice: String(item.salesPrice || 0),
      manufDate: item.manufDate || '',
      expiryDate: item.expiryDate || '',
      location: item.location || '',
      detailLocation: item.detailLocation || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!canEditItems) return;
    if (!window.confirm(`[${name}] 상품을 마스터에서 영구 삭제하시겠습니까? 관련 재고 데이터가 사라집니다.`)) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
      alert('삭제 되었습니다.');
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'inventory'); }
  };

  const handleRegisterPartner = async (e: any) => {
    e.preventDefault();
    if (!canEditItems) return;
    try {
      if (editingPartnerId) {
        await updateDoc(doc(db, 'partners', editingPartnerId), { ...partnerForm, updatedAt: serverTimestamp() });
        alert('거래처 정보가 수정되었습니다.');
        setEditingPartnerId(null);
      } else {
        await addDoc(collection(db, 'partners'), { ...partnerForm, createdAt: serverTimestamp() });
        alert('거래처가 등록되었습니다.');
      }
      setPartnerForm({ name: '', type: '공급사', phone: '', address: '' });
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'partners'); }
  };

  const handleEditPartner = (p: any) => {
    setEditingPartnerId(p.id);
    setPartnerForm({ name: p.name, type: p.type || '공급사', phone: p.phone || '', address: p.address || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePartner = async (id: string, name: string) => {
    if (!canEditItems) return;
    if (!window.confirm(`[${name}] 거래처를 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'partners', id));
      alert('삭제되었습니다.');
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'partners'); }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: string) => {
    if (!canManageUsers) return;
    try {
      await updateDoc(doc(db, 'users', targetUserId), { role: newRole, updatedAt: serverTimestamp() });
      alert('사용자 권한이 변경되었습니다.');
    } catch (error) {
      console.error(error);
      alert('권한 변경에 실패했습니다.');
    }
  };

  const handleRegisterAdmin = async (e: any) => {
    e.preventDefault();
    if (!canManageUsers || !newAdminEmail) return;
    try {
      alert(`${newAdminEmail} 주소가 관리자 후보로 등록되었습니다.`);
      setNewAdminEmail('');
    } catch (error) { console.error(error); }
  };

  const handleDeleteUser = async (targetUserId: string, targetUserEmail: string) => {
    if (!canManageUsers) return;
    if (targetUserEmail === user?.email) { alert('본인의 계정은 삭제할 수 없습니다.'); return; }
    if (targetUserEmail === 'crucify87@gmail.com') { alert('시스템 주 관리자 계정은 삭제할 수 없습니다.'); return; }
    if (!window.confirm(`${targetUserEmail} 계정을 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.`)) return;
    try {
      await deleteDoc(doc(db, 'users', targetUserId));
      alert('계정이 삭제되었습니다.');
    } catch (error) { console.error(error); alert('계정 삭제 중 오류가 발생했습니다.'); }
  };

  const filteredItems = inventory.filter((i: any) => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.sku?.toLowerCase().includes(search.toLowerCase()) ||
    i.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 md:p-3 bg-[#e8effd] hover:bg-[#d0e0fb] text-[#0f172a] rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl md:text-4xl font-black text-[#0f172a] tracking-tighter">시스템 설정</h1>
        </div>

        {/* SKU Reference Guide */}
        <div className="flex items-center gap-4 lg:gap-6 ml-auto bg-white/50 px-4 lg:px-6 py-3 rounded-2xl border border-outline-variant/50 backdrop-blur-sm overflow-x-auto no-scrollbar max-w-full">
          <div className="text-[9px] lg:text-[10px] font-black text-outline uppercase tracking-widest mr-2 whitespace-nowrap">SKU 가이드:</div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] lg:text-[10px] font-black">O-001</span>
            <span className="text-[10px] lg:text-[11px] font-bold text-slate-500">부속물</span>
          </div>
          <div className="flex items-center gap-2 border-l border-outline-variant/30 pl-3 lg:pl-4 whitespace-nowrap">
            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] lg:text-[10px] font-black">P-001</span>
            <span className="text-[10px] lg:text-[11px] font-bold text-rose-500">돼지고기</span>
          </div>
          <div className="flex items-center gap-2 border-l border-outline-variant/30 pl-3 lg:pl-4 whitespace-nowrap">
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] lg:text-[10px] font-black">C-001</span>
            <span className="text-[10px] lg:text-[11px] font-bold text-amber-700">소고기</span>
          </div>
        </div>
      </header>

      <div className="flex bg-[#f1f4f9] p-1.5 rounded-2xl border border-outline-variant/30 w-full md:w-fit overflow-x-auto no-scrollbar scroll-smooth">
        <button onClick={() => setTab('p')} className={`flex-1 md:flex-none min-w-[100px] px-4 md:px-10 py-3.5 rounded-xl font-black text-[11px] md:text-sm transition-all whitespace-nowrap ${tab === 'p' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>상품</button>
        <button onClick={() => setTab('t')} className={`flex-1 md:flex-none min-w-[100px] px-4 md:px-10 py-3.5 rounded-xl font-black text-[11px] md:text-sm transition-all whitespace-nowrap ${tab === 't' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>거래처 관리</button>
        {canManageUsers && <button onClick={() => setTab('u')} className={`flex-1 md:flex-none min-w-[100px] px-4 md:px-10 py-3.5 rounded-xl font-black text-[11px] md:text-sm transition-all whitespace-nowrap ${tab === 'u' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>관리자 설정</button>}
      </div>

      <div className="bg-white rounded-[32px] md:rounded-[40px] border border-outline-variant shadow-xl shadow-surface-container-high/50 overflow-hidden">
        {tab === 'p' && (
          <div className="p-4 md:p-10 space-y-10 md:space-y-12">
            {/* 1. Registration Form (TOP) */}
            {canEditItems ? (
              <div id="item-form" className="max-w-4xl mx-auto space-y-6 md:space-y-10">
                <div className="text-center space-y-1">
                  <h3 className="text-sm md:text-base font-black text-[#0f172a] tracking-tight">
                    {editingItemId ? '상품 정보 수정' : '신규 상품 등록'}
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-black text-outline uppercase tracking-widest">
                    {editingItemId ? 'UPDATE MASTER ITEM INFO' : 'REGISTER NEW MASTER ITEM'}
                  </p>
                  <div className="w-12 h-1 bg-primary/20 mx-auto rounded-full mt-3"></div>
                </div>
                
                <form onSubmit={handleRegisterItem} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5 md:gap-y-8">
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">SKU 번호</label>
                    <input placeholder="예: SKU-BF-001" value={itemForm.sku} onChange={e => setItemForm({...itemForm, sku: e.target.value})} className="w-full h-12 md:h-14 px-5 md:px-6 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">품목명</label>
                    <input placeholder="예: 프리미엄 티본" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="w-full h-12 md:h-14 px-5 md:px-6 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-sm" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative">
                      <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">카테고리</label>
                      <button 
                        type="button"
                        onClick={() => setShowCategoryOptions(!showCategoryOptions)}
                        className="w-full h-12 md:h-14 px-5 md:px-6 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold flex items-center justify-between outline-none focus:border-primary focus:bg-white transition-all group"
                      >
                        <span className="text-primary text-sm">{itemForm.category || '선택'}</span>
                        <ChevronDown className={`w-4 h-4 text-outline group-hover:text-primary transition-transform ${showCategoryOptions ? 'rotate-180' : ''}`} />
                      </button>
                      {showCategoryOptions && (
                        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-outline-variant rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200">
                          {['돼지고기', '소고기', '부속물'].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setItemForm({...itemForm, category: c});
                                setShowCategoryOptions(false);
                              }}
                              className={`w-full h-11 flex items-center justify-between px-5 text-sm font-bold hover:bg-[#f1f4f9] transition-colors ${itemForm.category === c ? 'bg-primary/5 text-primary' : 'text-slate-600'}`}
                            >
                              <span>{c}</span>
                              {itemForm.category === c && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">브랜드</label>
                      <input placeholder="예: 한우관" value={itemForm.brand} onChange={e => setItemForm({...itemForm, brand: e.target.value})} className="w-full h-12 md:h-14 px-5 md:px-6 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative">
                      <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">단위</label>
                      <button 
                        type="button"
                        onClick={() => setShowUnitOptions(!showUnitOptions)}
                        className="w-full h-12 md:h-14 px-5 md:px-6 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold flex items-center justify-between outline-none focus:border-primary focus:bg-white transition-all group"
                      >
                        <span className="text-primary text-sm">{itemForm.unit}</span>
                        <ChevronDown className={`w-4 h-4 text-outline group-hover:text-primary transition-transform ${showUnitOptions ? 'rotate-180' : ''}`} />
                      </button>
                      {showUnitOptions && (
                        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-outline-variant rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200">
                          {['kg', 'g'].map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => {
                                setItemForm({...itemForm, unit: u});
                                setShowUnitOptions(false);
                              }}
                              className={`w-full h-11 flex items-center justify-between px-5 text-sm font-bold hover:bg-[#f1f4f9] transition-colors ${itemForm.unit === u ? 'bg-primary/5 text-primary' : 'text-slate-600'}`}
                            >
                              <span>{u}</span>
                              {itemForm.unit === u && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">현재 재고</label>
                      <input type="number" value={itemForm.currentStock} onChange={e => setItemForm({...itemForm, currentStock: e.target.value})} className="w-full h-12 md:h-14 px-5 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">안전 재고</label>
                      <input type="number" value={itemForm.safetyStock} onChange={e => setItemForm({...itemForm, safetyStock: e.target.value})} className="w-full h-12 md:h-14 px-5 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">보관 위치</label>
                      <input placeholder="예: A구역/1번" value={itemForm.location} onChange={e => setItemForm({...itemForm, location: e.target.value})} className="w-full h-12 md:h-14 px-5 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">매입 단가 (W)</label>
                      <input type="number" placeholder={canEditPrices ? "예: 25000" : "권한 없음"} disabled={!canEditPrices} value={itemForm.purchasePrice} onChange={e => setItemForm({...itemForm, purchasePrice: e.target.value})} className="w-full h-12 md:h-14 px-5 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 disabled:bg-surface-container text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">판매 단가 (W)</label>
                      <input type="number" placeholder={canEditPrices ? "예: 38000" : "권한 없음"} disabled={!canEditPrices} value={itemForm.salesPrice} onChange={e => setItemForm({...itemForm, salesPrice: e.target.value})} className="w-full h-12 md:h-14 px-5 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 disabled:bg-surface-container text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3 text-emerald-500" /> 제조일자
                      </label>
                      <input type="date" value={itemForm.manufDate} onChange={e => setItemForm({...itemForm, manufDate: e.target.value})} className="w-full h-12 md:h-14 px-5 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all text-sm" />
                    </div>
                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-rose-500" /> 소비기한
                      </label>
                      <div className="space-y-2">
                        <input type="date" value={itemForm.expiryDate} onChange={e => setItemForm({...itemForm, expiryDate: e.target.value})} className="w-full h-12 md:h-14 px-5 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all text-sm" />
                        <div className="flex flex-wrap gap-1.5 px-1">
                          {[1, 3, 6, 12, 24].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                if (!itemForm.manufDate) {
                                  alert('먼저 제조일자를 선택해주세요.');
                                  return;
                                }
                                const date = new Date(itemForm.manufDate);
                                date.setMonth(date.getMonth() + m);
                                date.setDate(date.getDate() - 1);
                                setItemForm({ ...itemForm, expiryDate: date.toISOString().split('T')[0] });
                              }}
                              className="px-2.5 py-1.5 bg-[#f1f4f9] hover:bg-[#d0e0fb] text-[#0f172a] rounded-lg text-[10px] font-black transition-colors"
                            >
                              {m >= 12 ? `${m / 12}년` : `${m}개월`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 pt-4 flex flex-col sm:flex-row gap-3">
                    <button type="submit" className="flex-1 h-14 md:h-16 bg-[#0f172a] text-white rounded-2xl font-black text-sm md:text-lg tracking-tight shadow-xl shadow-indigo-900/10 hover:bg-slate-800 transition-all active:scale-[0.98]">
                      {editingItemId ? '정보 수정 완료' : '상품 마스터 등록'}
                    </button>
                    {editingItemId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingItemId(null);
                          setItemForm({ sku: '', name: '', category: '돼지고기', brand: '', unit: 'kg', currentStock: '', safetyStock: '', purchasePrice: '', salesPrice: '', manufDate: '', expiryDate: '', location: '', detailLocation: '' });
                        }}
                        className="w-full sm:w-40 h-14 md:h-16 bg-rose-50 text-rose-600 rounded-2xl font-black text-sm md:text-lg shadow-sm hover:bg-rose-100 transition-all"
                      >
                        취소
                      </button>
                    )}
                  </div>
                </form>
              </div>
            ) : (
              <div className="text-center py-10 opacity-60">
                 <Lock className="w-12 h-12 mx-auto mb-4 text-outline" />
                 <p className="font-black text-[#0f172a]">상품 등록/수정 권한이 없습니다.</p>
              </div>
            )}


            <hr className="border-outline-variant/30" />

            {/* 2. Registered Product List (BOTTOM) */}
            <div className="space-y-8 md:space-y-12">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-[#0f172a] tracking-tight flex items-center gap-2"><Package className="w-5 h-5 md:w-6 md:h-6" /> 등록된 상품</h3>
                  <p className="text-[10px] font-black text-outline uppercase tracking-widest mt-1">MASTER INVENTORY ITEMS</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative group flex-1 sm:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input type="text" placeholder="상품명, SKU, 카테고리 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-12 pl-11 pr-4 bg-white border border-outline-variant rounded-2xl text-xs sm:text-sm font-bold outline-none focus:border-primary focus:bg-slate-50 transition-all shadow-sm" />
                  </div>
                  <button onClick={() => setShowAllItems(!showAllItems)} className="flex items-center justify-center gap-2 px-6 h-12 bg-white border border-outline-variant rounded-2xl text-[11px] md:text-sm font-black text-[#0f172a] hover:bg-surface-container transition-all shadow-sm">
                    {showAllItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} 
                    {showAllItems ? '접기' : '더보기'}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-[24px] md:rounded-[32px] border border-outline-variant overflow-hidden shadow-sm p-2 md:p-0">
                <div className="w-full">
                  {/* Desktop View Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-[#f0f4f8] text-[11px] font-black text-[#0f172a]/60 uppercase tracking-widest border-b border-outline-variant/50">
                        <tr>
                          <th className="px-6 py-5 text-left">코드/품목명</th>
                          <th className="px-4 py-5 text-center">카테고리</th>
                          <th className="px-4 py-5 text-center">단위</th>
                          <th className="px-4 py-5 text-center">현재고</th>
                          <th className="px-4 py-5 text-center">안전재고</th>
                          <th className="px-4 py-5 text-center">위치</th>
                          <th className="px-6 py-5 text-right">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {filteredItems.length > 0 ? (
                          filteredItems.slice(0, showAllItems ? undefined : 15).map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-[#f1f4f9] rounded-xl flex items-center justify-center text-primary"><Package className="w-5 h-5" /></div>
                                  <div>
                                    <div className="font-black text-[#0f172a]">{item.name}</div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold text-outline uppercase">{item.sku || '-'}</span>
                                      {item.brand && <span className="text-[10px] font-black text-primary/50">| {item.brand}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-5 text-center"><span className="px-3 py-1 bg-surface-container rounded-lg text-[10px] font-black text-outline uppercase">{item.category || '-'}</span></td>
                              <td className="px-4 py-5 text-center text-sm font-bold">{item.unit || '-'}</td>
                              <td className="px-4 py-5 text-center">
                                <span className={`font-black ${item.currentStock <= item.safetyStock ? 'text-rose-500' : 'text-[#0f172a]'}`}>
                                  {item.currentStock?.toLocaleString()}
                                </span>
                              </td>
                              <td className="px-4 py-5 text-center text-xs font-bold text-outline">{item.safetyStock?.toLocaleString() || '0'}</td>
                              <td className="px-4 py-5 text-center">
                                <div className="text-xs font-bold text-on-surface/70">{item.location || '-'}</div>
                                <div className="text-[10px] text-outline">{item.detailLocation}</div>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {canEditItems && (
                                    <>
                                      <button onClick={() => handleEditItem(item)} className="p-2.5 text-primary hover:bg-primary/10 rounded-xl transition-all" title="수정"><Edit className="w-4 h-4" /></button>
                                      <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="삭제"><Trash2 className="w-4 h-4" /></button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={7} className="py-20 text-center opacity-40"><Package className="w-12 h-12 mx-auto mb-3" /><p className="font-black">등록된 상품이 없습니다.</p></td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4 p-2">
                    {filteredItems.length > 0 ? (
                      filteredItems.slice(0, showAllItems ? undefined : 15).map((item: any) => {
                        const isShortage = item.currentStock <= (item.safetyStock || 0);
                        return (
                          <div key={item.id} className={`bg-white p-5 rounded-[28px] border ${isShortage ? 'border-rose-200 bg-rose-50/20' : 'border-outline-variant/60'} shadow-sm space-y-4 relative overflow-hidden group transition-all`}>
                            {isShortage && <div className="absolute top-0 right-0 px-3 py-1 bg-rose-500 text-white text-[8px] font-black rounded-bl-xl uppercase tracking-widest animate-pulse">Low Stock</div>}
                            
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-black text-primary font-mono bg-primary/5 px-2 py-0.5 rounded-lg">{item.sku || 'NO-SKU'}</span>
                                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-[9px] font-black text-outline uppercase">{item.category}</span>
                                </div>
                                <h4 className="text-lg font-black text-[#0f172a] leading-tight truncate">{item.name}</h4>
                                {item.brand && <p className="text-[10px] font-bold text-outline-variant">{item.brand}</p>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {canEditItems && (
                                  <>
                                    <button onClick={() => handleEditItem(item)} className="p-3 bg-slate-50 text-slate-400 rounded-xl active:bg-primary/10 active:text-primary transition-all shadow-sm">
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-3 bg-rose-50 text-rose-400 rounded-xl active:bg-rose-100 active:text-rose-600 transition-all shadow-sm">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100/60">
                              <div>
                                  <div className="text-[9px] font-black text-outline uppercase tracking-wider mb-1">현재 재고</div>
                                  <div className={`text-base font-black ${isShortage ? 'text-rose-500' : 'text-[#0f172a]'}`}>
                                    {item.currentStock?.toLocaleString()} <span className="text-[11px] font-bold opacity-40 ml-0.5">{item.unit}</span>
                                  </div>
                              </div>
                              <div>
                                  <div className="text-[9px] font-black text-outline uppercase tracking-wider mb-1">보관 위치</div>
                                  <div className="text-sm font-black text-[#1e293b] truncate">
                                    {item.location || '미지정'}
                                  </div>
                              </div>
                            </div>

                            {canEditPrices && (
                              <div className="flex items-center gap-4 py-3 px-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <div className="flex-1">
                                  <div className="text-[8px] font-black text-outline uppercase mb-0.5">매입가</div>
                                  <div className="text-[11px] font-black text-slate-600">₩{item.purchasePrice?.toLocaleString()}</div>
                                </div>
                                <div className="w-px h-6 bg-slate-200"></div>
                                <div className="flex-1">
                                  <div className="text-[8px] font-black text-outline uppercase mb-0.5">판매가</div>
                                  <div className="text-[11px] font-black text-indigo-600">₩{item.salesPrice?.toLocaleString()}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-16 text-center opacity-40 bg-slate-50/50 rounded-[32px] border border-dashed border-outline-variant">
                         <Package className="w-12 h-12 mx-auto mb-3 text-outline" />
                         <p className="text-sm font-black text-[#0f172a]">등록된 상품이 없습니다</p>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}
        {tab === 't' && (
          <div className="p-4 md:p-10 space-y-10 md:space-y-12">
             <div className="bg-white border border-outline-variant/30 rounded-[32px] md:rounded-[48px] shadow-sm p-5 md:p-12 space-y-8 md:space-y-10">
                <div className="text-center space-y-1">
                  <h3 className="text-sm md:text-xl font-black text-[#0f172a] tracking-tight">{editingPartnerId ? '거래처 정보 수정' : '신규 거래처 등록'}</h3>
                  <p className="text-[9px] md:text-[10px] font-black text-outline uppercase tracking-widest">{editingPartnerId ? 'UPDATE PARTNER INFO' : 'REGISTER NEW PARTNER'}</p>
                  <div className="w-12 h-1 bg-blue-100 mx-auto rounded-full mt-3"></div>
                </div>

                <form onSubmit={handleRegisterPartner} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5 md:gap-y-8">
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">거래처명</label>
                    <input placeholder="예: (주)한울미트" value={partnerForm.name} onChange={e => setPartnerForm({...partnerForm, name: e.target.value})} className="w-full h-12 md:h-16 px-5 md:px-8 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 shadow-sm text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">유형</label>
                    <div className="relative">
                      <select value={partnerForm.type} onChange={e => setPartnerForm({...partnerForm, type: e.target.value})} className="w-full h-12 md:h-16 px-5 md:px-8 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all shadow-sm cursor-pointer appearance-none text-sm">
                        <option value="공급사">공급사</option>
                        <option value="고객사">고객사</option>
                        <option value="운송사">운송사</option>
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">연락처</label>
                    <input placeholder="예: 010-1234-5678" value={partnerForm.phone} onChange={e => setPartnerForm({...partnerForm, phone: e.target.value})} className="w-full h-12 md:h-16 px-5 md:px-8 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 shadow-sm text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">주소</label>
                    <input placeholder="예: 경기도 안양시..." value={partnerForm.address} onChange={e => setPartnerForm({...partnerForm, address: e.target.value})} className="w-full h-12 md:h-16 px-5 md:px-8 bg-slate-50/50 border border-outline-variant/60 rounded-2xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 shadow-sm text-sm" />
                  </div>
                  <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 pt-4">
                    <button type="submit" className="flex-1 h-14 md:h-16 bg-[#3b82f6] text-white rounded-2xl font-black text-sm md:text-lg tracking-tight shadow-xl shadow-blue-500/10 hover:bg-blue-600 transition-all active:scale-95">{editingPartnerId ? '수정 완료' : '거래처 등록하기'}</button>
                    {editingPartnerId && <button type="button" onClick={() => { setEditingPartnerId(null); setPartnerForm({ name: '', type: '공급사', phone: '', address: '' }); }} className="w-full sm:w-40 h-14 md:h-16 bg-rose-50 text-rose-600 rounded-2xl font-black text-sm md:text-lg shadow-sm hover:bg-rose-100 transition-all">취소</button>}
                  </div>
                </form>
             </div>

             <hr className="border-outline-variant/20" />
             <div className="space-y-6 md:space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div><h3 className="text-xl md:text-2xl font-black text-[#0f172a] flex items-center gap-2"><Users className="w-6 h-6 md:w-7 md:h-7" /> 거래처</h3></div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative group flex-1 sm:w-80">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                      <input type="text" placeholder="거래처명 검색..." value={partnerSearch} onChange={(e) => setPartnerSearch(e.target.value)} className="w-full h-12 pl-11 pr-4 bg-white border border-outline-variant rounded-2xl text-xs sm:text-sm font-bold outline-none focus:border-primary focus:bg-slate-50 transition-all shadow-sm" />
                    </div>
                    {partners.filter((p: any) => p.name.toLowerCase().includes(partnerSearch.toLowerCase())).length > 5 && (
                      <button onClick={() => setShowAllPartners(!showAllPartners)} className="flex items-center justify-center gap-2 px-6 h-12 bg-white border border-outline-variant rounded-2xl text-[11px] md:text-sm font-black text-[#0f172a] hover:bg-slate-50 transition-all shadow-sm">
                        {showAllPartners ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} 
                        {showAllPartners ? '접기' : '더보기'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-[24px] md:rounded-[40px] border border-outline-variant overflow-hidden shadow-sm p-2 md:p-0">
                  <div className="w-full">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-[#f0f4f8] text-[11px] md:text-[12px] font-black text-[#0f172a]/60 uppercase tracking-widest border-b border-outline-variant/50">
                          <tr><th className="px-6 py-6 text-left w-12"><input type="checkbox" className="w-5 h-5 rounded border-outline-variant" /></th><th className="px-6 py-6 text-left">거래처명</th><th className="px-6 py-6 text-center">유형</th><th className="px-6 py-6 text-center">연락처</th><th className="px-6 py-6 text-right">기능</th></tr>
                        </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {(() => {
                          const filtered = partners.filter((p: any) => 
                            p.name.toLowerCase().includes(partnerSearch.toLowerCase())
                          );
                          if (filtered.length === 0) {
                            return <tr><td colSpan={5} className="py-24 text-center"><p className="text-lg font-black text-[#0f172a]/30">등록된 거래처가 없습니다.</p></td></tr>;
                          }
                          return filtered.slice(0, showAllPartners ? undefined : 5).map((p: any) => (
                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-6"><input type="checkbox" className="w-5 h-5 rounded border-outline-variant" /></td>
                              <td className="px-6 py-6"><div className="font-black text-[#0f172a] text-lg">{p.name}</div><p className="text-[10px] text-outline font-bold mt-0.5">{p.address}</p></td>
                              <td className="px-6 py-6 text-center"><span className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black tracking-widest uppercase">{p.type}</span></td>
                              <td className="px-6 py-6 text-center font-bold text-on-surface/70">{p.phone || '-'}</td>
                              <td className="px-6 py-6 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => handleEditPartner(p)} className="p-3 text-primary hover:bg-primary/10 rounded-2xl transition-all" title="수정"><Edit className="w-5 h-5" /></button><button onClick={() => handleDeletePartner(p.id, p.name)} className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all" title="삭제"><Trash2 className="w-5 h-5" /></button></div></td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3 p-2">
                    {(() => {
                      const filtered = partners.filter((p: any) => 
                        p.name.toLowerCase().includes(partnerSearch.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        return <div className="py-12 text-center opacity-30 text-sm font-black">거래처가 없습니다</div>;
                      }
                      return filtered.slice(0, showAllPartners ? undefined : 5).map((p: any) => (
                        <div key={p.id} className="bg-white p-5 rounded-[28px] border border-outline-variant/60 shadow-sm space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest">{p.type}</div>
                              <h4 className="text-base font-black text-[#0f172a]">{p.name}</h4>
                              <div className="text-[10px] font-bold text-outline">{p.phone || '연락처 없음'}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEditPartner(p)} className="p-3 bg-slate-50 text-slate-400 rounded-xl active:bg-primary/10 active:text-primary transition-all">
                                <Edit className="w-4.5 h-4.5" />
                              </button>
                              <button onClick={() => handleDeletePartner(p.id, p.name)} className="p-3 bg-rose-50 text-rose-400 rounded-xl active:bg-rose-100 active:text-rose-600 transition-all">
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          </div>
                          <div className="pt-3 border-t border-slate-50 text-[10px] font-bold text-outline leading-relaxed">{p.address || '주소 정보 없음'}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
             </div>
          </div>
        </div>
        )}
        {tab === 'u' && (
          <div className="p-4 md:p-10 space-y-10 md:space-y-12">
             <div className="bg-[#f8fafc] p-5 md:p-8 rounded-[28px] md:rounded-[32px] border border-outline-variant space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="text-center lg:text-left">
                    <h3 className="text-base md:text-lg font-black text-[#0f172a] tracking-tight">신규 관리자 등록</h3>
                    <p className="text-[9px] md:text-[10px] font-black text-outline uppercase tracking-widest mt-1">REGISTER NEW ADMINISTRATOR EMAIL</p>
                  </div>
                  <form onSubmit={handleRegisterAdmin} className="flex-1 w-full max-w-2xl flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                      <input type="email" placeholder="등록할 관리자 이메일을 입력하세요" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} className="w-full h-12 md:h-14 pl-11 pr-4 bg-white border border-outline-variant rounded-2xl font-bold outline-none focus:border-primary transition-all shadow-sm text-xs md:text-sm" />
                    </div>
                    <button type="submit" className="h-12 md:h-14 px-8 bg-[#0f172a] text-white rounded-2xl font-black text-xs md:text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95 whitespace-nowrap">
                      등록하기
                    </button>
                  </form>
                </div>
             </div>
             
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-outline-variant pb-6 md:pb-8">
               <div>
                 <h3 className="text-lg md:text-2xl font-black text-[#0f172a] tracking-tight flex items-center gap-2"><Users className="w-5 h-5 md:w-6 md:h-6" /> 계정 권한 관리</h3>
                 <p className="text-[9px] md:text-[10px] font-black text-outline uppercase tracking-widest mt-1">USER ACCESS CONTROL</p>
               </div>
               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative group w-full sm:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input type="text" placeholder="이름 또는 이메일 검색..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="w-full h-12 pl-11 pr-4 bg-white border border-outline-variant rounded-2xl text-xs sm:text-sm font-bold outline-none focus:border-primary focus:bg-slate-50 transition-all shadow-sm" />
                  </div>
                  <button onClick={() => setShowAllUsers(!showAllUsers)} className="flex items-center justify-center gap-2 px-6 h-12 bg-white border border-outline-variant rounded-2xl text-xs md:text-sm font-black text-[#0f172a] hover:bg-surface-container transition-all shadow-sm">
                    {showAllUsers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {showAllUsers ? '접기' : '더보기'}
                  </button>
               </div>
             </div>

             <div className="grid grid-cols-1 md:gap-6 space-y-3 md:space-y-0">
               {allUsers.filter((u: any) => u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase())).slice(0, showAllUsers ? undefined : 6).map((u: any) => (
                  <div key={u.id} className="bg-white md:bg-[#f8fafc] p-4 md:p-8 rounded-[28px] md:rounded-[32px] border border-outline-variant/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-8 hover:bg-white hover:border-primary transition-all shadow-sm md:shadow-none">
                    <div className="flex items-center gap-4 md:gap-6 w-full">
                      <div className="relative shrink-0">
                        <img src={u.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200'} className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl border-2 border-white shadow-md object-cover" alt="" />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full border-2 md:border-4 border-white ${u.role === 'super_admin' ? 'bg-indigo-500' : u.role === 'admin' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base md:text-xl font-black text-[#0f172a] leading-tight truncate">{u.displayName || '이름 없음'}</h4>
                        <p className="text-[10px] md:text-xs font-bold text-outline-variant flex items-center gap-1 mt-1 truncate">{u.email}</p>
                      </div>
                    </div>
                    
                    <div className="w-full md:w-auto flex items-center gap-3 md:gap-4 bg-slate-50/50 md:bg-white p-2 md:p-2 rounded-2xl border border-outline-variant/40 shadow-sm">
                      <div className="relative flex-1 md:flex-none">
                        <select 
                          value={u.role || 'user'} 
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)} 
                          disabled={!canManageUsers || u.email === 'crucify87@gmail.com'} 
                          className="w-full md:w-auto bg-transparent h-10 pl-2 md:pl-4 pr-8 font-black text-[11px] md:text-sm outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                        >
                          <option value="super_admin">최고관리자</option>
                          <option value="admin">관리자</option>
                          <option value="user">일반</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-outline pointer-events-none" />
                      </div>
                      <div className="h-6 w-px bg-outline-variant/30"></div>
                      <span className={`px-3 md:px-4 py-1.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${u.role === 'super_admin' ? 'bg-indigo-50 text-indigo-600' : u.role === 'admin' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {u.role === 'super_admin' ? 'SUPER' : u.role === 'admin' ? 'ADMIN' : 'USER'}
                      </span>
                      {canManageUsers && u.email !== user?.email && u.email !== 'crucify87@gmail.com' && (
                        <button onClick={() => handleDeleteUser(u.id, u.email)} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90" title="계정 삭제">
                          <Trash2 className="w-4.5 h-4.5 md:w-5 md:h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
             </div>

             
             <div className="bg-amber-50 p-6 rounded-[28px] border border-amber-200">
               <div className="flex flex-col sm:flex-row gap-4">
                 <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                   <AlertTriangle className="w-5 h-5 text-amber-600" />
                 </div>
                 <div className="space-y-1">
                   <p className="text-sm md:text-base font-black text-amber-900">권한 안내</p>
                   <ul className="text-[11px] md:text-xs font-bold text-amber-800 space-y-2 list-disc pl-4 py-2">
                     <li><strong className="text-indigo-700">최고관리자:</strong> 상품/거래처 등록/수정, 단가 확인/변경, 유저 권한 설정 지원</li>
                     <li><strong className="text-emerald-700">관리자:</strong> 상품 등록 및 정보 수정, 매입/판매 단가 조회 가능</li>
                     <li><strong className="text-slate-700">일반:</strong> 대시보드 및 재고 현황(로그) 읽기 권한 전용</li>
                   </ul>
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsContent;
