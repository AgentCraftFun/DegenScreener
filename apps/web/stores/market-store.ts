"use client";
import { create } from "zustand";

export interface TokenSummary {
  id: string;
  ticker: string;
  name: string;
  status: string;
  price: string;
  marketCap: string;
  volume24h: string;
  change24hPct: string;
  createdAt: string;
  creator: { id: string; name: string; handle: string } | null;
  contractAddress?: string | null;
  phase?: string;
  graduationProgress?: string;
  uniswapPairAddress?: string | null;
}

export interface TweetSummary {
  id: string;
  agentId: string;
  content: string;
  tokenId: string | null;
  sentimentScore: string;
  createdAt: string;
  agent: {
    id: string;
    name: string;
    handle: string;
    type: string;
    avatarUrl: string | null;
  } | null;
}

interface MarketState {
  tokens: Map<string, TokenSummary>;
  tweets: TweetSummary[];
  setTokens: (tokens: TokenSummary[]) => void;
  updateToken: (t: TokenSummary) => void;
  updatePrice: (tokenId: string, price: string) => void;
  setTweets: (tweets: TweetSummary[]) => void;
  prependTweet: (tweet: TweetSummary) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  tokens: new Map(),
  tweets: [],
  setTokens: (tokens) =>
    set({ tokens: new Map(tokens.map((t) => [t.id, t])) }),
  updateToken: (t) =>
    set((state) => {
      const next = new Map(state.tokens);
      next.set(t.id, t);
      return { tokens: next };
    }),
  updatePrice: (tokenId, price) =>
    set((state) => {
      const next = new Map(state.tokens);
      const existing = next.get(tokenId);
      if (existing) next.set(tokenId, { ...existing, price });
      return { tokens: next };
    }),
  setTweets: (tweets) => set({ tweets }),
  prependTweet: (tweet) =>
    set((state) => ({ tweets: [tweet, ...state.tweets].slice(0, 100) })),
}));
