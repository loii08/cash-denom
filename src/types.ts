export interface Breakdown {
  [key: number]: number;
}

export interface Transaction {
  id?: string;
  date: Date;
  breakdown: Breakdown;
  total: number;
  uid: string;
  hasPendingWrites?: boolean;
  isDraft?: boolean;
  serverTimestamp?: number;
}

export interface ActivityLog {
  id?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  timestamp: Date;
  details: {
    total: number;
    breakdown: Breakdown;
    transactionId?: string;
    originalDate?: Date;
  };
  uid: string;
  hasPendingWrites?: boolean;
}

export interface Expense {
  id?: string;
  date: Date;
  amount: number;
  description: string;
  uid: string;
  hasPendingWrites?: boolean;
  isDraft?: boolean;
  serverTimestamp?: number;
}

export type UserRole = 'owner' | 'editor' | 'viewer';

export interface SharedAccess {
  id?: string;
  ownerId: string;
  sharedWithId: string;
  sharedWithEmail: string;
  sharedWithName?: string;
  sharedWithPhotoURL?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt?: Date;
}

export interface UserData {
  uid: string;
  name: string | null;
  email: string | null;
  photoUrl: string | null;
  lastLogin: Date;
  isOwner?: boolean;
}

export interface PermissionCheck {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canManageRoles: boolean;
  isOwner: boolean;
  isEditor: boolean;
  isViewer: boolean;
}

export const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
