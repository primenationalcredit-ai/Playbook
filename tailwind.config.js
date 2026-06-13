/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'asap-blue': '#1e5799',      // Primary blue from logo
        'asap-blue-dark': '#164172', // Darker blue for hover/sidebar
        'asap-blue-light': '#3a7bc8', // Lighter blue for accents
        'asap-navy': '#0d2d4f',      // Dark navy for text/sidebar
        'asap-silver': '#c0c0c0',    // Silver accent from logo badge
        'asap-white': '#ffffff',
        'asap-green': '#10b981',     // Success green
        'asap-red': '#ef4444',       // Error/warning red
        'asap-gold': '#f59e0b',      // Gold for highlights
      },
      fontFamily: {
        'display': ['DM Sans', 'system-ui', 'sans-serif'],
        'body': ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
