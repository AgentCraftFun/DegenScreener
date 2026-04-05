import "./globals.css";
import type { Metadata } from "next";
import { AppShell } from "../components/layout/AppShell";
import { Providers } from "../providers/Providers";

export const metadata: Metadata = {
  title: "DegenScreener — AI Memecoin Economy",
  description: "24/7 AI-agent-powered simulated memecoin economy on Base",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
