/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // AMICO - JASNY motyw: biel + granatowe akcenty. Przejrzysty, wysoki kontrast.
        // Skala "stone" = neutralne tło/tekst (polaryzacja jasna: 50 = biel, 900 = prawie czerń).
        stone: {
          25: '#fcfcfd',
          50: '#ffffff', // tło strony (biel)
          100: '#f3f4f7', // subtelne wypełnienie / hover
          200: '#e6e8ee', // obramowania / dzielniki
          300: '#d3d7e0', // mocniejsze obramowanie / input
          400: '#8b91a0', // tekst przygaszony / placeholder / ikony
          500: '#5c6472', // tekst drugorzędny
          600: '#3b414d', // tekst
          700: '#232833', // tekst mocny
          800: '#161a22',
          900: '#0d1017',
        },
        // Akcent - granatowy (navy). 700 = podstawowy granat na przyciskach/akcentach.
        brand: {
          50: '#eef1f9',
          100: '#dde3f3',
          200: '#c1cbe8',
          300: '#98a6d5',
          400: '#6979b4',
          500: '#43548f',
          600: '#2a3a6e',
          700: '#1d2a56', // podstawowy granat (przyciski, aktywne, nagłówki sekcji)
          800: '#162043',
          900: '#0e1533',
          950: '#0a0f26',
        },
        navy: {
          DEFAULT: '#0e1224',
          deep: '#080b16',
          tile: '#0e1533',
        },
        gold: {
          400: '#b98a2e',
          500: '#a9791f',
          600: '#8a6414',
        },
        ink: '#141821', // podstawowy tekst (nagłówki) - ciemny
      },
      fontFamily: {
        display: ['"Inter Tight Variable"', '"Inter Tight"', '"Space Grotesk Variable"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['"Inter Tight Variable"', '"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
        grotesk: ['"Space Grotesk Variable"', '"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.375rem',
        xl: '0.5rem',
        '2xl': '0.75rem',
      },
      boxShadow: {
        // Miekkie, jasne cienie (granatowy odcien zamiast czystej czerni - eleganciej na bieli).
        card: '0 1px 2px rgba(16,24,40,0.05), 0 10px 30px -16px rgba(16,24,40,0.14)',
        pop: '0 20px 60px -20px rgba(16,24,40,0.28)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease both',
        'scale-in': 'scale-in 0.18s ease both',
      },
    },
  },
  plugins: [],
}
