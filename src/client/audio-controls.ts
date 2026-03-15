function replayAudio(audio: HTMLAudioElement, playbackRate: number): void {
  audio.pause();
  audio.currentTime = 0;
  audio.playbackRate = playbackRate;
  void audio.play().catch(() => {
    // Ignore autoplay and playback failures; the controls remain visible.
  });
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

  replayAudio(audio, playbackRate);
});

function attemptAutoplay(): void {
  const audio = document.querySelector<HTMLAudioElement>('audio[data-autoplay="true"]');
  if (!audio) {
    return;
  }

  audio.playbackRate = 1;
  void audio.play().catch(() => {
    // Browsers may block unmuted autoplay. Visible controls remain available.
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attemptAutoplay, { once: true });
} else {
  attemptAutoplay();
}

window.addEventListener("pageshow", attemptAutoplay);
