import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Notification } from '../types';
import type { User } from 'firebase/auth';
import { Bell, Check, X, UserCheck, UserX, Users, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationCenterProps {
  user: User;
  onAcceptInvite: (memberId: string, walletId: string) => Promise<void>;
  onDeclineInvite: (memberId: string, walletId: string) => Promise<void>;
}

export function NotificationCenter({ user, onAcceptInvite, onDeclineInvite }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Subscribe to notifications
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      } as Notification));

      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    }, (err) => {
      console.error('Error fetching notifications:', err);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => 
        updateDoc(doc(db, 'notifications', n.id!), { read: true })
      ));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleAccept = async (notification: Notification) => {
    if (!notification.id) return;
    
    setLoading(true);
    try {
      // Find the member record by walletId and user
      const memberQuery = query(
        collection(db, 'walletMembers'),
        where('walletId', '==', notification.walletId),
        where('userEmail', '==', user.email)
      );
      
      // We need to get the member ID to accept
      // For now, we'll pass empty string and let the parent handle it
      await onAcceptInvite('', notification.walletId);
      await markAsRead(notification.id);
    } catch (err) {
      console.error('Error accepting invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async (notification: Notification) => {
    if (!notification.id) return;
    
    setLoading(true);
    try {
      await onDeclineInvite('', notification.walletId);
      await markAsRead(notification.id);
    } catch (err) {
      console.error('Error declining invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'SHARE_INVITE':
        return <Users className="w-5 h-5 text-blue-500" />;
      case 'SHARE_ACCEPTED':
        return <UserCheck className="w-5 h-5 text-emerald-500" />;
      case 'SHARE_DECLINED':
        return <UserX className="w-5 h-5 text-red-500" />;
      case 'ROLE_CHANGED':
        return <Users className="w-5 h-5 text-amber-500" />;
      case 'REMOVED':
        return <Trash2 className="w-5 h-5 text-neutral-500" />;
      default:
        return <Bell className="w-5 h-5 text-neutral-500" />;
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-neutral-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
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
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-neutral-200 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-100">
                <h3 className="font-bold text-neutral-800">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-neutral-400">
                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors ${
                        !notification.read ? 'bg-emerald-50/50' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-800 leading-relaxed">
                            {notification.message}
                          </p>
                          <p className="text-xs text-neutral-400 mt-1">
                            {notification.createdAt?.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>

                          {/* Action Buttons for Share Invites */}
                          {notification.type === 'SHARE_INVITE' && !notification.read && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleAccept(notification)}
                                disabled={loading}
                                className="flex-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleDecline(notification)}
                                disabled={loading}
                                className="flex-1 px-3 py-1.5 bg-white text-neutral-600 border border-neutral-200 text-xs font-medium rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Unread Indicator */}
                        {!notification.read && notification.type !== 'SHARE_INVITE' && (
                          <button
                            onClick={() => markAsRead(notification.id!)}
                            className="flex-shrink-0 p-1 text-neutral-400 hover:text-emerald-600 rounded-full hover:bg-emerald-50 transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
