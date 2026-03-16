import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

import type { Entry, PronunciationVariant } from "../../types/content";

export interface AudioGenerationInput {
  kind: string;
  value: string;
}

export interface AudioGenerationEngine {
  id: string;
  mimeType: string;
  canRun(): boolean;
  pickInput(entry: Entry, variant: PronunciationVariant): AudioGenerationInput | null;
  generate(outputPath: string, variant: PronunciationVariant, input: AudioGenerationInput): Promise<void>;
}

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
  const candidate = variant.audio.engineInputs.say_text ?? variant.respelling ?? entry.display;

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

export function createSayAudioEngine(): AudioGenerationEngine {
  return {
    id: "say",
    mimeType: "audio/wav",
    canRun() {
      return canUseCommand("say") && canUseCommand("afconvert");
    },
    pickInput(entry, variant) {
      const text = choosePreviewSpeechText(entry, variant);
      return text ? { kind: "text", value: text } : null;
    },
    async generate(outputPath, variant, input) {
      synthesizeWithSay(outputPath, chooseSayVoice(variant.locale), input.value);
    }
  };
}
