import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let initialized = false;
let authInstance: any = null;
let dbInstance: any = null;

const ensureInitialized = () => {
  if (initialized) return;
  
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };

  const existingApps = getApps();
  const app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);

  const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
  authInstance = getAuth(app);
  dbInstance = getFirestore(app, firestoreDatabaseId || undefined);
  
  initialized = true;
};

export const getAuth = () => {
  ensureInitialized();
  return authInstance;
};

export const getDb = () => {
  ensureInitialized();
  return dbInstance;
};

// Lazy getters to avoid circular dependencies
Object.defineProperty(globalThis, '__firebaseAuth', {
  get() {
    return getAuth();
  },
  configurable: true
});

Object.defineProperty(globalThis, '__firebaseDb', {
  get() {
    return getDb();
  },
  configurable: true
});

export const auth = globalThis.__firebaseAuth as any;
export const db = globalThis.__firebaseDb as any;
