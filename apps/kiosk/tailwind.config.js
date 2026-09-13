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
        /*
         * Shared with the terminal app (its `primary` scale, value for value), so
         * the kiosk and the counter read as one system rather than as an amber
         * cousin of an orange product.
         *
         * Contrast notes, measured, because this scale is darker than the amber it
         * replaced and that changes which steps are safe for text:
         *   - on brand-500, ink-900 is 6.34:1 and white is 2.85:1. Body copy on an
         *     orange panel stays ink-900; white fails even the large-text bar.
         *   - on a near-white surface, brand-500 is 2.76:1 and brand-600 is 3.53:1.
         *     Orange TEXT therefore starts at brand-700 (5.15:1). 500 and 600 are
         *     fill colours only.
         */
        brand: {
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
        /*
         * Near-white with a trace of warmth. The old cream was amber-tinted to sit
         * under an amber brand; against this orange it read as a competing colour
         * rather than as paper. Keeping a little warmth stops it going clinical.
         */
        cream: {
          50: '#FFFFFF',
          100: '#FCFBF9',
          200: '#F6F4F1',
          300: '#EDE9E4',
          400: '#DFD9D2',
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
