/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html", // If you have an index.html in your root
    "./src/**/*.{js,jsx,ts,tsx}", // This is the crucial line for React projects
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}