import path from "node:path";

import { readJsonFile, readTextFile } from "../io";

export function inferRevisionFromFilePath(filePath: string, fallback: string): string {
  const stem = path.basename(filePath).replace(path.extname(filePath), "");
  return stem || fallback;
}

export async function readJsonArrayFile<T>(filePath: string): Promise<T[]> {
  const value = await readJsonFile<unknown>(filePath);
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function readJsonlFile<T>(filePath: string): Promise<T[]> {
  const raw = await readTextFile(filePath);

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export async function readNonEmptyLines(filePath: string): Promise<string[]> {
  const raw = await readTextFile(filePath);
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
