import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PUBLIC_DOWNLOADS } from "../apps/web/src/lib/public-downloads";

const root = process.cwd();
const outputDirectory = path.join(root, "apps", "web", "public", "downloads");

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(PUBLIC_DOWNLOADS.map(({ sourceName, outputName }) => copyFile(
    path.join(root, "docs", "shime", sourceName),
    path.join(outputDirectory, outputName),
  )));
  console.info(`${PUBLIC_DOWNLOADS.length} public operation documents synchronized.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Public document synchronization failed.");
  process.exitCode = 1;
});
