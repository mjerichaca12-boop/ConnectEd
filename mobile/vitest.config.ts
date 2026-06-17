import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    transformMode: {
      web: [/\.[jt]sx$/],
    },
    server: {
      deps: {
        inline: ['react-native', '@react-native', '@tanstack/react-query'],
      },
    },
  },
} as any);
