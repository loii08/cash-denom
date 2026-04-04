import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  setDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  getDocFromServer,
  doc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Transaction, Breakdown, ActivityLog, DENOMINATIONS } from './types';
import { 
  Plus, 
  History, 
  Wallet, 
  LogOut, 
  LogIn, 
  ChevronRight, 
  ChevronDown,
  ChevronLeft,
  Calendar,
  PhilippinePeso,
  Edit2,
  Trash2,
  Activity,
  Check,
  X,
  Filter,
  WifiOff,
  CloudOff,
  Cloud,
  RefreshCcw,
  AlertCircle,
  Bell,
  Eye,
  EyeOff,
  Copy,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Toast Notification System ---
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

const Toast = ({ toast, onRemove }: { toast: Toast; onRemove: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onRemove, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.duration, onRemove]);

  const bgColor = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900'
  }[toast.type];

  const icon = {
    success: <Check className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
    info: <AlertCircle className="w-4 h-4" />,
    warning: <AlertCircle className="w-4 h-4" />
  }[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bgColor} text-sm font-medium`}
    >
      {icon}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onRemove} className="opacity-50 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

// --- Input Validation ---
const validateDenomination = (value: string): boolean => {
  const num = parseInt(value);
  return !isNaN(num) && num >= 0 && num <= 99999;
};

const sanitizeInput = (value: string): string => {
  return value.replace(/[^0-9]/g, '');
};

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [quantities, setQuantities] = useState<Breakdown>(
    DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d]: 0 }), {})
  );
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'activity'>('new');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [inputErrors, setInputErrors] = useState<Record<number, string>>({});
  const lastSaveTimeRef = useRef<number>(0);
  const [showStats, setShowStats] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // --- Toast Helper ---
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Install Prompt Handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        addToast('App installed successfully!', 'success');
      }
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (user) {
        const path = 'users';
        const userDoc = doc(db, path, user.uid);
        setDoc(userDoc, {
          name: user.displayName,
          email: user.email,
          photoUrl: user.photoURL,
          lastLogin: Timestamp.now()
        }, { merge: true }).catch(err => {
          console.error("Error creating user doc:", err);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Connection Test
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10; // Increased retries
    const retryDelay = 3000; // Increased delay

    async function testConnection() {
      try {
        // Use getDoc instead of getDocFromServer to allow for initial provisioning lag
        // but still check if we can reach the server eventually.
        await getDocFromServer(doc(db, 'test', 'connection'));
        setConnectionError(null);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('the client is offline') || error.message.includes('Failed to get document from server')) {
            if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(testConnection, retryDelay);
            } else {
              setConnectionError("Firestore is still initializing or offline. Please refresh in a moment.");
              console.error("Firestore Connection Error: Client is offline after multiple retries.");
            }
          } else {
            console.error("Firestore Connection Test Error:", error.message);
          }
        }
      }
    }
    testConnection();
  }, []);

  // Transactions Listener
  useEffect(() => {
    if (!user || !isAuthReady) {
      setTransactions([]);
      return;
    }

    const path = 'transactions';
    const constraints = [where('uid', '==', user.uid)];

    const q = query(collection(db, path), ...constraints);

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      let txs: Transaction[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          date: (data.date as Timestamp).toDate(),
          breakdown: data.breakdown,
          total: data.total,
          uid: data.uid,
          hasPendingWrites: doc.metadata.hasPendingWrites
        };
      });
      
      // Apply client-side date filtering
      if (selectedDate) {
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
        txs = txs.filter(tx => tx.date >= start && tx.date <= end);
      }
      
      // Sort by date descending (newest first)
      txs.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, isAuthReady, selectedDate]);

  // Activity Logs Listener
  useEffect(() => {
    if (!user || !isAuthReady) {
      setActivityLogs([]);
      return;
    }

    const path = 'activityLogs';
    const q = query(
      collection(db, path),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const logs: ActivityLog[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          action: data.action,
          timestamp: (data.timestamp as Timestamp).toDate(),
          details: data.details,
          uid: data.uid,
          hasPendingWrites: doc.metadata.hasPendingWrites
        };
      });
      // Sort by timestamp descending (newest first)
      logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivityLogs(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const currentTotal = useMemo(() => {
    return DENOMINATIONS.reduce((acc, d) => acc + (d * (quantities[d] || 0)), 0);
  }, [quantities]);

  const grandTotal = useMemo(() => {
    return transactions.reduce((acc, tx) => acc + tx.total, 0);
  }, [transactions]);

  const stats = useMemo(() => {
    if (transactions.length === 0) return { avg: 0, max: 0, min: 0, count: 0 };
    const totals = transactions.map(t => t.total);
    return {
      avg: Math.round(totals.reduce((a, b) => a + b, 0) / totals.length),
      max: Math.max(...totals),
      min: Math.min(...totals),
      count: transactions.length
    };
  }, [transactions]);

  const handleQuantityChange = (denom: number, value: string) => {
    const sanitized = sanitizeInput(value);
    const qty = parseInt(sanitized) || 0;
    
    // Only show error if value is not empty and invalid
    if (sanitized && !validateDenomination(sanitized)) {
      setInputErrors(prev => ({ ...prev, [denom]: 'Invalid amount' }));
      return;
    }
    
    setInputErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[denom];
      return newErrors;
    });
    
    setQuantities(prev => ({ ...prev, [denom]: Math.max(0, qty) }));
  };

  const logActivity = async (action: 'CREATE' | 'UPDATE' | 'DELETE', details: any) => {
    if (!user) return;
    const path = 'activityLogs';
    try {
      await addDoc(collection(db, path), {
        action,
        timestamp: Timestamp.now(),
        details,
        uid: user.uid
      });
    } catch (error) {
      console.error("Logging Error:", error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (currentTotal === 0) {
      addToast('Please enter at least one denomination', 'warning');
      return;
    }

    // Rate limiting - prevent rapid saves
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 1000) {
      addToast('Please wait a moment before saving again', 'warning');
      return;
    }
    lastSaveTimeRef.current = now;

    setIsSaving(true);
    const path = 'transactions';
    try {
      if (editingId) {
        const docRef = doc(db, path, editingId);
        await updateDoc(docRef, {
          breakdown: quantities,
          total: currentTotal
        });
        await logActivity('UPDATE', { 
          transactionId: editingId, 
          total: currentTotal, 
          breakdown: quantities 
        });
        setEditingId(null);
        addToast('Transaction updated successfully', 'success');
      } else {
        const docRef = await addDoc(collection(db, path), {
          date: Timestamp.now(),
          breakdown: quantities,
          total: currentTotal,
          uid: user.uid
        });
        await logActivity('CREATE', { 
          transactionId: docRef.id, 
          total: currentTotal, 
          breakdown: quantities 
        });
        addToast(`Saved ₱${currentTotal.toLocaleString()}`, 'success');
      }
      // Reset quantities after save
      setQuantities(DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d]: 0 }), {}));
      setActiveTab('history');
    } catch (error) {
      addToast(editingId ? 'Failed to update transaction' : 'Failed to save transaction', 'error');
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !txToDelete || !txToDelete.id) return;
    
    setIsDeleting(true);
    const path = 'transactions';
    try {
      await deleteDoc(doc(db, path, txToDelete.id));
      await logActivity('DELETE', { 
        transactionId: txToDelete.id, 
        total: txToDelete.total, 
        breakdown: txToDelete.breakdown,
        originalDate: txToDelete.date
      });
      setTxToDelete(null);
      addToast('Transaction deleted', 'success');
    } catch (error) {
      addToast('Failed to delete transaction', 'error');
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditing = (tx: Transaction) => {
    setEditingId(tx.id!);
    setQuantities(tx.breakdown);
    setActiveTab('new');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setQuantities(DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d]: 0 }), {}));
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      addToast('Signed in successfully', 'success');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('auth/cancelled-popup-request')) {
          console.warn("Login popup request was cancelled or another one is pending.");
        } else if (error.message.includes('auth/unauthorized-domain')) {
          setLoginError("This domain is not authorized for Google Sign-In. Please add the current URL to your Firebase Console's Authorized Domains.");
          addToast('Domain not authorized for Google Sign-In', 'error');
        } else if (error.message.includes('auth/popup-blocked')) {
          setLoginError("The login popup was blocked by your browser. Please allow popups for this site or open the app in a new tab.");
          addToast('Popup blocked - please allow popups', 'error');
        } else {
          setLoginError(`Login Error: ${error.message}`);
          addToast('Login failed', 'error');
          console.error("Login Error:", error);
        }
      } else {
        setLoginError("An unknown error occurred during login.");
        addToast('Login failed', 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const CalendarPicker = () => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    
    const daysInMonth = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const firstDayOfMonth = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const prevMonth = () => {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);

    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10" />);
    }

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
      const isSelected = selectedDate && 
        date.getDate() === selectedDate.getDate() && 
        date.getMonth() === selectedDate.getMonth() && 
        date.getFullYear() === selectedDate.getFullYear();
      
      const isToday = new Date().toDateString() === date.toDateString();

      days.push(
        <button
          key={d}
          onClick={() => setSelectedDate(isSelected ? null : date)}
          className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
            ${isSelected ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 
              isToday ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 
              'text-neutral-600 hover:bg-neutral-100'}`}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="font-bold text-neutral-900">
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="h-8 flex items-center justify-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
          {days}
        </div>
        {selectedDate && (
          <button 
            onClick={() => setSelectedDate(null)}
            className="w-full mt-2 py-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center justify-center gap-1"
          >
            <X className="w-3 h-3" /> Show All Dates
          </button>
        )}
      </div>
    );
  };

  const UserProfile = () => {
    if (!showUserProfile || !user) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        >
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-6 text-white">
            <button 
              onClick={() => setShowUserProfile(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-16 h-16 rounded-full border-4 border-white" />
              ) : (
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <Wallet className="w-8 h-8" />
                </div>
              )}
              <div className="text-left">
                <h3 className="text-xl font-bold">{user.displayName || 'User'}</h3>
                <p className="text-emerald-100 text-sm">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase font-bold text-neutral-400 tracking-widest">Account Info</p>
              <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-neutral-400 mb-1">Name</p>
                  <p className="font-semibold text-neutral-900">{user.displayName || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-1">Email</p>
                  <p className="font-semibold text-neutral-900">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-1">User ID</p>
                  <p className="font-mono text-xs text-neutral-600 break-all">{user.uid}</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowUserProfile(false)}
              className="w-full py-3 font-bold text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const DeleteModal = () => {
    if (!txToDelete) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"
        >
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-4">
            <Trash2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900 text-center mb-2">Delete Transaction?</h3>
          <p className="text-neutral-500 text-center mb-6">
            Are you sure you want to delete this transaction of <span className="font-bold text-neutral-900">₱ {txToDelete.total.toLocaleString()}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => setTxToDelete(null)}
              className="flex-1 py-3 font-bold text-neutral-500 hover:bg-neutral-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 py-3 font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
              ) : 'Delete'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-neutral-100 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-full flex items-center justify-center mx-auto shadow-lg">
            <Wallet className="w-10 h-10 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 mb-2">Cash Tracker</h1>
            <p className="text-neutral-500 text-lg">Track your physical savings with ease.</p>
          </div>
          
          {connectionError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm space-y-3"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="font-medium text-left">{connectionError}</p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="w-full text-xs bg-red-100 hover:bg-red-200 py-2 px-3 rounded-xl transition-colors font-bold"
              >
                Retry Connection
              </button>
            </motion.div>
          )}

          {loginError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm space-y-3"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="font-medium text-left">{loginError}</p>
              </div>
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="w-full text-xs bg-red-100 hover:bg-red-200 py-2 px-3 rounded-xl transition-colors font-bold"
              >
                Try Opening in New Tab
              </button>
            </motion.div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-200"
          >
            {isLoggingIn ? (
              <>
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign in with Google
              </>
            )}
          </button>

          <div className="pt-4 border-t border-neutral-200">
            <p className="text-xs text-neutral-500">
              By signing in, you agree to our terms. Your data is encrypted and private.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <Toast 
                toast={toast} 
                onRemove={() => removeToast(toast.id)} 
              />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-600" />
            <span className="font-bold text-xl text-neutral-900">Cash Tracker</span>
          </div>
          <div className="flex items-center gap-3">
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-bold border border-red-100">
                <WifiOff className="w-3 h-3" />
                Offline
              </div>
            )}
            {showInstallPrompt && (
              <button 
                onClick={handleInstall}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                title="Install Cash Tracker app"
              >
                <Plus className="w-3 h-3" />
                Install
              </button>
            )}
            <button 
              onClick={() => setShowUserProfile(!showUserProfile)}
              className="p-2 text-neutral-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
              title="User profile"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-5 h-5 rounded-full" />
              ) : (
                <Wallet className="w-5 h-5" />
              )}
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <DeleteModal />
        <UserProfile />
        
        {/* Total Savings Banner with Stats */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-600 p-8 rounded-3xl text-white shadow-lg shadow-emerald-200 relative overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => setShowStats(!showStats)}
        >
          <div className="relative z-10">
            <p className="text-emerald-100 text-sm font-medium uppercase tracking-wider mb-1 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Total Savings
            </p>
            <h2 className="text-5xl font-bold flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-medium opacity-80">₱</span>
              {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            
            <AnimatePresence>
              {showStats && stats.count > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-4 gap-3 pt-4 border-t border-emerald-400"
                >
                  <div className="text-center">
                    <p className="text-emerald-100 text-xs uppercase font-bold mb-1">Entries</p>
                    <p className="text-xl font-bold">{stats.count}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-emerald-100 text-xs uppercase font-bold mb-1">Average</p>
                    <p className="text-xl font-bold">₱{stats.avg.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-emerald-100 text-xs uppercase font-bold mb-1">Max</p>
                    <p className="text-xl font-bold">₱{stats.max.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-emerald-100 text-xs uppercase font-bold mb-1">Min</p>
                    <p className="text-xl font-bold">₱{stats.min.toLocaleString()}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-10">
            <PhilippinePeso className="w-48 h-48" />
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-neutral-200">
          <button 
            onClick={() => { setActiveTab('new'); if (!editingId) cancelEditing(); }}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'new' ? 'bg-emerald-50 text-emerald-700' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            <Plus className="w-4 h-4" />
            {editingId ? 'Edit Entry' : 'New Entry'}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-emerald-50 text-emerald-700' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button 
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'activity' ? 'bg-emerald-50 text-emerald-700' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            <Activity className="w-4 h-4" />
            Logs
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'new' ? (
            <motion.div 
              key="new-entry"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
                <div className="p-4 sm:p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50 backdrop-blur-md">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <h3 className="font-bold text-neutral-900 text-base sm:text-lg">{editingId ? 'Edit Transaction' : 'Denominations'}</h3>
                    {editingId && (
                      <button 
                        onClick={cancelEditing}
                        className="text-xs bg-neutral-200 text-neutral-600 px-2 py-1 rounded-md hover:bg-neutral-300 transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-400 uppercase font-bold tracking-widest">Subtotal</p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-600">₱ {currentTotal.toLocaleString()}</p>
                  </div>
                </div>
                <div className="p-4 sm:p-6 space-y-3 overflow-y-auto">
                  {DENOMINATIONS.map((d) => (
                    <div key={d} className="space-y-0">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <label className="font-bold text-neutral-700 w-14 sm:w-16 text-sm sm:text-base">₱ {d}</label>
                        <input 
                          type="number" 
                          inputMode="numeric"
                          value={quantities[d] || ''}
                          onChange={(e) => handleQuantityChange(d, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="0"
                          max="99999"
                          className={`flex-1 min-w-0 bg-neutral-100 border-2 rounded-xl px-3 py-2 sm:px-4 sm:py-3 focus:ring-2 focus:ring-emerald-500 transition-all text-neutral-900 font-medium text-sm sm:text-base ${
                            inputErrors[d] ? 'border-red-300' : 'border-transparent'
                          }`}
                        />
                        <div className="w-16 sm:w-24 text-right font-mono text-neutral-500 text-xs sm:text-sm font-semibold truncate">
                          {(d * (quantities[d] || 0)).toLocaleString()}
                        </div>
                      </div>
                      {inputErrors[d] && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {inputErrors[d]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-4 sm:p-6 bg-neutral-50 border-t border-neutral-100 space-y-3">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving || currentTotal === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-100"
                  >
                    {isSaving ? (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : (
                      editingId ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />
                    )}
                    {isSaving ? 'Saving...' : (editingId ? 'Update Transaction' : 'Save Transaction')}
                  </button>
                  <button 
                    onClick={() => {
                      setQuantities(DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d]: 0 }), {}));
                      setInputErrors({});
                    }}
                    disabled={isSaving || currentTotal === 0}
                    className="w-full py-3 text-neutral-600 hover:text-neutral-700 hover:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed font-bold rounded-xl transition-colors"
                  >
                    Clear All
                  </button>
                  {editingId && (
                    <button 
                      onClick={cancelEditing}
                      disabled={isSaving}
                      className="w-full py-3 text-neutral-600 hover:text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'history' ? (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <CalendarPicker />

              {transactions.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl text-center border border-neutral-200 border-dashed space-y-4">
                  <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto">
                    <History className="w-8 h-8 text-neutral-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-700 mb-1">No transactions yet</p>
                    <p className="text-sm text-neutral-400">
                      {selectedDate 
                        ? `No transactions on ${selectedDate.toLocaleDateString()}.` 
                        : 'Start by creating your first transaction'}
                    </p>
                  </div>
                  <button
                    onClick={() => { setActiveTab('new'); setSelectedDate(null); }}
                    className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-bold text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Entry
                  </button>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div 
                    key={tx.id} 
                    className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden"
                  >
                    <div className="flex items-center">
                      <button 
                        onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id!)}
                        className="flex-1 p-5 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-neutral-900 flex items-center gap-2">
                              ₱ {tx.total.toLocaleString()}
                              {tx.hasPendingWrites && (
                                <RefreshCcw className="w-3 h-3 text-emerald-500 animate-spin" />
                              )}
                            </p>
                            <p className="text-xs text-neutral-500">by: {user?.displayName || 'User'}</p>
                            <p className="text-xs text-neutral-400">{tx.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {tx.date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        {expandedId === tx.id ? <ChevronDown className="w-5 h-5 text-neutral-300" /> : <ChevronRight className="w-5 h-5 text-neutral-300" />}
                      </button>
                      <div className="flex pr-4 gap-2">
                        <button 
                          onClick={() => startEditing(tx)}
                          className="p-2 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setTxToDelete(tx)}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {expandedId === tx.id && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden bg-neutral-50"
                        >
                          <div className="p-5 pt-0 space-y-2">
                            <div className="h-px bg-neutral-200 mb-4" />
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Breakdown</p>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                              {DENOMINATIONS.map(d => tx.breakdown[d] > 0 && (
                                <div key={d} className="flex justify-between text-sm">
                                  <span className="text-neutral-500">₱ {d} × {tx.breakdown[d]}</span>
                                  <span className="font-medium text-neutral-700">₱ {(d * tx.breakdown[d]).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="activity"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3"
            >
              {activityLogs.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl text-center border border-neutral-200 border-dashed space-y-4">
                  <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto">
                    <Activity className="w-8 h-8 text-neutral-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-700 mb-1">No activity yet</p>
                    <p className="text-sm text-neutral-400">Your actions will be logged here</p>
                  </div>
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden"
                  >
                    <button 
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id!)}
                      className="w-full p-5 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-600' :
                          log.action === 'UPDATE' ? 'bg-blue-50 text-blue-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {log.action === 'CREATE' ? <Plus className="w-6 h-6" /> :
                           log.action === 'UPDATE' ? <Edit2 className="w-6 h-6" /> :
                           <Trash2 className="w-6 h-6" />}
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-neutral-900 flex items-center gap-2">
                            {log.action} <span className="text-neutral-400 font-normal">₱ {log.details.total.toLocaleString()}</span>
                            {log.hasPendingWrites && (
                              <RefreshCcw className="w-3 h-3 text-emerald-500 animate-spin" />
                            )}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {log.timestamp.toLocaleDateString()} at {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      {expandedId === log.id ? <ChevronDown className="w-5 h-5 text-neutral-300" /> : <ChevronRight className="w-5 h-5 text-neutral-300" />}
                    </button>
                    
                    <AnimatePresence>
                      {expandedId === log.id && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden bg-neutral-50"
                        >
                          <div className="p-5 pt-0 space-y-2">
                            <div className="h-px bg-neutral-200 mb-4" />
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Details</p>
                            {log.details.originalDate && (
                              <p className="text-xs text-neutral-500 mb-2">Original Date: {new Date(log.details.originalDate).toLocaleDateString()}</p>
                            )}
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                              {DENOMINATIONS.map(d => log.details.breakdown[d] > 0 && (
                                <div key={d} className="flex justify-between text-sm">
                                  <span className="text-neutral-500">₱ {d} × {log.details.breakdown[d]}</span>
                                  <span className="font-medium text-neutral-700">₱ {(d * log.details.breakdown[d]).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
