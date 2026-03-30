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

const ARPABET_VOWELS = new Set([
  "AA",
  "AE",
  "AH",
  "AO",
  "AW",
  "AY",
  "EH",
  "ER",
  "EY",
  "IH",
  "IY",
  "OW",
  "OY",
  "UH",
  "UW",
  "AX",
  "AXR"
]);

const ALLOWED_ENGLISH_ONSETS = new Set([
  "p ɹ",
  "p l",
  "p j",
  "b ɹ",
  "b l",
  "b j",
  "t ɹ",
  "t w",
  "t j",
  "d ɹ",
  "d w",
  "d j",
  "k ɹ",
  "k l",
  "k w",
  "k j",
  "ɡ ɹ",
  "ɡ l",
  "ɡ w",
  "f ɹ",
  "f l",
  "f j",
  "v j",
  "θ ɹ",
  "ʃ ɹ",
  "s p",
  "s p ɹ",
  "s p l",
  "s t",
  "s t ɹ",
  "s k",
  "s k ɹ",
  "s k w",
  "s m",
  "s n",
  "s l",
  "s w",
  "m j",
  "n j",
  "h j"
]);

interface ArpabetSegment {
  ipa: string;
  stress: "" | "0" | "1" | "2";
  vowel: boolean;
}

function mapArpabetToken(base: string, stress: ArpabetSegment["stress"]): string {
  if (base === "AH") {
    return stress === "0" ? "ə" : "ʌ";
  }

  if (base === "ER") {
    return stress === "0" ? "ɚ" : "ɝ";
  }

  return ARPABET_TO_IPA[base] ?? base.toLowerCase();
}

function parseArpabetSegments(arpabet: string): ArpabetSegment[] {
  return arpabet
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const match = token.match(/^([A-Z]+)([0-2])?$/);
      const base = match?.[1] ?? token;
      const stress = (match?.[2] as ArpabetSegment["stress"] | undefined) ?? "";

      return {
        ipa: mapArpabetToken(base, stress),
        stress,
        vowel: ARPABET_VOWELS.has(base)
      };
    });
}

function getOnsetLength(consonants: string[]): number {
  if (consonants.length === 0) {
    return 0;
  }

  for (let size = Math.min(3, consonants.length); size >= 2; size -= 1) {
    const suffix = consonants.slice(consonants.length - size).join(" ");
    if (ALLOWED_ENGLISH_ONSETS.has(suffix)) {
      return size;
    }
  }

  return consonants[consonants.length - 1] === "ŋ" ? 0 : 1;
}

function arpabetToIpa(arpabet: string): string {
  const segments = parseArpabetSegments(arpabet);
  const output: string[] = [];
  let betweenVowelIndex = 0;

  for (const segment of segments) {
    if (segment.vowel) {
      if (segment.stress === "1" || segment.stress === "2") {
        const consonantsBetweenVowels = output.slice(betweenVowelIndex);
        const onsetLength = getOnsetLength(consonantsBetweenVowels);
        const insertAt = Math.max(betweenVowelIndex, output.length - onsetLength);
        output.splice(insertAt, 0, segment.stress === "1" ? "ˈ" : "ˌ");
      }

      output.push(segment.ipa);
      betweenVowelIndex = output.length;
      continue;
    }

    output.push(segment.ipa);
  }

  return `/${output.join("")}/`;
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

    const match = line.match(/^(\S+)\s+(.+)$/);
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
