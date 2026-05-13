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
        // Primary scale — Rose #FF2C5D
        blush: {
          50:  '#FFF0F4',
          100: '#FFD6E0',
          200: '#FFB5C5',
          300: '#FF85A3',
          400: '#FF5580',
          500: '#FF2C5D',
          600: '#E0144A',
          700: '#BE1040',
          800: '#9C0D36',
          900: '#7A0B2D',
        },
        // Neutral scale — Dark Plum #3D2535
        nude: {
          50:  '#FAFAFA',
          100: '#F5F0F0',
          200: '#EDE5E8',
          300: '#D4C4CB',
          400: '#9C7A8B',
          500: '#7A5A6A',
          600: '#5D3F50',
          700: '#4A2D3E',
          800: '#3D2535',
          900: '#2A1825',
        },
        // Semantic aliases
        pouchy: {
          primary:     '#FF2C5D',
          secondary:   '#3D2535',
          accent:      '#FFB5C5',
          surface:     '#FEFEFE',
          neutral:     '#FAFAFA',
          muted:       '#9C7A8B',
          border:      '#F5F0F0',
          success:     '#22C55E',
          danger:      '#FF4757',
          alternative: '#8B5FBF',
        },
      },
      fontFamily: {
        sans:    ['var(--font-body)',    'Noto Sans TC', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'Plus Jakarta Sans', 'DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)',    'DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
