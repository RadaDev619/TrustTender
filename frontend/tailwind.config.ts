import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}",
    "../shared/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          ink: "#172033",
          green: "#14532d",
          blue: "#1d4ed8",
          maroon: "#7f1d1d",
          gold: "#b7791f",
          mist: "#f6f8fb",
        },
      },
      boxShadow: {
        panel: "0 1px 2px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
