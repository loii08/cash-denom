import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { Wallet, WalletMember, Notification, UserRole, ShareStatus } from '../types';

export interface WalletWithMembers extends Wallet {
  members: WalletMember[];
  myRole?: UserRole;
  myStatus?: ShareStatus;
}

export function useWallets(user: User | null) {
  const [wallets, setWallets] = useState<WalletWithMembers[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get wallets where user is owner or member
  useEffect(() => {
    if (!user) {
      setWallets([]);
      setSelectedWalletId(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Query 1: Wallets where user is owner
    const ownedQuery = query(
      collection(db, 'wallets'),
      where('ownerId', '==', user.uid)
    );

    // Query 2a: Wallet memberships where user is a member (accepted invites)
    const memberQuery = query(
      collection(db, 'walletMembers'),
      where('userId', '==', user.uid),
      where('status', 'in', ['pending', 'accepted'])
    );

    // Query 2b: Pending invites by email (user hasn't accepted yet)
    const pendingInviteQuery = query(
      collection(db, 'walletMembers'),
      where('userEmail', '==', user.email?.toLowerCase()),
      where('status', '==', 'pending')
    );

    const unsubOwned = onSnapshot(ownedQuery, (snapshot) => {
      const ownedWallets: Wallet[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Wallet));

      // Update wallets state
      setWallets(prev => {
        const otherWallets = prev.filter(w => w.ownerId !== user.uid);
        const updatedOwned = ownedWallets.map(w => ({
          ...w,
          members: prev.find(pw => pw.id === w.id)?.members || [],
          myRole: 'owner' as UserRole,
          myStatus: 'accepted' as ShareStatus,
        }));
        return [...otherWallets, ...updatedOwned];
      });
      setLoading(false);
    }, (err) => {
      console.error('Error fetching owned wallets:', err);
      setError('Failed to load wallets');
      setLoading(false);
    });

    // Helper function to process memberships and fetch wallet details
    const processMemberships = async (memberships: WalletMember[]) => {
      const walletIds = memberships.map(m => m.walletId);
      if (walletIds.length === 0) return;

      // Get wallet details
      const walletPromises = walletIds.map(async (walletId) => {
        const walletDoc = await getDocs(query(collection(db, 'wallets'), where('__name__', '==', walletId)));
        if (walletDoc.empty) return null;
        const data = walletDoc.docs[0].data();
        return {
          id: walletId,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Wallet;
      });

      const sharedWallets = (await Promise.all(walletPromises)).filter(Boolean) as Wallet[];

      setWallets(prev => {
        const ownedWallets = prev.filter(w => w.ownerId === user.uid);
        const existingSharedIds = new Set(ownedWallets.map(w => w.id));
        
        const updatedShared = sharedWallets.map(w => {
          const membership = memberships.find(m => m.walletId === w.id);
          return {
            ...w,
            members: prev.find(pw => pw.id === w.id)?.members || [],
            myRole: membership?.role,
            myStatus: membership?.status,
          };
        }).filter(w => !existingSharedIds.has(w.id));
        
        return [...ownedWallets, ...updatedShared];
      });
    };

    const unsubMembers = onSnapshot(memberQuery, async (snapshot) => {
      const memberships: WalletMember[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        invitedAt: doc.data().invitedAt?.toDate(),
        respondedAt: doc.data().respondedAt?.toDate(),
      } as WalletMember));
      await processMemberships(memberships);
    }, (err) => {
      console.error('Error fetching wallet memberships by userId:', err);
    });

    // Subscribe to pending invites by email
    const unsubPendingInvites = onSnapshot(pendingInviteQuery, async (snapshot) => {
      const memberships: WalletMember[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        invitedAt: doc.data().invitedAt?.toDate(),
        respondedAt: doc.data().respondedAt?.toDate(),
      } as WalletMember));
      await processMemberships(memberships);
    }, (err) => {
      console.error('Error fetching pending invites by email:', err);
    });

    // Fetch members for each wallet
    const unsubWalletMembers = onSnapshot(
      query(collection(db, 'walletMembers')),
      (snapshot) => {
        const allMembers: WalletMember[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          invitedAt: doc.data().invitedAt?.toDate(),
          respondedAt: doc.data().respondedAt?.toDate(),
        } as WalletMember));

        setWallets(prev => prev.map(w => ({
          ...w,
          members: allMembers.filter(m => m.walletId === w.id),
        })));
      }
    );

    return () => {
      unsubOwned();
      unsubMembers();
      unsubPendingInvites();
      unsubWalletMembers();
    };
  }, [user]);

  // Auto-select default wallet when wallets load
  useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
      // First try to find the default wallet
      const defaultWallet = wallets.find(w => w.isDefault && w.ownerId === user?.uid);
      if (defaultWallet) {
        setSelectedWalletId(defaultWallet.id);
      } else {
        // Otherwise select the first owned wallet
        const firstOwned = wallets.find(w => w.ownerId === user?.uid);
        if (firstOwned) {
          setSelectedWalletId(firstOwned.id);
        } else {
          // Or the first shared wallet with accepted status
          const firstShared = wallets.find(w => w.myStatus === 'accepted');
          if (firstShared) {
            setSelectedWalletId(firstShared.id);
          }
        }
      }
    }
  }, [wallets, selectedWalletId, user]);

  // Create a new wallet
  const createWallet = useCallback(async (name: string, description?: string): Promise<string | null> => {
    if (!user) return null;

    try {
      const walletData = {
        name: name.trim(),
        description: description?.trim(),
        ownerId: user.uid,
        ownerEmail: user.email,
        ownerName: user.displayName,
        ownerPhotoURL: user.photoURL,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        isDefault: wallets.length === 0, // First wallet is default
      };

      const docRef = await addDoc(collection(db, 'wallets'), walletData);
      
      // Select the new wallet
      setSelectedWalletId(docRef.id);
      
      return docRef.id;
    } catch (err) {
      console.error('Error creating wallet:', err);
      throw new Error('Failed to create wallet');
    }
  }, [user, wallets.length]);

  // Update wallet
  const updateWallet = useCallback(async (walletId: string, updates: Partial<Wallet>) => {
    if (!user) return;

    try {
      const walletRef = doc(db, 'wallets', walletId);
      await updateDoc(walletRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error updating wallet:', err);
      throw new Error('Failed to update wallet');
    }
  }, [user]);

  // Delete wallet
  const deleteWallet = useCallback(async (walletId: string) => {
    if (!user) return;

    try {
      // Delete all related data
      const batch = writeBatch(db);

      // Delete transactions
      const transactions = await getDocs(query(collection(db, 'transactions'), where('walletId', '==', walletId)));
      transactions.docs.forEach(doc => batch.delete(doc.ref));

      // Delete expenses
      const expenses = await getDocs(query(collection(db, 'expenses'), where('walletId', '==', walletId)));
      expenses.docs.forEach(doc => batch.delete(doc.ref));

      // Delete activity logs
      const logs = await getDocs(query(collection(db, 'activityLogs'), where('walletId', '==', walletId)));
      logs.docs.forEach(doc => batch.delete(doc.ref));

      // Delete wallet members
      const members = await getDocs(query(collection(db, 'walletMembers'), where('walletId', '==', walletId)));
      members.docs.forEach(doc => batch.delete(doc.ref));

      // Delete the wallet
      batch.delete(doc(db, 'wallets', walletId));

      await batch.commit();

      // Select another wallet if this was selected
      if (selectedWalletId === walletId) {
        const remaining = wallets.filter(w => w.id !== walletId);
        setSelectedWalletId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Error deleting wallet:', err);
      throw new Error('Failed to delete wallet');
    }
  }, [user, selectedWalletId, wallets]);

  // Share wallet with user
  const shareWallet = useCallback(async (walletId: string, email: string, role: UserRole) => {
    if (!user) return;

    try {
      // Check if user is registered in the application
      const normalizedEmail = email.toLowerCase().trim();
      const userQuery = query(
        collection(db, 'users'),
        where('email', '==', normalizedEmail)
      );
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        throw new Error('❌ User not registered yet. The person must sign in to Cash Tracker at least once before you can share with them.');
      }

      // Check if already shared
      const existingQuery = query(
        collection(db, 'walletMembers'),
        where('walletId', '==', walletId),
        where('userEmail', '==', normalizedEmail)
      );
      const existing = await getDocs(existingQuery);

      if (!existing.empty) {
        throw new Error('⚠️ This user already has access to this wallet');
      }

      // Create wallet member record with pending status
      const memberData = {
        walletId,
        userId: null, // Will be filled when user accepts
        userEmail: email.toLowerCase().trim(),
        userName: null,
        userPhotoURL: null,
        role,
        status: 'pending' as ShareStatus,
        invitedBy: user.uid,
        invitedAt: Timestamp.now(),
      };

      const memberRef = await addDoc(collection(db, 'walletMembers'), memberData);

      // Create notification for the invited user
      const wallet = wallets.find(w => w.id === walletId);
      const notificationData = {
        type: 'SHARE_INVITE' as const,
        fromUserId: user.uid,
        fromUserName: user.displayName,
        fromUserEmail: user.email,
        toUserId: null, // Will be filled when user accepts
        toUserEmail: email.toLowerCase().trim(),
        walletId,
        walletName: wallet?.name || 'Unnamed Wallet',
        role,
        message: `${user.displayName || user.email} invited you to access "${wallet?.name || 'Unnamed Wallet'}" as ${role}`,
        read: false,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'notifications'), notificationData);

      return memberRef.id;
    } catch (err) {
      console.error('Error sharing wallet:', err);
      throw err;
    }
  }, [user, wallets]);

  // Accept wallet invitation
  const acceptInvitation = useCallback(async (memberId: string, walletId: string) => {
    if (!user) return;

    try {
      // Get wallet details from Firestore
      const walletDoc = await getDocs(query(collection(db, 'wallets'), where('__name__', '==', walletId)));
      if (walletDoc.empty) throw new Error('Wallet not found');
      const walletData = walletDoc.docs[0].data();
      const ownerId = walletData.ownerId;
      const walletName = walletData.name || 'Unnamed Wallet';

      // Update member record
      await updateDoc(doc(db, 'walletMembers', memberId), {
        userId: user.uid,
        userName: user.displayName,
        userPhotoURL: user.photoURL,
        status: 'accepted',
        respondedAt: Timestamp.now(),
      });

      // Create notification for the owner
      const notificationData = {
        type: 'SHARE_ACCEPTED' as const,
        fromUserId: user.uid,
        fromUserName: user.displayName,
        fromUserEmail: user.email,
        toUserId: ownerId,
        toUserEmail: null,
        walletId,
        walletName,
        message: `${user.displayName || user.email} accepted your invitation to "${walletName}"`,
        read: false,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'notifications'), notificationData);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      throw new Error('Failed to accept invitation');
    }
  }, [user, wallets]);

  // Decline wallet invitation
  const declineInvitation = useCallback(async (memberId: string, walletId: string) => {
    if (!user) return;

    try {
      // Update member record
      await updateDoc(doc(db, 'walletMembers', memberId), {
        userId: user.uid,
        userName: user.displayName,
        userPhotoURL: user.photoURL,
        status: 'declined',
        respondedAt: Timestamp.now(),
      });

      // Get wallet owner for notification
      const wallet = wallets.find(w => w.id === walletId);

      // Create notification for the owner
      const notificationData = {
        type: 'SHARE_DECLINED' as const,
        fromUserId: user.uid,
        fromUserName: user.displayName,
        fromUserEmail: user.email,
        toUserId: wallet?.ownerId,
        walletId,
        walletName: wallet?.name || 'Unnamed Wallet',
        message: `${user.displayName || user.email} declined your invitation to "${wallet?.name || 'Unnamed Wallet'}"`,
        read: false,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'notifications'), notificationData);
    } catch (err) {
      console.error('Error declining invitation:', err);
      throw new Error('Failed to decline invitation');
    }
  }, [user, wallets]);

  // Update member role
  const updateMemberRole = useCallback(async (memberId: string, newRole: UserRole) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'walletMembers', memberId), {
        role: newRole,
        updatedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error updating member role:', err);
      throw new Error('Failed to update role');
    }
  }, [user]);

  // Remove member from wallet
  const removeMember = useCallback(async (memberId: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, 'walletMembers', memberId));
    } catch (err) {
      console.error('Error removing member:', err);
      throw new Error('Failed to remove member');
    }
  }, [user]);

  // Set default wallet
  const setDefaultWallet = useCallback(async (walletId: string) => {
    if (!user) return;

    try {
      // Remove default from all user's wallets
      const userWallets = wallets.filter(w => w.ownerId === user.uid);
      const batch = writeBatch(db);

      userWallets.forEach(w => {
        if (w.isDefault) {
          batch.update(doc(db, 'wallets', w.id), { isDefault: false });
        }
      });

      // Set new default
      batch.update(doc(db, 'wallets', walletId), { isDefault: true });
      
      await batch.commit();
    } catch (err) {
      console.error('Error setting default wallet:', err);
      throw new Error('Failed to set default wallet');
    }
  }, [user, wallets]);

  // Selected wallet object - always returns a wallet (selected, default, or first)
  const selectedWallet = useMemo(() => {
    // If a wallet is explicitly selected, use it
    if (selectedWalletId) {
      const found = wallets.find(w => w.id === selectedWalletId);
      if (found) return found;
    }
    // Otherwise, find the default wallet (owned by current user)
    const defaultWallet = wallets.find(w => w.isDefault && w.ownerId === user?.uid);
    if (defaultWallet) return defaultWallet;
    // Or the first owned wallet
    const firstOwned = wallets.find(w => w.ownerId === user?.uid);
    if (firstOwned) return firstOwned;
    // Or the first shared wallet with accepted status
    const firstShared = wallets.find(w => w.myStatus === 'accepted');
    if (firstShared) return firstShared;
    // Fallback to first wallet
    return wallets[0] || null;
  }, [wallets, selectedWalletId, user]);

  // Check permissions for selected wallet
  const permissions = useMemo(() => {
    if (!selectedWallet || !user) {
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canShare: false,
        canManageRoles: false,
        isOwner: false,
        isEditor: false,
        isViewer: false,
      };
    }

    const role = selectedWallet.myRole;
    const isOwner = selectedWallet.ownerId === user.uid;

    return {
      canCreate: isOwner || role === 'editor',
      canEdit: isOwner || role === 'editor',
      canDelete: isOwner || role === 'editor',
      canShare: isOwner,
      canManageRoles: isOwner,
      isOwner,
      isEditor: role === 'editor',
      isViewer: role === 'viewer',
    };
  }, [selectedWallet, user]);

  return {
    wallets,
    selectedWallet,
    selectedWalletId,
    setSelectedWalletId,
    loading,
    error,
    permissions,
    createWallet,
    updateWallet,
    deleteWallet,
    shareWallet,
    acceptInvitation,
    declineInvitation,
    updateMemberRole,
    removeMember,
    setDefaultWallet,
  };
}
