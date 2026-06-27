import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50: "#e6f3f5",
          100: "#c0e0e4",
          200: "#8fc8cf",
          300: "#5aafba",
          400: "#2f97a5",
          500: "#0A7E8C",
          600: "#096f7b",
          700: "#075a64",
          800: "#05454d",
          900: "#033137",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
