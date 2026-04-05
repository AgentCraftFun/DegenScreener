"use client";
import { createContext, useContext } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

interface WsCtx {
  status: "connecting" | "connected" | "disconnected" | "reconnecting";
  send: (msg: unknown) => void;
}

const WebSocketContext = createContext<WsCtx>({
  status: "disconnected",
  send: () => {},
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { status, send } = useWebSocket(WS_URL);
  return (
    <WebSocketContext.Provider value={{ status, send }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWs = () => useContext(WebSocketContext);
