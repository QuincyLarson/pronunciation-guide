import path from "node:path";

import type { RawIpaDictEntry } from "../source-records";
import { rawIpaDictEntrySchema } from "../source-records";
import { inferRevisionFromFilePath, readJsonArrayFile, readNonEmptyLines } from "./shared";

function inferLocale(filePath: string): string {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes("en-us") || name.includes("us")) {
    return "en-US";
  }
  if (name.includes("en-gb") || name.includes("uk")) {
    return "en-GB";
  }
  return "en";
}

function withSource(entry: RawIpaDictEntry, filePath: string): RawIpaDictEntry {
  return rawIpaDictEntrySchema.parse({
    ...entry,
    source: entry.source ?? {
      name: "open-dict-data/ipa-dict",
      url: "https://github.com/open-dict-data/ipa-dict",
      license: "Unlicense",
      revision: inferRevisionFromFilePath(filePath, "ipa-dict-snapshot"),
      attribution: "Pronunciation adapted from open-dict-data/ipa-dict.",
      fields: ["variants"],
      confidence: entry.confidence ?? 0.78,
      review_status: "reviewed"
    }
  });
}

export async function importIpaDictFile(filePath: string): Promise<RawIpaDictEntry[]> {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".json") {
    const records = await readJsonArrayFile<RawIpaDictEntry>(filePath);
    return records.map((record) => withSource(record, filePath));
  }

  const locale = inferLocale(filePath);
  const entries: RawIpaDictEntry[] = [];

  for (const line of await readNonEmptyLines(filePath)) {
    if (line.startsWith("#")) {
      continue;
    }

    const [headword, ipa] = line.split(/\t+/, 2);
    if (!headword || !ipa) {
      continue;
    }

    entries.push(
      withSource(
        {
          headword,
          variant_key: `ipa-dict-${locale.toLowerCase()}`,
          display: headword,
          locale,
          ipa,
          respelling: null,
          notes: [],
          confidence: 0.78
        },
        filePath
      )
    );
  }

  return entries;
}
