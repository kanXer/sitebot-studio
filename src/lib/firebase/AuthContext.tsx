'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './client';

export type UserRole = 'super_admin' | 'admin' | 'user';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemo?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  error: string | null;
  isFirebaseReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsDemoUser: (email?: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER_KEY = 'sitebot_demo_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isFirebaseReady = isFirebaseConfigured();

  // Helper to fetch server-side verified role
  const fetchUserRole = async (email: string | null): Promise<UserRole> => {
    if (!email) return 'user';
    const cleanEmail = email.trim().toLowerCase();

    // Client-side instant check for configured super admin env variable
    const envSuper = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || '')
      .replace(/["']/g, '')
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const fallbackRole: UserRole = envSuper.includes(cleanEmail) ? 'super_admin' : 'user';

    try {
      const res = await fetch(`/api/auth/me?email=${encodeURIComponent(cleanEmail)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        return data.role || fallbackRole;
      }
    } catch (err) {
      console.warn('Failed to verify role with server:', err);
    }
    return fallbackRole;
  };

  const refreshRole = async () => {
    if (user?.email) {
      const serverRole = await fetchUserRole(user.email);
      setRole(serverRole);
    }
  };

  useEffect(() => {
    // 1. Check local storage for demo user
    try {
      const savedDemo = localStorage.getItem(DEMO_USER_KEY);
      if (savedDemo) {
        const parsed = JSON.parse(savedDemo);
        setUser(parsed);
        fetchUserRole(parsed.email).then((r) => {
          setRole(r);
          setLoading(false);
        });
        return;
      }
    } catch {}

    // 2. Listen to real Firebase Auth
    if (auth) {
      const unsubscribe = onAuthStateChanged(
        auth,
        async (fbUser: FirebaseUser | null) => {
          if (fbUser) {
            const mappedUser: AppUser = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
              photoURL: fbUser.photoURL,
              isDemo: false,
            };
            setUser(mappedUser);
            const serverRole = await fetchUserRole(fbUser.email);
            setRole(serverRole);
          } else {
            // Check if demo user was active
            const savedDemo = localStorage.getItem(DEMO_USER_KEY);
            if (!savedDemo) {
              setUser(null);
              setRole(null);
            }
          }
          setLoading(false);
        },
        (err) => {
          console.warn('Firebase auth state error:', err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    if (!auth || !googleProvider) {
      throw new Error(
        'Firebase is not yet configured with valid credentials in .env. You can use the Quick Demo Login below or add your Firebase keys.'
      );
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const mappedUser: AppUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
        photoURL: fbUser.photoURL,
        isDemo: false,
      };
      // Clear demo storage if real login succeeded
      try {
        localStorage.removeItem(DEMO_USER_KEY);
      } catch {}

      setUser(mappedUser);
      const serverRole = await fetchUserRole(fbUser.email);
      setRole(serverRole);
    } catch (err: any) {
      console.error('Firebase Google Sign-In Error:', err);
      const code = err.code || '';
      let msg = err.message || 'Failed to sign in with Google';

      if (code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in window was closed before completing.';
      } else if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid') {
        msg =
          'Firebase API key in .env is dummy or invalid. Please update NEXT_PUBLIC_FIREBASE_* in .env with your real Firebase Project keys, or use Demo Login!';
      } else if (code === 'auth/unauthorized-domain') {
        msg =
          'This domain is not authorized in your Firebase Console. Add localhost to Firebase Auth > Settings > Authorized domains.';
      }

      setError(msg);
      throw new Error(msg);
    }
  };

  const signInAsDemoUser = async (email?: string, name?: string) => {
    setError(null);
    const demoEmail = email || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'admin@sitebotstudio.com';
    const demoName = name || (demoEmail.includes('admin') ? 'Super Admin (Demo)' : 'Demo Creator');
    const demoUser: AppUser = {
      uid: `demo-${Date.now()}`,
      email: demoEmail,
      displayName: demoName,
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${demoEmail}`,
      isDemo: true,
    };

    try {
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
    } catch {}

    setUser(demoUser);
    const serverRole = await fetchUserRole(demoUser.email);
    setRole(serverRole);
  };

  const signOut = async () => {
    try {
      localStorage.removeItem(DEMO_USER_KEY);
    } catch {}

    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch {}
    }

    setUser(null);
    setRole(null);
  };

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isSuperAdmin,
        loading,
        error,
        isFirebaseReady,
        signInWithGoogle,
        signInAsDemoUser,
        signOut,
        refreshRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
