import { describe, expect, test } from "vitest";

import { importSources, normalizeImportedSources } from "../src/lib/build/sources";

describe("real-source adapters", () => {
  test("parses Kaikki JSONL, CMUdict text, OEWN JSON, and ipa-dict text fixtures", async () => {
    const imported = await importSources();

    const kaikkeiQigong = imported.kaikki.find((entry) => entry.term === "qigong");
    const cmudictQatar = imported.cmudict.find((entry) => entry.headword === "QATAR");
    const oewnQigong = imported.oewn.find((entry) => entry.lemma === "qigong");
    const ipaDictNguyen = imported.ipaDict.find((entry) => entry.headword === "nguyen");

    expect(kaikkeiQigong?.pronunciations[0]?.ipa).toBeTruthy();
    expect(cmudictQatar?.arpabet).toBe("K AH0 T AA1 R");
    expect(oewnQigong?.glosses[0]).toContain("coordinated breathing");
    expect(ipaDictNguyen?.ipa).toBe("/wɪn/");
  });

  test("normalization preserves engine-specific inputs and per-field provenance", async () => {
    const normalized = normalizeImportedSources(await importSources());
    const qatarSources = normalized.filter((entry) => entry.slug === "qatar");
    const cmudictVariant = qatarSources.flatMap((entry) => entry.variants).find((variant) => variant.id.includes("cmudict"));
    const ipaDictVariant = qatarSources.flatMap((entry) => entry.variants).find((variant) => variant.id.includes("ipa-dict"));

    expect(cmudictVariant?.audio.engineInputs.cmudict_arpabet).toBe("K AH0 T AA1 R");
    expect(cmudictVariant?.fieldProvenance.ipa).toBeDefined();
    expect(ipaDictVariant?.audio.engineInputs.ipa_dict).toBe("/ˈkɑːtɑɹ/");
  });
});
