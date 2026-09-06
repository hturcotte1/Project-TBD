import type { Config } from 'tailwindcss';

/**
 * Tailwind is a thin alias layer over apps/web/app/tokens.css. The default palette, font sizes,
 * radii and shadows are replaced, not extended, so a stock palette class, `text-xs`,
 * `rounded-2xl` or `shadow-md` does not exist. Every value below is a var(--…) from tokens.css.
 */
const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      page: 'var(--page)',
      s1: 'var(--s1)',
      s2: 'var(--s2)',
      s3: 'var(--s3)',
      line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
      fg: { DEFAULT: 'var(--fg)', 2: 'var(--fg-2)', 3: 'var(--fg-3)', 'on-brand': 'var(--fg-on-brand)' },
      brand: { DEFAULT: 'var(--brand)', soft: 'var(--brand-soft)' },
      heat: {
        1: 'var(--heat-1)',
        2: 'var(--heat-2)',
        3: 'var(--heat-3)',
        4: 'var(--heat-4)',
        5: 'var(--heat-5)',
      },
      ok: 'var(--ok)',
      err: 'var(--err)',
      focus: 'var(--focus)',
    },
    fontFamily: {
      ui: ['var(--font-ui)', 'Hanken Grotesk', 'Helvetica Neue', 'Arial', 'sans-serif'],
      count: ['var(--font-count)', 'Bricolage Grotesque', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['var(--font-mono)'],
    },
    fontSize: {
      12: ['var(--text-12)', { lineHeight: 'var(--lh-12)' }],
      14: ['var(--text-14)', { lineHeight: 'var(--lh-14)' }],
      17: ['var(--text-17)', { lineHeight: 'var(--lh-17)' }],
      22: ['var(--text-22)', { lineHeight: 'var(--lh-22)' }],
      28: ['var(--text-28)', { lineHeight: 'var(--lh-28)' }],
      34: ['var(--text-34)', { lineHeight: 'var(--lh-34)' }],
      43: ['var(--text-43)', { lineHeight: 'var(--lh-43)' }],
      54: ['var(--text-54)', { lineHeight: 'var(--lh-54)' }],
      67: ['var(--text-67)', { lineHeight: 'var(--lh-67)' }],
      84: ['var(--text-84)', { lineHeight: 'var(--lh-84)' }],
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
    },
    borderRadius: {
      none: '0',
      DEFAULT: 'var(--radius-control)',
      lg: 'var(--radius-float)',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      float: 'var(--shadow-float)',
    },
    extend: {
      spacing: {
        row: 'var(--row)',
        'row-touch': 'var(--row-touch)',
        rail: 'var(--rail)',
        'rail-collapsed': 'var(--rail-collapsed)',
        tabbar: 'var(--tabbar)',
      },
      maxWidth: {
        content: 'var(--content-max)',
        measure: 'var(--measure)',
      },
      transitionTimingFunction: {
        settle: 'var(--ease-settle)',
        out: 'var(--ease-out)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        open: 'var(--dur-open)',
        settle: 'var(--dur-settle)',
      },
      keyframes: {
        'typing-dot': {
          '0%, 60%, 100%': { opacity: '0.25', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-2px)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': { from: { transform: 'translateX(16px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        'slide-in-up': { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'progress-slide': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(300%)' } },
        // Button `loading` spinner. Tailwind's own `animate-spin` isn't part of this app's
        // replaced animation scale, so it needs its own entry here.
        spin: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'typing-dot': 'typing-dot 1.2s ease-in-out infinite',
        'fade-in': 'fade-in var(--dur-open) var(--ease-out)',
        'slide-in-right': 'slide-in-right var(--dur-open) var(--ease-out)',
        'slide-in-up': 'slide-in-up var(--dur-open) var(--ease-out)',
        'progress-slide': 'progress-slide 1.2s var(--ease-settle) infinite',
        spin: 'spin 0.6s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
