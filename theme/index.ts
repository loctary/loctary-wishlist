import { createTheme, type MantineColorsTuple } from '@mantine/core';

const orange: MantineColorsTuple = [
  '#fff4e6',
  '#ffe8cc',
  '#ffd09b',
  '#ffb765',
  '#ffa237',
  '#ff9318',
  '#ff8b09',
  '#e37a00',
  '#ca6c00',
  '#b05c00',
];

export const theme = createTheme({
  primaryColor: 'orange',
  colors: { orange },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  },
  defaultRadius: 'md',
  components: {
    Button: { defaultProps: { radius: 'md' } },
    TextInput: { defaultProps: { radius: 'md' } },
    PasswordInput: { defaultProps: { radius: 'md' } },
    Card: { defaultProps: { radius: 'md' } },
  },
});
