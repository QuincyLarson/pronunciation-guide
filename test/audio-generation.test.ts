import { choosePreviewSpeechText, chooseSayVoice, isFixturePreviewAudio } from "../src/lib/build/audio";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("audio generation helpers", () => {
  test("identifies placeholder fixture audio files", () => {
    expect(isFixturePreviewAudio("/audio/fixtures/human-sample.wav")).toBe(true);
    expect(isFixturePreviewAudio("/audio/fixtures/synthetic-sample.wav")).toBe(true);
    expect(isFixturePreviewAudio("/audio/generated/qatar/en-newsroom.wav")).toBe(false);
  });

  test("builds a spoken preview phrase from respelling data", async () => {
    const corpus = await buildFixtureCorpus();
    const qatar = corpus.find((entry) => entry.slug === "qatar");
    const newsroom = qatar?.variants.find((variant) => variant.id === "en-newsroom");

    if (!qatar || !newsroom) {
      throw new Error("Missing qatar newsroom fixture");
    }

    expect(choosePreviewSpeechText(qatar, newsroom)).toBe("kah tar");
  });

  test("maps common locales to a local speech voice", () => {
    expect(chooseSayVoice("en-US")).toBe("Samantha");
    expect(chooseSayVoice("en-GB")).toBe("Daniel");
    expect(chooseSayVoice("de")).toBe("Anna");
    expect(chooseSayVoice("zh")).toContain("Chinese");
  });
});
