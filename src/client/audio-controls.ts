function hasPlayableAudio(audio: HTMLAudioElement): boolean {
  return Number.isFinite(audio.duration) && audio.duration > 0.05;
}

function waitForAudioMetadata(audio: HTMLAudioElement): Promise<void> {
  if (hasPlayableAudio(audio) || audio.error) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      audio.removeEventListener("loadedmetadata", finish);
      audio.removeEventListener("canplay", finish);
      audio.removeEventListener("error", finish);
      window.clearTimeout(timeoutId);
      resolve();
    };

    const timeoutId = window.setTimeout(finish, 800);
    audio.addEventListener("loadedmetadata", finish, { once: true });
    audio.addEventListener("canplay", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    audio.load();
  });
}

function speakFallback(audio: HTMLAudioElement, playbackRate: number): boolean {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return false;
  }

  const text = audio.dataset.speechText?.trim();
  if (!text) {
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const locale = audio.dataset.speechLocale?.trim();
  if (locale) {
    utterance.lang = locale;
    const voice = window.speechSynthesis
      .getVoices()
      .find(
        (candidate) =>
          candidate.lang.toLowerCase() === locale.toLowerCase() ||
          candidate.lang.toLowerCase().startsWith(`${locale.toLowerCase().split("-")[0]}-`)
      );
    if (voice) {
      utterance.voice = voice;
    }
  }
  utterance.rate = playbackRate;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

async function replayAudio(audio: HTMLAudioElement, playbackRate: number): Promise<void> {
  const preferSpeech = audio.dataset.preferSpeech === "true";

  if (!preferSpeech) {
    try {
      if (!hasPlayableAudio(audio)) {
        await waitForAudioMetadata(audio);
      }

      if (hasPlayableAudio(audio)) {
        audio.pause();
        audio.currentTime = 0;
        audio.playbackRate = playbackRate;
        await audio.play();
        return;
      }
    } catch {
      // Fall through to speech synthesis or the final audio retry below.
    }
  }

  if (speakFallback(audio, playbackRate)) {
    return;
  }

  try {
    if (!hasPlayableAudio(audio)) {
      await waitForAudioMetadata(audio);
    }

    if (hasPlayableAudio(audio)) {
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = playbackRate;
      await audio.play();
    }
  } catch {
    // Ignore autoplay and playback failures; the controls remain visible.
  }
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest<HTMLButtonElement>("[data-audio-target]");
  if (!button) {
    return;
  }

  const audioId = button.dataset.audioTarget;
  const playbackRate = Number(button.dataset.playbackRate ?? "1");
  if (!audioId) {
    return;
  }

  const audio = document.getElementById(audioId);
  if (!(audio instanceof HTMLAudioElement)) {
    return;
  }

  void replayAudio(audio, playbackRate);
});

function attemptAutoplay(): void {
  const audio = document.querySelector<HTMLAudioElement>('audio[data-autoplay="true"]');
  if (!audio) {
    return;
  }

  void replayAudio(audio, 1);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attemptAutoplay, { once: true });
} else {
  attemptAutoplay();
}

window.addEventListener("pageshow", attemptAutoplay);
