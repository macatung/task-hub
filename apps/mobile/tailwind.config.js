/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        midnight: {
          950: '#04070d',
          900: '#070b14',
          850: '#0c1220',
          800: '#11182c',
          700: '#1a233d',
          600: '#253254',
          500: '#394b7a',
        },
        talisman: {
          yellow: '#ffd166',
          gold: '#f59e0b',
          paper: '#ffea79',
          cinnabar: '#e63946',
          seal: '#ef233c',
        },
        phantom: {
          cyan: '#00f5d4',
          mint: '#00f5a0',
          blue: '#00bbf9',
          purple: '#9d4edd',
          lavender: '#c77dff',
          neon: '#7000ff',
          blood: '#ff0054',
        },
        surface: {
          DEFAULT: '#111827',
          subtle: '#0c1220',
          border: '#1e293b',
          hover: '#1a233d',
        },
        accent: {
          DEFAULT: '#00f5d4',
          purple: '#9d4edd',
          yellow: '#ffd166',
          danger: '#ff0054',
        },
      },
      fontFamily: {
        sans: ['System'],
        mono: ['Courier', 'monospace'],
      },
    },
  },
  plugins: [],
};
