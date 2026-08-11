import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      // `supabase start` writes a bundled edge-runtime entrypoint here. It is
      // generated, gitignored, and minified onto one line, so linting it turns
      // `pnpm lint` red for anyone who followed supabase/README.md.
      "supabase/.temp/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Repo tooling runs in Node, not the browser, so `console` and `process`
    // are defined. Without this the default browser globals make every script
    // here look like it references undeclared names.
    files: ["scripts/**/*.mjs", "*.config.{js,mjs,ts}"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
);
