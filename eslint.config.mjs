export default [
  {
    files: ["site/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        crypto: "readonly",
        atob: "readonly",
        btoa: "readonly",
        Blob: "readonly",
        URL: "readonly",
        Uint8Array: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        setTimeout: "readonly",
        console: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { varsIgnorePattern: "^(uploadFiles|downloadFile|addSled|applyRawJson|switchTab|handleFiles)$" }],
      "no-redeclare": "error",
      "eqeqeq": ["error", "always"],
      "no-implicit-globals": "off",
    },
  },
];
