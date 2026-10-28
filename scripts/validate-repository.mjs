import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const failures = [];
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const requirePath = (path) => {
  if (!existsSync(join(root, path))) failures.push("Missing required path: " + path);
};

const rootPackage = readJson("package.json");
const lock = readJson("package-lock.json");

if (rootPackage.private !== true) failures.push("Root package.json must remain private.");
if (!rootPackage.engines?.node?.includes("24")) failures.push("Node 24 must remain the supported development/CI line.");
if (!Array.isArray(rootPackage.workspaces) || rootPackage.workspaces.length === 0) failures.push("npm workspaces must be configured.");
if (lock.lockfileVersion !== 3) failures.push("package-lock.json must use lockfileVersion 3.");
if (lock.packages?.[""]?.devDependencies?.typescript !== rootPackage.devDependencies?.typescript) {
  failures.push("TypeScript version in package-lock.json must match package.json exactly.");
}
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(rootPackage.devDependencies?.typescript ?? "")) {
  failures.push("Direct dev dependencies must be pinned to exact versions, not ranges.");
}

const workspaces = [
  "apps/portal",
  "apps/runtime-dashboard",
  "services/agent",
  "packages/contracts",
  "packages/config"
];
for (const path of workspaces) {
  requirePath(path + "/package.json");
  if (!existsSync(join(root, path, "package.json"))) continue;
  const manifest = readJson(path + "/package.json");
  if (manifest.private !== true) failures.push("Workspace must be private until separately approved: " + path);
  if (!lock.packages?.[path]) failures.push("Workspace missing from package-lock.json: " + path);
}
requirePath(".env.example");
requirePath(".gitignore");
requirePath(".github/workflows/ci.yml");
requirePath("packages/contracts/src/index.ts");
requirePath("packages/config/src/index.ts");

const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
if (!gitignore.split(/\r?\n/).includes(".env")) failures.push(".gitignore must ignore local .env files.");
if (!gitignore.split(/\r?\n/).includes("!.env.example")) failures.push(".env.example must remain the only tracked env sample.");

const envExample = readFileSync(join(root, ".env.example"), "utf8");
if (!/LIVE_TRADING_ENABLED=false/.test(envExample)) failures.push(".env.example must explicitly keep live trading disabled.");
if (/^(?:[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*)\s*=\s*[^#\s]/m.test(envExample)) {
  failures.push(".env.example must not contain populated secret fields.");
}

// Scan only code/config paths to avoid false positives in security documentation.
const sourceRoots = ["apps", "services", "packages", "scripts", "test", ".github"];
const extensionAllowlist = new Set([".js", ".mjs", ".cjs", ".ts", ".json", ".yml", ".yaml", ".sh"]);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bsk_live_[A-Za-z0-9]{12,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/
];
function walk(directory) {
  if (!existsSync(join(root, directory))) return;
  for (const entry of readdirSync(join(root, directory))) {
    const relativePath = join(directory, entry);
    const absolutePath = join(root, relativePath);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      if (["node_modules", "dist", "coverage", ".next", ".turbo"].includes(entry)) continue;
      walk(relativePath);
      continue;
    }
    if (entry.startsWith(".env") && entry !== ".env.example") {
      failures.push("Local environment file must not be committed: " + relativePath.split(sep).join("/"));
      continue;
    }
    const extension = entry.includes(".") ? entry.slice(entry.lastIndexOf(".")).toLowerCase() : "";
    if (!extensionAllowlist.has(extension)) continue;
    const source = readFileSync(absolutePath, "utf8");
    for (const pattern of secretPatterns) {
      if (pattern.test(source)) {
        failures.push("Possible credential/private-key material in source path: " + relativePath.split(sep).join("/"));
        break;
      }
    }
  }
}
for (const directory of sourceRoots) walk(directory);

if (failures.length > 0) {
  console.error("Repository validation failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exitCode = 1;
} else {
  console.log("Repository validation passed: workspaces, pinned TypeScript, safe env defaults, ignored local env files and source secret-pattern scan.");
}
