import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Explicitly set to Node.js environment
    include: ['server/**/*.test.{ts,tsx}'], // Pattern for server-side tests
    // reporters: ['default'], // Optional: configure reporters
    // setupFiles: ['./server/src/setupTests.ts'], // If server-side setup is needed
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/server', // Separate coverage reports
      include: ['server/**/*.{ts,tsx}'],
      exclude: [
        'server/**/*.test.{ts,tsx}',
        'server/vite.ts', // Example: exclude Vite specific setup
        'server/index.ts', // Example: exclude main server entry point if it's hard to test directly
      ],
    },
  },
});
