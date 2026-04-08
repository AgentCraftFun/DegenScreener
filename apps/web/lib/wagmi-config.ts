import { http, createConfig } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://sepolia.base.org",
    ),
    [base.id]: http("https://mainnet.base.org"),
  },
});
