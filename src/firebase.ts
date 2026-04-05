import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache } from 'firebase/firestore';

// Environment variable validation for production
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

const optionalEnvVars = [
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_FIRESTORE_DATABASE_ID'
] as const;

// Validate required environment variables in production
if (import.meta.env.PROD) {
  const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required Firebase environment variables: ${missingVars.join(', ')}. Please configure these in your Vercel dashboard.`);
  }
}

// Firebase configuration from environment variables only
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Get optional Firestore database ID (only if explicitly set)
const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore with modern cache settings
export const db = initializeFirestore(app, {
  cache: persistentLocalCache(/* options */),
  ...(firestoreDatabaseId && { databaseId: firestoreDatabaseId })
});

export const auth = getAuth(app);
