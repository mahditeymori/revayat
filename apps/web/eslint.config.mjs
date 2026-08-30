import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// Repository-layer rule (not just documented, enforced): app/ and components/
// may only reach the database through lib/commerce, lib/zibal, lib/security,
// or lib/media. Importing drizzle-orm or db/schema/client directly from a page
// or component would silently reintroduce the tight coupling the whole
// lib/commerce layer exists to prevent.
const dbImportBoundary = {
  files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'drizzle-orm',
            message: 'Import from lib/commerce/* (or lib/zibal, lib/security, lib/media) instead of Drizzle directly.',
          },
        ],
        patterns: [
          {
            group: ['@/db/*', '@/db'],
            message: 'app/ and components/ must not import the db layer directly — go through lib/commerce/* instead.',
          },
        ],
      },
    ],
  },
};

const eslintConfig = [...nextCoreWebVitals, dbImportBoundary];

export default eslintConfig;
