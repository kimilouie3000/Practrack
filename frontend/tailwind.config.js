
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Manrope", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#eff4ff",
          100: "#dbe7ff",
          500: "#4569e8",
          600: "#3155d9",
          700: "#2744b5"
        }
      },
      boxShadow: {
        soft: "0 8px 30px rgba(25, 42, 80, 0.06)"
      }
    }
  },
  plugins: []
};
