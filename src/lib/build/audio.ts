import path from "node:path";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

import type { Entry, PronunciationVariant } from "../../types/content";
import { DIST_AUDIO_DIR } from "./paths";
import { ensureDir } from "./io";

const FIXTURE_PREVIEW_SOURCES = new Set([
  "/audio/fixtures/human-sample.wav",
  "/audio/fixtures/synthetic-sample.wav"
]);

const SAY_VOICE_BY_LOCALE: Array<[prefix: string, voice: string]> = [
  ["de", "Anna"],
  ["en-gb", "Daniel"],
  ["en-us", "Samantha"],
  ["en", "Samantha"],
  ["es-mx", "Eddy (Spanish (Mexico))"],
  ["es", "Eddy (Spanish (Spain))"],
  ["fr-ca", "Eddy (French (Canada))"],
  ["fr", "Thomas"],
  ["it", "Eddy (Italian (Italy))"],
  ["ja", "Kyoko"],
  ["ko", "Yuna"],
  ["zh-cn", "Eddy (Chinese (China mainland))"],
  ["zh-tw", "Eddy (Chinese (Taiwan))"],
  ["zh", "Eddy (Chinese (China mainland))"]
];

export function isFixturePreviewAudio(src: string): boolean {
  return FIXTURE_PREVIEW_SOURCES.has(src);
}

export function choosePreviewSpeechText(entry: Entry, variant: PronunciationVariant): string {
  const candidate = variant.respelling ?? entry.display;

  return candidate
    .replace(/[\/()[\],.]/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(/\b([A-Z]{2,})\b/g, (match) => match.toLowerCase())
    .replace(/\s+/g, " ")
    .trim();
}

export function chooseSayVoice(locale: string): string {
  const normalized = locale.toLowerCase();

  for (const [prefix, voice] of SAY_VOICE_BY_LOCALE) {
    if (normalized === prefix || normalized.startsWith(`${prefix}-`)) {
      return voice;
    }
  }

  return "Samantha";
}

function canUseCommand(command: string): boolean {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function synthesizeWithSay(outputPath: string, voice: string, text: string): void {
  const tempAiffPath = `${outputPath}.aiff`;
  execFileSync("say", ["-v", voice, "-o", tempAiffPath, text], {
    stdio: "ignore"
  });
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@22050", tempAiffPath, outputPath], {
    stdio: "ignore"
  });
  rmSync(tempAiffPath, { force: true });
}

async function materializePreviewVariantAudio(
  entry: Entry,
  variant: PronunciationVariant
): Promise<PronunciationVariant> {
  if (!isFixturePreviewAudio(variant.audio.src)) {
    return variant;
  }

  if (!canUseCommand("say") || !canUseCommand("afconvert")) {
    return variant;
  }

  const relativeOutputPath = `/audio/generated/${entry.slug}/${variant.id}.wav`;
  const absoluteOutputPath = path.join(DIST_AUDIO_DIR, "generated", entry.slug, `${variant.id}.wav`);
  await ensureDir(path.dirname(absoluteOutputPath));

  synthesizeWithSay(
    absoluteOutputPath,
    chooseSayVoice(variant.locale),
    choosePreviewSpeechText(entry, variant)
  );

  return {
    ...variant,
    notes: variant.notes.includes("Locally synthesized preview audio.")
      ? variant.notes
      : [...variant.notes, "Locally synthesized preview audio."],
    audio: {
      ...variant.audio,
      src: relativeOutputPath,
      mimeType: "audio/wav",
      engine: variant.audio.engine ?? "say",
      engineInput: variant.audio.engineInput ?? choosePreviewSpeechText(entry, variant)
    }
  };
}

export async function materializePreviewAudio(entries: Entry[]): Promise<Entry[]> {
  const nextEntries: Entry[] = [];

  for (const entry of entries) {
    const variants: PronunciationVariant[] = [];
    for (const variant of entry.variants) {
      variants.push(await materializePreviewVariantAudio(entry, variant));
    }

    nextEntries.push({
      ...entry,
      variants
    });
  }

  return nextEntries;
}
