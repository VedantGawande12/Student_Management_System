/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cit: {
          blue: '#0F2A4A',
          teal: '#0D9488',
          accent: '#2563EB',
          subtle: '#F8FAFC',
          border: '#E2E8F0'
        }
      }
    },
  },
  plugins: [],
}

