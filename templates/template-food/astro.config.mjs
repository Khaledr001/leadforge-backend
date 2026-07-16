import { defineConfig } from 'astro/config';

// Static output (default). Inline styles so the single page ships as one
// request — helps the Lighthouse 95+ target.
export default defineConfig({
  build: { inlineStylesheets: 'always' },
});
