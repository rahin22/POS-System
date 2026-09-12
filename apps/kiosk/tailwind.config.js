/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  future: {
    // This machine has no pointer. Chromium still applies :hover to the last
    // element touched and keeps it there, so hover styling doubles as a stuck
    // "selected" look. Compiling every hover: variant behind (hover: hover)
    // makes the whole codebase, including .btn-* in index.css, touch-correct.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        // Al Taher brand amber (anchored on the logo mark)
        brand: {
          50: '#FFF6E6',
          100: '#FFE9C2',
          200: '#FFD68C',
          300: '#FBC15A',
          400: '#F8B133',
          500: '#F5A623',
          600: '#E2820D',
          700: '#C2660A',
          800: '#954E0A',
          900: '#6B3E0C',
        },
        // Warm cream surfaces (light, food-forward)
        cream: {
          50: '#FFFCF7',
          100: '#FFF8EF',
          200: '#FDF1E3',
          300: '#F6E6D3',
          400: '#EADBC8',
        },
        // Text and dark accents
        ink: {
          900: '#1B1510',
          800: '#2A211A',
          700: '#453729',
          600: '#6B5D4F',
          500: '#8C7E70',
          400: '#B3A899',
        },
        success: '#1B8E4B',
        danger: '#C8391F',
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // The panel is 15.6" at 1080px wide => ~0.18mm per px. A customer stands
        // 50-65cm away, so the smallest customer-facing text must be ~24px (4.3mm)
        // to stay comfortably legible for older eyes. Nothing a customer must read
        // to make a decision goes below kiosk-sm.
        'kiosk-xs': ['1.5rem', { lineHeight: '1.4' }],
        'kiosk-sm': ['1.75rem', { lineHeight: '1.45' }],
        'kiosk-base': ['2rem', { lineHeight: '1.45' }],
        'kiosk-lg': ['2.5rem', { lineHeight: '1.3' }],
        'kiosk-xl': ['3.25rem', { lineHeight: '1.2' }],
        'kiosk-2xl': ['4rem', { lineHeight: '1.12' }],
        'kiosk-3xl': ['5rem', { lineHeight: '1.05' }],
        'kiosk-hero': ['7.5rem', { lineHeight: '1' }],
      },
      borderRadius: {
        kiosk: '1.75rem',
        panel: '2.5rem',
      },
      boxShadow: {
        card: '0 2px 10px rgba(72, 47, 20, 0.08)',
        lifted: '0 12px 32px rgba(72, 47, 20, 0.14)',
        bar: '0 -8px 28px rgba(72, 47, 20, 0.10)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '70%': { transform: 'scale(1.3)', opacity: '0' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        'nudge-right': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(18px)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'nudge-right': 'nudge-right 1.8s ease-in-out infinite',
        'toast-in': 'toast-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
