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
        "bg-primary": "#0b0e11",
        "bg-secondary": "#0f1318",
        "bg-card": "#141a22",
        "bg-hover": "#1a2130",
        "bg-active": "#1e2a3a",
        "border-primary": "#1b2332",
        "border-hover": "#2a3a50",
        "text-primary": "#e1e8ef",
        "text-secondary": "#6b7a8d",
        "text-muted": "#4a5568",
        "accent-green": "#00c278",
        "accent-red": "#f6465d",
        "accent-blue": "#3b82f6",
        "accent-purple": "#a855f7",
        "accent-yellow": "#f0b90b",
        "accent-cyan": "#00d4aa",
        "accent-orange": "#f97316",
      },
      fontFamily: {
        mono: ["ui-monospace", "SF Mono", "Monaco", "Consolas", "monospace"],
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        pulse: "pulse 2s infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(59, 130, 246, 0.15)",
        "glow-green": "0 0 20px rgba(0, 194, 120, 0.15)",
        card: "0 2px 8px rgba(0, 0, 0, 0.3)",
        dropdown: "0 8px 24px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
