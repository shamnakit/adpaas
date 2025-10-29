// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}', './app/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { rose:'#ff4d57', pink:'#ff7ab8', violet:'#8b5cf6', indigo:'#6366f1', blue:'#3b82f6' },
        ink: { 900:'#0f172a', 800:'#1e293b', 700:'#334155', 600:'#475569', 500:'#64748b' },
      },
      boxShadow: {
        'brand-md': '0 12px 28px -12px rgba(99,102,241,.35)',
        'brand-lg': '0 22px 50px -18px rgba(139,92,246,.45)',
      },
      backgroundImage: {
        'brand-linear': 'linear-gradient(90deg, #ff4d57 0%, #8b5cf6 55%, #3b82f6 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
