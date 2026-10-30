import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  evaluateMigrationReleasePacket,
  inspectMigrationSet
} from "./lib/migration-governance.mjs";

const root = process.cwd();
const inspection = inspectMigrationSet();

if (!inspection.ok) {
  console.error("Migration inventory blocked:");
  for (const error of inspection.errors) console.error(" - " + error);
  process.exitCode = 1;
} else {
  console.log("Migration inventory integrity verified.");
  console.log("Migration count: " + inspection.migrationCount);
  for (const migration of inspection.migrations) {
    console.log(migration.id + "  " + migration.sha256);
  }
  console.log("Migration-set SHA-256: " + inspection.migrationSetSha256);
}

const args = process.argv.slice(2);
if (args.length > 0 && args[0] !== "--plan") {
  console.error("Usage: node scripts/verify-migrations.mjs [--plan /absolute/path/to/release-plan.json]");
  process.exitCode = 1;
} else if (args[0] === "--plan") {
  if (args.length !== 2) {
    console.error("A single release-plan JSON path is required after --plan.");
    process.exitCode = 1;
  } else if (!inspection.ok) {
    console.error("Release preflight cannot run while migration inventory is blocked.");
    process.exitCode = 1;
  } else {
    const planPath = resolve(args[1]);
    const rel = relative(root, planPath);
    const insideRepository = rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel));
    try {
      if (insideRepository) throw new Error("Release plans must be stored outside the Git working tree.");
      const stat = lstatSync(planPath);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 64 * 1024) {
        throw new Error("Release plan must be a regular non-symlink file no larger than 64 KiB.");
      }
      const packet = JSON.parse(readFileSync(planPath, "utf8"));
      const result = evaluateMigrationReleasePacket(packet, {
        migrationSetSha256: inspection.migrationSetSha256
      });
      console.log("Release preflight status: " + result.status);
      if (result.ok) {
        console.log(result.notice);
      } else {
        for (const error of result.errors) console.error(" - " + error);
        process.exitCode = 1;
      }
    } catch (error) {
      console.error("Release preflight blocked: " + (error instanceof Error ? error.message : "unreadable plan"));
      process.exitCode = 1;
    }
  }
}

console.log("No database connection was opened; no SQL was executed.");
console.log("Migration execution, provider activation and trading authorization remain false.");
