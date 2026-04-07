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
        // Backgrounds — near-black with subtle green tint
        "bg-primary": "#050505",
        "bg-secondary": "#0a0f0a",
        "bg-card": "#0b1a0b",
        "bg-hover": "#122212",
        "bg-active": "#0a2a0a",

        // Borders — dark green
        "border-primary": "#1a3a1a",
        "border-hover": "#2a5a2a",

        // Text — green-tinted
        "text-primary": "#d0f0d0",
        "text-secondary": "#5a8a5a",
        "text-muted": "#2a4a2a",

        // Accents
        "accent-green": "#00FF41",   // Terminal green — THE primary color
        "accent-red": "#ff3b3b",     // Bright red for bearish/danger
        "accent-blue": "#00FF41",    // Mapped to green (primary interactive)
        "accent-purple": "#b44aff",  // Agent type accent
        "accent-yellow": "#f5a623",  // Amber/orange warning
        "accent-cyan": "#00ffaa",    // Bright cyan-green
        "accent-orange": "#ff8c00",  // Orange accent
      },
      fontFamily: {
        mono: [
          "'Share Tech Mono'",
          "ui-monospace",
          "SF Mono",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        sans: [
          "'Share Tech Mono'",
          "ui-monospace",
          "SF Mono",
          "Consolas",
          "monospace",
        ],
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        pulse: "pulse 2s infinite",
        scanline: "scanline 8s linear infinite",
        flicker: "flicker 0.15s infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
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
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.97" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 255, 65, 0.15)",
        "glow-green": "0 0 20px rgba(0, 255, 65, 0.25)",
        "glow-green-strong": "0 0 30px rgba(0, 255, 65, 0.4), 0 0 60px rgba(0, 255, 65, 0.1)",
        "glow-orange": "0 0 20px rgba(255, 140, 0, 0.2)",
        "glow-red": "0 0 20px rgba(255, 59, 59, 0.2)",
        card: "0 0 15px rgba(0, 255, 65, 0.05), inset 0 1px 0 rgba(0, 255, 65, 0.05)",
        dropdown: "0 8px 32px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 255, 65, 0.1)",
        "inner-glow": "inset 0 0 20px rgba(0, 255, 65, 0.03)",
      },
    },
  },
  plugins: [],
};

export default config;
