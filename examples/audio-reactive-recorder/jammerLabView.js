export function createJammerLabView({ refs, getState, callbacks, formatters }) {
  const { formatShortDate } = formatters;

  function toggleLibrary(forceOpen) {
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : !getState().jammerDeckLibraryOpen;
    callbacks.setLibraryOpen(nextOpen);
    refs.jammerLibraryPanel.classList.toggle("active", nextOpen);
    refs.jammerLibraryTitle.textContent = "Tone Instrument Library";
    refs.jammerLibraryHint.textContent = "Choose one or more instruments to add to the deck.";
  }

  function renderInstrumentLibrary() {
    const { toneDrumBus } = getState();
    const grouped = toneDrumBus.getInstrumentCatalog().reduce((accumulator, instrument) => {
      accumulator[instrument.group] = accumulator[instrument.group] || [];
      accumulator[instrument.group].push(instrument);
      return accumulator;
    }, {});

    refs.jammerLibraryGroups.innerHTML = "";
    Object.entries(grouped).forEach(([groupName, instruments]) => {
      const group = document.createElement("div");
      group.className = "jammer-library-group";
      const title = document.createElement("strong");
      title.textContent = groupName;
      group.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "jammer-library-grid";
      instruments.forEach((instrument) => {
        const card = document.createElement("div");
        card.className = "jammer-library-card";
        const info = document.createElement("div");
        const heading = document.createElement("strong");
        heading.textContent = instrument.name;
        const meta = document.createElement("div");
        meta.className = "jammer-deck-meta";
        meta.textContent = `${instrument.engine} - ${instrument.role}`;
        const actions = document.createElement("div");
        actions.className = "jammer-library-actions";
        const previewButton = document.createElement("button");
        previewButton.type = "button";
        previewButton.className = "jammer-preview-icon";
        previewButton.setAttribute("aria-label", `Preview ${instrument.name}`);
        previewButton.title = `Preview ${instrument.name}`;
        previewButton.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 9v6"></path>
            <path d="M9 7v10"></path>
            <path d="M9 8 14 12 9 16"></path>
            <path d="M17 9.5a3.5 3.5 0 0 1 0 5"></path>
            <path d="M19 7a7 7 0 0 1 0 10"></path>
          </svg>
        `;
        previewButton.addEventListener("click", () => {
          const temporaryEntry = {
            id: `library-preview-${instrument.id}`,
            catalogId: instrument.id,
            enabled: true,
            volume: 1,
          };
          toneDrumBus.previewVoice(temporaryEntry).catch((error) => {
            callbacks.log(`Instrument preview error: ${error.message}`);
          });
        });
        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.textContent = "Add To Deck";
        addButton.addEventListener("click", () => {
          toneDrumBus.addInstrumentToDeck(instrument.id);
          renderInstrumentDeck();
          callbacks.persistJammerLabSettings().catch((error) => callbacks.log(`Drummer lab save error: ${error.message}`));
        });
        info.appendChild(heading);
        info.appendChild(meta);
        card.appendChild(info);
        actions.appendChild(previewButton);
        actions.appendChild(addButton);
        card.appendChild(actions);
        grid.appendChild(card);
      });
      group.appendChild(grid);
      refs.jammerLibraryGroups.appendChild(group);
    });
  }

  function enforceDeckAvailability() {
    const { toneDrumBus, jammerEngine } = getState();
    if (toneDrumBus.hasActiveDeck()) {
      return true;
    }

    if (jammerEngine.state.enabled) {
      callbacks.stopLabJam();
      jammerEngine.setEnabled(false);
      refs.jammerEnabledInput.checked = false;
      callbacks.persistSetting("jammerEnabled", false);
      callbacks.syncJammerControlsFromEngine();
      callbacks.updateStageLoopMonitor();
      callbacks.log("Drummer stopped: no active instruments in deck");
    }
    return false;
  }

  function renderInstrumentDeck() {
    const { toneDrumBus } = getState();
    const deck = toneDrumBus.getDeckSnapshot();
    const activeCount = deck.filter((entry) => entry.enabled).length;
    refs.jammerDeckSummary.textContent = deck.length === 0
      ? "No instruments in the deck yet."
      : `${activeCount}/${deck.length} instruments active`;
    refs.jammerDeckGrid.innerHTML = "";

    if (deck.length === 0) {
      const empty = document.createElement("div");
      empty.className = "jammer-favorite-item";
      empty.textContent = "The deck is empty. Add instruments before starting the drummer.";
      refs.jammerDeckGrid.appendChild(empty);
      return;
    }

    deck.forEach((entry) => {
      const card = document.createElement("div");
      card.className = `jammer-deck-card${entry.enabled ? "" : " is-muted"}`;

      const mainButton = document.createElement("button");
      mainButton.type = "button";
      mainButton.className = "jammer-deck-main";
      mainButton.textContent = entry.name;
      mainButton.addEventListener("click", () => {
        toneDrumBus.previewVoice(entry.id).catch((error) => callbacks.log(`Instrument preview error: ${error.message}`));
      });

      const meta = document.createElement("div");
      meta.className = "jammer-deck-meta";
      meta.textContent = `${entry.group} - ${entry.engine}`;

      const controls = document.createElement("div");
      controls.className = "jammer-deck-controls";

      const muteButton = document.createElement("button");
      muteButton.type = "button";
      muteButton.className = "jammer-deck-icon-button";
      muteButton.setAttribute("aria-label", entry.enabled ? `Mute ${entry.name}` : `Unmute ${entry.name}`);
      muteButton.title = entry.enabled ? "Mute" : "Muted";
      muteButton.innerHTML = entry.enabled
        ? `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 15h4l5 4V5L8 9H4z"></path>
            <path d="M17 9a5 5 0 0 1 0 6"></path>
            <path d="M19.5 6.5a8.5 8.5 0 0 1 0 11"></path>
          </svg>
        `
        : `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 15h4l5 4V5L8 9H4z"></path>
            <path d="M5 5 19 19"></path>
            <path d="M19 5 5 19"></path>
          </svg>
        `;
      muteButton.addEventListener("click", () => {
        toneDrumBus.toggleDeckInstrument(entry.id);
        renderInstrumentDeck();
        callbacks.persistJammerLabSettings().catch((error) => callbacks.log(`Drummer lab save error: ${error.message}`));
        enforceDeckAvailability();
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "jammer-deck-icon-button";
      removeButton.setAttribute("aria-label", `Remove ${entry.name}`);
      removeButton.title = "Remove";
      removeButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6 18 18"></path>
          <path d="M18 6 6 18"></path>
        </svg>
      `;
      removeButton.addEventListener("click", () => {
        toneDrumBus.removeDeckInstrument(entry.id);
        renderInstrumentDeck();
        callbacks.persistJammerLabSettings().catch((error) => callbacks.log(`Drummer lab save error: ${error.message}`));
        enforceDeckAvailability();
      });

      const volumeWrap = document.createElement("label");
      volumeWrap.className = "jammer-deck-volume";
      const volumeLabel = document.createElement("span");
      volumeLabel.textContent = "Vol";
      const volumeSlider = document.createElement("input");
      volumeSlider.type = "range";
      volumeSlider.min = "0";
      volumeSlider.max = "100";
      volumeSlider.step = "1";
      volumeSlider.value = String(Math.round((entry.volume ?? 1) * 100));
      volumeSlider.setAttribute("aria-label", `Volume for ${entry.name}`);
      volumeSlider.addEventListener("input", () => {
        toneDrumBus.setDeckInstrumentVolume(entry.id, Number(volumeSlider.value) / 100);
        callbacks.persistJammerLabSettings().catch((error) => callbacks.log(`Drummer lab save error: ${error.message}`));
      });
      volumeWrap.appendChild(volumeLabel);
      volumeWrap.appendChild(volumeSlider);

      controls.appendChild(muteButton);
      controls.appendChild(removeButton);
      controls.appendChild(volumeWrap);

      card.appendChild(mainButton);
      card.appendChild(meta);
      card.appendChild(controls);
      refs.jammerDeckGrid.appendChild(card);
    });
  }

  function renderJammerLabState() {
    const { jammerLabState } = getState();
    const favorites = jammerLabState?.favorites || [];
    const deckPresets = jammerLabState?.deckPresets || [];
    refs.jammerFavoriteCount.textContent = String(favorites.length);
    refs.jammerFavoriteUpdated.textContent = formatShortDate(jammerLabState?.updatedAt);
    refs.jammerFavoriteList.innerHTML = "";
    refs.jammerDeckPresetSelect.innerHTML = '<option value="">Saved decks</option>';
    renderInstrumentDeck();
    renderInstrumentLibrary();

    deckPresets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.name;
      refs.jammerDeckPresetSelect.appendChild(option);
    });

    if (favorites.length === 0) {
      const item = document.createElement("li");
      item.className = "jammer-favorite-item";
      item.textContent = "No favorite drummer snapshots saved yet.";
      refs.jammerFavoriteList.appendChild(item);
      return;
    }

    favorites.slice(0, 4).forEach((favorite) => {
      const item = document.createElement("li");
      item.className = "jammer-favorite-item";
      const title = document.createElement("strong");
      title.textContent = `${favorite.drummerId} - ${favorite.rating}/5`;
      item.appendChild(title);
      item.appendChild(document.createTextNode(
        `${favorite.notes || "No notes yet."} | deck ${(favorite.settings.instrumentDeck || []).length} - kick ${favorite.settings.kickPitch}, decay ${favorite.settings.kickDecay}, snare ${favorite.settings.snareDecay}, hat ${favorite.settings.hatBrightness}`
      ));
      refs.jammerFavoriteList.appendChild(item);
    });
  }

  function applyDeckPreset(preset) {
    const { jammerLabState, toneDrumBus } = getState();
    if (!preset?.settings) {
      return;
    }

    callbacks.applyLabConfigToUi({
      ...jammerLabState.settings,
      ...(preset.settings || {}),
    });
    toneDrumBus.setInstrumentDeck(preset.settings.instrumentDeck || []);
    callbacks.syncToneLabShape();
    renderJammerLabState();
    callbacks.updateStageLoopMonitor();
  }

  return {
    applyDeckPreset,
    enforceDeckAvailability,
    renderInstrumentDeck,
    renderInstrumentLibrary,
    renderJammerLabState,
    toggleLibrary,
  };
}
