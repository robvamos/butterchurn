export function createPlayerView({ refs, getState, callbacks, formatters }) {
  const { formatTime } = formatters;

  function updateStatus(text) {
    refs.playerStatusLabel.textContent = text;
  }

  function updateTimes() {
    refs.playerCurrentTimeLabel.textContent = formatTime(refs.playerAudio.currentTime || 0);
    refs.playerDurationLabel.textContent = formatTime(refs.playerAudio.duration || 0);
    const duration = Number.isFinite(refs.playerAudio.duration) && refs.playerAudio.duration > 0 ? refs.playerAudio.duration : 0;
    const progress = duration > 0 ? Math.round((refs.playerAudio.currentTime / duration) * 1000) : 0;
    refs.playerProgress.value = String(progress);
  }

  function updateTrackSummary() {
    const state = getState();
    const track = state.playerPlaylist[state.playerTrackIndex];
    refs.playerTrackTitle.textContent = track ? track.name : "No track loaded";
    refs.playerPlaylistLabel.textContent = track
      ? `${state.playerTrackIndex + 1} of ${state.playerPlaylist.length} - ${track.sourceLabel}`
      : "Choose a folder playlist or a single audio file.";
  }

  function updateButtons() {
    const state = getState();
    const hasTracks = state.playerPlaylist.length > 0;
    const isPlaying = state.isPlayerPlaying();
    const isPaused = hasTracks && !isPlaying && !!refs.playerAudio.src && (refs.playerAudio.currentTime || 0) > 0;
    refs.playerPlayPauseButton.disabled = !hasTracks;
    refs.playerPrevButton.disabled = !hasTracks || state.playerPlaylist.length < 2;
    refs.playerNextButton.disabled = !hasTracks || state.playerPlaylist.length < 2;
    refs.playerProgress.disabled = !hasTracks;
    refs.clearPlaylistButton.disabled = !hasTracks;
    refs.playerPlayPauseButton.textContent = isPlaying ? "\u25A0" : "\u25B6";
    refs.playerPlayPauseButton.title = isPlaying ? "Stop" : "Play";
    refs.playerPlayPauseButton.setAttribute("aria-label", isPlaying ? "Stop" : "Play");
    refs.playerPrevButton.title = "Previous track";
    refs.playerPrevButton.setAttribute("aria-label", "Previous track");
    refs.playerNextButton.title = "Next track";
    refs.playerNextButton.setAttribute("aria-label", "Next track");
    refs.playerPlayPauseButton.classList.toggle("active", isPlaying);
    updateStatus(!hasTracks ? "No track" : isPlaying ? "Playing" : isPaused ? "Paused" : "Ready");
  }

  function refreshUI() {
    updateTrackSummary();
    updateTimes();
    updateButtons();
  }

  function clearProgressWatch() {
    const state = getState();
    if (state.playerProgressWatchTimer) {
      clearTimeout(state.playerProgressWatchTimer);
      callbacks.setPlayerProgressWatchTimer(null);
    }
  }

  function bindEvents() {
    refs.loadFolderButton.addEventListener("click", callbacks.onLoadFolder);
    refs.openTrackButton.addEventListener("click", callbacks.onOpenTrack);
    refs.clearPlaylistButton.addEventListener("click", callbacks.onClearPlaylist);
    refs.playerPrevButton.addEventListener("click", callbacks.onPrevTrack);
    refs.playerPlayPauseButton.addEventListener("click", callbacks.onPlayPause);
    refs.playerNextButton.addEventListener("click", callbacks.onNextTrack);

    refs.playerTrackSelect.addEventListener("change", () => {
      const state = getState();
      if (state.suppressPlayerTrackChange || refs.playerTrackSelect.value === "") {
        return;
      }
      callbacks.onTrackSelect(Number(refs.playerTrackSelect.value), state.isPlayerPlaying());
    });

    refs.playerProgress.addEventListener("input", () => {
      if (!Number.isFinite(refs.playerAudio.duration) || refs.playerAudio.duration <= 0) {
        return;
      }
      const nextTime = (Number(refs.playerProgress.value) / 1000) * refs.playerAudio.duration;
      refs.playerAudio.currentTime = nextTime;
      updateTimes();
      callbacks.onPersistPlayerState();
    });

    [refs.playerBassSlider, refs.playerMidSlider, refs.playerTrebleSlider].forEach((slider) => {
      slider.addEventListener("input", callbacks.onEqInput);
    });
    refs.playerVolumeSlider.addEventListener("input", callbacks.onVolumeInput);

    refs.singleTrackInput.addEventListener("change", () => callbacks.onSingleTrackFiles(refs.singleTrackInput.files));
    refs.folderTrackInput.addEventListener("change", () => callbacks.onFolderTrackFiles(refs.folderTrackInput.files));

    refs.playerAudio.addEventListener("play", callbacks.onAudioPlay);
    refs.playerAudio.addEventListener("playing", () => {
      clearProgressWatch();
      updateStatus("Playing");
      refreshUI();
      callbacks.onAudioPlaying();
    });
    refs.playerAudio.addEventListener("pause", () => {
      clearProgressWatch();
      callbacks.onAudioPause();
    });
    refs.playerAudio.addEventListener("waiting", () => {
      updateStatus("Buffering");
      callbacks.onAudioWaiting();
    });
    refs.playerAudio.addEventListener("stalled", () => {
      updateStatus("Stalled");
      callbacks.onAudioStalled();
    });
    refs.playerAudio.addEventListener("timeupdate", () => {
      updateTimes();
      callbacks.onAudioTimeUpdate();
    });
    refs.playerAudio.addEventListener("loadedmetadata", () => {
      updateTimes();
      refreshUI();
      callbacks.onAudioLoadedMetadata();
    });
    refs.playerAudio.addEventListener("error", () => {
      clearProgressWatch();
      callbacks.onAudioError();
    });
    refs.playerAudio.addEventListener("ended", () => {
      clearProgressWatch();
      callbacks.onAudioEnded();
    });
  }

  return {
    bindEvents,
    clearProgressWatch,
    refreshUI,
    updateButtons,
    updateStatus,
    updateTimes,
    updateTrackSummary,
  };
}
