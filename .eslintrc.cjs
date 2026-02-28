/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@remix-run/eslint-config"],
  ignorePatterns: [
    "build/",
    "node_modules/",
    "extensions/bundle-discount/dist/",
    "update_settings.js",
  ],
};
