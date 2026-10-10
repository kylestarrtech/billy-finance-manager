// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // jest.mock factories can't use imports, so tests require() their stand-ins.
    files: ["**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
