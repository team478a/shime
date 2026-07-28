import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const SOURCE_ROOT = path.resolve("apps/web/src");
const MAX_SOURCE_LINES = 300;

const baseline = {
  routeDbImports: 62,
  clientFilesWithFetch: 24,
  filesOverMaxLines: 9,
} as const;

type Metrics = {
  routeDbImports: number;
  clientFilesWithFetch: number;
  filesOverMaxLines: number;
};

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(target);
      return entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) ? [target] : [];
    }),
  );
  return nested.flat();
}

function isClientComponent(source: string): boolean {
  return /^\s*["']use client["'];/.test(source);
}

// Module hooks are the sanctioned fetch boundary (AGENTS.md): components call hooks,
// hooks call fetch. Counting hook files here would penalize the correct pattern.
function isModuleHook(normalizedPath: string): boolean {
  return normalizedPath.includes("/src/hooks/");
}

async function collectMetrics(): Promise<Metrics> {
  const files = await sourceFiles(SOURCE_ROOT);
  const metrics: Metrics = {
    routeDbImports: 0,
    clientFilesWithFetch: 0,
    filesOverMaxLines: 0,
  };

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const normalizedPath = file.replaceAll("\\", "/");
    const lineCount = source.split(/\r?\n/).length;
    if (normalizedPath.endsWith("/route.ts") && source.includes("@shime/db")) metrics.routeDbImports += 1;
    if (isClientComponent(source) && !isModuleHook(normalizedPath) && /\bfetch\s*\(/.test(source))
      metrics.clientFilesWithFetch += 1;
    if (lineCount > MAX_SOURCE_LINES) metrics.filesOverMaxLines += 1;
  }
  return metrics;
}

async function main() {
  const metrics = await collectMetrics();
  const regressions = (Object.keys(baseline) as Array<keyof Metrics>).filter((key) => metrics[key] > baseline[key]);

  console.log("Architecture debt baseline:");
  console.log(`- API routes importing @shime/db: ${metrics.routeDbImports}/${baseline.routeDbImports}`);
  console.log(`- Client components calling fetch: ${metrics.clientFilesWithFetch}/${baseline.clientFilesWithFetch}`);
  console.log(
    `- Source files over ${MAX_SOURCE_LINES} lines: ${metrics.filesOverMaxLines}/${baseline.filesOverMaxLines}`,
  );

  if (regressions.length > 0) {
    throw new Error(`ARCHITECTURE_BASELINE_REGRESSION: ${regressions.join(", ")}`);
  }
}

void main();
