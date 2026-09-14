import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Vercel Blob on Hobby locks the store for 30 days past 2,000 uploads a month.
    // Every upload must go through src/lib/storage.ts, which reserves a slot in the
    // DB-capped blob_usage counter first. Importing the SDK anywhere else is an error.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "@vercel/blob", message: "Upload through src/lib/storage.ts (enforces the monthly upload cap)." }],
          patterns: [{ group: ["@vercel/blob/*"], message: "Upload through src/lib/storage.ts (enforces the monthly upload cap)." }],
        },
      ],
    },
  },
  {
    files: ["src/lib/storage.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
