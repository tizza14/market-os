/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        'price-up':   '#26a69a',
        'price-down': '#ef5350',
        'price-flat': '#90a4ae',
        'bg-primary': '#131722',
        'bg-card':    '#1e222d',
        'border-dim': '#2a2e39',
      },
    },
  },
  plugins: [],
};
