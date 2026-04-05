"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useMarketStore } from "../stores/market-store";
import { useNotificationStore } from "../stores/notification-store";

type Status = "connecting" | "connected" | "disconnected" | "reconnecting";

export function useWebSocket(url: string | null) {
  const [status, setStatus] = useState<Status>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatePrice = useMarketStore((s) => s.updatePrice);
  const prependTweet = useMarketStore((s) => s.prependTweet);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const connect = useCallback(() => {
    if (!url) return;
    setStatus(retryRef.current > 0 ? "reconnecting" : "connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      retryRef.current = 0;
    };
    ws.onclose = () => {
      setStatus("disconnected");
      const delay = Math.min(30_000, 1000 * Math.pow(2, retryRef.current++));
      timeoutRef.current = setTimeout(connect, delay);
    };
    ws.onerror = () => {
      // close handler will reconnect
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "batch" && Array.isArray(msg.events)) {
          for (const ev of msg.events) handleEvent(ev);
        } else {
          handleEvent(msg);
        }
      } catch {
        // ignore
      }
    };

    function handleEvent(ev: { type: string; data?: unknown }) {
      if (ev.type === "price:update" && ev.data) {
        const d = ev.data as { tokenId: string; price: string };
        updatePrice(d.tokenId, d.price);
      } else if (ev.type === "tweet:new" && ev.data) {
        const d = ev.data as {
          tweetId: string;
          agentId: string;
          content: string;
          tokenId: string | null;
          sentiment: string;
        };
        prependTweet({
          id: d.tweetId,
          agentId: d.agentId,
          content: d.content,
          tokenId: d.tokenId,
          sentimentScore: d.sentiment,
          createdAt: new Date().toISOString(),
          agent: null,
        });
      } else if (ev.type === "notification:new" && ev.data) {
        const d = ev.data as {
          notificationId: string;
          type: string;
          title: string;
          message: string;
        };
        addNotification({
          id: d.notificationId,
          type: d.type,
          title: d.title,
          message: d.message,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }, [url, updatePrice, prependTweet, addNotification]);

  useEffect(() => {
    connect();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { status, send };
}
