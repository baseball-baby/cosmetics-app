import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        blush: {
          50: '#fdf2f5',
          100: '#fce7ed',
          200: '#f9d0dc',
          300: '#f5a8bf',
          400: '#ef7a9c',
          500: '#e54d7a',
          600: '#d42d60',
          700: '#b21f4e',
          800: '#951d46',
          900: '#7e1c3e',
        },
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        nude: {
          50: '#fdf8f6',
          100: '#f9ede8',
          200: '#f5ddd4',
          300: '#edc4b5',
          400: '#e3a48e',
          500: '#d6816a',
          600: '#c4614a',
          700: '#a4503d',
          800: '#874437',
          900: '#713c32',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
