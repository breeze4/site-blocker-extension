import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    plugins: {
      prettier,
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        alert: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        Promise: "readonly",
        Date: "readonly",
        Math: "readonly",
        Object: "readonly",
        Array: "readonly",
        JSON: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        localStorage: "readonly",
        location: "readonly",
        
        // Chrome extension globals
        chrome: "readonly",
        importScripts: "readonly",
        
        // Node.js globals for timer-utils.js
        module: "writable",
        exports: "writable",
        require: "readonly",
      },
    },
    rules: {
      ...prettierConfig.rules,
      "no-console": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "prefer-const": "warn",
      "no-var": "error",
      "prettier/prettier": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-redeclare": ["error", { builtinGlobals: false }],
    },
  },
  {
    // Specific rules for storage-utils.js - these functions are exported globally
    files: ["src/storage-utils.js"],
    languageOptions: {
      globals: {
        isDebugMode: "writable",
        debugLog: "writable",
        setToStorage: "writable",
        getFromStorage: "writable",
        StorageUtils: "writable",
      },
    },
  },
  {
    // Specific rules for files that use storage-utils functions
    files: ["src/background.js", "src/content.js", "src/options.js"],
    languageOptions: {
      globals: {
        isDebugMode: "readonly",
        debugLog: "readonly",
        setToStorage: "readonly",
        getFromStorage: "readonly",
        StorageUtils: "readonly",
        TimerUtils: "writable",
      },
    },
  },
  {
    ignores: ["node_modules/", "dist/", "coverage/", "tests/", "*.min.js", ".eslintrc.json", "eslint.config.js"],
  },
];