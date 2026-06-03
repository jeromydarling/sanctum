/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm, communal, trustworthy — deep indigo primary + soft gold accent.
        ink: '#1a1530',
        primary: {
          DEFAULT: '#4338ca',
          50: '#eef0ff',
          100: '#e0e3ff',
          200: '#c6ccff',
          300: '#a3a9ff',
          400: '#7d7bf8',
          500: '#5b50ee',
          600: '#4338ca',
          700: '#372dad',
          800: '#2e288c',
          900: '#292670',
          950: '#171441',
        },
        gold: {
          DEFAULT: '#c9a84c',
          light: '#e3c878',
          dark: '#a8852f',
        },
        cream: '#faf7f2',
        stone: {
          warm: '#8b8680',
        },
        success: '#2d6a4f',
        warning: '#e9a825',
        danger: '#c0392b',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '8px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(26, 21, 48, 0.08), 0 1px 2px rgba(26, 21, 48, 0.04)',
        lift: '0 12px 32px -8px rgba(67, 56, 202, 0.22)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blob: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-40px) scale(1.1)' },
          '66%': { transform: 'translate(-20px,20px) scale(0.95)' },
        },
        'gradient-pan': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        blob: 'blob 14s ease-in-out infinite',
        'gradient-pan': 'gradient-pan 12s ease infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};
