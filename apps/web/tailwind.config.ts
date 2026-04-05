import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./providers/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0d1117",
        "bg-secondary": "#161b22",
        "bg-card": "#1c2333",
        "border-primary": "#1e2937",
        "text-primary": "#e6edf3",
        "text-secondary": "#8b949e",
        "accent-green": "#22c55e",
        "accent-red": "#ef4444",
        "accent-blue": "#58a6ff",
        "accent-purple": "#a855f7",
        "accent-yellow": "#eab308",
      },
      fontFamily: {
        mono: ["ui-monospace", "SF Mono", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
