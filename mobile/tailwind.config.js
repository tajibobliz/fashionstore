/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f4',
          100: '#fde6e9',
          200: '#fbcfd5',
          300: '#f7a7b1',
          400: '#f27587',
          500: '#e94560', // color acento principal (rosa/coral)
          600: '#d63052',
          700: '#b32444',
          800: '#95213e',
          900: '#7d1f38',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};