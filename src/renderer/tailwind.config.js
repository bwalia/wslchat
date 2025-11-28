/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Slack-like color palette
        primary: {
          50: '#f0f4ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        sidebar: {
          light: '#3f0e40',
          DEFAULT: '#350d36',
          dark: '#1a1d21',
          hover: '#4d2a4d',
          active: '#1164a3',
          text: '#bcabbc',
          textHover: '#ffffff',
        },
        channel: {
          bg: '#ffffff',
          bgDark: '#1a1d21',
          hover: '#f8f8f8',
          hoverDark: '#222529',
          border: '#e1e1e1',
          borderDark: '#3d3d3d',
        },
        message: {
          bg: '#ffffff',
          bgDark: '#1a1d21',
          hover: '#f8f8f8',
          hoverDark: '#222529',
          own: '#e8f5e9',
          ownDark: '#1b3a1f',
        },
        accent: {
          green: '#2eb67d',
          yellow: '#ecb22e',
          red: '#e01e5a',
          blue: '#36c5f0',
        },
      },
      fontFamily: {
        sans: [
          'Lato',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'Fira Sans',
          'Droid Sans',
          'Helvetica Neue',
          'sans-serif'
        ],
        mono: [
          'Monaco',
          'Menlo',
          'Consolas',
          'Courier New',
          'monospace'
        ],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'slide-out': 'slideOut 0.2s ease-in',
        'fade-in': 'fadeIn 0.15s ease-out',
        'pulse-dot': 'pulseDot 1.5s ease-in-out infinite',
        'typing': 'typing 1s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOut: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
        },
        typing: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
      },
      boxShadow: {
        'message': '0 1px 2px rgba(0, 0, 0, 0.1)',
        'dropdown': '0 4px 12px rgba(0, 0, 0, 0.15)',
        'modal': '0 8px 32px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
}
