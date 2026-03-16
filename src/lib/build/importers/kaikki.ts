import path from "node:path";

import type { RawAudio, RawWiktionaryEntry } from "../source-records";
import { rawWiktionaryEntrySchema } from "../source-records";
import { inferRevisionFromFilePath, readJsonArrayFile, readJsonlFile } from "./shared";

interface KaikkiSound {
  ipa?: string;
  enpr?: string;
  text?: string;
  tags?: string[];
  audio?: string;
  ogg_url?: string;
  mp3_url?: string;
}

interface KaikkiSense {
  glosses?: string[];
  raw_glosses?: string[];
}

interface KaikkiRecord {
  word?: string;
  lang?: string;
  lang_code?: string;
  pos?: string;
  forms?: Array<{ form?: string; tags?: string[] }>;
  senses?: KaikkiSense[];
  sounds?: KaikkiSound[];
  categories?: string[];
  etymology_text?: string;
  related?: Array<string | { word?: string }>;
  derived?: Array<string | { word?: string }>;
}

function soundLocale(sound: KaikkiSound): string {
  const tags = (sound.tags ?? []).map((tag) => tag.toLowerCase());
  if (tags.some((tag) => tag.includes("us"))) {
    return "en-US";
  }
  if (tags.some((tag) => tag.includes("uk") || tag.includes("british"))) {
    return "en-GB";
  }
  return "en";
}

function soundLabel(sound: KaikkiSound, index: number): string {
  const tags = sound.tags?.filter(Boolean) ?? [];
  if (tags.length > 0) {
    return tags.join(" · ");
  }
  return index === 0 ? "Dictionary pronunciation" : `Variant ${index + 1}`;
}

function soundToAudio(record: KaikkiRecord, sound: KaikkiSound, revision: string): RawAudio {
  const src = sound.audio ?? sound.ogg_url ?? sound.mp3_url;

  if (src) {
    return {
      kind: "human",
      src,
      source_name: "Kaikki/Wiktextract audio",
      source_url: "https://kaikki.org/",
      license: "CC BY-SA 4.0 + GFDL",
      license_status: "clear",
      review_status: "reviewed",
      confidence: 0.88
    };
  }

  return {
    kind: "synthetic",
    src: "/audio/fixtures/synthetic-sample.wav",
    engine: "phoneme-placeholder",
    engine_input: record.word ?? "",
    source_name: "Synthetic fallback",
    source_url: "https://github.com/espeak-ng/espeak-ng",
    license: "GPL-3.0-or-later",
    license_status: "clear",
    review_status: "needs-source-check",
    confidence: 0.62
  };
}

function toRelated(values: KaikkiRecord["related"]): string[] {
  return (values ?? [])
    .map((value) => (typeof value === "string" ? value : value.word ?? ""))
    .filter(Boolean);
}

function adaptKaikkiRecord(record: KaikkiRecord | RawWiktionaryEntry, filePath: string): RawWiktionaryEntry | null {
  if ("term" in record && "pronunciations" in record) {
    return rawWiktionaryEntrySchema.parse({
      ...record,
      source:
        record.source ?? {
          name: "Kaikki/Wiktextract fixture",
          url: "https://kaikki.org/",
          license: "CC BY-SA 4.0 + GFDL",
          revision: inferRevisionFromFilePath(filePath, "kaikki-fixture"),
          attribution: "Adapted from a Kaikki/Wiktextract-style fixture.",
          fields: ["display", "glosses", "origin", "variants", "related"],
          confidence: 0.86,
          review_status: "reviewed"
        }
    });
  }

  if (!record.word || !record.lang_code) {
    return null;
  }

  const revision = inferRevisionFromFilePath(filePath, "kaikki-snapshot");
  const sounds = (record.sounds ?? []).filter((sound) => sound.ipa || sound.audio || sound.ogg_url || sound.mp3_url);

  return rawWiktionaryEntrySchema.parse({
    term: record.word,
    display: record.forms?.find((form) => form.tags?.includes("canonical"))?.form ?? record.word,
    language: record.lang_code,
    parts_of_speech: record.pos ? [record.pos] : [],
    definitions: (record.senses ?? []).flatMap((sense) => sense.glosses ?? sense.raw_glosses ?? []),
    short_gloss: (record.senses ?? [])
      .flatMap((sense) => sense.glosses ?? sense.raw_glosses ?? [])
      .find(Boolean),
    origin: {
      code: null,
      name: null,
      label: record.etymology_text ?? null
    },
    topics: record.categories ?? [],
    pronunciations: sounds.map((sound, index) => ({
      id: `kaikki-${index}`,
      label: soundLabel(sound, index),
      locale: soundLocale(sound),
      ipa: sound.ipa ?? null,
      respelling: sound.enpr ?? sound.text ?? null,
      notes: [],
      audio: soundToAudio(record, sound, revision)
    })),
    related_terms: [...toRelated(record.related), ...toRelated(record.derived)],
    semantic_links: [],
    confusions: [],
    confusion_notes: [],
    search_rank: 0,
    badges: [],
    source: {
      name: "Kaikki/Wiktextract",
      url: "https://kaikki.org/",
      license: "CC BY-SA 4.0 + GFDL",
      revision,
      attribution: "Adapted from Kaikki/Wiktextract JSONL.",
      fields: ["display", "glosses", "origin", "variants", "related"],
      confidence: 0.86,
      review_status: "reviewed"
    }
  });
}

export async function importKaikkiFile(filePath: string): Promise<RawWiktionaryEntry[]> {
  const extension = path.extname(filePath).toLowerCase();
  const records =
    extension === ".jsonl"
      ? await readJsonlFile<KaikkiRecord | RawWiktionaryEntry>(filePath)
      : await readJsonArrayFile<KaikkiRecord | RawWiktionaryEntry>(filePath);

  return records
    .map((record) => adaptKaikkiRecord(record, filePath))
    .filter((record): record is RawWiktionaryEntry => !!record);
}
