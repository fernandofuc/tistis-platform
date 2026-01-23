import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'tis-bg-primary': 'rgb(246, 246, 246)',
        'tis-bg-secondary': 'rgb(225, 222, 213)',

        // Accents - TIS TIS Brand Colors
        'tis-coral': {
          DEFAULT: 'rgb(223, 115, 115)',
          50: 'rgba(223, 115, 115, 0.05)',
          100: 'rgba(223, 115, 115, 0.1)',
          200: 'rgba(223, 115, 115, 0.2)',
          300: 'rgba(223, 115, 115, 0.3)',
          400: 'rgba(223, 115, 115, 0.6)',
          500: 'rgb(223, 115, 115)',
          600: 'rgb(200, 95, 95)',
          700: 'rgb(180, 75, 75)',
        },
        'tis-pink': {
          DEFAULT: 'rgb(194, 51, 80)',
          50: 'rgba(194, 51, 80, 0.05)',
          100: 'rgba(194, 51, 80, 0.1)',
          200: 'rgba(194, 51, 80, 0.2)',
        },
        'tis-green': {
          DEFAULT: '#9DB8A1',
          50: 'rgba(157, 184, 161, 0.05)',
          100: 'rgba(157, 184, 161, 0.1)',
          200: 'rgba(157, 184, 161, 0.2)',
          300: 'rgba(157, 184, 161, 0.3)',
          400: '#7FA385',
          500: '#9DB8A1',
          600: '#7A9E7E',
          700: '#5A7D5E',
          800: '#3A5D3E',
          900: '#2A4D2E',
        },

        // Neutrales sofisticados (del spec)
        'slate': {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },

        // Text
        'tis-text-primary': '#0f172a',
        'tis-text-secondary': '#475569',
        'tis-text-muted': '#94a3b8',

        // Lovable-inspired gradients
        'tis-purple': '#667eea',
        'tis-purple-dark': '#764ba2',

        // Lead scoring colors (sin emojis, gradientes elegantes)
        'score-hot': {
          from: 'rgb(223, 115, 115)',
          to: 'rgb(194, 51, 80)',
        },
        'score-warm': {
          from: '#f59e0b',
          to: '#d97706',
        },
        'score-cold': {
          from: '#94a3b8',
          to: '#64748b',
        },
      },
      backgroundImage: {
        'gradient-lovable': 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(245,101,101,0.1) 50%, rgba(255,183,77,0.1) 100%)',
        'gradient-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-coral': 'linear-gradient(135deg, rgb(223,115,115) 0%, rgb(194,51,80) 100%)',
        'gradient-green': 'linear-gradient(135deg, #9DB8A1 0%, #7A9E7E 100%)',
        // Lead scoring gradients
        'gradient-hot': 'linear-gradient(135deg, rgb(223,115,115) 0%, rgb(194,51,80) 100%)',
        'gradient-warm': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-cold': 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
        // Card hero gradient (dark)
        'gradient-hero': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        // Background gradient
        'gradient-bg': 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, rgba(223,115,115,0.03) 100%)',
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Premium typography scale
        'metric': ['2rem', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '800' }],
        'metric-sm': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'label': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.05em', fontWeight: '500' }],
        'heading-lg': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-sm': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.1em', fontWeight: '600' }],
      },
      boxShadow: {
        'coral': '0 10px 30px -5px rgba(223, 115, 115, 0.3)',
        // Premium card shadows (del spec)
        'card': '0 1px 2px rgba(0, 0, 0, 0.02), 0 4px 8px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 4px 8px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.04)',
        'card-elevated': '0 4px 12px rgba(0, 0, 0, 0.05), 0 12px 32px rgba(0, 0, 0, 0.05)',
        // Lead score badge shadow
        'score': '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      animation: {
        'shimmer': 'shimmer 1.5s infinite',
        'pulse-soft': 'pulse-soft 2s infinite',
        'slide-up': 'slide-up 0.2s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      transitionProperty: {
        'card': 'transform, box-shadow, border-color',
      },
    },
  },
  plugins: [],
};

export default config;
