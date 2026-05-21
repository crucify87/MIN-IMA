import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  doc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError } from '../lib/firestoreUtils';
import { OperationType } from '../types';

export function useAppData(user: any, isSuperAdmin: boolean) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [production, setProduction] = useState<any[]>([]);
  const [logistics, setLogistics] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    // 1. Public Settings (Fetch even if not logged in)
    const unsubSettings = onSnapshot(doc(db, 'settings', 'app'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data());
      }
    }, error => handleFirestoreError(error, OperationType.GET, 'settings/app'));

    if (!user) {
      return () => unsubSettings();
    }

    const qInv = query(collection(db, 'inventory'), orderBy('name'));
    const unsubInv = onSnapshot(qInv, (snap) => {
      setInventory(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'inventory'));

    const qProd = query(collection(db, 'production_batches'), orderBy('manufDate', 'desc'), limit(50));
    const unsubProd = onSnapshot(qProd, (snap) => {
      setProduction(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'production_batches'));

    const qLog = query(collection(db, 'logistics'));
    const unsubLog = onSnapshot(qLog, (snap) => {
      setLogistics(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'logistics'));

    const unsubPartners = onSnapshot(collection(db, 'partners'), (snap) => {
      setPartners(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'partners'));

    let unsubAllUsers: () => void = () => {};
    if (isSuperAdmin) {
      unsubAllUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setAllUsers(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      }, error => handleFirestoreError(error, OperationType.LIST, 'users'));
    }

    return () => {
      unsubSettings();
      unsubInv();
      unsubProd();
      unsubLog();
      unsubPartners();
      unsubAllUsers();
    };
  }, [user, isSuperAdmin]);

  return {
    inventory,
    production,
    logistics,
    partners,
    allUsers,
    settings
  };
}
