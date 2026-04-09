import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { SharedAccess, UserRole, PermissionCheck } from '../types';

export function usePermissions(user: User | null) {
  const [sharedAccessList, setSharedAccessList] = useState<SharedAccess[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>('owner');
  const [currentOwnerId, setCurrentOwnerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load shared access data
  useEffect(() => {
    if (!user) {
      setSharedAccessList([]);
      setCurrentRole('owner');
      setCurrentOwnerId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Query for records where user is the owner
    const ownerQuery = query(
      collection(db, 'sharedAccess'),
      where('ownerId', '==', user.uid)
    );

    // Query for records where user has been given access
    const sharedWithQuery = query(
      collection(db, 'sharedAccess'),
      where('sharedWithId', '==', user.uid)
    );

    const unsubscribeOwner = onSnapshot(ownerQuery, (snapshot) => {
      const ownerAccess: SharedAccess[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp).toDate(),
        updatedAt: doc.data().updatedAt
          ? (doc.data().updatedAt as Timestamp).toDate()
          : undefined,
      })) as SharedAccess[];

      setSharedAccessList((prev) => {
        const nonOwner = prev.filter((p) => p.ownerId !== user.uid);
        return [...nonOwner, ...ownerAccess];
      });
    });

    const unsubscribeShared = onSnapshot(sharedWithQuery, (snapshot) => {
      const sharedAccess: SharedAccess[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp).toDate(),
        updatedAt: doc.data().updatedAt
          ? (doc.data().updatedAt as Timestamp).toDate()
          : undefined,
      })) as SharedAccess[];

      // Determine user's role from shared access
      if (sharedAccess.length > 0) {
        // User has been shared access - use the first (should only have one)
        const access = sharedAccess[0];
        setCurrentRole(access.role);
        setCurrentOwnerId(access.ownerId);
      } else {
        // User is an owner (no shared access records found for them)
        setCurrentRole('owner');
        setCurrentOwnerId(user.uid);
      }

      setSharedAccessList((prev) => {
        const nonShared = prev.filter((p) => p.sharedWithId !== user.uid);
        return [...nonShared, ...sharedAccess];
      });
      setIsLoading(false);
    });

    return () => {
      unsubscribeOwner();
      unsubscribeShared();
    };
  }, [user]);

  // Get permissions based on current role
  const getPermissions = useCallback((): PermissionCheck => {
    const role = currentRole;
    return {
      canCreate: role === 'owner' || role === 'editor',
      canEdit: role === 'owner' || role === 'editor',
      canDelete: role === 'owner' || role === 'editor',
      canShare: role === 'owner',
      canManageRoles: role === 'owner',
      isOwner: role === 'owner',
      isEditor: role === 'editor',
      isViewer: role === 'viewer',
    };
  }, [currentRole]);

  // Share access with another user
  const shareAccess = useCallback(
    async (
      sharedWithEmail: string,
      role: UserRole,
      userInfo?: { uid: string; name: string | null; photoURL: string | null }
    ) => {
      if (!user || currentRole !== 'owner') {
        throw new Error('Only owners can share access');
      }

      const sharedWithId = userInfo?.uid || '';
      const accessId = `${user.uid}_${sharedWithId}`;

      // Check if access already exists
      const existingDoc = await getDoc(doc(db, 'sharedAccess', accessId));
      if (existingDoc.exists()) {
        // Update existing
        await updateDoc(doc(db, 'sharedAccess', accessId), {
          role,
          updatedAt: Timestamp.now(),
        });
      } else {
        // Create new
        const newAccess: Omit<SharedAccess, 'id'> = {
          ownerId: user.uid,
          sharedWithId,
          sharedWithEmail,
          sharedWithName: userInfo?.name || sharedWithEmail,
          sharedWithPhotoURL: userInfo?.photoURL || null,
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await addDoc(collection(db, 'sharedAccess'), newAccess);
      }
    },
    [user, currentRole]
  );

  // Revoke access
  const revokeAccess = useCallback(
    async (accessId: string) => {
      if (!user || currentRole !== 'owner') {
        throw new Error('Only owners can revoke access');
      }

      await deleteDoc(doc(db, 'sharedAccess', accessId));
    },
    [user, currentRole]
  );

  // Update role
  const updateRole = useCallback(
    async (accessId: string, newRole: UserRole) => {
      if (!user || currentRole !== 'owner') {
        throw new Error('Only owners can update roles');
      }

      await updateDoc(doc(db, 'sharedAccess', accessId), {
        role: newRole,
        updatedAt: Timestamp.now(),
      });
    },
    [user, currentRole]
  );

  // Get the effective owner ID for data operations
  const getDataOwnerId = useCallback(() => {
    return currentOwnerId || user?.uid || null;
  }, [currentOwnerId, user]);

  // Check if user has shared access (for UI purposes)
  const hasActiveSharing = useCallback(() => {
    return sharedAccessList.some((access) => access.ownerId === user?.uid);
  }, [sharedAccessList, user]);

  return {
    sharedAccessList,
    currentRole,
    currentOwnerId,
    isLoading,
    permissions: getPermissions(),
    shareAccess,
    revokeAccess,
    updateRole,
    getDataOwnerId,
    hasActiveSharing,
  };
}

export default usePermissions;
