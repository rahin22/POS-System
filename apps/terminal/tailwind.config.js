/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ee',
          100: '#fdedd6',
          200: '#f9d7ad',
          300: '#f5ba78',
          400: '#f09341',
          500: '#ec7a1c',
          600: '#dd6012',
          700: '#b74811',
          800: '#923a16',
          900: '#763215',
        },
      },
    },
  },
  plugins: [],
}
