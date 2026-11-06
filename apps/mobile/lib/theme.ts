export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  primarySoft: string;
  text: string;
  muted: string;
  danger: string;
  sponsored: string;
  border: string;
}

export interface Theme {
  mode: Exclude<ThemeMode, 'system'>;
  dark: boolean;
  colors: ThemeColors;
  radius: number;
  spacing: { xs: 4; sm: 8; md: 12; lg: 16; xl: 24; xxl: 32 };
  type: {
    body: number;
    bodyLineHeight: number;
    title: number;
    caption: number;
  };
}

const LIGHT: ThemeColors = {
  bg: '#F6F7F4',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF2EE',
  primary: '#3F7A6B',
  primarySoft: '#E4EEE9',
  text: '#1C2422',
  muted: '#6B7B77',
  danger: '#B4564B',
  sponsored: '#C9B393',
  border: '#E2E8E3',
};

const DARK: ThemeColors = {
  bg: '#12171A',
  surface: '#1A2224',
  surfaceAlt: '#222B2D',
  primary: '#6FB3A0',
  primarySoft: '#1E3330',
  text: '#E7EDEA',
  muted: '#93A5A0',
  danger: '#E0857A',
  sponsored: '#6E6152',
  border: '#2A3436',
};

const SHARED = {
  radius: 18,
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  type: {
    body: 15,
    bodyLineHeight: 22,
    title: 17,
    caption: 12,
  },
} as const;

export const lightTheme: Theme = {
  ...SHARED,
  mode: 'light',
  dark: false,
  colors: LIGHT,
};

export const darkTheme: Theme = {
  ...SHARED,
  mode: 'dark',
  dark: true,
  colors: DARK,
};

export function resolveTheme(mode: ThemeMode, systemDark: boolean): Theme {
  if (mode === 'light') return lightTheme;
  if (mode === 'dark') return darkTheme;
  return systemDark ? darkTheme : lightTheme;
}