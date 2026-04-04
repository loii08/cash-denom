import { useState, useEffect, useMemo } from 'react';
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
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

  // Online/Offline Listener
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
    const constraints = [
      where('uid', '==', user.uid),
      orderBy('date', 'desc')
    ];

    if (selectedDate) {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      constraints.push(where('date', '>=', start));
      constraints.push(where('date', '<=', end));
    }

    const q = query(collection(db, path), ...constraints);

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const txs: Transaction[] = snapshot.docs.map(doc => {
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
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc')
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

  const handleQuantityChange = (denom: number, value: string) => {
    const qty = parseInt(value) || 0;
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
    if (currentTotal === 0) return;

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
      }
      // Reset quantities after save
      setQuantities(DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d]: 0 }), {}));
      setActiveTab('history');
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('auth/cancelled-popup-request')) {
          console.warn("Login popup request was cancelled or another one is pending.");
        } else if (error.message.includes('auth/unauthorized-domain')) {
          setLoginError("This domain is not authorized for Google Sign-In. Please add the current URL to your Firebase Console's Authorized Domains.");
        } else if (error.message.includes('auth/popup-blocked')) {
          setLoginError("The login popup was blocked by your browser. Please allow popups for this site or open the app in a new tab.");
        } else {
          setLoginError(`Login Error: ${error.message}`);
          console.error("Login Error:", error);
        }
      } else {
        setLoginError("An unknown error occurred during login.");
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
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Cash Tracker</h1>
          <p className="text-neutral-500 mb-8">Track your physical savings with ease. Count your bills and coins in one place.</p>
          
          {connectionError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <X className="w-5 h-5 flex-shrink-0" />
                <p className="text-left font-medium">{connectionError}</p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="text-xs bg-red-100 hover:bg-red-200 py-2 px-3 rounded-xl transition-colors font-bold"
              >
                Retry Connection
              </button>
            </div>
          )}

          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <X className="w-5 h-5 flex-shrink-0" />
                <p className="text-left font-medium">{loginError}</p>
              </div>
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="text-xs bg-red-100 hover:bg-red-200 py-2 px-3 rounded-xl transition-colors font-bold"
              >
                Try Opening in New Tab
              </button>
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-100"
          >
            {isLoggingIn ? (
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign in with Google
              </>
            )}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
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
            <button 
              onClick={handleLogout}
              className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <DeleteModal />
        {/* Total Savings Banner */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-600 p-8 rounded-3xl text-white shadow-lg shadow-emerald-200 relative overflow-hidden"
        >
          <div className="relative z-10">
            <p className="text-emerald-100 text-sm font-medium uppercase tracking-wider mb-1">Total Savings</p>
            <h2 className="text-5xl font-bold flex items-baseline gap-1">
              <span className="text-3xl font-medium opacity-80">₱</span>
              {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
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
              <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50 sticky top-[72px] z-10 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-neutral-900">{editingId ? 'Edit Transaction' : 'Denominations'}</h3>
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
                    <p className="text-xl font-bold text-emerald-600">₱ {currentTotal.toLocaleString()}</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {DENOMINATIONS.map((d) => (
                    <div key={d} className="flex items-center gap-4">
                      <div className="w-20 font-bold text-neutral-700">₱ {d}</div>
                      <div className="flex-1">
                        <input 
                          type="number" 
                          inputMode="numeric"
                          value={quantities[d] || ''}
                          onChange={(e) => handleQuantityChange(d, e.target.value)}
                          placeholder="0"
                          className="w-full bg-neutral-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 transition-all text-neutral-900 font-medium"
                        />
                      </div>
                      <div className="w-24 text-right font-mono text-neutral-400 text-sm">
                        ₱ {(d * (quantities[d] || 0)).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-neutral-50 border-t border-neutral-100">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving || currentTotal === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-100"
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
                    {editingId ? 'Update Transaction' : 'Save Transaction'}
                  </button>
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
                <div className="bg-white p-12 rounded-3xl text-center border border-neutral-200 border-dashed">
                  <History className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                  <p className="text-neutral-400">
                    {selectedDate 
                      ? `No transactions on ${selectedDate.toLocaleDateString()}.` 
                      : 'No transactions yet.'}
                  </p>
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
                            <p className="text-xs text-neutral-400">{tx.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
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
                <div className="bg-white p-12 rounded-3xl text-center border border-neutral-200 border-dashed">
                  <Activity className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                  <p className="text-neutral-400">No activity logs yet.</p>
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
