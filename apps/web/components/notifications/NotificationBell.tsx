"use client";
import { useState, useEffect } from "react";
import { apiGet, apiPatch } from "../../hooks/useApi";
import { useNotificationStore } from "../../stores/notification-store";
import { formatRelative } from "../../lib/format";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, setNotifications, markRead } =
    useNotificationStore();

  useEffect(() => {
    apiGet<{ notifications: typeof notifications; unreadCount: number }>(
      "/api/user/notifications?limit=20",
    )
      .then((r) => setNotifications(r.notifications, r.unreadCount))
      .catch(() => {});
  }, [setNotifications]);

  const handleClick = async (id: string) => {
    markRead(id);
    await apiPatch(`/api/user/notifications/${id}`, {}).catch(() => {});
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded text-text-muted hover:text-accent-green hover:bg-bg-hover transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-accent-red text-white text-[9px] rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center font-bold shadow-[0_0_6px_rgba(255,59,59,0.5)]">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 w-80 max-h-96 overflow-y-auto bg-bg-card border border-accent-green/20 rounded shadow-dropdown z-50 animate-fade-in">
          <div className="px-3 py-2.5 border-b border-border-primary flex items-center justify-between">
            <span className="text-[12px] font-semibold text-accent-green text-glow-green">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] text-accent-orange">{unreadCount} new</span>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-[12px] text-text-muted text-center">
              No notifications
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-border-primary/50 hover:bg-bg-hover transition-colors ${
                  !n.read ? "bg-accent-green/5" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent-green mt-1.5 flex-shrink-0 shadow-[0_0_4px_rgba(0,255,65,0.5)]" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[11px] text-text-primary">
                      {n.title}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                      {n.message}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {formatRelative(n.createdAt)}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
