import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDirectory = path.join(root, "apps", "web", "public", "downloads");
const publicDocuments = [
  ["COMPLETION_RECORD_20260715.md", "SHIME_COMPLETION_RECORD_20260715.md"],
  ["CLIENT_DEMO_GUIDE_20260717.md", "SHIME_CLIENT_DEMO_GUIDE_20260717.md"],
  ["REHEARSAL_EXECUTION_RECORD_20260715.md", "SHIME_REHEARSAL_EXECUTION_RECORD_20260715.md"],
  ["REHEARSAL_APPLICATIONS_12.csv", "SHIME_REHEARSAL_APPLICATIONS_12.csv"],
] as const;

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(publicDocuments.map(([sourceName, outputName]) => copyFile(
    path.join(root, "docs", "shime", sourceName),
    path.join(outputDirectory, outputName),
  )));
  console.info(`${publicDocuments.length} public operation documents synchronized.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Public document synchronization failed.");
  process.exitCode = 1;
});
