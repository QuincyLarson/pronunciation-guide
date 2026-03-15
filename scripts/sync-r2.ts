import path from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { collectFiles } from "../src/lib/build/io";
import { mimeTypeForPath } from "../src/lib/build/mime";
import { DIST_PUBLIC_DIR, PROJECT_ROOT } from "../src/lib/build/paths";

type Target = "audio" | "corpus";

interface SyncTargetConfig {
  bucketName: string;
  sourceDirectory: string;
}

function parseConfig(): {
  r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
} {
  const raw = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "wrangler.jsonc"), "utf8")) as {
    r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
  };
  return raw;
}

function bucketForBinding(binding: string): string {
  const config = parseConfig();
  const bucketName = config.r2_buckets?.find((bucket) => bucket.binding === binding)?.bucket_name;
  if (!bucketName) {
    throw new Error(`Missing bucket_name for binding ${binding} in wrangler.jsonc`);
  }

  return bucketName;
}

function resolveTarget(target: Target): SyncTargetConfig {
  if (target === "audio") {
    return {
      bucketName: bucketForBinding("AUDIO_BUCKET"),
      sourceDirectory: path.join(DIST_PUBLIC_DIR, "audio")
    };
  }

  return {
    bucketName: bucketForBinding("CORPUS_BUCKET"),
    sourceDirectory: path.join(DIST_PUBLIC_DIR, "data", "shards")
  };
}

function readArgs(): {
  target: Target;
  remote: boolean;
  dryRun: boolean;
} {
  const [, , targetArg, ...flags] = process.argv;
  if (targetArg !== "audio" && targetArg !== "corpus") {
    throw new Error("Usage: tsx scripts/sync-r2.ts <audio|corpus> [--remote] [--dry-run]");
  }

  return {
    target: targetArg,
    remote: flags.includes("--remote"),
    dryRun: flags.includes("--dry-run")
  };
}

function uploadObject(
  bucketName: string,
  key: string,
  filePath: string,
  remote: boolean
): void {
  const wranglerPath =
    process.platform === "win32" ? ".\\node_modules\\.bin\\wrangler.cmd" : "./node_modules/.bin/wrangler";
  const args = [
    "r2",
    "object",
    "put",
    `${bucketName}/${key}`,
    "--file",
    filePath,
    "--content-type",
    mimeTypeForPath(filePath),
    remote ? "--remote" : "--local"
  ];

  const result = spawnSync(wranglerPath, args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`Failed to upload ${filePath} to ${bucketName}/${key}`);
  }
}

async function main(): Promise<void> {
  const { target, remote, dryRun } = readArgs();
  const config = resolveTarget(target);
  const files = await collectFiles(config.sourceDirectory, "");

  if (files.length === 0) {
    throw new Error(`No files found under ${config.sourceDirectory}. Run npm run build first.`);
  }

  for (const filePath of files) {
    const key = path.relative(DIST_PUBLIC_DIR, filePath).split(path.sep).join("/");
    if (dryRun) {
      console.log(`${config.bucketName}/${key} <= ${filePath}`);
      continue;
    }

    uploadObject(config.bucketName, key, filePath, remote);
  }

  console.log(
    `${dryRun ? "Planned" : "Uploaded"} ${files.length} ${target} files ${dryRun ? "for" : "to"} ${config.bucketName}`
  );
}

await main();
