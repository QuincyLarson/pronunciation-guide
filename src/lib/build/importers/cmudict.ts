import path from "node:path";

import type { RawCmudictEntry } from "../source-records";
import { rawCmudictEntrySchema } from "../source-records";
import { inferRevisionFromFilePath, readJsonArrayFile, readNonEmptyLines } from "./shared";

const ARPABET_TO_IPA: Record<string, string> = {
  AA: "ɑ",
  AE: "æ",
  AH: "ʌ",
  AO: "ɔ",
  AW: "aʊ",
  AY: "aɪ",
  B: "b",
  CH: "tʃ",
  D: "d",
  DH: "ð",
  EH: "ɛ",
  ER: "ɝ",
  EY: "eɪ",
  F: "f",
  G: "ɡ",
  HH: "h",
  IH: "ɪ",
  IY: "i",
  JH: "dʒ",
  K: "k",
  L: "l",
  M: "m",
  N: "n",
  NG: "ŋ",
  OW: "oʊ",
  OY: "ɔɪ",
  P: "p",
  R: "ɹ",
  S: "s",
  SH: "ʃ",
  T: "t",
  TH: "θ",
  UH: "ʊ",
  UW: "u",
  V: "v",
  W: "w",
  Y: "j",
  Z: "z",
  ZH: "ʒ",
  AX: "ə",
  AXR: "ɚ",
  DX: "ɾ",
  Q: "ʔ"
};

function arpabetToIpa(arpabet: string): string {
  return `/${arpabet
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.replace(/[0-2]$/, ""))
    .map((token) => ARPABET_TO_IPA[token] ?? token.toLowerCase())
    .join("")}/`;
}

function normalizeHeadword(rawHeadword: string): { headword: string; variantKey: string } {
  const match = rawHeadword.match(/^(.*?)(?:\((\d+)\))?$/);
  const base = (match?.[1] ?? rawHeadword).replace(/_/g, " ").trim();
  const variantIndex = match?.[2] ?? "0";

  return {
    headword: base,
    variantKey: `cmudict-${variantIndex}`
  };
}

function withSource(entry: RawCmudictEntry, filePath: string): RawCmudictEntry {
  return rawCmudictEntrySchema.parse({
    ...entry,
    source: entry.source ?? {
      name: "CMUdict",
      url: "https://github.com/cmusphinx/cmudict",
      license: "CMUdict license",
      revision: inferRevisionFromFilePath(filePath, "cmudict-snapshot"),
      attribution: "Pronunciation data adapted from a CMUdict snapshot.",
      fields: ["variants"],
      confidence: entry.confidence ?? 0.88,
      review_status: "reviewed"
    }
  });
}

export async function importCmudictFile(filePath: string): Promise<RawCmudictEntry[]> {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".json") {
    const records = await readJsonArrayFile<RawCmudictEntry>(filePath);
    return records.map((record) => withSource(record, filePath));
  }

  const entries: RawCmudictEntry[] = [];
  for (const line of await readNonEmptyLines(filePath)) {
    if (line.startsWith(";;;")) {
      continue;
    }

    const match = line.match(/^(\S+)\s{2,}(.+)$/);
    if (!match) {
      continue;
    }

    const { headword, variantKey } = normalizeHeadword(match[1]);
    const arpabet = match[2].trim();

    entries.push(
      withSource(
        {
          headword,
          variant_key: variantKey,
          ipa: arpabetToIpa(arpabet),
          respelling: null,
          arpabet,
          parts_of_speech: [],
          topics: [],
          confidence: 0.88,
          search_rank: 0
        },
        filePath
      )
    );
  }

  return entries;
}
