/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // AMICO – ciemny, monochromatyczny motyw ze strony amico.kontaktio.pl
        // Skala "stone" = neutralne tło/tekst (polaryzacja jak w motywie jasnym,
        // ale wartości dobrane pod ciemne tło).
        stone: {
          25: '#0d0e14',
          50: '#0b0b10', // tło strony
          100: '#181b26', // subtelne wypełnienie / hover
          200: '#242836', // obramowania / dzielniki
          300: '#2e3342', // mocniejsze obramowanie / input
          400: '#7a7e8c', // tekst przygaszony / placeholder / ikony
          500: '#9ca3af', // tekst drugorzędny
          600: '#b4bac6', // tekst
          700: '#e5e7eb', // tekst mocny
          800: '#f0f1f3',
          900: '#f7f7f8',
        },
        // Akcent – chłodny stalowo-granatowy (nawiązanie do navy #0E1224)
        brand: {
          50: '#151a2e',
          100: '#1b2140',
          200: '#252d52',
          300: '#37416b',
          400: '#4d5a85',
          500: '#6b78a0',
          600: '#8b96b8',
          700: '#aeb6d0',
          800: '#cdd3e4',
          900: '#e8ebf3',
          950: '#f2f4f9',
        },
        navy: {
          DEFAULT: '#0e1224',
          deep: '#080b16',
          tile: '#0e1533',
        },
        gold: {
          400: '#d9d9d9',
          500: '#c9ccd6',
          600: '#aeb4c0',
        },
        ink: '#f5f5f5', // podstawowy tekst (nagłówki)
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
        card: '0 2px 8px rgba(0,0,0,0.45), 0 12px 40px -18px rgba(0,0,0,0.6)',
        pop: '0 24px 80px -20px rgba(0,0,0,0.8)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.04)',
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
