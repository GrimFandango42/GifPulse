import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Optional: use if you prefer Vitest globals like describe, it, expect
    environment: 'node', // Set the test environment
    coverage: {
      provider: 'c8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      all: true, // Include all files in coverage, not just tested ones
      include: ['src/**/*.ts'], // Specify files to include in coverage
      exclude: [ // Specify files/patterns to exclude
        'src/**/index.ts', 
        'src/**/*.config.ts',
        'src/**/*.d.ts',
        'src/**/genkit.config.ts', // Exclude genkit config
        // Add other patterns if needed, e.g., specific test helpers
      ],
    },
    // If you need to mock modules globally or set up files
    // setupFiles: ['./test/setup.ts'], 
    // reporters: ['default', 'html'], // For HTML report
    // ui: true, // if @vitest/ui is installed and you want to launch UI with `vitest` command
  },
  // Resolve aliases if you use them in your source code (e.g., @/components/*)
  // resolve: {
  //   alias: {
  //     '@': new URL('./src', import.meta.url).pathname,
  //   },
  // },
});
