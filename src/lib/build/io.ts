import path from "node:path";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";

import { DIST_DIR, DIST_PUBLIC_DIR, GENERATED_DIR, STAGES_DIR } from "./paths";

export async function ensureDir(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeTextFile(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, value, "utf8");
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function collectFiles(directory: string, extension: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const currentPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await collectFiles(currentPath, extension)));
    } else if (entry.name.endsWith(extension)) {
      result.push(currentPath);
    }
  }

  return result.sort();
}

export async function copyPublicAssets(sourceDirectory: string, destinationDirectory: string): Promise<void> {
  await ensureDir(destinationDirectory);
  await cp(sourceDirectory, destinationDirectory, { recursive: true });
}

export async function cleanBuildOutputs(): Promise<void> {
  await rm(DIST_DIR, { recursive: true, force: true });
  await rm(STAGES_DIR, { recursive: true, force: true });
  await rm(path.join(GENERATED_DIR, "shards"), { recursive: true, force: true });
  await rm(path.join(GENERATED_DIR, "ipa"), { recursive: true, force: true });
  await rm(path.join(GENERATED_DIR, "audio-manifest.json"), { force: true });
  await rm(path.join(GENERATED_DIR, "attribution-manifest.json"), { force: true });
  await rm(path.join(GENERATED_DIR, "site-manifest.json"), { force: true });
  await ensureDir(GENERATED_DIR);
  await ensureDir(DIST_PUBLIC_DIR);
}

export async function writeRouteHtml(rootDirectory: string, pathname: string, html: string): Promise<void> {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  const filePath =
    trimmed.length === 0
      ? path.join(rootDirectory, "index.html")
      : path.join(rootDirectory, trimmed, "index.html");
  await writeTextFile(filePath, html);
}
