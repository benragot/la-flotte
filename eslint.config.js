import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-lines-per-function": [
        "error",
        { max: 10, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ["error", 4],
      "max-depth": ["error", 2],
      "max-params": ["error", 3],
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "max-lines-per-function": [
        "error",
        { max: 35, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
);
