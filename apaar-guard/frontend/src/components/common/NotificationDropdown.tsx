import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CheckCheck, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n/LanguageContext';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'warning' | 'danger' | 'info';
  link: string;
  timestamp: string;
  count?: number;
}

export const NotificationDropdown: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('apaar_read_notifs');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch real backend notifications
  const fetchNotifications = async () => {
    try {
      const res = await api.get<{ notifications: NotificationItem[]; total_count: number }>('/notifications');
      setNotifications(res.notifications || []);
    } catch {
      // Handled safely
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll once per minute
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const markAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    try {
      localStorage.setItem('apaar_read_notifs', JSON.stringify(Array.from(next)));
    } catch {}
  };

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    try {
      localStorage.setItem('apaar_read_notifs', JSON.stringify(Array.from(allIds)));
    } catch {}
  };

  const handleNotificationClick = (item: NotificationItem) => {
    markAsRead(item.id);
    setIsOpen(false);
    navigate(item.link);
  };

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !readIds.has(n.id);
    return true;
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'danger':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        title={t('notifications')}
        aria-label={t('notifications')}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full ring-2 ring-[#142B4A] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 text-sm">{t('notifications')}</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                  {unreadCount} {t('unreadCount')}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{t('markAllRead')}</span>
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center space-x-2 text-xs font-medium">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                filter === 'unread' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List of notifications */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 border border-emerald-200">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-500 m-0 font-medium">
                  {filter === 'unread' ? 'No unread notifications' : t('noNotifications')}
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const isRead = readIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3.5 flex items-start space-x-3 hover:bg-slate-50 transition cursor-pointer group ${
                      !isRead ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{getSeverityIcon(item.severity)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs ${!isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'} truncate m-0`}>
                          {item.title}
                        </p>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 ml-2" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed m-0">
                        {item.message}
                      </p>
                      <div className="mt-1 flex items-center space-x-2 text-[10px] text-slate-400">
                        <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span className="text-blue-600 font-semibold group-hover:underline inline-flex items-center gap-0.5">
                          View details <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
            <span className="text-[10px] text-slate-400">
              Generated in real-time from active institutional database records
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
