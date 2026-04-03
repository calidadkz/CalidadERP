
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./{components,features,services,types,views}/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
