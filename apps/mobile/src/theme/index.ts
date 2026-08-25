export * from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const typography = {
  titleLarge: 'text-2xl font-bold tracking-tight text-slate-100',
  titleMedium: 'text-xl font-semibold tracking-tight text-slate-100',
  titleSmall: 'text-lg font-medium text-slate-100',
  bodyLarge: 'text-base text-slate-200',
  bodyMedium: 'text-sm text-slate-300',
  bodySmall: 'text-xs text-slate-400',
  caption: 'text-xs text-slate-500 font-mono',
} as const;
