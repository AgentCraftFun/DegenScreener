"use client";
import { create } from "zustand";

export interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: NotificationSummary[];
  unreadCount: number;
  setNotifications: (n: NotificationSummary[], unreadCount: number) => void;
  addNotification: (n: NotificationSummary) => void;
  markRead: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications, unreadCount) =>
    set({ notifications, unreadCount }),
  addNotification: (n) =>
    set((state) => ({
      notifications: [n, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    })),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((x) =>
        x.id === id ? { ...x, read: true } : x,
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
}));
