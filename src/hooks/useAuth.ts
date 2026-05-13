import { useState, useEffect, useMemo } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = useMemo(() => {
    if (!user?.email) return false;
    if (user.email === 'crucify87@gmail.com') return true;
    return userData?.role === 'super_admin';
  }, [user, userData]);

  const isAdmin = useMemo(() => {
    if (isSuperAdmin) return true;
    return userData?.role === 'admin';
  }, [isSuperAdmin, userData]);

  const isStaff = useMemo(() => {
    if (isAdmin) return true;
    return userData?.role === 'staff' || userData?.role === 'user';
  }, [isAdmin, userData]);

  const canManageUsers = isSuperAdmin;
  const canEditPrices = isSuperAdmin;
  const canViewPrices = isAdmin;
  const canEditItems = isAdmin;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserData(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          setUserData(snap.data());
        } else {
          setUserData({ role: 'staff' });
        }
        setLoading(false);
      });
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const syncProfile = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          const isInitialSuper = user.email === 'crucify87@gmail.com';
          await setDoc(userRef, {
            displayName: user.displayName || user.email?.split('@')[0] || '사용자',
            email: user.email,
            photoURL: user.photoURL,
            updatedAt: serverTimestamp(),
            ...(isInitialSuper ? { role: 'super_admin' } : {})
          }, { merge: true });
        } catch (error) {
          console.error("Error syncing profile:", error);
        }
      };
      syncProfile();
    }
  }, [user]);

  return {
    user,
    userData,
    loading,
    isSuperAdmin,
    isAdmin,
    isStaff,
    permissions: {
      canManageUsers,
      canEditPrices,
      canViewPrices,
      canEditItems,
    }
  };
}
