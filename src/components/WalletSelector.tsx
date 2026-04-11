import React, { useState } from 'react';
import type { WalletWithMembers } from '../hooks/useWallets';
import type { User } from 'firebase/auth';
import { Wallet, ChevronDown, Plus, Users, Star, MoreVertical, Edit2, Trash2, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WalletSelectorProps {
  wallets: WalletWithMembers[];
  selectedWallet: WalletWithMembers | null;
  onSelectWallet: (walletId: string) => void;
  onCreateWallet: () => void;
  onEditWallet: (wallet: WalletWithMembers) => void;
  onDeleteWallet: (wallet: WalletWithMembers) => void;
  onShareWallet: (wallet: WalletWithMembers) => void;
  onSetDefault: (walletId: string) => void;
  user: User;
}

export function WalletSelector({
  wallets,
  selectedWallet,
  onSelectWallet,
  onCreateWallet,
  onEditWallet,
  onDeleteWallet,
  onShareWallet,
  onSetDefault,
  user,
}: WalletSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const getWalletIcon = (wallet: WalletWithMembers) => {
    if (wallet.isDefault) {
      return <Star className="w-4 h-4 text-amber-500 fill-amber-500" />;
    }
    if (wallet.ownerId !== user.uid) {
      return <Users className="w-4 h-4 text-blue-500" />;
    }
    return <Wallet className="w-4 h-4 text-emerald-500" />;
  };

  const getWalletBadge = (wallet: WalletWithMembers) => {
    if (wallet.myStatus === 'pending') {
      return (
        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
          Pending
        </span>
      );
    }
    if (wallet.ownerId !== user.uid) {
      return (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full capitalize">
          {wallet.myRole}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="relative">
      {/* Selected Wallet Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full bg-white border border-neutral-200 rounded-xl p-3 hover:border-emerald-300 hover:shadow-sm transition-all"
      >
        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
          {selectedWallet ? (
            getWalletIcon(selectedWallet)
          ) : (
            <Wallet className="w-5 h-5 text-emerald-600" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="font-semibold text-neutral-800 truncate">
            {selectedWallet?.name || 'Select a wallet'}
          </p>
          <p className="text-xs text-neutral-400 truncate">
            {selectedWallet?.ownerId === user.uid ? 'Owned by you' : `Shared by ${selectedWallet?.ownerName || selectedWallet?.ownerEmail}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedWallet && getWalletBadge(selectedWallet)}
          <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Wallet Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-neutral-200 z-50 overflow-hidden max-h-96"
            >
              {/* My Wallets Section */}
              {wallets.filter(w => w.ownerId === user.uid).length > 0 && (
                <div className="border-b border-neutral-100">
                  <p className="px-4 py-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    My Wallets
                  </p>
                  {wallets
                    .filter(w => w.ownerId === user.uid)
                    .map(wallet => (
                      <div
                        key={wallet.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors cursor-pointer ${
                          selectedWallet?.id === wallet.id ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <button
                          onClick={() => {
                            onSelectWallet(wallet.id);
                            setIsOpen(false);
                          }}
                          className="flex-1 flex items-center gap-3 min-w-0"
                        >
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            {wallet.isDefault ? (
                              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            ) : (
                              <Wallet className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-medium text-neutral-800 truncate">{wallet.name}</p>
                            {wallet.isDefault && (
                              <p className="text-xs text-amber-600">Default</p>
                            )}
                          </div>
                          {selectedWallet?.id === wallet.id && (
                            <Check className="w-5 h-5 text-emerald-600" />
                          )}
                        </button>

                        {/* Actions Menu */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(menuOpen === wallet.id ? null : wallet.id);
                            }}
                            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {menuOpen === wallet.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 min-w-40 z-50">
                              <button
                                onClick={() => {
                                  onShareWallet(wallet);
                                  setMenuOpen(null);
                                  setIsOpen(false);
                                }}
                                className="w-full px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                              >
                                <Share2 className="w-4 h-4" />
                                Share
                              </button>
                              <button
                                onClick={() => {
                                  onEditWallet(wallet);
                                  setMenuOpen(null);
                                  setIsOpen(false);
                                }}
                                className="w-full px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                              {!wallet.isDefault && (
                                <button
                                  onClick={() => {
                                    onSetDefault(wallet.id);
                                    setMenuOpen(null);
                                  }}
                                  className="w-full px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                                >
                                  <Star className="w-4 h-4" />
                                  Set Default
                                </button>
                              )}
                              <hr className="my-1 border-neutral-100" />
                              <button
                                onClick={() => {
                                  onDeleteWallet(wallet);
                                  setMenuOpen(null);
                                  setIsOpen(false);
                                }}
                                className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Shared Wallets Section */}
              {wallets.filter(w => w.ownerId !== user.uid).length > 0 && (
                <div className="border-b border-neutral-100">
                  <p className="px-4 py-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Shared With Me
                  </p>
                  {wallets
                    .filter(w => w.ownerId !== user.uid)
                    .map(wallet => (
                      <button
                        key={wallet.id}
                        onClick={() => {
                          onSelectWallet(wallet.id);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors ${
                          selectedWallet?.id === wallet.id ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          {wallet.myStatus === 'pending' ? (
                            <Users className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Users className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-neutral-800 truncate">{wallet.name}</p>
                          <p className="text-xs text-neutral-400 truncate">
                            by {wallet.ownerName || wallet.ownerEmail}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {wallet.myStatus === 'pending' && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                              Pending
                            </span>
                          )}
                          {selectedWallet?.id === wallet.id && (
                            <Check className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              )}

              {/* Create New Wallet */}
              <button
                onClick={() => {
                  onCreateWallet();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Create New Wallet</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
