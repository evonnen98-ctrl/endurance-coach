/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        volt:     '#C7F526',
        ink:      '#1B2027',
        mist:     '#F4F4F2',
        graphite: {
          300: '#B8BCC0',
          500: '#6B7177',
        },
      },
      fontFamily: {
        archivo: ['"Archivo"', 'sans-serif'],
        poppins: ['"Poppins"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
