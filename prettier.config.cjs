module.exports = {
  printWidth: 120,
  singleQuote: true,
  importOrder: [
    "env",
    "react",
    "^[./].*instrumentation$", // More specific pattern for instrumentation imports
    "<THIRD_PARTY_MODULES>",
    "^[./]",
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ["explicitResourceManagement", "typescript", "jsx"],
  plugins: ["@trivago/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"],
  overrides: [
    {
      files: ["**/libraries/ui/src/**/*.{ts,tsx,css}"],
      options: {
        printWidth: 80,
        singleQuote: false,
        trailingComma: "es5",
        semi: false,
        plugins: ["prettier-plugin-tailwindcss"],
      },
    },
    {
      files: ["apps/backend/supabase/functions/**/*.ts"],
      options: {
        // Disable prettier formatting for backend functions
        // These files are formatted manually or by Deno
        printWidth: 999,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: true,
        trailingComma: "es5",
        bracketSpacing: true,
        arrowParens: "always",
      },
    },
  ],
};
