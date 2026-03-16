import path from "node:path";

import type { RawWordnetEntry } from "../source-records";
import { rawWordnetEntrySchema } from "../source-records";
import { readJsonFile } from "../io";
import { inferRevisionFromFilePath, readJsonArrayFile } from "./shared";

interface OewnSense {
  definition?: string;
  gloss?: string;
  examples?: string[];
}

interface OewnRecord {
  lemma?: string;
  word?: string;
  pos?: string;
  partOfSpeech?: string;
  senses?: OewnSense[];
  topics?: string[];
  semantic_links?: string[];
  related?: string[];
}

function toGlosses(record: OewnRecord | RawWordnetEntry): string[] {
  if ("glosses" in record) {
    return record.glosses;
  }

  return (record.senses ?? [])
    .flatMap((sense) => [sense.definition, sense.gloss, ...(sense.examples ?? [])])
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function adaptWordnetRecord(
  record: OewnRecord | RawWordnetEntry,
  filePath: string,
  sourceName: string,
  sourceUrl: string,
  sourceLicense: string
): RawWordnetEntry | null {
  if ("lemma" in record && "glosses" in record) {
    return rawWordnetEntrySchema.parse({
      ...record,
      source:
        record.source ?? {
          name: sourceName,
          url: sourceUrl,
          license: sourceLicense,
          revision: inferRevisionFromFilePath(filePath, "wordnet-snapshot"),
          attribution: `Adapted from ${sourceName}.`,
          fields: ["glosses", "related"],
          confidence: 0.82,
          review_status: "reviewed"
        }
    });
  }

  const lemma = record.lemma ?? record.word;
  if (!lemma) {
    return null;
  }

  return rawWordnetEntrySchema.parse({
    lemma,
    glosses: toGlosses(record),
    short_gloss: toGlosses(record)[0],
    parts_of_speech: [record.pos ?? record.partOfSpeech ?? "noun"].filter(Boolean),
    topics: record.topics ?? [],
    semantic_links: [...(record.semantic_links ?? []), ...(record.related ?? [])],
    search_rank: 0,
    source: {
      name: sourceName,
      url: sourceUrl,
      license: sourceLicense,
      revision: inferRevisionFromFilePath(filePath, "wordnet-snapshot"),
      attribution: `Adapted from ${sourceName}.`,
      fields: ["glosses", "related"],
      confidence: 0.82,
      review_status: "reviewed"
    }
  });
}

export async function importWordnetFile(filePath: string): Promise<RawWordnetEntry[]> {
  const records = await readJsonArrayFile<OewnRecord | RawWordnetEntry>(filePath);
  return records
    .map((record) =>
      adaptWordnetRecord(
        record,
        filePath,
        "Princeton WordNet",
        "https://wordnet.princeton.edu/",
        "WordNet License"
      )
    )
    .filter((record): record is RawWordnetEntry => !!record);
}

export async function importOewnFile(filePath: string): Promise<RawWordnetEntry[]> {
  const value = await readJsonFile<unknown>(filePath);
  const records = Array.isArray(value)
    ? (value as Array<OewnRecord | RawWordnetEntry>)
    : Array.isArray((value as { entries?: unknown[] }).entries)
      ? (((value as { entries: unknown[] }).entries as unknown[]) as Array<OewnRecord | RawWordnetEntry>)
      : [];

  return records
    .map((record) =>
      adaptWordnetRecord(
        record,
        filePath,
        "Open English WordNet",
        "https://github.com/globalwordnet/english-wordnet",
        "CC BY 4.0"
      )
    )
    .filter((record): record is RawWordnetEntry => !!record);
}
