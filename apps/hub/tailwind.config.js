/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './resources/views/**/*.blade.php',
    './resources/js/**/*.{vue,ts,js,jsx,tsx}',
  ],
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
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Lora"', '"Merriweather"', 'Georgia', 'serif'],
        pali: ['"Lora"', 'Georgia', 'serif'],
        display: ['"Space Grotesk"', '"Syne"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        rune: ['"Lora"', 'serif'],
      },
      animation: {
        'hop': 'hop 1s cubic-bezier(0.28, 0.84, 0.42, 1) infinite',
        'hop-fast': 'hop 0.6s cubic-bezier(0.28, 0.84, 0.42, 1) infinite',
        'mini-hop': 'miniHop 2.4s cubic-bezier(0.28, 0.84, 0.42, 1) infinite',
        'float': 'float 4s ease-in-out infinite',
        'float-slow': 'float 7s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'talisman-flutter': 'flutter 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        hop: {
          '0%, 100%': { transform: 'translateY(0) scale(1, 0.95)' },
          '30%': { transform: 'translateY(-28px) scale(0.92, 1.08)' },
          '60%': { transform: 'translateY(-32px) scale(0.95, 1.05)' },
          '85%': { transform: 'translateY(0) scale(1.08, 0.92)' },
        },
        miniHop: {
          '0%, 100%': { transform: 'translateY(0) scale(1, 0.96)' },
          '14%': { transform: 'translateY(-7px) scale(0.94, 1.06)' },
          '28%': { transform: 'translateY(-8px) scale(0.97, 1.03)' },
          '42%': { transform: 'translateY(0) scale(1.05, 0.95)' },
          '52%': { transform: 'translateY(0) scale(1, 1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-12px) rotate(2deg)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', filter: 'drop-shadow(0 0 15px rgba(0, 245, 160, 0.3))' },
          '50%': { opacity: '0.9', filter: 'drop-shadow(0 0 30px rgba(0, 245, 160, 0.8))' },
        },
        flutter: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-4deg) skewX(2deg)' },
          '75%': { transform: 'rotate(4deg) skewX(-2deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(0, 245, 212, 0.4)',
        'glow-mint': '0 0 30px -5px rgba(0, 245, 160, 0.45)',
        'glow-talisman': '0 0 35px -5px rgba(255, 209, 102, 0.5)',
        'glow-purple': '0 0 30px -5px rgba(157, 78, 221, 0.45)',
        'glow-blood': '0 0 30px -5px rgba(255, 0, 84, 0.45)',
      }
    },
  },
  plugins: [],
}
