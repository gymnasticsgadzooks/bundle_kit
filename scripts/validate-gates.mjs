import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const strictMode = process.argv.includes("--strict");
const repoRoot = process.cwd();

const PASS = "PASS";
const FAIL = "FAIL";
const BLOCKED = "BLOCKED";

function runCommand(command) {
  const result = spawnSync(command, {
    cwd: repoRoot,
    shell: true,
    stdio: "inherit",
    env: process.env,
  });
  return result.status === 0;
}

function printGateResult(name, status, details) {
  const suffix = details ? ` - ${details}` : "";
  console.log(`[${status}] ${name}${suffix}`);
}

function lintConfigExists() {
  const candidates = [
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yaml",
    ".eslintrc.yml",
    "eslint.config.js",
    "eslint.config.cjs",
    "eslint.config.mjs",
    "eslint.config.ts",
  ];
  return candidates.some((relPath) => fs.existsSync(path.join(repoRoot, relPath)));
}

function runArchitectureChecks() {
  const proxyRoutePath = path.join(repoRoot, "app/routes/api.bundles.tsx");
  const storefrontExtensionPath = path.join(repoRoot, "extensions/bundle-storefront");
  const shopifyTomlPath = path.join(repoRoot, "shopify.app.toml");

  if (fs.existsSync(proxyRoutePath)) {
    return { status: FAIL, details: "Found deprecated app proxy route app/routes/api.bundles.tsx" };
  }

  if (fs.existsSync(storefrontExtensionPath)) {
    return { status: FAIL, details: "Found deprecated storefront extension directory extensions/bundle-storefront" };
  }

  if (!fs.existsSync(shopifyTomlPath)) {
    return { status: FAIL, details: "Missing shopify.app.toml" };
  }

  const tomlContents = fs.readFileSync(shopifyTomlPath, "utf8");
  if (tomlContents.includes("[app_proxy]")) {
    return { status: FAIL, details: "shopify.app.toml still contains [app_proxy]" };
  }

  return { status: PASS, details: "Legacy storefront and app proxy paths are removed" };
}

function evaluateGate(name, executor) {
  const outcome = executor();
  printGateResult(name, outcome.status, outcome.details);
  return outcome.status;
}

const results = [];

results.push(
  evaluateGate("ArchitectureRemoval", () => runArchitectureChecks()),
);

results.push(
  evaluateGate("AppBuild", () => {
    const ok = runCommand("npm run build");
    return ok
      ? { status: PASS, details: "npm run build" }
      : { status: FAIL, details: "npm run build" };
  }),
);

results.push(
  evaluateGate("Lint", () => {
    if (!lintConfigExists()) {
      return {
        status: BLOCKED,
        details: "No ESLint config found (.eslintrc* or eslint.config.*)",
      };
    }
    const ok = runCommand("npm run lint");
    return ok
      ? { status: PASS, details: "npm run lint" }
      : { status: FAIL, details: "npm run lint" };
  }),
);

results.push(
  evaluateGate("FunctionTests", () => {
    const ok = runCommand("npm --workspace extensions/bundle-discount run test");
    return ok
      ? { status: PASS, details: "npm --workspace extensions/bundle-discount run test" }
      : { status: FAIL, details: "bundle discount test suite failed" };
  }),
);

results.push(
  evaluateGate("FunctionUnitTests", () => {
    const ok = runCommand("npm --workspace extensions/bundle-discount run test:unit");
    return ok
      ? { status: PASS, details: "npm --workspace extensions/bundle-discount run test:unit" }
      : { status: FAIL, details: "bundle discount unit tests failed" };
  }),
);

const failCount = results.filter((status) => status === FAIL).length;
const blockedCount = results.filter((status) => status === BLOCKED).length;

console.log("");
console.log(`Validation summary: ${results.length} gates, ${failCount} failed, ${blockedCount} blocked.`);

if (failCount > 0) {
  process.exit(1);
}

if (blockedCount > 0 && strictMode) {
  process.exit(2);
}

if (blockedCount > 0) {
  console.log("Non-strict mode allows blocked gates for local triage. Use --strict to enforce zero blocked gates.");
}
