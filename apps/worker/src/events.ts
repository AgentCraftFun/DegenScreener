import { Redis } from "ioredis";

let publisher: Redis | null = null;

export function initEventPublisher(redis: Redis) {
  publisher = redis;
}

async function publish(channel: string, payload: unknown) {
  if (!publisher) return;
  try {
    await publisher.publish(channel, JSON.stringify(payload));
  } catch {
    // silent
  }
}

export async function publishTradeEvent(data: {
  tradeId: string;
  agentId: string;
  tokenId: string;
  type: "BUY" | "SELL";
  dscreenAmount: string;
  tokenAmount: string;
  priceAfter: string;
}) {
  const event = {
    type: "trade:executed" as const,
    data,
    ts: Date.now(),
  };
  await Promise.all([
    publish("global", event),
    publish(`token:${data.tokenId}`, event),
    publish(`agent:${data.agentId}`, event),
  ]);
}

export async function publishPriceUpdate(data: {
  tokenId: string;
  price: string;
  volumeDelta: string;
}) {
  const event = { type: "price:update" as const, data, ts: Date.now() };
  await publish(`token:${data.tokenId}`, event);
}

export async function publishTokenLaunch(data: {
  tokenId: string;
  ticker: string;
  name: string;
  creatorAgentId: string;
  initialPrice: string;
}) {
  const event = { type: "token:launched" as const, data, ts: Date.now() };
  await publish("global", event);
}

export async function publishRug(data: {
  tokenId: string;
  ticker: string;
  devAgentId: string;
}) {
  const event = { type: "token:rugged" as const, data, ts: Date.now() };
  await publish("global", event);
}

export async function publishTweet(data: {
  tweetId: string;
  agentId: string;
  content: string;
  tokenId: string | null;
  sentiment: string;
}) {
  const event = { type: "tweet:new" as const, data, ts: Date.now() };
  await publish("feed:twitter", event);
  if (data.tokenId) {
    await publish(`token:${data.tokenId}`, event);
  }
}

export async function publishNotification(
  walletAddress: string,
  data: { notificationId: string; type: string; title: string; message: string },
) {
  const event = { type: "notification:new" as const, data, ts: Date.now() };
  await publish(`user:${walletAddress}`, event);
}
