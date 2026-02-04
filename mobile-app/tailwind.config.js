/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
        mono: ['SpaceMono'],
      },
      colors: {
        // Soft fintech blue
        primary: {
          50: '#EFF7FF',
          100: '#DBEEFF',
          200: '#B7DCFF',
          300: '#8EC7FF',
          400: '#69B3FF',
          500: '#4FA3FF',
          600: '#2E86F5',
          700: '#1F6CD1',
          800: '#1E57A3',
          900: '#1B467F',
        },
        surface: {
          0: '#FFFFFF',
          1: '#F7F9FC',
          2: '#EEF2F8',
        },
        ink: {
          900: '#0B1220',
          700: '#243044',
          500: '#4A5568',
          300: '#A0AEC0',
        },
        stroke: {
          100: 'rgba(15, 23, 42, 0.08)',
          200: 'rgba(15, 23, 42, 0.12)',
        },
        danger: {
          500: '#EF4444',
        },
        success: {
          500: '#22C55E',
        },
      },
    },
  },
  plugins: [],
};
