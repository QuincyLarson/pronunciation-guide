import path from "node:path";

import { LEARN_IPA_DRILL_SOURCE_FILES } from "../src/lib/build/learn-ipa-drills";
import { ensureDir, writeJsonFile, writeTextFile } from "../src/lib/build/io";
import { LEARN_IPA_SOURCES_DIR } from "../src/lib/build/paths";

const DRILL_SOURCES = [
  {
    id: "cmudict",
    description: "CMUdict raw pronunciation dictionary",
    url: "https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict",
    fileName: LEARN_IPA_DRILL_SOURCE_FILES.cmudict
  },
  {
    id: "ipa-dict-en-us",
    description: "open-dict-data IPA dict (US English)",
    url: "https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_US.txt",
    fileName: LEARN_IPA_DRILL_SOURCE_FILES.ipaDictUs
  },
  {
    id: "ipa-dict-en-gb",
    description: "open-dict-data IPA dict (British English)",
    url: "https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_UK.txt",
    fileName: LEARN_IPA_DRILL_SOURCE_FILES.ipaDictGb
  },
  {
    id: "common-words",
    description: "Frequency-ranked common English words",
    url: "https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt",
    fileName: LEARN_IPA_DRILL_SOURCE_FILES.commonWords
  }
] as const;

async function fetchText(url: string): Promise<{ text: string; etag: string | null }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "pronunciation-guide-build/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  return {
    text: await response.text(),
    etag: response.headers.get("etag")
  };
}

await ensureDir(LEARN_IPA_SOURCES_DIR);

const manifestEntries = [];

for (const source of DRILL_SOURCES) {
  const startedAt = new Date().toISOString();
  const { text, etag } = await fetchText(source.url);
  const destination = path.join(LEARN_IPA_SOURCES_DIR, source.fileName);

  await writeTextFile(destination, text);
  manifestEntries.push({
    id: source.id,
    description: source.description,
    url: source.url,
    fileName: source.fileName,
    fetchedAt: startedAt,
    etag,
    sizeBytes: Buffer.byteLength(text, "utf8")
  });
}

await writeJsonFile(path.join(LEARN_IPA_SOURCES_DIR, LEARN_IPA_DRILL_SOURCE_FILES.manifest), {
  fetchedAt: new Date().toISOString(),
  sources: manifestEntries
});

console.log(
  `Synced ${manifestEntries.length} learn-IPA drill sources to ${LEARN_IPA_SOURCES_DIR}.`
);
