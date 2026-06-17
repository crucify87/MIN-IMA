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
  ChevronLeft,
  ChevronRight,
  Users,
  Mail,
  Lock,
  Settings,
  Image as ImageIcon,
  Upload,
  AlertTriangle,
  MapPin,
  Scale,
  MessageSquarePlus
} from 'lucide-react';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  addDoc, 
  deleteDoc,
  writeBatch,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError } from '../../lib/firestoreUtils';
import { OperationType } from '../../types';
import { FeedbackModal } from '../common/FeedbackModal';

function SettingsContent({ 
  user,
  userData,
  inventory, 
  logistics = [],
  partners, 
  allUsers, 
  onNavigate, 
  canEditItems, 
  canManageUsers, 
  canEditPrices,
  settings,
  isSuperAdmin
}: any) {
  const hasFeedbackViewPermission = canManageUsers || userData?.canViewFeedback === true;

  const [tab, setTab] = useState<'p' | 't' | 'u' | 's' | 'f'>('p');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackFilterType, setFeedbackFilterType] = useState('');
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);

  const handleToggleFeedbackPermission = async (targetUserId: string, currentVal: boolean) => {
    if (!canManageUsers) return;
    try {
      await updateDoc(doc(db, 'users', targetUserId), { 
        canViewFeedback: !currentVal, 
        updatedAt: serverTimestamp() 
      });
      alert('피드백 조회 권한이 변경되었습니다.');
    } catch (error) {
      console.error(error);
      alert('권한 변경에 실패했습니다.');
    }
  };

  const formatFeedbackDate = (timestamp: any) => {
    if (!timestamp) return '-';
    // If it's a Firestore Timestamp, it has computed .toDate()
    const date = timestamp && typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleConfirmDeleteFeedback = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'feedbacks', id));
      setDeletingFeedbackId(null);
    } catch (err: any) {
      console.error('Failed to delete feedback:', err);
      alert('건의사항 삭제에 실패했습니다: ' + err?.message);
    }
  };

  const filteredFeedbacks = feedbacks.filter((item) => {
    const matchesType = !feedbackFilterType || item.type === feedbackFilterType;
    const matchesSearch = !feedbackSearch || 
      item.content?.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
      item.userEmail?.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
      item.userName?.toLowerCase().includes(feedbackSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterPartner, setFilterPartner] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showAllPartners, setShowAllPartners] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isItemsListExpanded, setIsItemsListExpanded] = useState(false);
  const ITEMS_PER_PAGE = 10;
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [userPage, setUserPage] = useState(1);

  // App Settings Form
  const [logoUrl, setLogoUrl] = useState(settings?.logoUrl || '');
  const [appName, setAppName] = useState(settings?.appName || '재고 관리 시스템');
  const [savingSettings, setSavingSettings] = useState(false);
  
  React.useEffect(() => {
    if (!hasFeedbackViewPermission) {
      setFeedbacks([]);
      setLoadingFeedbacks(false);
      return;
    }
    setLoadingFeedbacks(true);
    const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setFeedbacks(list);
      setLoadingFeedbacks(false);
    }, (error) => {
      console.error("Error listening to feedbacks:", error);
      setLoadingFeedbacks(false);
    });
    return () => unsubscribe();
  }, [hasFeedbackViewPermission]);

  const formatWithCommas = (value: string | number) => {
    if (value === '' || value === null || value === undefined) return '';
    let str = String(value).replace(/[^0-9.-]/g, '');
    const parts = str.split('.');
    if (parts.length > 2) {
      str = parts[0] + '.' + parts.slice(1).join('');
    }
    const dotIndex = str.indexOf('.');
    if (dotIndex !== -1) {
      const integerPart = str.substring(0, dotIndex);
      let decimalPart = str.substring(dotIndex + 1);
      decimalPart = decimalPart.substring(0, 2);
      const parsedInt = parseInt(integerPart.replace(/[^0-9-]/g, ''));
      const formattedInt = isNaN(parsedInt) ? (integerPart.startsWith('-') ? '-' : '') : parsedInt.toLocaleString();
      return formattedInt + '.' + decimalPart;
    } else {
      const parsed = parseInt(str.replace(/[^0-9-]/g, ''));
      if (isNaN(parsed)) return str.startsWith('-') ? '-' : '';
      return parsed.toLocaleString();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // Approx 800KB to stay safe within Firestore's 1MB limit (inc metadata)
      alert('파일 크기가 너무 큽니다. 800KB 이하의 이미지를 선택해주세요.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setLogoUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAppSettings = async (e: any) => {
    e.preventDefault();
    if (!canManageUsers) return;
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'app'), {
        logoUrl,
        appName,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email
      }, { merge: true });
      alert('앱 설정이 저장되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/app');
    } finally {
      setSavingSettings(false);
    }
  };

  // Item Form
  const [itemForm, setItemForm] = useState({
    sku: '', name: '', category: '돼지고기', brand: '', specs: '', unit: 'BOX', boxes: '', currentStock: '', safetyStock: '',
    purchasePrice: '', salesPrice: '', manufDate: '', expiryDate: '', location: '', detailLocation: '', partner: '', avgWeight: ''
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);
  const [showUnitOptions, setShowUnitOptions] = useState(false);
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [showBrandOptions, setShowBrandOptions] = useState(false);
  const [showPartnerOptions, setShowPartnerOptions] = useState(false);
  const [showSkuOptions, setShowSkuOptions] = useState(false);

  const getNextSku = (prefix: string) => {
    const itemsWithPrefix = inventory.filter((i: any) => i.sku?.startsWith(prefix));
    let nextNum = 1;
    
    if (itemsWithPrefix.length > 0) {
      const nums = itemsWithPrefix.map((i: any) => {
        const parts = i.sku.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart);
        return isNaN(num) ? 0 : num;
      });
      nextNum = Math.max(...nums) + 1;
    }
    
    return `${prefix}-${String(nextNum).padStart(3, '0')}`;
  };

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
        currentStock: Number(itemForm.currentStock) || 0,
        safetyStock: Number(itemForm.safetyStock) || 0,
        boxes: Number(itemForm.boxes) || 0,
        purchasePrice: Number(itemForm.purchasePrice) || 0,
        salesPrice: Number(itemForm.salesPrice) || 0,
        avgWeight: Number(itemForm.avgWeight) || 0,
        updatedAt: serverTimestamp()
      };

      if (editingItemId) {
        const oldItem = inventory.find((i: any) => i.id === editingItemId);
        await updateDoc(doc(db, 'inventory', editingItemId), data);

        if (oldItem) {
          const stockDiff = data.currentStock - (oldItem.currentStock || 0);
          const boxesDiff = data.boxes - (oldItem.boxes || 0);
          
          if (stockDiff !== 0 || boxesDiff !== 0) {
            try {
              await addDoc(collection(db, 'logistics'), {
                date: new Date().toLocaleDateString('sv-SE'),
                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                type: stockDiff > 0 ? '입고' : '출고',
                item: data.name,
                weight: Math.abs(stockDiff),
                boxes: Math.abs(boxesDiff),
                unit: data.unit || 'BOX',
                prevStock: oldItem.currentStock || 0,
                nextStock: data.currentStock,
                prevBoxes: oldItem.boxes || 0,
                nextBoxes: data.boxes,
                specs: data.specs || '',
                category: data.category || '미분류',
                brand: data.brand || '',
                partner: '시스템 조정 (Settings)',
                memo: '마스터 아이템 수정 시 재고 수동 조정',
                createdAt: serverTimestamp()
              });
            } catch (logError) {
              console.error('Failed to create manual adjustment logistics record:', logError);
            }
          }
        }

        // If critical fields changed, update related records to maintain data consistency
        const nameChanged = oldItem && oldItem.name !== data.name;
        const catChanged = oldItem && oldItem.category !== data.category;
        const brandChanged = oldItem && oldItem.brand !== data.brand;
        const partnerChanged = oldItem && oldItem.partner !== data.partner;

        if (oldItem && (nameChanged || catChanged || brandChanged || partnerChanged)) {
          try {
            const batch = writeBatch(db);
            let updateCount = 0;

            // 1. Update Logistics records
            const logQuery = query(collection(db, 'logistics'), where('item', '==', oldItem.name));
            const logSnapshot = await getDocs(logQuery);
            logSnapshot.docs.forEach(docSnap => {
              const u: any = {};
              if (nameChanged) u.item = data.name;
              if (catChanged) u.category = data.category;
              if (brandChanged) u.brand = data.brand;
              // Only update partner if it matches the master partner (e.g. initial stock or default partner records)
              if (partnerChanged && docSnap.data().partner === oldItem.partner) u.partner = data.partner;
              
              if (Object.keys(u).length > 0) {
                batch.update(docSnap.ref, u);
                updateCount++;
              }
            });

            // 2. Update Production records (Finished goods)
            const prodQuery = query(collection(db, 'production_batches'), where('title', '==', oldItem.name));
            const prodSnapshot = await getDocs(prodQuery);
            prodSnapshot.docs.forEach(docSnap => {
              const u: any = {};
              if (nameChanged) u.title = data.name;
              if (brandChanged) u.brand = data.brand;
              if (partnerChanged) u.partner = data.partner;
              
              if (Object.keys(u).length > 0) {
                batch.update(docSnap.ref, u);
                updateCount++;
              }
            });

            // 3. Update Production records (Raw materials)
            const rawQuery = query(collection(db, 'production_batches'), where('rawMaterial', '==', oldItem.name));
            const rawSnapshot = await getDocs(rawQuery);
            rawSnapshot.docs.forEach(docSnap => {
              const u: any = {};
              if (nameChanged) u.rawMaterial = data.name;
              // For raw material records, brand might come from the item master too
              if (brandChanged && docSnap.data().brand === oldItem.brand) u.brand = data.brand;
              
              if (Object.keys(u).length > 0) {
                batch.update(docSnap.ref, u);
                updateCount++;
              }
            });

            if (updateCount > 0) {
              await batch.commit();
              console.log(`Updated ${updateCount} related historical records.`);
            }
          } catch (syncError) {
            console.error('Failed to sync historical records:', syncError);
            // We don't block the main update alert, but log it
          }
        }

        alert('상품 정보가 수정되었습니다.');
        setEditingItemId(null);
      } else {
        if (pendingApprovalId) {
          await updateDoc(doc(db, 'inventory', pendingApprovalId), {
            ...data,
            isApproved: true
          });

          // Add logistics record for initial stock if > 0
          if (data.currentStock > 0) {
            try {
              await addDoc(collection(db, 'logistics'), {
                date: new Date().toLocaleDateString('sv-SE'),
                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                type: '입고',
                item: data.name,
                weight: data.currentStock,
                boxes: data.boxes,
                unit: data.unit || 'BOX',
                prevStock: 0,
                nextStock: data.currentStock,
                prevBoxes: 0,
                nextBoxes: data.boxes,
                specs: data.specs || '',
                partner: data.partner || '초기재고등록',
                category: data.category,
                brand: data.brand,
                memo: '승인 대기 임시 상품 정식 등록 초기 재고',
                createdAt: serverTimestamp()
              });
            } catch (logError) {
              console.error('Failed to create initial logistics record:', logError);
            }
          }

          alert('승인 대기 상품이 성공적으로 등록(승인)되었습니다.');
          setPendingApprovalId(null);
        } else {
          await addDoc(collection(db, 'inventory'), {
            ...data,
            isApproved: true,
            createdAt: serverTimestamp()
          });
          
          // Add logistics record for initial stock if > 0
          if (data.currentStock > 0) {
            try {
              await addDoc(collection(db, 'logistics'), {
                date: new Date().toLocaleDateString('sv-SE'),
                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                type: '입고',
                item: data.name,
                weight: data.currentStock,
                boxes: data.boxes,
                unit: data.unit || 'BOX',
                prevStock: 0,
                nextStock: data.currentStock,
                prevBoxes: 0,
                nextBoxes: data.boxes,
                specs: data.specs || '',
                partner: data.partner || '초기재고등록',
                category: data.category,
                brand: data.brand,
                memo: '신규 상품 등록 초기 재고',
                createdAt: serverTimestamp()
              });
            } catch (logError) {
              console.error('Failed to create initial logistics record:', logError);
            }
          }
          
          alert('상품 등록이 완료되었습니다.');
        }
      }
      setItemForm({ sku: '', name: '', category: '돼지고기', brand: '', specs: '', unit: 'BOX', boxes: '', currentStock: '', safetyStock: '', purchasePrice: '', salesPrice: '', manufDate: '', expiryDate: '', location: '', detailLocation: '', partner: '', avgWeight: '' });
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'inventory'); }
  };

  const handlePendingItemSelection = (item: any) => {
    setPendingApprovalId(item.id);
    setEditingItemId(null);
    setItemForm({
      sku: getNextSku(item.category === '원육' ? 'R' : 'P'),
      name: item.name || '',
      category: item.category || '돼지고기',
      brand: item.brand || '',
      specs: item.specs || '',
      unit: item.unit || 'BOX',
      boxes: String(item.boxes || ''),
      currentStock: String(item.currentStock || ''),
      safetyStock: String(item.safetyStock || ''),
      purchasePrice: String(item.purchasePrice || ''),
      salesPrice: String(item.salesPrice || ''),
      manufDate: item.manufDate || '',
      expiryDate: item.expiryDate || '',
      location: item.location || '',
      detailLocation: item.detailLocation || '',
      partner: item.partner || '',
      avgWeight: String(item.avgWeight || '')
    });
    const el = document.getElementById('item-form');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleEditItem = (item: any) => {
    setEditingItemId(item.id);
    setItemForm({
      sku: item.sku || '',
      name: item.name || '',
      category: item.category || '',
      brand: item.brand || '',
      specs: item.specs || '',
      unit: (item.unit || 'KG').toUpperCase(),
      boxes: String(item.boxes || 0),
      currentStock: String(item.currentStock || 0),
      safetyStock: String(item.safetyStock || 0),
      purchasePrice: String(item.purchasePrice || 0),
      salesPrice: String(item.salesPrice || 0),
      manufDate: item.manufDate || '',
      expiryDate: item.expiryDate || '',
      location: item.location || '',
      detailLocation: item.detailLocation || '',
      partner: item.partner || '',
      avgWeight: String(item.avgWeight || '')
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!canEditItems) return;
    if (!window.confirm(`[${name}] 상품을 마스터에서 영구 삭제하시겠습니까? 관련 모든 입출고 내역 및 생산 일지 기록도 함께 삭제됩니다.`)) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Delete the inventory document
      batch.delete(doc(db, 'inventory', id));

      // 2. Query and delete all related logistics documents
      const qLog = query(collection(db, 'logistics'), where('item', '==', name));
      const logSnap = await getDocs(qLog);
      logSnap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      // 3. Query and delete all related production batch documents where title is name
      const qProdTitle = query(collection(db, 'production_batches'), where('title', '==', name));
      const prodTitleSnap = await getDocs(qProdTitle);
      prodTitleSnap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      // 4. Query and delete all related production batch documents where rawMaterial is name
      const qProdRaw = query(collection(db, 'production_batches'), where('rawMaterial', '==', name));
      const prodRawSnap = await getDocs(qProdRaw);
      prodRawSnap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
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

  const filteredItems = React.useMemo(() => {
    const approvedInventory = inventory.filter((i: any) => i.isApproved !== false);
    let result = approvedInventory.filter((i: any) => 
      i.name.toLowerCase().includes(search.toLowerCase()) || 
      i.sku?.toLowerCase().includes(search.toLowerCase()) ||
      i.category?.toLowerCase().includes(search.toLowerCase()) ||
      i.brand?.toLowerCase().includes(search.toLowerCase())
    );

    if (filterCategory) {
      result = result.filter((i: any) => i.category === filterCategory);
    }

    if (filterBrand) {
      result = result.filter((i: any) => i.brand === filterBrand);
    }

    if (filterPartner) {
      result = result.filter((i: any) => i.partner === filterPartner);
    }

    // Sort by latest update first
    return [...result].sort((a: any, b: any) => {
      const timeA = a.updatedAt?.seconds || 0;
      const timeB = b.updatedAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [inventory, search, filterCategory, filterBrand, filterPartner]);

  const categories = React.useMemo(() => {
    const approvedInventory = inventory.filter((i: any) => i.isApproved !== false);
    const cats = new Set(approvedInventory.map((i: any) => i.category).filter(Boolean));
    return Array.from(cats).sort() as string[];
  }, [inventory]);

  const brands = React.useMemo(() => {
    const approvedInventory = inventory.filter((i: any) => i.isApproved !== false);
    const bnds = new Set(approvedInventory.map((i: any) => i.brand).filter(Boolean));
    return Array.from(bnds).sort() as string[];
  }, [inventory]);

  const itemPartners = React.useMemo(() => {
    const pts = new Set<string>();
    if (partners && partners.length > 0) {
      partners.forEach((p: any) => {
        if (p.name) pts.add(p.name);
      });
    }
    const approvedInventory = inventory.filter((i: any) => i.isApproved !== false);
    approvedInventory.forEach((i: any) => {
      if (i.partner) pts.add(i.partner);
    });
    return Array.from(pts).sort();
  }, [partners, inventory]);

  const deletedItems = React.useMemo(() => {
    if (!logistics || logistics.length === 0 || !inventory) return [];

    // Group logistics logs by item name
    const itemLogsMap: { [name: string]: any[] } = {};
    logistics.forEach((log: any) => {
      const name = log.item;
      if (!name) return;
      if (!itemLogsMap[name]) {
        itemLogsMap[name] = [];
      }
      itemLogsMap[name].push(log);
    });

    const inventoryNames = new Set(inventory.map((i: any) => i.name));
    const deletedNames = Object.keys(itemLogsMap).filter(name => !inventoryNames.has(name));

    return deletedNames.map(name => {
      const logs = itemLogsMap[name];
      const sortedLogs = [...logs].sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || (a.date ? new Date(a.date).getTime() / 1000 : 0);
        const timeB = b.createdAt?.seconds || (b.date ? new Date(b.date).getTime() / 1000 : 0);
        return timeB - timeA;
      });

      const latestLog = sortedLogs[0];
      
      const currentStock = latestLog.nextStock !== undefined ? latestLog.nextStock : 
        logs.reduce((sum, l) => {
          const qty = Number(l.weight || 0);
          return sum + (l.type === '입고' ? qty : -qty);
        }, 0);

      const boxes = latestLog.nextBoxes !== undefined ? latestLog.nextBoxes : 
        logs.reduce((sum, l) => {
          const qty = Number(l.boxes || 0);
          return sum + (l.type === '입고' ? qty : -qty);
        }, 0);

      return {
        name,
        category: latestLog.category || '돼지고기',
        brand: latestLog.brand || '',
        unit: latestLog.unit || 'BOX',
        currentStock,
        boxes,
        partner: latestLog.partner || '',
        location: latestLog.location || 'B창고, 1구역',
        safetyStock: latestLog.safetyStock || 100,
        sku: latestLog.sku || `SKU-RESTORE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        isApproved: true
      };
    });
  }, [logistics, inventory]);

  const handleRestoreItem = async (restoredItem: any) => {
    if (!canEditItems) return;
    if (!window.confirm(`[${restoredItem.name}] 품목을 복구하시겠습니까? (이전에 누적된 로그를 기준으로 수량과 현재고가 자동 복원됩니다.)`)) return;
    try {
      await addDoc(collection(db, 'inventory'), {
        name: restoredItem.name,
        category: restoredItem.category,
        brand: restoredItem.brand || '',
        unit: restoredItem.unit || 'BOX',
        currentStock: restoredItem.currentStock,
        boxes: restoredItem.boxes,
        partner: restoredItem.partner || '',
        location: restoredItem.location || '미지정',
        safetyStock: restoredItem.safetyStock || 0,
        sku: restoredItem.sku,
        isApproved: true,
        updatedAt: serverTimestamp()
      });
      alert(`[${restoredItem.name}] 품목이 정상적으로 복구되었습니다.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'inventory');
    }
  };

  const handleResetAllInventory = async () => {
    if (!isSuperAdmin) return;
    if (!window.confirm("⚠️ 정말로 모든 등록된 품목의 현재 재고 수량(중량/박스)을 0으로 리셋하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 원부자재 및 완제품의 현재고/박스수가 0으로 변경됩니다.")) return;
    if (!window.confirm("⚠️ [최종 확인] 전체 품목의 재고 초기화를 진행하시겠습니까? 관련 입출고 로그는 보존되며 오직 마스터 품목의 현재고 데이터만 0으로 바뀝니다.")) return;

    try {
      // Chunk items in groups of 500
      const chunks = [];
      const tempItems = [...inventory];
      while (tempItems.length > 0) {
        chunks.push(tempItems.splice(0, 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((item: any) => {
          const itemRef = doc(db, 'inventory', item.id);
          batch.update(itemRef, {
            currentStock: 0,
            boxes: 0,
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
      }

      alert("모든 품목의 재고(수량 및 박스)가 0으로 정상 초기화되었습니다.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inventory');
    }
  };

  const handleResetAllLogistics = async () => {
    if (!isSuperAdmin) return;
    if (!window.confirm("⚠️ 정말로 모든 입출고 내역(물류리스트)을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 과거 입출고 로그 데이터가 삭제됩니다.")) return;
    if (!window.confirm("⚠️ [최종 확인] 전체 물류 리스트 초기화를 진행하시겠습니까? 등록된 품목 마스터의 현재고는 유지되며 오직 과거 입출고 내역 로그만 지워집니다.")) return;

    try {
      const chunks = [];
      const tempLogs = [...logistics];
      while (tempLogs.length > 0) {
        chunks.push(tempLogs.splice(0, 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((log: any) => {
          const logRef = doc(db, 'logistics', log.id);
          batch.delete(logRef);
        });
        await batch.commit();
      }

      alert("모든 물류 입출고 로그가 정상 초기화되었습니다.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'logistics');
    }
  };

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterBrand, filterPartner]);

  const Pagination = ({ current, total, totalItems, itemsPerPage, onChange }: { current: number; total: number; totalItems: number; itemsPerPage: number; onChange: (p: number) => void }) => {
    if (total <= 1) return null;
    
    const startItem = (current - 1) * itemsPerPage + 1;
    const endItem = Math.min(current * itemsPerPage, totalItems);

    const getVisiblePages = () => {
      const pages = [];
      const delta = 1;
      for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
          pages.push(i);
        }
      }
      return pages;
    };

    const visiblePages = getVisiblePages();

    return (
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-outline-variant/30 mt-6 md:mt-8">
        <div className="text-[10px] md:text-xs font-black text-outline uppercase tracking-widest order-2 md:order-1">
          {totalItems.toLocaleString()}개 항목 중 {startItem}-{endItem} 번호 표시 중
        </div>
        <div className="flex items-center gap-2 order-1 md:order-2">
          <button 
            disabled={current === 1}
            onClick={() => {
              onChange(current - 1);
              window.scrollTo({ top: (document.getElementById('items-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
            }}
            className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <div className="flex items-center gap-1.5">
            {visiblePages.map((p, i) => (
              <React.Fragment key={p}>
                {i > 0 && visiblePages[i - 1] !== p - 1 && (
                  <span className="text-outline/40 font-black px-1">...</span>
                )}
                <button
                  onClick={() => {
                    onChange(p);
                    window.scrollTo({ top: (document.getElementById('items-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
                  }}
                  className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${current === p ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white border border-outline-variant text-outline hover:border-primary hover:text-primary'}`}
                >
                  {p}
                </button>
              </React.Fragment>
            ))}
          </div>
          <button 
            disabled={current === total}
            onClick={() => {
              onChange(current + 1);
              window.scrollTo({ top: (document.getElementById('items-list')?.offsetTop || 0) - 100, behavior: 'smooth' });
            }}
            className="p-2 bg-white border border-outline-variant rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all active:scale-95"
          >
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center gap-4 px-1 md:px-0">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2.5 md:p-3 bg-[#e8effd] hover:bg-[#d0e0fb] text-[#0f172a] rounded-full transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl md:text-5xl font-black text-[#0f172a] tracking-tighter">설정</h1>
        </div>

        {/* SKU Reference Guide */}
        <div className="flex items-center gap-4 lg:gap-6 ml-auto bg-white/50 px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl border border-outline-variant/50 backdrop-blur-sm overflow-x-auto no-scrollbar max-w-full">
          <div className="text-[8px] md:text-[10px] font-black text-outline uppercase tracking-widest mr-2 whitespace-nowrap">SKU 가이드:</div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[8px] md:text-[10px] font-black">O</span>
            <span className="text-[10px] md:text-[11px] font-bold text-slate-500">부속</span>
          </div>
          <div className="flex items-center gap-2 border-l border-outline-variant/30 pl-3 md:pl-4 whitespace-nowrap">
            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[8px] md:text-[10px] font-black">P</span>
            <span className="text-[10px] md:text-[11px] font-bold text-rose-500">돼지</span>
          </div>
          <div className="flex items-center gap-2 border-l border-outline-variant/30 pl-3 md:pl-4 whitespace-nowrap">
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[8px] md:text-[10px] font-black">C</span>
            <span className="text-[10px] md:text-[11px] font-bold text-amber-700">소</span>
          </div>
          <div className="flex items-center gap-2 border-l border-outline-variant/30 pl-3 md:pl-4 whitespace-nowrap">
            <span className="px-2 py-0.5 bg-sky-50 text-sky-600 rounded text-[8px] md:text-[10px] font-black">R</span>
            <span className="text-[10px] md:text-[11px] font-bold text-sky-500">원육</span>
          </div>
        </div>
      </header>

      <div className="flex flex-nowrap bg-[#f1f4f9] p-1.5 rounded-2xl border border-outline-variant/30 w-full md:w-fit overflow-x-auto no-scrollbar scroll-smooth gap-1">
        <button onClick={() => setTab('p')} className={`shrink-0 px-5 md:px-10 py-3 rounded-xl font-black text-[11px] md:text-sm transition-all whitespace-nowrap ${tab === 'p' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>상품</button>
        <button onClick={() => setTab('t')} className={`shrink-0 px-5 md:px-10 py-3 rounded-xl font-black text-[11px] md:text-sm transition-all whitespace-nowrap ${tab === 't' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>거래처</button>
        {canManageUsers && <button onClick={() => setTab('u')} className={`shrink-0 px-5 md:px-10 py-3 rounded-xl font-black text-[11px] md:text-sm transition-all whitespace-nowrap ${tab === 'u' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>권한</button>}
        {canManageUsers && <button onClick={() => setTab('s')} className={`shrink-0 px-5 md:px-10 py-3 rounded-xl font-black text-[11px] md:text-sm transition-all whitespace-nowrap ${tab === 's' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>앱설정</button>}
        {hasFeedbackViewPermission && (
          <button onClick={() => setTab('f')} className={`shrink-0 px-5 md:px-10 py-3 rounded-xl font-black text-[11px] md:text-sm transition-all whitespace-nowrap flex items-center gap-1.5 ${tab === 'f' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-outline hover:text-[#0f172a]'}`}>
            <span>건의사항</span>
            {feedbacks.length > 0 && (
              <span className="px-1.5 py-0.5 bg-[#059669] text-white text-[9px] font-black rounded-full leading-none shrink-0 min-w-4 text-center">
                {feedbacks.length}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="bg-white rounded-[24px] md:rounded-[40px] border border-outline-variant shadow-xl shadow-surface-container-high/50 overflow-hidden">
        {tab === 'p' && (
          <div className="p-3 md:p-10 space-y-6 md:space-y-12">
            {/* 1. Registration Form (TOP) */}
            {canEditItems ? (
              <div id="item-form" className="max-w-2xl mx-auto space-y-4 md:space-y-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-0.5">
                    <h3 className="text-sm md:text-lg font-black text-[#0f172a] tracking-tight text-left">
                      {editingItemId ? '상품 정보 수정' : '신규 상품 등록'}
                    </h3>
                    <p className="text-[8px] md:text-[10px] font-black text-outline uppercase tracking-widest text-left">
                      {editingItemId ? 'UPDATE MASTER ITEM INFO' : 'REGISTER NEW MASTER ITEM'}
                    </p>
                  </div>
                  
                  {/* Smaller Partner Selection moved to Top Right */}
                  <div className="w-full md:w-64 space-y-1 relative">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-tight ml-1 flex items-center gap-1">
                      <Users className="w-3 h-3 text-primary" /> 주거래처
                    </label>
                    <div className="relative group">
                      <input 
                        placeholder="거래처 선택 또는 직접 입력" 
                        value={itemForm.partner} 
                        onChange={e => setItemForm({...itemForm, partner: e.target.value})} 
                        onFocus={() => setShowPartnerOptions(true)}
                        className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-xs shadow-sm" 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPartnerOptions(!showPartnerOptions)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-outline hover:text-primary transition-colors"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${showPartnerOptions ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {showPartnerOptions && (
                      <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200 max-h-56 overflow-y-auto">
                        {partners?.length > 0 ? (
                          (() => {
                            const selectedPartners = itemForm.partner
                              ? itemForm.partner.split(',').map((s: any) => s.trim()).filter(Boolean)
                              : [];
                            return partners.map((p: any) => {
                              const isSelected = selectedPartners.includes(p.name);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    let newSelected;
                                    if (isSelected) {
                                      newSelected = selectedPartners.filter((name: string) => name !== p.name);
                                    } else {
                                      newSelected = [...selectedPartners, p.name];
                                    }
                                    setItemForm({...itemForm, partner: newSelected.join(', ')});
                                  }}
                                  className={`w-full h-11 flex items-center justify-between px-5 text-xs font-bold hover:bg-[#f1f4f9] transition-colors ${isSelected ? 'bg-primary/5 text-primary' : 'text-slate-600'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="checkbox" 
                                      checked={isSelected} 
                                      onChange={() => {}} // pure click handled by parent button
                                      className="w-4 h-4 rounded text-primary border-outline-variant focus:ring-primary pointer-events-none" 
                                    />
                                    <span>{p.name}</span>
                                  </div>
                                </button>
                              );
                            });
                          })()
                        ) : (
                          <div className="px-5 py-4 text-[10px] font-bold text-outline text-center">등록된 거래처가 없습니다</div>
                        )}
                        <div className="px-5 py-2 bg-slate-50 text-[9px] font-black text-outline/50 uppercase text-center border-t border-outline-variant/10">직접 입력 시 쉼표(,)로 구분 가능</div>
                      </div>
                    )}
                  </div>
                </div>
                
                <form onSubmit={handleRegisterItem} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-12 gap-y-3 md:gap-y-6">
                  {/* Row 1: SKU & Name */}
                  <div className="space-y-1 relative">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">SKU 번호</label>
                    <div className="relative group">
                      <input 
                        placeholder="예: P-001" 
                        value={itemForm.sku} 
                        onChange={e => setItemForm({...itemForm, sku: e.target.value.toUpperCase()})} 
                        className="w-full h-10 md:h-12 px-3.5 md:px-5 pr-10 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-xs shadow-sm" 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowSkuOptions(!showSkuOptions)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-outline hover:text-primary transition-colors"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSkuOptions ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {showSkuOptions && (
                      <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="px-4 py-2 bg-[#f8fafc] text-[8px] md:text-[10px] font-black text-outline uppercase tracking-widest">자동 번호 부여</div>
                        {[
                          { label: '부속물', prefix: 'O', category: '부속물' },
                          { label: '돼지고기', prefix: 'P', category: '돼지고기' },
                          { label: '소고기', prefix: 'C', category: '소고기' },
                          { label: '원육', prefix: 'R', category: '원육' }
                        ].map((opt) => (
                          <button
                            key={opt.prefix}
                            type="button"
                            onClick={() => {
                              const newSku = getNextSku(opt.prefix);
                              setItemForm({ ...itemForm, sku: newSku, category: opt.category });
                              setShowSkuOptions(false);
                            }}
                            className="w-full h-9 md:h-11 flex items-center justify-between px-4 text-xs font-bold hover:bg-[#f1f4f9] transition-colors text-slate-600"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-8 text-left font-black text-primary">{opt.prefix}-</span>
                              <span>{opt.label}</span>
                            </div>
                            <div className="text-[8px] md:text-[10px] font-black text-outline/50">{getNextSku(opt.prefix)} 예정</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">품목명</label>
                    <input placeholder="예: 프리미엄 티본" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="w-full h-10 md:h-12 px-3.5 md:px-5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-xs shadow-sm" />
                  </div>

                  {/* Row 2: Category & Brand */}
                  <div className="space-y-1 relative">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">카테고리</label>
                    <button 
                      type="button"
                      onClick={() => setShowCategoryOptions(!showCategoryOptions)}
                      className="w-full h-10 md:h-12 px-3.5 md:px-5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold flex items-center justify-between outline-none focus:border-primary focus:bg-white transition-all group shadow-sm text-xs"
                    >
                      <span className="text-primary text-xs">{itemForm.category || '선택'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-outline group-hover:text-primary transition-transform ${showCategoryOptions ? 'rotate-180' : ''}`} />
                    </button>
                    {showCategoryOptions && (
                      <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-outline-variant rounded-xl md:rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200">
                        {['원육', '돼지고기', '소고기', '부속물', '기타'].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setItemForm({...itemForm, category: c, unit: c === '원육' ? 'BOX' : itemForm.unit.toUpperCase()});
                              setShowCategoryOptions(false);
                            }}
                            className={`w-full h-10 md:h-11 flex items-center justify-between px-4 text-xs md:text-sm font-bold hover:bg-[#f1f4f9] transition-colors ${itemForm.category === c ? 'bg-primary/5 text-primary' : 'text-slate-600'}`}
                          >
                            <span>{c}</span>
                            {itemForm.category === c && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 relative">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">브랜드</label>
                    <div className="relative">
                      <input 
                        placeholder="브랜드 선택 또는 입력" 
                        value={itemForm.brand} 
                        onChange={e => setItemForm({...itemForm, brand: e.target.value})} 
                        onFocus={() => setShowBrandOptions(true)}
                        className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-xs shadow-sm" 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowBrandOptions(!showBrandOptions)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-outline hover:text-primary transition-colors"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBrandOptions ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {showBrandOptions && (
                      <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200 max-h-48 overflow-y-auto">
                        {brands.length > 0 ? (
                          brands.map((b) => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => {
                                setItemForm({...itemForm, brand: b});
                                setShowBrandOptions(false);
                              }}
                              className={`w-full h-10 flex items-center justify-between px-4 text-xs font-bold hover:bg-[#f1f4f9] transition-colors ${itemForm.brand === b ? 'bg-primary/5 text-primary' : 'text-slate-600'}`}
                            >
                              <span>{b}</span>
                              {itemForm.brand === b && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs font-bold text-outline text-center">등록된 브랜드가 없습니다</div>
                        )}
                        <div className="px-4 py-1.5 bg-slate-50 text-[9px] font-black text-outline/50 uppercase text-center border-t border-outline-variant/10">직접 입력 가능</div>
                      </div>
                    )}
                  </div>

                  {/* Row 3: Specs & Unit */}
                  <div className="space-y-1">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">규격 (Specs)</label>
                    <input placeholder="예: 250g/팩, 10kg/박스" value={itemForm.specs} onChange={e => setItemForm({...itemForm, specs: e.target.value})} className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-xs shadow-sm" />
                  </div>
                  <div className="space-y-1 relative">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">단위</label>
                    <button 
                      type="button"
                      onClick={() => setShowUnitOptions(!showUnitOptions)}
                      className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold flex items-center justify-between outline-none focus:border-primary focus:bg-white transition-all group shadow-sm text-xs"
                    >
                      <span className="text-primary text-xs">{itemForm.unit}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-outline group-hover:text-primary transition-transform ${showUnitOptions ? 'rotate-180' : ''}`} />
                    </button>
                    {showUnitOptions && (
                      <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-200">
                        {['BOX', 'EA', 'KG', 'G'].map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => {
                              setItemForm({...itemForm, unit: u});
                              setShowUnitOptions(false);
                            }}
                            className={`w-full h-10 flex items-center justify-between px-4 text-xs font-bold hover:bg-[#f1f4f9] transition-colors ${itemForm.unit === u ? 'bg-primary/5 text-primary' : 'text-slate-600'}`}
                          >
                            <span>{u}</span>
                            {itemForm.unit === u && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Row 4: Stocks */}
                  <div className="space-y-1">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">현재 재고 ({itemForm.unit})</label>
                    <input 
                      type="text" 
                      value={formatWithCommas(itemForm.currentStock)} 
                      onChange={e => {
                        const val = e.target.value;
                        let cleaned = val.replace(/(?!^)-/g, '').replace(/[^0-9.-]/g, '');
                        const parts = cleaned.split('.');
                        if (parts.length > 2) {
                          cleaned = parts[0] + '.' + parts.slice(1).join('');
                        }
                        const dotIndex = cleaned.indexOf('.');
                        if (dotIndex !== -1) {
                          cleaned = cleaned.substring(0, dotIndex + 1) + cleaned.substring(dotIndex + 1, dotIndex + 3);
                        }
                        setItemForm({...itemForm, currentStock: cleaned});
                      }} 
                      className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all text-xs shadow-sm" 
                    />
                  </div>
                  {itemForm.category === '원육' && (
                    <div className="space-y-1 font-bold text-xs">
                      <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">현재 {['KG', 'G'].includes((itemForm.unit || '').toUpperCase()) ? '박스' : (itemForm.unit || 'BOX').toUpperCase()} 수</label>
                      <input 
                        type="text" 
                        value={formatWithCommas(itemForm.boxes)} 
                        onChange={e => setItemForm({...itemForm, boxes: e.target.value.replace(/[^0-9]/g, '')})} 
                        className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all text-xs shadow-sm" 
                        placeholder="0"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">안전 재고</label>
                    <input 
                      type="text" 
                      value={formatWithCommas(itemForm.safetyStock)} 
                      onChange={e => {
                        const val = e.target.value;
                        let cleaned = val.replace(/(?!^)-/g, '').replace(/[^0-9.-]/g, '');
                        const parts = cleaned.split('.');
                        if (parts.length > 2) {
                          cleaned = parts[0] + '.' + parts.slice(1).join('');
                        }
                        const dotIndex = cleaned.indexOf('.');
                        if (dotIndex !== -1) {
                          cleaned = cleaned.substring(0, dotIndex + 1) + cleaned.substring(dotIndex + 1, dotIndex + 3);
                        }
                        setItemForm({...itemForm, safetyStock: cleaned});
                      }} 
                      className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all text-xs shadow-sm" 
                    />
                  </div>

                  {/* Row 5: Prices - Sales Price moved up */}
                  <div className="space-y-1">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">매입 단가 (원)</label>
                    <input 
                      type="text" 
                      placeholder={canEditPrices ? "예: 25,000" : "권한 없음"} 
                      disabled={!canEditPrices} 
                      value={formatWithCommas(itemForm.purchasePrice)} 
                      onChange={e => setItemForm({...itemForm, purchasePrice: e.target.value.replace(/[^0-9]/g, '')})} 
                      className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 disabled:bg-slate-100/50 text-xs shadow-sm" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1">판매 단가 (원)</label>
                    <input 
                      type="text" 
                      placeholder={canEditPrices ? "예: 38,000" : "권한 없음"} 
                      disabled={!canEditPrices} 
                      value={formatWithCommas(itemForm.salesPrice)} 
                      onChange={e => setItemForm({...itemForm, salesPrice: e.target.value.replace(/[^0-9]/g, '')})} 
                      className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 disabled:bg-slate-100/50 text-xs shadow-sm" 
                    />
                  </div>

                  {/* Row 6: Dates - Expiry moved up */}
                  <div className="space-y-1 flex flex-col">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-emerald-500" /> 제조일자
                    </label>
                    <input type="date" value={itemForm.manufDate} onChange={e => setItemForm({...itemForm, manufDate: e.target.value})} className="w-full h-10 md:h-12 px-3 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all text-xs shadow-sm" />
                  </div>
                  <div className="space-y-1 flex flex-col">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-rose-500" /> 소비기한
                    </label>
                    <div className="space-y-1.5">
                      <input type="date" value={itemForm.expiryDate} onChange={e => setItemForm({...itemForm, expiryDate: e.target.value})} className="w-full h-10 md:h-12 px-3 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all text-xs shadow-sm" />
                      <div className="flex flex-wrap gap-1 px-1">
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
                            className="px-2 py-0.5 bg-slate-100 hover:bg-white border border-transparent hover:border-outline-variant/30 text-slate-500 hover:text-primary rounded-md text-[9px] font-black transition-all active:scale-[0.95]"
                          >
                            {m >= 12 ? `${m / 12}년` : `${m}개월`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Row 7: Average Weight */}
                  <div className="space-y-1 flex flex-col">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1 flex items-center gap-1.5">
                       <Scale className="w-3.5 h-3.5 text-primary" /> 박스당 평균 무게 (KG)
                    </label>
                    <input 
                      placeholder="예: 20.5 (원육의 경우 설정)" 
                      value={itemForm.avgWeight || ''} 
                      onChange={e => setItemForm({...itemForm, avgWeight: e.target.value.replace(/[^0-9.]/g, '')})} 
                      className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-xs shadow-sm" 
                    />
                  </div>

                  {/* Row 8: Storage Location */}
                  <div className="space-y-1 flex flex-col">
                    <label className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1 flex items-center gap-1.5">
                       <MapPin className="w-3.5 h-3.5 text-primary" /> 보관 위치
                    </label>
                    <input 
                      placeholder="예: A구역 / 냉동고-1" 
                      value={itemForm.location} 
                      onChange={e => setItemForm({...itemForm, location: e.target.value})} 
                      className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 text-xs shadow-sm" 
                    />
                  </div>

                  <div className="md:col-span-2 pt-2 flex flex-col sm:flex-row gap-2">
                    <button type="submit" className="flex-1 h-11 md:h-12 bg-[#0f172a] text-white rounded-xl font-black text-xs md:text-sm tracking-tight shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-[0.98]">
                      {editingItemId ? '정보 수정 완료' : '상품등록'}
                    </button>
                    {editingItemId && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingItemId(null);
                          setItemForm({ sku: '', name: '', category: '돼지고기', brand: '', specs: '', unit: 'BOX', boxes: '', currentStock: '', safetyStock: '', purchasePrice: '', salesPrice: '', manufDate: '', expiryDate: '', location: '', detailLocation: '', partner: '', avgWeight: '' });
                        }}
                        className="w-full sm:w-36 h-11 md:h-12 bg-rose-50 text-rose-600 rounded-xl font-black text-xs md:text-sm shadow-sm hover:bg-rose-100 transition-all active:scale-[0.98]"
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
            <div id="items-list" className="space-y-6 md:space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
                <div>
                  <h3 className="text-base md:text-xl font-black text-[#0f172a] tracking-tight flex items-center gap-2">
                    등록된 상품
                    <span className="text-[11px] font-black bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                      {filteredItems.length}개
                    </span>
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-black text-outline uppercase tracking-widest mt-0.5">MASTER INVENTORY ITEMS</p>
                </div>

                {isSuperAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetAllLogistics}
                      className="h-10 px-4 md:px-5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm active:scale-95"
                      id="btn-reset-all-logistics"
                    >
                      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      물류 내역 일괄 초기화
                    </button>

                    <button
                      type="button"
                      onClick={handleResetAllInventory}
                      className="h-10 px-4 md:px-5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm active:scale-95"
                      id="btn-reset-all-inventory"
                    >
                      <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      재고 일괄 리셋 (0으로 초기화)
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-6 md:space-y-8">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select 
                    value={filterCategory} 
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="h-10 px-3 bg-white border border-outline-variant rounded-xl text-xs font-bold outline-none focus:border-primary transition-all shadow-sm"
                  >
                    <option value="">전체 카테고리</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <select 
                    value={filterBrand} 
                    onChange={(e) => setFilterBrand(e.target.value)}
                    className="h-10 px-3 bg-white border border-outline-variant rounded-xl text-xs font-bold outline-none focus:border-primary transition-all shadow-sm"
                  >
                    <option value="">전체 브랜드</option>
                    {brands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>

                  <select 
                    value={filterPartner} 
                    onChange={(e) => setFilterPartner(e.target.value)}
                    className="h-10 px-3 bg-white border border-outline-variant rounded-xl text-xs font-bold outline-none focus:border-primary transition-all shadow-sm"
                  >
                    <option value="">전체 거래처</option>
                    {itemPartners.map(partner => (
                      <option key={partner} value={partner}>{partner}</option>
                    ))}
                  </select>

                  <div className="relative group flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
                    <input type="text" placeholder="상품명, SKU 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-3 bg-white border border-outline-variant rounded-xl text-xs font-bold outline-none focus:border-primary focus:bg-slate-50 transition-all shadow-sm" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl md:rounded-[24px] border border-outline-variant overflow-hidden shadow-sm p-2 md:p-0">
                  <div className="w-full">
                    {/* Desktop View Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-[#f0f4f8] text-[11px] font-black text-[#0f172a]/60 uppercase tracking-widest border-b border-outline-variant/50">
                          <tr>
                            <th className="px-6 py-5 text-left">코드/품목명</th>
                            <th className="px-4 py-5 text-center">카테고리</th>
                            <th className="px-4 py-5 text-center">주거래처</th>
                            <th className="px-4 py-5 text-center">단위</th>
                            <th className="px-4 py-5 text-center">현재고</th>
                            <th className="px-4 py-5 text-center">현재박스/수량</th>
                            <th className="px-4 py-5 text-center">안전재고</th>
                            <th className="px-4 py-5 text-center">위치</th>
                            <th className="px-6 py-5 text-right">관리</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                          {paginatedItems.length > 0 ? (
                            paginatedItems.map((item: any) => (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <div className="font-black text-[#0f172a]">{item.name}</div>
                                      {item.brand && <div className="text-[10px] font-black text-primary mt-0.5">{item.brand}</div>}
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-bold text-outline uppercase">{item.sku || '-'}</span>
                                        {item.specs && <span className="text-[10px] font-black text-emerald-500/70">| {item.specs}</span>}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-5 text-center"><span className="px-3 py-1 bg-surface-container rounded-lg text-[10px] font-black text-outline uppercase">{item.category || '-'}</span></td>
                                <td className="px-4 py-5 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className="text-xs font-bold text-slate-600">{item.partner || '-'}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-5 text-center text-sm font-bold">{item.unit || '-'}</td>
                                <td className="px-4 py-5 text-center">
                                  <span className={`font-black ${item.currentStock <= item.safetyStock ? 'text-rose-500' : 'text-[#0f172a]'}`}>
                                    {item.currentStock?.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-5 text-center">
                                  <span className="font-black text-[#0f172a]">
                                    {item.category === '원육' ? `${(item.boxes || 0).toLocaleString()} ${['KG', 'G'].includes((item.unit || '').toUpperCase()) ? 'BOX' : (item.unit || 'BOX').toUpperCase()}` : '-'}
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
                            <tr><td colSpan={7} className="py-20 text-center opacity-40"><p className="font-black text-xl">등록된 상품이 없습니다.</p></td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4 p-2">
                      {paginatedItems.length > 0 ? (
                        paginatedItems.map((item: any) => {
                          const isShortage = item.currentStock <= (item.safetyStock || 0);
                          return (
                            <div key={item.id} className={`bg-white p-5 rounded-[28px] border ${isShortage ? 'border-rose-200 bg-rose-50/20' : 'border-outline-variant/60'} shadow-sm space-y-4 relative overflow-hidden group transition-all active:bg-slate-50`}>
                              {isShortage && <div className="absolute top-0 right-0 px-3 py-1 bg-rose-500 text-white text-[8px] font-black rounded-bl-xl uppercase tracking-widest animate-pulse shadow-sm">Low Stock</div>}
                              
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1.5 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap text-left">
                                    <span className="text-[10px] font-black text-primary font-mono bg-primary/5 px-2 py-0.5 rounded-lg">{item.sku || 'NO-SKU'}</span>
                                    <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-[9px] font-black text-outline uppercase">{item.category}</span>
                                  </div>
                                  <h4 className="text-lg font-black text-[#0f172a] leading-tight truncate text-left">{item.name}</h4>
                                  <div className="flex items-center gap-2 flex-wrap text-left">
                                    {item.brand && <p className="text-[10px] font-bold text-outline-variant">{item.brand}</p>}
                                    {item.partner && (
                                      <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                                        <Users className="w-2.5 h-2.5" /> {item.partner}
                                      </p>
                                    )}
                                    {item.specs && <p className="text-[10px] font-black text-emerald-500/70">{item.specs}</p>}
                                  </div>
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
                              
                              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100/60 text-left">
                                <div className="space-y-1">
                                    <div className="text-[9px] font-black text-outline uppercase tracking-wider">현재 재고</div>
                                    <div className={`text-base font-black ${isShortage ? 'text-rose-500' : 'text-[#0f172a]'}`}>
                                      {item.currentStock?.toLocaleString()} <span className="text-[11px] font-bold opacity-40 ml-0.5">{item.unit}</span>
                                    </div>
                                    {item.category === '원육' && (
                                      <div className="text-[10px] font-black text-slate-400">
                                        {(item.boxes || 0).toLocaleString()} {['KG', 'G'].includes((item.unit || '').toUpperCase()) ? 'BOX' : (item.unit || 'BOX').toUpperCase()}
                                      </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[9px] font-black text-outline uppercase tracking-wider">보관 위치</div>
                                    <div className="text-sm font-black text-[#1e293b] truncate">
                                      {item.location || '미지정'}
                                    </div>
                                </div>
                              </div>

                              {canEditPrices && (
                                <div className="flex items-center gap-4 py-3 px-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                  <div className="flex-1 text-left">
                                    <div className="text-[8px] font-black text-outline uppercase mb-0.5">매입가</div>
                                    <div className="text-[11px] font-black text-slate-600">₩{item.purchasePrice?.toLocaleString()}</div>
                                  </div>
                                  <div className="w-px h-6 bg-slate-200"></div>
                                  <div className="flex-1 text-left">
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
                           <p className="text-sm font-black text-[#0f172a]">등록된 상품이 없습니다</p>
                        </div>
                      )}
                    </div>

                    <Pagination current={currentPage} total={totalPages} totalItems={filteredItems.length} itemsPerPage={ITEMS_PER_PAGE} onChange={setCurrentPage} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === 't' && (
          <div className="p-3 md:p-10 space-y-6 md:space-y-12">
             <div className="max-w-2xl mx-auto w-full bg-white border border-outline-variant/30 rounded-2xl md:rounded-[32px] shadow-sm p-3.5 md:p-10 space-y-4 md:space-y-8">
                <div className="text-center space-y-0.5">
                  <h3 className="text-sm md:text-xl font-black text-[#0f172a] tracking-tight">{editingPartnerId ? '거래처 정보 수정' : '신규 거래처 등록'}</h3>
                  <p className="text-[8px] md:text-[10px] font-black text-outline uppercase tracking-widest">{editingPartnerId ? 'UPDATE PARTNER INFO' : 'REGISTER NEW PARTNER'}</p>
                  <div className="w-10 h-1 bg-blue-100 mx-auto rounded-full mt-1.5 md:mt-3"></div>
                </div>

                <form onSubmit={handleRegisterPartner} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 md:gap-y-6">
                  <div className="space-y-1">
                    <label className="text-[9px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">거래처명</label>
                    <input placeholder="예: (주)한울미트" value={partnerForm.name} onChange={e => setPartnerForm({...partnerForm, name: e.target.value})} className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 shadow-sm text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">유형</label>
                    <div className="relative">
                      <select value={partnerForm.type} onChange={e => setPartnerForm({...partnerForm, type: e.target.value})} className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all shadow-sm cursor-pointer appearance-none text-xs">
                        <option value="공급사">공급사</option>
                        <option value="고객사">고객사</option>
                        <option value="운송사">운송사</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">연락처</label>
                    <input placeholder="예: 010-1234-5678" value={partnerForm.phone} onChange={e => setPartnerForm({...partnerForm, phone: e.target.value})} className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 shadow-sm text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] md:text-[11px] font-black text-[#0f172a] uppercase tracking-widest ml-1">주소</label>
                    <input placeholder="예: 경기도 안양시..." value={partnerForm.address} onChange={e => setPartnerForm({...partnerForm, address: e.target.value})} className="w-full h-10 md:h-12 px-3.5 bg-slate-50/50 border border-outline-variant/60 rounded-xl font-bold focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline-variant/40 shadow-sm text-xs" />
                  </div>
                  <div className="md:col-span-2 flex flex-col sm:flex-row gap-2 pt-2">
                    <button type="submit" className="flex-1 h-11 md:h-12 bg-primary text-white rounded-xl font-black text-xs md:text-sm tracking-tight shadow-xl shadow-blue-500/10 hover:bg-blue-600 transition-all active:scale-95">{editingPartnerId ? '수정 완료' : '거래처 등록하기'}</button>
                    {editingPartnerId && <button type="button" onClick={() => { setEditingPartnerId(null); setPartnerForm({ name: '', type: '공급사', phone: '', address: '' }); }} className="w-full sm:w-36 h-11 md:h-12 bg-rose-50 text-rose-600 rounded-xl font-black text-xs md:text-sm shadow-sm hover:bg-rose-100 transition-all">취소</button>}
                  </div>
                </form>
             </div>

             <hr className="border-outline-variant/20" />
             <div className="space-y-6 md:space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div><h3 className="text-xl md:text-2xl font-black text-[#0f172a]">거래처</h3></div>
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
                  <div className="md:hidden space-y-3 p-1">
                    {(() => {
                      const filtered = partners.filter((p: any) => 
                        p.name.toLowerCase().includes(partnerSearch.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        return <div className="py-12 text-center opacity-30 text-sm font-black italic">PARTNERS NO RESULTS</div>;
                      }
                      return filtered.slice(0, showAllPartners ? undefined : 5).map((p: any) => (
                        <div key={p.id} className="bg-white p-4 rounded-[24px] border border-outline-variant/60 shadow-sm space-y-3 relative overflow-hidden active:scale-[0.98] transition-all">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="text-[8px] font-black text-primary uppercase tracking-wider bg-primary/5 px-1.5 py-0.5 rounded w-fit border border-primary/10">{p.type}</div>
                              <h4 className="text-sm font-black text-[#0f172a] truncate">{p.name}</h4>
                              <div className="text-[9px] font-black text-outline-variant flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{p.phone || '연락처 정보 없음'}</div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => handleEditPartner(p)} className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl active:bg-primary/10 active:text-primary transition-all">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeletePartner(p.id, p.name)} className="w-9 h-9 flex items-center justify-center bg-rose-50 text-rose-400 rounded-xl active:bg-rose-100 active:text-rose-600 transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-slate-50 text-[9px] font-bold text-outline leading-tight truncate"><MapPin className="inline w-2.5 h-2.5 mr-1 align-baseline text-on-surface/40" />{p.address || '주소 정보 없음'}</div>
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
          <div className="p-3 md:p-10 space-y-6 md:space-y-12">
             <div className="max-w-2xl mx-auto w-full bg-[#f8fafc] p-3.5 md:p-8 rounded-2xl md:rounded-[32px] border border-outline-variant space-y-3 md:space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="text-center lg:text-left">
                    <h3 className="text-sm md:text-lg font-black text-[#0f172a] tracking-tight">신규 관리자 등록</h3>
                    <p className="text-[8px] md:text-[10px] font-black text-outline uppercase tracking-widest mt-0.5">REGISTER NEW ADMINISTRATOR EMAIL</p>
                  </div>
                  <form onSubmit={handleRegisterAdmin} className="flex-1 w-full max-w-2xl flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                      <input type="email" placeholder="등록할 관리자 이메일을 입력하세요" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} className="w-full h-10 md:h-12 pl-10 pr-4 bg-white border border-outline-variant rounded-xl font-bold outline-none focus:border-primary transition-all shadow-sm text-xs" />
                    </div>
                    <button type="submit" className="h-10 md:h-12 px-6 bg-[#0f172a] text-white rounded-xl font-black text-xs hover:bg-slate-800 transition-all shadow-lg active:scale-95 whitespace-nowrap">
                      등록하기
                    </button>
                  </form>
                </div>
             </div>
             
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-4 md:pb-8">
               <div>
                 <h3 className="text-sm md:text-2xl font-black text-[#0f172a] tracking-tight flex items-center gap-2">계정 권한 관리</h3>
                 <p className="text-[8px] md:text-[10px] font-black text-outline uppercase tracking-widest mt-0.5">USER ACCESS CONTROL</p>
               </div>
               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative group w-full sm:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input 
                      type="text" 
                      placeholder="이름 또는 이메일 검색..." 
                      value={userSearch} 
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setUserPage(1);
                      }} 
                      className="w-full h-10 md:h-12 pl-10 pr-4 bg-white border border-outline-variant rounded-xl text-xs font-bold outline-none focus:border-primary focus:bg-slate-50 transition-all shadow-sm" 
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2 px-6 h-10 md:h-12 bg-white border border-outline-variant rounded-xl text-xs font-black text-[#0f172a] shadow-sm select-none">
                    등록 계정: {allUsers.filter((u: any) => u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase())).length}명
                  </div>
               </div>
             </div>

             <div className="grid grid-cols-1 md:gap-6 space-y-3 md:space-y-0">
               {(() => {
                 const filteredUsers = allUsers.filter((u: any) => u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()));
                 const USERS_PER_PAGE = 10;
                 const paginatedUsers = filteredUsers.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);

                 if (filteredUsers.length === 0) {
                   return (
                     <div className="py-16 text-center text-outline text-xs md:text-sm font-black italic">
                       검색 조건에 맞는 관리자 계정이 존재하지 않습니다.
                     </div>
                   );
                 }

                 return paginatedUsers.map((u: any) => (
                   <div key={u.id} className="bg-white md:bg-[#f8fafc] p-3 md:p-6 rounded-[20px] md:rounded-[32px] border border-outline-variant/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-8 hover:bg-white hover:border-primary transition-all shadow-sm md:shadow-none">
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
                       {canManageUsers && (
                         <>
                           <div className="h-6 w-px bg-outline-variant/30"></div>
                           <label className="flex items-center gap-1.5 cursor-pointer shrink-0 select-none">
                             <input 
                               type="checkbox" 
                               checked={u.canViewFeedback === true || u.role === 'super_admin'} 
                               disabled={!canManageUsers || u.email === 'crucify87@gmail.com' || u.role === 'super_admin'}
                               onChange={() => handleToggleFeedbackPermission(u.id, u.canViewFeedback || false)}
                               className="w-4.5 h-4.5 text-emerald-600 focus:ring-emerald-500 border-outline-variant rounded transition-all cursor-pointer accent-[#059669] disabled:opacity-50"
                             />
                             <span className="text-[10px] md:text-xs font-black text-slate-650 whitespace-nowrap">피드백 조회</span>
                           </label>
                         </>
                       )}
                       {canManageUsers && u.email !== user?.email && u.email !== 'crucify87@gmail.com' && (
                         <button onClick={() => handleDeleteUser(u.id, u.email)} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90" title="계정 삭제">
                           <Trash2 className="w-4.5 h-4.5 md:w-5 md:h-5" />
                         </button>
                       )}
                     </div>
                   </div>
                 ));
               })()}
             </div>

             {/* Dynamic Pagination Controls */}
             {(() => {
               const filteredUsers = allUsers.filter((u: any) => u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()));
               const USERS_PER_PAGE = 10;
               const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
               
               if (totalPages <= 1) return null;

               return (
                 <div className="flex items-center justify-center gap-1.5 md:gap-2 pt-6">
                   <button
                     onClick={() => setUserPage((prev) => Math.max(prev - 1, 1))}
                     disabled={userPage === 1}
                     className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center border border-outline-variant/60 bg-white rounded-lg md:rounded-xl text-[#0f172a] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.95]"
                     title="이전 페이지"
                   >
                     <ChevronLeft className="w-4 h-4" />
                   </button>
                   {Array.from({ length: totalPages }).map((_, idx) => {
                     const pageNum = idx + 1;
                     return (
                       <button
                         key={pageNum}
                         onClick={() => setUserPage(pageNum)}
                         className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-xs font-black rounded-lg md:rounded-xl transition-all active:scale-[0.95] ${
                           userPage === pageNum
                             ? 'bg-[#0f172a] text-white shadow-md shadow-slate-900/10'
                             : 'bg-white border border-outline-variant/60 text-[#0f172a] hover:bg-slate-50'
                         }`}
                       >
                         {pageNum}
                       </button>
                     );
                   })}
                   <button
                     onClick={() => setUserPage((prev) => Math.min(prev + 1, totalPages))}
                     disabled={userPage === totalPages}
                     className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center border border-outline-variant/60 bg-white rounded-lg md:rounded-xl text-[#0f172a] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.95]"
                     title="다음 페이지"
                   >
                     <ChevronRight className="w-4 h-4" />
                   </button>
                 </div>
               );
             })()}

             
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
        {tab === 's' && (
          <div className="p-4 md:p-10 space-y-8 md:space-y-12">
            <div className="max-w-xl mx-auto space-y-8">
              <div className="text-center space-y-1">
                <h3 className="text-sm md:text-xl font-black text-[#0f172a] tracking-tight">앱 로고 및 정보 변경</h3>
                <p className="text-[9px] md:text-[10px] font-black text-outline uppercase tracking-widest">APPLICATION BRANDING & SETTINGS</p>
                <div className="w-10 h-1 bg-primary/20 mx-auto rounded-full mt-2"></div>
              </div>

              <form onSubmit={handleSaveAppSettings} className="space-y-6">
                {/* Logo Preview */}
                <div className="flex flex-col items-center gap-4 p-4 md:p-8 bg-slate-50/50 rounded-2xl md:rounded-[32px] border border-outline-variant/40">
                  <div className="text-[9px] md:text-[10px] font-black text-outline uppercase tracking-widest">로고 미리보기 (PREVIEW)</div>
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-2xl p-4 flex items-center justify-center shadow-md border border-slate-100">
                    <img src={logoUrl || "/IMA512.png"} className="max-w-full max-h-full object-contain" alt="Logo Preview" />
                  </div>
                  <div className="text-center space-y-0.5">
                    <p className="text-[10px] md:text-[11px] font-bold text-slate-500">200x200 이상 PNG/JPG 권장</p>
                    <p className="text-[9px] md:text-[10px] text-primary/60 font-black">브라우저 아이콘도 함께 변경됩니다</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-1">
                    <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1 flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5 text-primary" /> 로고 이미지 첨부
                    </label>
                    <div className="relative">
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label 
                        htmlFor="logo-upload"
                        className="w-full h-11 md:h-14 px-4 md:px-6 bg-white border border-outline-variant/60 rounded-xl md:rounded-2xl font-bold flex items-center justify-between cursor-pointer hover:border-primary hover:bg-slate-50 transition-all shadow-sm group text-xs md:text-sm"
                      >
                        <span className="text-xs text-slate-600 truncate mr-4">
                          {logoUrl.startsWith('data:') ? '새 이미지 분석됨' : (logoUrl ? '현재 사용 중인 이미지' : '이미지 선택...')}
                        </span>
                        <div className="shrink-0 flex items-center gap-1 text-primary font-black text-[10px] md:text-[11px] uppercase tracking-wider">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>파일 선택</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-tight ml-1 flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-primary" /> 시스템 명칭
                    </label>
                    <input 
                      placeholder="재고 관리 시스템" 
                      value={appName} 
                      onChange={e => setAppName(e.target.value)} 
                      className="w-full h-11 md:h-14 px-4 md:px-6 bg-white border border-outline-variant/60 rounded-xl md:rounded-2xl font-bold focus:border-primary outline-none transition-all placeholder:text-outline-variant/30 text-xs md:text-sm shadow-sm" 
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={savingSettings}
                  className="w-full h-12 md:h-14 bg-[#0f172a] text-white rounded-xl md:rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingSettings ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : '설정 저장하기'}
                </button>
              </form>
            </div>
          </div>
        )}

        {tab === 'f' && hasFeedbackViewPermission && (
          <div className="p-3 md:p-10 space-y-6 md:space-y-10 font-sans">
            {/* Header / Intro */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div className="space-y-1">
                <h3 className="font-black text-xl md:text-2xl text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="w-2.5 h-6 bg-[#059669] rounded-full inline-block animate-pulse"></span>
                  접수된 건의사항/피드백
                </h3>
                <p className="text-xs md:text-sm font-bold text-slate-500">
                  사용자분들이 작성해주신 개선 건의사항 및 버그 피드백을 실시간으로 확인하고 관리하는 공간입니다.
                </p>
              </div>
            </div>

            {/* Filter / Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Type Category Filter */}
              <div className="flex flex-wrap gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full md:w-fit overflow-x-auto">
                {['전체', '기능 제안', 'UI/디자인', '오류/버그', '기타'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFeedbackFilterType(t === '전체' ? '' : t)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                      (t === '전체' && !feedbackFilterType) || feedbackFilterType === t
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative flex-1 md:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  placeholder="피드백 내용 또는 작성자 검색..."
                  value={feedbackSearch}
                  onChange={(e) => setFeedbackSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs md:text-sm focus:bg-white focus:border-slate-400 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Loading / Empty Space */}
            {loadingFeedbacks ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-[#059669]/20 border-t-[#059669] rounded-full animate-spin"></div>
                <span className="text-xs font-bold text-slate-400">건의사항 목록 동기화 중...</span>
              </div>
            ) : filteredFeedbacks.length === 0 ? (
              <div className="py-20 border border-dashed border-slate-200 rounded-[28px] flex flex-col items-center justify-center text-center px-4 bg-slate-50/50">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 animate-bounce">
                  <MessageSquarePlus className="w-7 h-7 text-slate-500" />
                </div>
                <p className="font-extrabold text-slate-800 text-base">접수된 건의사항이 없습니다.</p>
                <p className="text-xs font-semibold text-slate-400 mt-1 max-w-sm leading-relaxed">
                  {feedbackFilterType || feedbackSearch 
                    ? '선택하신 필터나 검색어에 해당하는 건의사항이 발견되지 않았습니다.' 
                    : '사이드바 하단 또는 앱설정 하단의 [개선사항 및 피드백 건의] 기능을 사용하여 소중한 한 마디를 남겨주세요.'}
                </p>
                {(feedbackFilterType || feedbackSearch) && (
                  <button
                    onClick={() => {
                      setFeedbackFilterType('');
                      setFeedbackSearch('');
                    }}
                    className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs rounded-xl transition-all"
                  >
                    필터 초기화
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredFeedbacks.map((item: any) => {
                  const typeColors: Record<string, string> = {
                    '기능 제안': 'bg-blue-50 text-blue-600 border-blue-100',
                    'UI/디자인': 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
                    '오류/버그': 'bg-rose-50 text-rose-600 border-rose-100',
                    '기타': 'bg-slate-100 text-slate-600 border-slate-200',
                  };

                  const isConfirmingDelete = deletingFeedbackId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="group border border-slate-100 bg-slate-50/40 rounded-3xl p-5 md:p-6 transition-all duration-300 hover:border-slate-300 hover:bg-white hover:shadow-xl hover:shadow-slate-100/40 flex flex-col justify-between gap-4"
                    >
                      {/* Top Row: Meta & Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-slate-200/65 pb-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] md:text-[11px] font-black border uppercase tracking-wider ${typeColors[item.type] || typeColors['기타']}`}>
                            {item.type}
                          </span>
                          <span className="text-xs md:text-sm font-black text-slate-800">
                            {item.userName || '미정'}
                          </span>
                          <span className="text-xs font-bold text-slate-400 border-l border-slate-200 pl-2 font-mono">
                            {item.userEmail}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] md:text-[11px] font-black text-slate-400 font-mono">
                            {formatFeedbackDate(item.createdAt)}
                          </span>

                          {/* Delete option for authorized users */}
                          {canManageUsers && (
                            <div className="relative">
                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 px-2 py-1 rounded-lg">
                                  <span className="text-[9px] font-black text-rose-600">삭제?</span>
                                  <button
                                    onClick={() => handleConfirmDeleteFeedback(item.id)}
                                    className="px-1.5 py-0.5 bg-rose-600 text-white font-black text-[9px] rounded-md hover:bg-rose-700 transition animate-pulse"
                                  >
                                    예
                                  </button>
                                  <button
                                    onClick={() => setDeletingFeedbackId(null)}
                                    className="px-1.5 py-0.5 bg-white text-slate-500 font-black text-[9px] rounded-md hover:bg-slate-100 border border-slate-200 transition"
                                  >
                                    아니오
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeletingFeedbackId(item.id)}
                                  className="w-7 h-7 rounded-lg hover:bg-rose-50 text-slate-350 hover:text-rose-600 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="건의사항 삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content Box */}
                      <div className="text-xs md:text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap break-words pl-1">
                        {item.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 개선사항 건의 섹션 */}
      <div className="bg-emerald-50/40 border border-emerald-100/80 rounded-[24px] md:rounded-[36px] p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/20 rounded-full blur-2xl -mr-6 -mt-6"></div>
        <div className="space-y-2 relative z-10 max-w-3xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-100/80 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <MessageSquarePlus className="w-4.5 h-4.5" />
            </div>
            <h3 className="text-base md:text-lg font-black text-slate-800 tracking-tight">시스템 품질 향상 및 개선 제안</h3>
          </div>
          <p className="text-xs md:text-sm font-semibold text-slate-500 leading-relaxed pl-1">
            IMA 생산 및 재고 관리 시스템을 사용하면서 발견된 오류 또는 비즈니스 흐름 상 추가가 필요한 기능이 있다면 편하게 말씀해 주세요. 
            소중한 조언을 밑거름 삼아 끊임없이 시스템 사용 환경을 개선해 나가겠습니다.
          </p>
        </div>
        <button
          onClick={() => setFeedbackOpen(true)}
          className="shrink-0 w-full md:w-auto px-6 py-4 bg-[#059669] text-white font-extrabold text-xs md:text-sm rounded-xl md:rounded-2xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/25 hover:bg-emerald-700 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 relative z-10"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>개선사항 및 피드백 건의</span>
        </button>
      </div>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}

export default SettingsContent;
