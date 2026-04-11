import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Share2,
  X,
  Users,
  Shield,
  Eye,
  Edit3,
  Crown,
  Trash2,
  ChevronDown,
  AlertCircle,
  UserPlus,
} from 'lucide-react';
import type { WalletMember, UserRole, ShareStatus } from '../types';

interface SharingManagerProps {
  walletName: string;
  members: WalletMember[];
  onShareWallet: (email: string, role: UserRole) => Promise<void>;
  onRevokeAccess: (memberId: string) => Promise<void>;
  onUpdateRole: (memberId: string, role: UserRole) => Promise<void>;
  currentUserEmail: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const roleConfig: Record<
  UserRole,
  { label: string; icon: typeof Eye; color: string; description: string }
> = {
  owner: {
    label: 'Owner',
    icon: Crown,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    description: 'Full control including sharing and managing roles',
  },
  editor: {
    label: 'Editor',
    icon: Edit3,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description: 'Can add, edit, and delete entries',
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    description: 'Can only view data, cannot make changes',
  },
};

const statusConfig: Record<ShareStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50' },
  accepted: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  declined: { label: 'Declined', color: 'text-red-600', bg: 'bg-red-50' },
};

export function SharingManager({
  walletName,
  members,
  onShareWallet,
  onRevokeAccess,
  onUpdateRole,
  currentUserEmail,
  isOpen,
  onClose,
}: SharingManagerProps) {
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer');
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showRoleMenu, setShowRoleMenu] = useState<string | null>(null);

  const handleShare = async () => {
    if (!email.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (email === currentUserEmail) {
      setError('Cannot share with yourself');
      return;
    }

    // Check if already shared
    const alreadyShared = members.some(m => 
      m.userEmail.toLowerCase() === email.toLowerCase().trim() && 
      m.status !== 'declined'
    );
    if (alreadyShared) {
      setError('This user already has access or has a pending invitation');
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      await onShareWallet(email.trim(), selectedRole);
      setEmail('');
      setSelectedRole('viewer');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to share access. Please try again.'
      );
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevoke = async (accessId: string) => {
    if (!confirm('Are you sure you want to revoke access for this user?')) return;

    try {
      await onRevokeAccess(accessId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to revoke access. Please try again.'
      );
    }
  };

  const handleRoleChange = async (accessId: string, newRole: UserRole) => {
    setUpdatingId(accessId);
    setShowRoleMenu(null);

    try {
      await onUpdateRole(accessId, newRole);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update role. Please try again.'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter out the owner (members with userId matching owner should not appear)
  const sharedMembers = members.filter(m => m.status !== 'declined');

  return (
    <>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-neutral-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Share2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-xl text-neutral-900">Share "{walletName}"</h2>
                      <p className="text-sm text-neutral-500">
                        Manage who can view or edit this wallet
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                  {/* Add New User */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                      Add New User
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="Enter email address..."
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleShare();
                          }}
                          className="w-full px-4 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                          Role
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['editor', 'viewer'] as UserRole[]).map((role) => {
                            const config = roleConfig[role];
                            const Icon = config.icon;
                            return (
                              <button
                                key={role}
                                onClick={() => setSelectedRole(role)}
                                className={`p-3 rounded-xl border-2 transition-all text-left ${
                                  selectedRole === role
                                    ? config.color
                                    : 'border-neutral-200 hover:border-neutral-300'
                                }`}
                              >
                                <Icon className="w-4 h-4 mb-1" />
                                <p className="font-semibold text-sm">{config.label}</p>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-neutral-500 mt-2">
                          {roleConfig[selectedRole].description}
                        </p>
                      </div>

                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {error}
                        </motion.div>
                      )}

                      <button
                        onClick={handleShare}
                        disabled={!email.trim() || isSharing}
                        className="w-full py-3 font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        {isSharing ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                          />
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            Share Access
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Shared Users List */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                      Shared With ({sharedMembers.length})
                    </h3>

                    {sharedMembers.length === 0 ? (
                      <div className="text-center py-8 bg-neutral-50 rounded-2xl">
                        <Users className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                        <p className="text-neutral-500 text-sm">
                          No one has access yet. Share your tracker to collaborate.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sharedMembers.map((member) => {
                          const config = roleConfig[member.role];
                          const Icon = config.icon;
                          const isUpdating = updatingId === member.id;
                          const statusConfig_item = statusConfig[member.status];

                          return (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl"
                            >
                              <div className="flex items-center gap-3">
                                {member.userPhotoURL ? (
                                  <img
                                    src={member.userPhotoURL}
                                    alt={member.userName || ''}
                                    className="w-10 h-10 rounded-full"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-neutral-200 rounded-full flex items-center justify-center">
                                    <Users className="w-5 h-5 text-neutral-400" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-neutral-900 text-sm">
                                    {member.userName || member.userEmail}
                                  </p>
                                  <p className="text-xs text-neutral-500">
                                    {member.userEmail}
                                  </p>
                                  {member.status === 'pending' && (
                                    <span className={`text-xs ${statusConfig_item.color} font-medium`}>
                                      {statusConfig_item.label} - Waiting for response
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Status Badge */}
                                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusConfig_item.bg} ${statusConfig_item.color}`}>
                                  {statusConfig_item.label}
                                </span>

                                {/* Role Selector - only for accepted members */}
                                {member.status === 'accepted' && (
                                  <div className="relative">
                                    <button
                                      onClick={() =>
                                        setShowRoleMenu(
                                          showRoleMenu === member.id ? null : member.id
                                        )
                                      }
                                      disabled={isUpdating}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${config.color}`}
                                    >
                                      <Icon className="w-3 h-3" />
                                      {config.label}
                                      <ChevronDown className="w-3 h-3" />
                                    </button>

                                    {/* Role Dropdown */}
                                    <AnimatePresence>
                                      {showRoleMenu === member.id && (
                                        <motion.div
                                          initial={{ opacity: 0, y: -10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, y: -10 }}
                                          className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-10 min-w-[120px]"
                                        >
                                          {(['editor', 'viewer'] as UserRole[]).map(
                                            (role) => {
                                              const roleConfig_item = roleConfig[role];
                                              const RoleIcon = roleConfig_item.icon;
                                              return (
                                                <button
                                                  key={role}
                                                  onClick={() =>
                                                    handleRoleChange(member.id!, role)
                                                  }
                                                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-neutral-50 transition-colors ${
                                                    member.role === role
                                                      ? 'text-neutral-900'
                                                      : 'text-neutral-600'
                                                  }`}
                                                >
                                                  <RoleIcon className="w-3 h-3" />
                                                  {roleConfig_item.label}
                                                </button>
                                              );
                                            }
                                          )}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )}

                                {/* Revoke Button */}
                                <button
                                  onClick={() => handleRevoke(member.id!)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Revoke access"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Role Legend */}
                  <div className="bg-neutral-50 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                      Permission Levels
                    </h4>
                    {(['owner', 'editor', 'viewer'] as UserRole[]).map((role) => {
                      const config = roleConfig[role];
                      const Icon = config.icon;
                      return (
                        <div key={role} className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-neutral-900">
                              {config.label}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {config.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default SharingManager;
