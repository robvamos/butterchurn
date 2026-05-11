export function createAudioInputController({
  refs,
  getState,
  setState,
  callbacks,
  helpers,
}) {
  function setMicPermissionButtonVisible(visible) {
    refs.requestMicPermissionButton.classList.toggle("hidden", !visible);
  }

  function setDefaultAudioOptions(message = "System default input") {
    refs.audioDeviceSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = message;
    refs.audioDeviceSelect.appendChild(option);
  }

  function isMicrophoneActive() {
    const { micStream } = getState();
    return Boolean(
      micStream &&
      micStream.getAudioTracks().some((track) => track.readyState === "live" && track.enabled)
    );
  }

  function isPlayerPlaying() {
    return Boolean(refs.playerAudio.src && !refs.playerAudio.paused && !refs.playerAudio.ended);
  }

  function syncMicButtons() {
    const micActive = isMicrophoneActive();
    const playerLocked = isPlayerPlaying();
    refs.startMicButton.disabled = playerLocked || micActive;
    refs.stopMicButton.disabled = playerLocked || !micActive;
    refs.startRecordingButton.disabled = playerLocked || !micActive;
    if (playerLocked) {
      callbacks.updateMeterStatus("Player");
    }
    callbacks.updateJammerSourceState();
  }

  function setActiveAudioInput(node, analyserNode, mode) {
    const state = getState();
    if (state.visualizer && state.activeAudioNode && state.activeAudioNode !== node) {
      state.visualizer.disconnectAudio(state.activeAudioNode);
    }

    setState({
      activeAudioNode: node,
      analyser: analyserNode,
      activeInputMode: mode,
    });

    if (state.visualizer && node) {
      state.visualizer.connectAudio(node);
    }
    callbacks.syncEssentiaSource();
    callbacks.syncAubioSource();
    callbacks.refreshMeterRoute();
    callbacks.updateJammerSourceState();
  }

  function clearActiveAudioInput(mode) {
    const state = getState();
    if (mode && state.activeInputMode !== mode) {
      return;
    }

    if (state.visualizer && state.activeAudioNode) {
      state.visualizer.disconnectAudio(state.activeAudioNode);
    }

    setState({
      activeAudioNode: null,
      analyser: null,
      activeInputMode: "none",
    });
    refs.meterFill.style.width = "0%";
    callbacks.syncEssentiaSource();
    callbacks.syncAubioSource();
    callbacks.refreshMeterRoute();
    callbacks.updateJammerSourceState();
  }

  function releaseMicrophoneForPlayer() {
    const state = getState();
    if (state.micStream || state.activeInputMode === "microphone" || !refs.stopMicButton.disabled) {
      stopMicrophone();
    }
  }

  async function loadAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const currentSelection = refs.audioDeviceSelect.value;
      const { hardwareInputs, visibleInputs } = helpers.getSelectableAudioInputs(devices);
      const labelsVisible = visibleInputs.some((device) => device.label);

      refs.audioDeviceSelect.innerHTML = "";

      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "System default input";
      refs.audioDeviceSelect.appendChild(defaultOption);

      visibleInputs.forEach((device, index) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = helpers.formatAudioDeviceLabel(device, index);
        option.title = option.textContent;
        refs.audioDeviceSelect.appendChild(option);
      });

      const storedDeviceId = callbacks.getStoredAudioDeviceId() || currentSelection;
      if (
        storedDeviceId &&
        Array.from(refs.audioDeviceSelect.options).some((option) => option.value === storedDeviceId)
      ) {
        refs.audioDeviceSelect.value = storedDeviceId;
      }

      callbacks.updateAudioDeviceHint({
        hardwareCount: hardwareInputs.length || visibleInputs.length,
        visibleCount: visibleInputs.length,
        labelsVisible,
      });
      callbacks.refreshAudioSummary();

      if (visibleInputs.length === 0) {
        callbacks.log("No audio inputs visible yet. Waiting for microphone permission.");
      } else {
        callbacks.log(`Browser sees ${hardwareInputs.length || visibleInputs.length} selectable audio input device(s)`);
      }
    } catch (error) {
      setDefaultAudioOptions("System default input");
      callbacks.updateAudioDeviceHint();
      callbacks.refreshAudioSummary();
      callbacks.log(`Audio devices error: ${error.message}`);
    }
  }

  async function requestMicrophonePermission() {
    try {
      setMicPermissionButtonVisible(false);
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
      await loadAudioDevices();
      refs.audioDeviceHint.textContent = "Microphone access granted. Choose any exposed input or keep the system default route.";
      callbacks.log("Microphone permission granted");
      return true;
    } catch (error) {
      setMicPermissionButtonVisible(true);
      refs.audioDeviceHint.textContent = "Microphone access is blocked in this browser. Use the site controls near the address bar to allow it, then press Refresh.";
      callbacks.log(`Permission error: ${error.message}`);
      return false;
    }
  }

  async function getMicrophonePermissionState() {
    if (!navigator.permissions?.query) {
      return "unknown";
    }

    try {
      const permissionStatus = await navigator.permissions.query({ name: "microphone" });
      return permissionStatus.state;
    } catch (error) {
      callbacks.log(`Permission status check unavailable: ${error.message}`);
      return "unknown";
    }
  }

  async function prepareMicrophoneAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermissionButtonVisible(false);
      refs.audioDeviceHint.textContent = "This browser does not support microphone access for the recorder.";
      callbacks.log("Microphone access API unavailable");
      return;
    }

    try {
      const permissionState = await getMicrophonePermissionState();
      if (permissionState === "granted") {
        setMicPermissionButtonVisible(false);
        await loadAudioDevices();
        refs.audioDeviceHint.textContent = "Microphone access is already granted. Choose any exposed input or keep the system default route.";
        return;
      }

      if (permissionState === "denied") {
        setMicPermissionButtonVisible(true);
        await loadAudioDevices();
        refs.audioDeviceHint.textContent = "Microphone access is blocked in the browser. Re-enable it from the site controls near the address bar, then press Refresh.";
        callbacks.log("Microphone permission is currently blocked");
        return;
      }

      if (permissionState === "prompt" || permissionState === "unknown") {
        setMicPermissionButtonVisible(true);
      }
    } catch (error) {
      callbacks.log(`Microphone preparation error: ${error.message}`);
    }
  }

  async function startMicrophone() {
    try {
      if (isPlayerPlaying()) {
        callbacks.log("Pause the player before enabling the microphone");
        return;
      }

      await callbacks.ensureVisualizer();
      const state = getState();

      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      };

      if (refs.audioDeviceSelect.value) {
        constraints.audio.deviceId = { exact: refs.audioDeviceSelect.value };
      }

      if (state.micStream) {
        stopMicrophone();
      }

      const micStream = await navigator.mediaDevices.getUserMedia(constraints);
      const micSource = state.audioContext.createMediaStreamSource(micStream);
      const gainNode = state.audioContext.createGain();
      gainNode.gain.value = 1.25;
      const analyser = state.audioContext.createAnalyser();
      analyser.fftSize = 1024;

      micSource.connect(gainNode);
      gainNode.connect(analyser);
      setState({ micStream, micSource, gainNode, analyser });
      setActiveAudioInput(gainNode, analyser, "microphone");
      await callbacks.ensureEssentiaListener();
      await callbacks.ensureAubioListener();
      callbacks.syncEssentiaSource();
      callbacks.syncAubioSource();

      callbacks.startRenderLoop();
      callbacks.updateMeterStatus("Listening");
      syncMicButtons();
      callbacks.refreshJammerUi();

      await loadAudioDevices();
      callbacks.restartPresetCycle();
      callbacks.log("Microphone connected");
    } catch (error) {
      callbacks.log(`Microphone error: ${error.message}`);
    }
  }

  function stopMicrophone() {
    const state = getState();
    const activeMicNode = state.gainNode;
    const hadMicRoute = state.activeInputMode === "microphone" || state.activeAudioNode === activeMicNode;

    if (callbacks.isRecorderRecording()) {
      callbacks.stopRecording();
    }

    if (state.micSource) {
      state.micSource.disconnect();
    }

    if (state.gainNode) {
      state.gainNode.disconnect();
    }

    if (state.analyser) {
      state.analyser.disconnect();
    }

    if (state.micStream) {
      state.micStream.getTracks().forEach((track) => track.stop());
    }

    const nextState = {
      micStream: null,
      micSource: null,
      gainNode: null,
    };
    if (hadMicRoute) {
      if (state.visualizer && state.activeAudioNode) {
        state.visualizer.disconnectAudio(state.activeAudioNode);
      }
      nextState.activeAudioNode = null;
      nextState.activeInputMode = "none";
    }
    nextState.analyser = hadMicRoute && state.activeInputMode !== "player"
      ? null
      : (state.activeInputMode === "player" ? state.playerAnalyser : null);
    setState(nextState);

    callbacks.syncEssentiaSource();
    callbacks.syncAubioSource();
    refs.stopRecordingButton.disabled = true;
    syncMicButtons();
    callbacks.applyStandbyMeterState();
    callbacks.restartPresetCycle();
    if (getState().activeInputMode !== "player") {
      callbacks.stopRenderLoop();
    }
    callbacks.log("Microphone stopped");
  }

  return {
    clearActiveAudioInput,
    isMicrophoneActive,
    isPlayerPlaying,
    loadAudioDevices,
    prepareMicrophoneAccess,
    releaseMicrophoneForPlayer,
    requestMicrophonePermission,
    setActiveAudioInput,
    setMicPermissionButtonVisible,
    startMicrophone,
    stopMicrophone,
    syncMicButtons,
  };
}
