import { WebSocketServer, WebSocket } from "ws";
import { Redis } from "ioredis";
import { jwtVerify } from "jose";
import { URL } from "node:url";

const PORT = Number(process.env.WS_PORT ?? 3001);
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me-please-32chars+",
);

interface Client {
  ws: WebSocket;
  userId: string | null;
  walletAddress: string | null;
  channels: Set<string>;
  pendingEvents: unknown[];
  tweetTimes: number[];
  lastPong: number;
}

const clients = new Set<Client>();

async function verifyToken(
  token: string,
): Promise<{ userId: string; walletAddress: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      walletAddress: payload.walletAddress as string,
    };
  } catch {
    return null;
  }
}

function sendBatch(c: Client) {
  if (c.pendingEvents.length === 0) return;
  if (c.ws.readyState !== WebSocket.OPEN) return;
  c.ws.send(JSON.stringify({ type: "batch", events: c.pendingEvents }));
  c.pendingEvents = [];
}

function enqueue(c: Client, event: unknown & { type: string }) {
  // Tweet throttle: 1/sec
  if (event.type === "tweet:new") {
    const now = Date.now();
    c.tweetTimes = c.tweetTimes.filter((t) => now - t < 1000);
    if (c.tweetTimes.length >= 1) return;
    c.tweetTimes.push(now);
  }
  c.pendingEvents.push(event);
}

function channelMatches(client: Client, channel: string): boolean {
  if (channel === "global" && client.channels.has("global")) return true;
  if (channel === "feed:twitter" && client.channels.has("feed:twitter"))
    return true;
  if (client.channels.has(channel)) return true;
  // user:{wallet} — only for that wallet
  if (channel.startsWith("user:") && client.walletAddress) {
    return channel === `user:${client.walletAddress}`;
  }
  return false;
}

async function main() {
  const wss = new WebSocketServer({ port: PORT });
  console.log(`[ws] listening on :${PORT}`);

  const sub = new Redis(REDIS_URL);
  await sub.psubscribe("global", "token:*", "agent:*", "user:*", "feed:twitter");

  sub.on("pmessage", (_pattern, channel, message) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    for (const c of clients) {
      if (channelMatches(c, channel)) {
        enqueue(c, parsed as { type: string });
      }
    }
  });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url ?? "/", `ws://localhost:${PORT}`);
    const token = url.searchParams.get("token");
    let auth: { userId: string; walletAddress: string } | null = null;
    if (token) auth = await verifyToken(token);

    const client: Client = {
      ws,
      userId: auth?.userId ?? null,
      walletAddress: auth?.walletAddress ?? null,
      channels: new Set(["global", "feed:twitter"]),
      pendingEvents: [],
      tweetTimes: [],
      lastPong: Date.now(),
    };
    if (auth) {
      client.channels.add(`user:${auth.walletAddress}`);
    }
    clients.add(client);
    console.log(
      `[ws] client connected (auth=${!!auth}), clients=${clients.size}`,
    );

    ws.on("message", (raw) => {
      let msg: { type?: string; tokenId?: string; agentId?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === "subscribe:token" && msg.tokenId) {
        client.channels.add(`token:${msg.tokenId}`);
      } else if (msg.type === "subscribe:agent" && msg.agentId) {
        client.channels.add(`agent:${msg.agentId}`);
      } else if (msg.type === "unsubscribe:token" && msg.tokenId) {
        client.channels.delete(`token:${msg.tokenId}`);
      } else if (msg.type === "unsubscribe:agent" && msg.agentId) {
        client.channels.delete(`agent:${msg.agentId}`);
      }
    });

    ws.on("pong", () => {
      client.lastPong = Date.now();
    });

    ws.on("close", () => {
      clients.delete(client);
      console.log(`[ws] client disconnected, clients=${clients.size}`);
    });
  });

  // Batching: flush every 1s
  setInterval(() => {
    for (const c of clients) sendBatch(c);
  }, 1000);

  // Heartbeat: ping every 30s, close stale
  setInterval(() => {
    const now = Date.now();
    for (const c of clients) {
      if (now - c.lastPong > 40_000) {
        try {
          c.ws.terminate();
        } catch {
          void 0;
        }
        clients.delete(c);
        continue;
      }
      try {
        c.ws.ping();
      } catch {
        void 0;
      }
    }
  }, 30_000);

  const shutdown = async (sig: string) => {
    console.log(`[ws] ${sig} received`);
    wss.close();
    await sub.quit();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
