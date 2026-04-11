export interface Breakdown {
  [key: number]: number;
}

export interface Transaction {
  id?: string;
  walletId: string;
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
  walletId: string;
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
  walletId: string;
  date: Date;
  amount: number;
  description: string;
  uid: string;
  hasPendingWrites?: boolean;
  isDraft?: boolean;
  serverTimestamp?: number;
}

export type UserRole = 'owner' | 'editor' | 'viewer';
export type ShareStatus = 'pending' | 'accepted' | 'declined';
export type NotificationType = 'SHARE_INVITE' | 'SHARE_ACCEPTED' | 'SHARE_DECLINED' | 'ROLE_CHANGED' | 'REMOVED';

// Wallet/Account for multi-wallet support
export interface Wallet {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;
  ownerPhotoURL?: string;
  createdAt: Date;
  updatedAt?: Date;
  isDefault?: boolean;
}

// Wallet membership with share status
export interface WalletMember {
  id?: string;
  walletId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  userPhotoURL?: string;
  role: UserRole;
  status: ShareStatus;
  invitedBy: string;
  invitedAt: Date;
  respondedAt?: Date;
}

// Notifications for share workflow
export interface Notification {
  id?: string;
  type: NotificationType;
  fromUserId: string;
  fromUserName?: string;
  fromUserEmail?: string;
  toUserId: string;
  walletId: string;
  walletName: string;
  role?: UserRole;
  message: string;
  read: boolean;
  createdAt: Date;
}

// Legacy SharedAccess (deprecated, use WalletMember)
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
