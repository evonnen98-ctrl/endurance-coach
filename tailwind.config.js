/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        swim: '#3B82F6',
        ride: '#F97316',
        run: '#22C55E',
        rest: '#9CA3AF',
      },
    },
  },
  plugins: [],
}
