"use client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WebSocketProvider } from "./WebSocketProvider";
import { wagmiConfig } from "../lib/wagmi-config";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>{children}</WebSocketProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
