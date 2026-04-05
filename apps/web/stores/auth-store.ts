"use client";
import { create } from "zustand";

interface AuthState {
  userId: string | null;
  walletAddress: string | null;
  internalBalance: string;
  isConnected: boolean;
  setUser: (u: {
    id: string;
    walletAddress: string;
    internalBalance: string;
  }) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  walletAddress: null,
  internalBalance: "0",
  isConnected: false,
  setUser: (u) =>
    set({
      userId: u.id,
      walletAddress: u.walletAddress,
      internalBalance: u.internalBalance,
      isConnected: true,
    }),
  clearUser: () =>
    set({
      userId: null,
      walletAddress: null,
      internalBalance: "0",
      isConnected: false,
    }),
}));
