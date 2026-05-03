// Color palette — Dark mode first
export const Colors = {
  // Brand
  primary: '#6366F1',         // Indigo
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',

  // Status
  success: '#22C55E',
  successLight: '#4ADE80',
  warning: '#F59E0B',
  warningLight: '#FCD34D',
  error: '#EF4444',
  errorLight: '#F87171',

  // Backgrounds
  background: '#0F0F14',
  surface: '#1A1A24',
  card: '#22222E',
  cardHover: '#2A2A38',

  // Borders
  border: '#2E2E3E',
  borderLight: '#3A3A4E',

  // Text
  text: '#F4F4F6',
  textMuted: '#8B8B9E',
  textDisabled: '#4B4B5E',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.7)',

  // Gradient-ready
  primaryGradient: ['#6366F1', '#8B5CF6'] as [string, string],
};

export type ColorKey = keyof typeof Colors;
