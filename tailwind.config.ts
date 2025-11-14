import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'tis-bg-primary': 'rgb(246, 246, 246)',
        'tis-bg-secondary': 'rgb(225, 222, 213)',

        // Accents
        'tis-coral': 'rgb(223, 115, 115)',
        'tis-pink': 'rgb(194, 51, 80)',
        'tis-green': {
          DEFAULT: '#9DB8A1',
        },

        // Text
        'tis-text-primary': '#1a202c',
        'tis-text-secondary': '#4a5568',
        'tis-text-muted': '#718096',

        // Lovable-inspired gradients
        'tis-purple': '#667eea',
        'tis-purple-dark': '#764ba2',
      },
      backgroundImage: {
        'gradient-lovable': 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(245,101,101,0.1) 50%, rgba(255,183,77,0.1) 100%)',
        'gradient-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-coral': 'linear-gradient(135deg, rgb(223,115,115) 0%, rgb(194,51,80) 100%)',
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'coral': '0 10px 30px -5px rgba(223, 115, 115, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
