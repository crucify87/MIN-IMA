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
  const [showAllUsers, setShowAllUsers] = useState(false);

  // Item Form
  const [itemForm, setItemForm] = useState({
    sku: '', name: '', category: '', unit: '', currentStock: '', safetyStock: '',
    purchasePrice: '', salesPrice: '', manufDate: '', expiryDate: '', location: '', detailLocation: ''
  });

  // Partner Form
  const [partnerForm, setPartnerForm] = useState({ name: '', type: '공급사', phone: '', address: '' });
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  
  // Admin Form
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const handleRegisterItem = async (e: any) => {
    e.preventDefault();
    if (!canEditItems) return;
    try {
      await addDoc(collection(db, 'inventory'), {
        ...itemForm,
        currentStock: Number(itemForm.currentStock),
        safetyStock: Number(itemForm.safetyStock),
        purchasePrice: Number(itemForm.purchasePrice),
        salesPrice: Number(itemForm.salesPrice),
        createdAt: serverTimestamp()
      });
      alert('상품 마스터 등록이 완료되었습니다.');
      setItemForm({ sku: '', name: '', category: '', unit: '', currentStock: '', safetyStock: '', purchasePrice: '', salesPrice: '', manufDate: '', expiryDate: '', location: '', detailLocation: '' });
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'inventory'); }
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
      <header className="flex items-center gap-4">
        <button onClick={() => onNavigate('dashboard')} className="p-3 bg-[#e8effd] hover:bg-[#d0e0fb] text-[#0f172a] rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter">시스템 설정</h1>
          <p className="text-[11px] font-black text-outline uppercase tracking-tight">환경 설정</p>
        </div>
      </header>

      <div className="flex bg-[#f1f4f9] p-1.5 rounded-2xl border border-outline-variant/30 w-fit">
        <button onClick={() => setTab('p')} className={`px-10 py-3 rounded-xl font-black text-sm transition-all ${tab === 'p' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>상품</button>
        <button onClick={() => setTab('t')} className={`px-10 py-3 rounded-xl font-black text-sm transition-all ${tab === 't' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>거래처</button>
        {canManageUsers && <button onClick={() => setTab('u')} className={`px-10 py-3 rounded-xl font-black text-sm transition-all ${tab === 'u' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>관리자</button>}
      </div>

      <div className="bg-white rounded-[40px] border border-outline-variant shadow-xl shadow-surface-container-high/50 overflow-hidden">
        {tab === 'p' && (
          <div className="p-10 space-y-12">
            {canEditItems ? (
              <div className="max-w-4xl mx-auto space-y-10">
                <h3 className="text-center text-[13px] font-black text-[#0f172a] uppercase tracking-widest border-b border-outline-variant pb-6">신규 상품(MASTER) 등록</h3>
                <form onSubmit={handleRegisterItem} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  <div className="space-y-2"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">SKU 번호</label><input placeholder="예: SKU-BF-001" value={itemForm.sku} onChange={e => setItemForm({...itemForm, sku: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">품목명</label><input placeholder="예: 프리미엄 티본" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">카테고리</label><input placeholder="예: 소고기" value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">단위</label><input placeholder="예: kg" value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">현재 재고</label><input type="number" value={itemForm.currentStock} onChange={e => setItemForm({...itemForm, currentStock: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">안전 재고</label><input type="number" value={itemForm.safetyStock} onChange={e => setItemForm({...itemForm, safetyStock: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">매입 단가 (W)</label><input type="number" placeholder={canEditPrices ? "예: 25000" : "권한 없음"} disabled={!canEditPrices} value={itemForm.purchasePrice} onChange={e => setItemForm({...itemForm, purchasePrice: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50 disabled:bg-surface-container" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">판매 단가 (W)</label><input type="number" placeholder={canEditPrices ? "예: 38000" : "권한 없음"} disabled={!canEditPrices} value={itemForm.salesPrice} onChange={e => setItemForm({...itemForm, salesPrice: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50 disabled:bg-surface-container" /></div>
                  <div className="space-y-2 flex flex-col"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1 flex items-center gap-1"><CalendarDays className="w-3 h-3 text-emerald-500" /> 제조일자</label><input type="date" value={itemForm.manufDate} onChange={e => setItemForm({...itemForm, manufDate: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all" /></div>
                  <div className="space-y-2 flex flex-col"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1 flex items-center gap-1"><Clock className="w-3 h-3 text-rose-500" /> 소비기한</label><input type="date" value={itemForm.expiryDate} onChange={e => setItemForm({...itemForm, expiryDate: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">보관 위치/라인</label><input placeholder="예: A구역 / 1번라인" value={itemForm.location} onChange={e => setItemForm({...itemForm, location: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-tight ml-1">상세 위치</label><input placeholder="예: 3단 4번" value={itemForm.detailLocation} onChange={e => setItemForm({...itemForm, detailLocation: e.target.value})} className="w-full h-14 px-6 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50" /></div>
                  <div className="md:col-span-2 pt-4"><button type="submit" className="w-full h-16 bg-[#0f172a] text-white rounded-2xl font-black text-lg tracking-tight shadow-xl shadow-indigo-900/10 hover:bg-slate-800 transition-all active:scale-[0.98]">상품 시스템 등록</button></div>
                </form>
              </div>
            ) : (
              <div className="text-center py-10 opacity-60">
                 <Lock className="w-12 h-12 mx-auto mb-4" />
                 <p className="font-black">상품 등록/수정 권한이 없습니다.</p>
              </div>
            )}
            <hr className="border-outline-variant/30" />
            <div className="space-y-12">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-black text-[#0f172a] tracking-tight flex items-center gap-2"><Package className="w-6 h-6" /> 등록된 상품 목록</h3>
                  <p className="text-[10px] font-black text-outline uppercase tracking-widest mt-1">MASTER INVENTORY ITEMS</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative group flex-1 md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input type="text" placeholder="상품명, SKU, 카테고리 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-11 pl-11 pr-4 bg-white border border-outline-variant rounded-xl text-sm font-bold outline-none focus:border-primary transition-all" />
                  </div>
                  <button className="flex items-center gap-2 px-6 h-11 bg-white border border-outline-variant rounded-xl text-sm font-black text-[#0f172a] hover:bg-surface-container transition-all"><ChevronDown className="w-4 h-4" /> 펼치기</button>
                </div>
              </div>
              <div className="bg-[#f8fafc] border-2 border-dashed border-[#d1d5db] rounded-[32px] min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
                {filteredItems.length > 0 ? (
                  <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredItems.map((item: any) => (
                      <div key={item.id} className="bg-white p-6 rounded-3xl border border-outline-variant shadow-sm flex items-center justify-between hover:border-primary transition-all">
                        <div className="flex items-center gap-4 text-left">
                          <div className="w-12 h-12 bg-surface-container rounded-2xl flex items-center justify-center text-primary"><Package className="w-6 h-6" /></div>
                          <div><h4 className="font-black text-[#0f172a] leading-tight">{item.name}</h4><p className="text-[10px] font-black text-outline uppercase mt-1">{item.sku} • {item.category}</p></div>
                        </div>
                        {canEditItems && (
                          <button onClick={() => onNavigate('detail', item)} className="p-3 hover:bg-primary/5 text-primary rounded-xl transition-colors"><Edit className="w-5 h-5" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 opacity-40"><Package className="w-16 h-16 mx-auto" /><p className="text-xl font-black text-[#0f172a] tracking-tight">등록된 상품이 없거나 검색 결과가 없습니다.</p></div>
                )}
              </div>
            </div>
          </div>
        )}
        {tab === 't' && (
          <div className="p-10 space-y-12">
             <div className="bg-white border border-outline-variant/30 rounded-[48px] shadow-2xl p-12 space-y-10">
                <h3 className="text-center text-xl font-black text-[#0f172a] uppercase tracking-tight">{editingPartnerId ? '거래처 정보 수정' : '신규 거래처 등록'}</h3>
                <form onSubmit={handleRegisterPartner} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  <div className="space-y-3"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">거래처명</label><input placeholder="예: (주)한울미트" value={partnerForm.name} onChange={e => setPartnerForm({...partnerForm, name: e.target.value})} className="w-full h-16 px-8 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50 shadow-sm" /></div>
                  <div className="space-y-3"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">유형</label><select value={partnerForm.type} onChange={e => setPartnerForm({...partnerForm, type: e.target.value})} className="w-full h-16 px-8 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all shadow-sm cursor-pointer"><option value="공급사">공급사</option><option value="고객사">고객사</option><option value="운송사">운송사</option></select></div>
                  <div className="space-y-3"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">연락처</label><input placeholder="예: 010-1234-5678" value={partnerForm.phone} onChange={e => setPartnerForm({...partnerForm, phone: e.target.value})} className="w-full h-16 px-8 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50 shadow-sm" /></div>
                  <div className="space-y-3"><label className="text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">주소</label><input placeholder="예: 경기도 안양시..." value={partnerForm.address} onChange={e => setPartnerForm({...partnerForm, address: e.target.value})} className="w-full h-16 px-8 bg-white border border-outline-variant rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/50 shadow-sm" /></div>
                  <div className="md:col-span-2 flex gap-4 pt-4"><button type="submit" className="flex-1 h-16 bg-[#3b82f6] text-white rounded-2xl font-black text-lg tracking-tight shadow-xl shadow-blue-500/10 hover:bg-blue-600 transition-all active:scale-95">{editingPartnerId ? '수정 완료' : '등록 완료'}</button>{editingPartnerId && <button type="button" onClick={() => { setEditingPartnerId(null); setPartnerForm({ name: '', type: '공급사', phone: '', address: '' }); }} className="w-40 h-16 bg-rose-50 text-rose-600 rounded-2xl font-black text-lg shadow-sm hover:bg-rose-100 transition-all">취소</button>}</div>
                </form>
             </div>
             <hr className="border-outline-variant/20" />
             <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div><h3 className="text-2xl font-black text-[#0f172a] flex items-center gap-2"><Users className="w-7 h-7" /> 거래처 목록</h3></div>
                  <div className="flex items-center gap-3">
                    <div className="relative group w-full md:w-80"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" /><input type="text" placeholder="거래처명 검색..." value={partnerSearch} onChange={(e) => setPartnerSearch(e.target.value)} className="w-full h-12 pl-11 pr-4 bg-white border border-outline-variant rounded-xl text-sm font-bold outline-none focus:border-primary transition-all shadow-sm" /></div>
                    <button onClick={() => setShowAllPartners(!showAllPartners)} className="flex items-center gap-2 px-6 h-12 bg-[#e8f1ff] border border-outline-variant/20 rounded-xl text-sm font-black text-[#0f172a] hover:bg-blue-100 transition-all">{showAllPartners ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} 펼치기</button>
                  </div>
                </div>
                <div className="bg-white rounded-[40px] border border-outline-variant overflow-hidden shadow-sm">
                  <table className="w-full border-collapse">
                    <thead className="bg-[#f0f4f8] text-[12px] font-black text-[#0f172a]/60 uppercase tracking-widest border-b border-outline-variant/50">
                      <tr><th className="px-6 py-6 text-left w-12"><input type="checkbox" className="w-5 h-5 rounded border-outline-variant" /></th><th className="px-6 py-6 text-left">거래처명</th><th className="px-6 py-6 text-center">유형</th><th className="px-6 py-6 text-center">연락처</th><th className="px-6 py-6 text-right">기능</th></tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {partners.filter((p: any) => p.name.toLowerCase().includes(partnerSearch.toLowerCase())).length > 0 ? (
                          partners.filter((p: any) => p.name.toLowerCase().includes(partnerSearch.toLowerCase())).map((p: any) => (
                              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-6"><input type="checkbox" className="w-5 h-5 rounded border-outline-variant" /></td>
                                <td className="px-6 py-6"><div className="font-black text-[#0f172a] text-lg">{p.name}</div><p className="text-[10px] text-outline font-bold mt-0.5">{p.address}</p></td>
                                <td className="px-6 py-6 text-center"><span className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black tracking-widest uppercase">{p.type}</span></td>
                                <td className="px-6 py-6 text-center font-bold text-on-surface/70">{p.phone || '-'}</td>
                                <td className="px-6 py-6 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => handleEditPartner(p)} className="p-3 text-primary hover:bg-primary/10 rounded-2xl transition-all" title="수정"><Edit className="w-5 h-5" /></button><button onClick={() => handleDeletePartner(p.id, p.name)} className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all" title="삭제"><Trash2 className="w-5 h-5" /></button></div></td>
                              </tr>
                            ))
                        ) : (<tr><td colSpan={5} className="py-24 text-center"><p className="text-lg font-black text-[#0f172a]/30">등록된 거래처가 없습니다.</p></td></tr>)
                      }
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}
        {tab === 'u' && (
          <div className="p-10 space-y-12">
             <div className="bg-[#f8fafc] p-8 rounded-[32px] border border-outline-variant space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div><h3 className="text-lg font-black text-[#0f172a] tracking-tight">신규 관리자 등록</h3><p className="text-[10px] font-black text-outline uppercase tracking-widest mt-1">REGISTER NEW ADMINISTRATOR EMAIL</p></div>
                  <form onSubmit={handleRegisterAdmin} className="flex-1 max-w-2xl flex gap-3"><div className="relative flex-1"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" /><input type="email" placeholder="등록할 관리자 이메일을 입력하세요" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} className="w-full h-14 pl-11 pr-4 bg-white border border-outline-variant rounded-2xl font-bold outline-none focus:border-primary transition-all shadow-sm" /></div><button type="submit" className="h-14 px-8 bg-[#0f172a] text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95 whitespace-nowrap">등록</button></form>
                </div>
             </div>
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-outline-variant pb-6">
               <div><h3 className="text-2xl font-black text-[#0f172a] tracking-tight flex items-center gap-2"><Users className="w-6 h-6" /> 계정 권한 관리</h3><p className="text-[10px] font-black text-outline uppercase tracking-widest mt-1">USER ACCESS CONTROL</p></div>
               <div className="flex items-center gap-3">
                  <div className="relative group w-full md:w-80"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" /><input type="text" placeholder="이름 또는 이메일 검색..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="w-full h-11 pl-11 pr-4 bg-white border border-outline-variant rounded-xl text-sm font-bold outline-none focus:border-primary transition-all" /></div>
                  <button onClick={() => setShowAllUsers(!showAllUsers)} className="flex items-center gap-2 px-6 h-11 bg-white border border-outline-variant rounded-xl text-sm font-black text-[#0f172a] hover:bg-surface-container transition-all">{showAllUsers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}{showAllUsers ? '접기' : '펼쳐보기'}</button>
               </div>
             </div>
             <div className="space-y-6">
               {allUsers.filter((u: any) => u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase())).slice(0, showAllUsers ? undefined : 3).map((u: any) => (
                  <div key={u.id} className="bg-[#f8fafc] p-8 rounded-[32px] border border-outline-variant flex flex-col md:flex-row items-center justify-between gap-8 group hover:bg-white hover:border-primary transition-all">
                    <div className="flex items-center gap-6"><div className="relative"><img src={u.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200'} className="w-16 h-16 rounded-3xl border-2 border-white shadow-xl object-cover" alt="" /><div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white ${u.role === 'super_admin' ? 'bg-indigo-500' : u.role === 'admin' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div></div><div><h4 className="text-xl font-black text-[#0f172a] leading-tight">{u.displayName || '이름 없음'}</h4><p className="text-xs font-bold text-outline-variant flex items-center gap-1 mt-1">{u.email}</p></div></div>
                    <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-outline-variant/50 shadow-sm"><select value={u.role || 'user'} onChange={(e) => handleUpdateRole(u.id, e.target.value)} disabled={!canManageUsers || u.email === 'crucify87@gmail.com'} className="bg-transparent h-10 px-4 font-black text-sm outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><option value="super_admin">최고관리자</option><option value="admin">관리자</option><option value="user">일반</option></select><div className="h-6 w-px bg-outline-variant/30"></div><span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${u.role === 'super_admin' ? 'bg-indigo-50 text-indigo-600' : u.role === 'admin' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{u.role === 'super_admin' ? 'SUPER' : u.role === 'admin' ? 'ADMIN' : 'USER'}</span>{canManageUsers && u.email !== user?.email && u.email !== 'crucify87@gmail.com' && (<button onClick={() => handleDeleteUser(u.id, u.email)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="계정 삭제"><Trash2 className="w-5 h-5" /></button>)}</div>
                  </div>
                ))}
             </div>
             <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200">
               <div className="flex gap-4">
                 <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                 <div className="space-y-1"><p className="text-sm font-black text-amber-900">권한 안내</p><ul className="text-xs font-bold text-amber-800 space-y-1.5 list-disc pl-4 py-2"><li><strong className="text-indigo-700">최고관리자:</strong> 전 항목 등록/수정, 매입/판매 단가 변경, 권한 설정 가능</li><li><strong className="text-emerald-700">관리자:</strong> 상품 등록/수정, 매입/판매 단가 확인 가능</li><li><strong className="text-slate-700">일반:</strong> 실시간 통합 재고 현황 읽기 권한만 부여</li></ul></div>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsContent;
