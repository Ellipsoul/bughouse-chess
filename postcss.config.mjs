const config = {
  /**
   * Tailwind v4 PostCSS integration.
   *
   * Note:
   * - Vite (used by Cypress component tests) expects PostCSS plugins as functions or a
   *   `{ [pluginName]: options }` object.
   * - A string array form can fail with "Invalid PostCSS Plugin".
   */
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
