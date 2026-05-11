import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
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

  useEffect(() => {
    if (!user) return;

    const qInv = query(collection(db, 'inventory'), orderBy('name'));
    const unsubInv = onSnapshot(qInv, (snap) => {
      setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'inventory'));

    const qProd = query(collection(db, 'production_batches'), orderBy('manufDate', 'desc'), limit(50));
    const unsubProd = onSnapshot(qProd, (snap) => {
      setProduction(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'production_batches'));

    const qLog = query(collection(db, 'logistics'), orderBy('createdAt', 'desc'), limit(100));
    const unsubLog = onSnapshot(qLog, (snap) => {
      setLogistics(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'logistics'));

    const unsubPartners = onSnapshot(collection(db, 'partners'), (snap) => {
      setPartners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'partners'));

    let unsubAllUsers: () => void = () => {};
    if (isSuperAdmin) {
      unsubAllUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, error => handleFirestoreError(error, OperationType.LIST, 'users'));
    }

    return () => {
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
    allUsers
  };
}
