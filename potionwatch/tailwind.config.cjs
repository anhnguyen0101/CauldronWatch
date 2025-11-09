module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dual-theme color system
        background: {
          light: '#f9f9f9',
          dark: '#1e1e1e'
        },
        panel: {
          light: '#ffffff',
          dark: '#2a2a2a'
        },
        border: {
          light: '#e5e5e5',
          dark: '#3a3a3a'
        },
        accent: '#38bdf8',
        success: '#22c55e',
        warning: '#facc15',
        danger: '#ef4444',
        text: {
          light: '#111111',
          dark: '#f5f5f5'
        }
      },
      borderRadius: {
        '2xl': '1rem'
      }
    }
  },
  plugins: [],
}
