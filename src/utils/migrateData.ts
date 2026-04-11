import { collection, query, where, getDocs, addDoc, updateDoc, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from 'firebase/auth';

/**
 * Migration utility to convert existing user data to the new wallet-based system.
 * This creates a default wallet for each user and migrates all their existing
 * transactions, expenses, and activity logs to use the new walletId field.
 */

export interface MigrationResult {
  success: boolean;
  walletId?: string;
  transactionsMigrated: number;
  expensesMigrated: number;
  activityLogsMigrated: number;
  error?: string;
}

/**
 * Check if user has any existing data that needs migration
 */
export async function checkNeedsMigration(user: User): Promise<boolean> {
  try {
    // Check if user already has wallets
    const walletsQuery = query(
      collection(db, 'wallets'),
      where('ownerId', '==', user.uid)
    );
    const walletsSnapshot = await getDocs(walletsQuery);
    
    if (!walletsSnapshot.empty) {
      // User already has wallets, no migration needed
      return false;
    }

    // Check if user has any existing transactions without walletId
    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid)
    );
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    // If there are transactions, we need to migrate
    return !transactionsSnapshot.empty;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}

/**
 * Migrate existing user data to wallet-based system
 */
export async function migrateUserData(user: User): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    transactionsMigrated: 0,
    expensesMigrated: 0,
    activityLogsMigrated: 0,
  };

  try {
    // 1. Create default wallet for the user
    const walletData = {
      name: 'My Wallet',
      description: 'Default wallet - migrated from existing data',
      ownerId: user.uid,
      ownerEmail: user.email || '',
      ownerName: user.displayName || 'Unknown',
      ownerPhotoURL: user.photoURL || '',
      isDefault: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const walletRef = await addDoc(collection(db, 'wallets'), walletData);
    const walletId = walletRef.id;
    result.walletId = walletId;

    // 2. Migrate transactions
    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid)
    );
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    const transactionBatch = writeBatch(db);
    transactionsSnapshot.docs.forEach((docSnapshot) => {
      const txRef = doc(db, 'transactions', docSnapshot.id);
      transactionBatch.update(txRef, { walletId });
    });
    await transactionBatch.commit();
    result.transactionsMigrated = transactionsSnapshot.size;

    // 3. Migrate expenses
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('uid', '==', user.uid)
    );
    const expensesSnapshot = await getDocs(expensesQuery);
    
    const expenseBatch = writeBatch(db);
    expensesSnapshot.docs.forEach((docSnapshot) => {
      const expRef = doc(db, 'expenses', docSnapshot.id);
      expenseBatch.update(expRef, { walletId });
    });
    await expenseBatch.commit();
    result.expensesMigrated = expensesSnapshot.size;

    // 4. Migrate activity logs
    const logsQuery = query(
      collection(db, 'activityLogs'),
      where('uid', '==', user.uid)
    );
    const logsSnapshot = await getDocs(logsQuery);
    
    const logsBatch = writeBatch(db);
    logsSnapshot.docs.forEach((docSnapshot) => {
      const logRef = doc(db, 'activityLogs', docSnapshot.id);
      logsBatch.update(logRef, { walletId });
    });
    await logsBatch.commit();
    result.activityLogsMigrated = logsSnapshot.size;

    // 5. Create activity log entry for the migration
    await addDoc(collection(db, 'activityLogs'), {
      walletId,
      action: 'CREATE',
      timestamp: Timestamp.now(),
      details: {
        type: 'wallet_migration',
        transactionsMigrated: result.transactionsMigrated,
        expensesMigrated: result.expensesMigrated,
        activityLogsMigrated: result.activityLogsMigrated,
      },
      uid: user.uid,
    });

    result.success = true;
    return result;
  } catch (error) {
    console.error('Migration error:', error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

/**
 * Run migration with progress callback
 */
export async function runMigration(
  user: User,
  onProgress?: (message: string) => void
): Promise<MigrationResult> {
  onProgress?.('Checking if migration is needed...');
  
  const needsMigration = await checkNeedsMigration(user);
  
  if (!needsMigration) {
    onProgress?.('No migration needed - you already have wallets!');
    return {
      success: true,
      transactionsMigrated: 0,
      expensesMigrated: 0,
      activityLogsMigrated: 0,
    };
  }

  onProgress?.('Starting migration...');
  const result = await migrateUserData(user);
  
  if (result.success) {
    onProgress?.(`Migration complete! Created wallet and migrated ${result.transactionsMigrated} transactions, ${result.expensesMigrated} expenses.`);
  } else {
    onProgress?.(`Migration failed: ${result.error}`);
  }
  
  return result;
}
