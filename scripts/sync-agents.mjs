import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptNicobailonAgent } from "./lib/nicobailon-agent-adapter.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(readFileSync(join(root, "sources.lock.json"), "utf8"));
const sourceDir = join(root, lock.nicobailon.path, "agents");
const sourceRoot = join(root, lock.nicobailon.path);
const targetDir = join(root, "agents");
const checkOnly = process.argv.includes("--check");

if (!existsSync(sourceDir)) {
  throw new Error(
    `Missing ${sourceDir}. Clone ${lock.nicobailon.repository} at ${lock.nicobailon.commit} before syncing.`,
  );
}

const actualCommit = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (actualCommit !== lock.nicobailon.commit) {
  throw new Error(
    `Nicobailon source is at ${actualCommit}, but sources.lock.json requires ${lock.nicobailon.commit}. Review upstream changes and update the lock deliberately.`,
  );
}

const results = [];
for (const file of readdirSync(sourceDir).filter((name) => name.endsWith(".md")).sort()) {
  const source = readFileSync(join(sourceDir, file), "utf8");
  const adapted = adaptNicobailonAgent(source, { fallbackName: basename(file, ".md") });
  const target = join(targetDir, file);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  const changed = current !== adapted.markdown;

  if (!checkOnly && changed) {
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(target, adapted.markdown, "utf8");
  }

  results.push({ file, changed, ignored: adapted.ignoredNicobailonFields });
}

const changed = results.filter((result) => result.changed);
for (const result of results) {
  const status = result.changed ? (checkOnly ? "OUTDATED" : "SYNCED") : "OK";
  const ignored = result.ignored.length ? `; Nicobailon-only: ${result.ignored.join(", ")}` : "";
  console.log(`${status} ${result.file}${ignored}`);
}

if (checkOnly && changed.length) {
  console.error(`${changed.length} generated agent definition(s) are out of date. Run npm run sync.`);
  process.exitCode = 1;
}
