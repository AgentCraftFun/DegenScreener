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
        className="relative text-text-secondary hover:text-text-primary text-lg px-2"
        aria-label="Notifications"
      >
        ◔
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-accent-red text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 w-80 max-h-96 overflow-y-auto bg-bg-card border border-border-primary rounded shadow-lg z-50">
          <div className="p-3 border-b border-border-primary text-sm font-semibold">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-xs text-text-secondary">
              No notifications
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n.id)}
                className={`w-full text-left p-3 border-b border-border-primary hover:bg-bg-secondary ${
                  !n.read ? "border-l-2 border-l-accent-blue" : ""
                }`}
              >
                <div className="font-semibold text-xs text-text-primary">
                  {n.title}
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  {n.message}
                </div>
                <div className="text-[10px] text-text-secondary mt-1">
                  {formatRelative(n.createdAt)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
