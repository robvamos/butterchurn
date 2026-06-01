function formatDurationSeconds(seconds) {
  const totalSeconds = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = Math.round(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatVisibility(visibility) {
  return visibility === "private_or_unlisted" ? "Private" : "Public";
}

function summarizePrompt(prompt) {
  const text = String(prompt || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "No prompt captured yet.";
  }
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function normalizeTokenList(values) {
  return Array.isArray(values) ? values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean) : [];
}

function buildFilteredTracks(state) {
  const query = String(state.searchQuery || "").trim().toLowerCase();
  const visibility = state.visibilityFilter || "all";
  const catalog = Array.isArray(state.catalog) ? state.catalog : [];

  return catalog.filter((track) => {
    if (visibility !== "all" && track.visibility !== visibility) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      track.title,
      track.promptExcerpt,
      ...(track.tags || []),
      track.persona?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function renderSunoProductionsPanel() {
  return `
    <div class="suno-panel">
      <div class="suno-panel-header summary-card">
        <div class="section-title">Suno Productions</div>
        <div class="summary-note">Each song carries prompt, lyrics base, cue timeline, and video blueprint so we can grow visuals from the music itself.</div>
        <div class="suno-summary-grid">
          <div class="summary-stat">
            <div class="summary-stat-label">Songs</div>
            <div id="sunoSongCount" class="summary-stat-value">0</div>
          </div>
          <div class="summary-stat">
            <div class="summary-stat-label">Public</div>
            <div id="sunoPublicCount" class="summary-stat-value">0</div>
          </div>
          <div class="summary-stat">
            <div class="summary-stat-label">Private</div>
            <div id="sunoPrivateCount" class="summary-stat-value">0</div>
          </div>
          <div class="summary-stat">
            <div class="summary-stat-label">Story Beats</div>
            <div id="sunoCueCount" class="summary-stat-value">0</div>
          </div>
        </div>
      </div>

      <div class="suno-toolbar settings-card">
        <div class="control-group jammer-compact-control">
          <label for="sunoSearchInput" title="Filter songs by title, prompt, tag, or persona.">Search</label>
          <input id="sunoSearchInput" type="search" placeholder="title, mood, tag, persona">
        </div>
        <div class="control-group jammer-compact-control">
          <label for="sunoVisibilityFilter" title="Switch between all songs, public songs, or private ones.">Visibility</label>
          <select id="sunoVisibilityFilter">
            <option value="all">All songs</option>
            <option value="public">Public only</option>
            <option value="private_or_unlisted">Private only</option>
          </select>
        </div>
        <div class="button-row">
          <button id="sunoRefreshButton" type="button">Refresh</button>
        </div>
      </div>

      <div class="suno-layout">
        <section class="settings-card suno-library-column">
          <div class="suno-column-head">
            <div class="section-title">Library</div>
            <div id="sunoCatalogStatus" class="player-mini-status">Idle</div>
          </div>
          <div id="sunoCatalogEmpty" class="summary-note hidden">No Suno songs available yet.</div>
          <div id="sunoSongList" class="suno-song-list"></div>
        </section>

        <section class="settings-card suno-detail-column">
          <div class="suno-column-head">
            <div>
              <div id="sunoDetailTitle" class="section-title">Choose a song</div>
              <div id="sunoDetailSubtitle" class="summary-note">The selected production will show prompt, video cues, and multimedia anchors.</div>
            </div>
            <div id="sunoDetailVisibility" class="suno-visibility-badge">Waiting</div>
          </div>
          <audio id="sunoAudioPreview" class="suno-audio-preview" controls preload="none"></audio>
          <div id="sunoDetailMeta" class="suno-meta-chips"></div>
          <div id="sunoDetailPrompt" class="suno-prompt-card">No prompt loaded yet.</div>
          <div id="sunoDetailVisualLanguage" class="suno-visual-language hidden"></div>
          <div class="suno-story-card">
            <div class="suno-story-head">
              <div class="section-title">Story Beats</div>
              <div id="sunoSceneCount" class="summary-note">0 scenes</div>
            </div>
            <div id="sunoStoryBeatList" class="suno-story-beat-list"></div>
          </div>
        </section>
      </div>
    </div>
  `;
}

export function getSunoProductionsRefs(root = document) {
  return {
    sunoSongCount: root.getElementById("sunoSongCount"),
    sunoPublicCount: root.getElementById("sunoPublicCount"),
    sunoPrivateCount: root.getElementById("sunoPrivateCount"),
    sunoCueCount: root.getElementById("sunoCueCount"),
    sunoSearchInput: root.getElementById("sunoSearchInput"),
    sunoVisibilityFilter: root.getElementById("sunoVisibilityFilter"),
    sunoRefreshButton: root.getElementById("sunoRefreshButton"),
    sunoCatalogStatus: root.getElementById("sunoCatalogStatus"),
    sunoCatalogEmpty: root.getElementById("sunoCatalogEmpty"),
    sunoSongList: root.getElementById("sunoSongList"),
    sunoDetailTitle: root.getElementById("sunoDetailTitle"),
    sunoDetailSubtitle: root.getElementById("sunoDetailSubtitle"),
    sunoDetailVisibility: root.getElementById("sunoDetailVisibility"),
    sunoAudioPreview: root.getElementById("sunoAudioPreview"),
    sunoDetailMeta: root.getElementById("sunoDetailMeta"),
    sunoDetailPrompt: root.getElementById("sunoDetailPrompt"),
    sunoDetailVisualLanguage: root.getElementById("sunoDetailVisualLanguage"),
    sunoSceneCount: root.getElementById("sunoSceneCount"),
    sunoStoryBeatList: root.getElementById("sunoStoryBeatList"),
  };
}

export function createSunoProductionsView({ refs, getState }) {
  function renderSummary(state) {
    const catalog = Array.isArray(state.catalog) ? state.catalog : [];
    const publicCount = catalog.filter((entry) => entry.visibility === "public").length;
    const privateCount = catalog.filter((entry) => entry.visibility === "private_or_unlisted").length;
    const cueCount = catalog.reduce((total, entry) => total + Number(entry.sceneCount || 0), 0);

    refs.sunoSongCount.textContent = String(catalog.length);
    refs.sunoPublicCount.textContent = String(publicCount);
    refs.sunoPrivateCount.textContent = String(privateCount);
    refs.sunoCueCount.textContent = String(cueCount);
    refs.sunoCatalogStatus.textContent = state.loading ? "Loading" : (state.error ? "Unavailable" : `${catalog.length} ready`);
  }

  function renderSongList(state) {
    const filteredTracks = buildFilteredTracks(state);
    refs.sunoSongList.innerHTML = "";
    refs.sunoCatalogEmpty.classList.toggle("hidden", filteredTracks.length > 0);
    refs.sunoCatalogEmpty.textContent = state.loading
      ? "Loading Suno productions..."
      : (state.error || "No Suno songs available yet.");

    filteredTracks.forEach((track) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suno-song-card";
      button.dataset.songId = track.songId;
      button.classList.toggle("active", track.songId === state.selectedSongId);

      const head = document.createElement("div");
      head.className = "suno-song-card-head";

      const title = document.createElement("div");
      title.className = "suno-song-card-title";
      title.textContent = track.title || "Untitled Suno song";

      const badge = document.createElement("span");
      badge.className = `suno-visibility-pill ${track.visibility === "public" ? "is-public" : "is-private"}`;
      badge.textContent = formatVisibility(track.visibility);

      head.appendChild(title);
      head.appendChild(badge);

      const meta = document.createElement("div");
      meta.className = "suno-song-card-meta";
      meta.textContent = `${formatDurationSeconds(track.durationSeconds)} - ${Number(track.sceneCount || 0)} scenes`;

      const prompt = document.createElement("div");
      prompt.className = "suno-song-card-copy";
      prompt.textContent = track.promptExcerpt || "No prompt summary";

      const chipRow = document.createElement("div");
      chipRow.className = "suno-song-card-tags";
      normalizeTokenList(track.tags).slice(0, 3).forEach((tagValue) => {
        const chip = document.createElement("span");
        chip.className = "suno-chip";
        chip.textContent = tagValue;
        chipRow.appendChild(chip);
      });

      button.appendChild(head);
      button.appendChild(meta);
      button.appendChild(prompt);
      button.appendChild(chipRow);
      refs.sunoSongList.appendChild(button);
    });
  }

  function renderDetail(state) {
    const detail = state.detail || null;
    const metadata = detail?.metadata || {};
    const generation = metadata.generation || {};
    const lyrics = metadata.lyrics || {};
    const blueprint = detail?.videoBlueprint || {};
    const storyMap = detail?.storytelling || {};
    const scenePlan = Array.isArray(blueprint.scene_plan) ? blueprint.scene_plan : [];
    const visualLanguage = Array.isArray(blueprint?.recommended_format?.visual_language)
      ? blueprint.recommended_format.visual_language
      : [];

    refs.sunoDetailTitle.textContent = detail?.title || "Choose a song";
    refs.sunoDetailSubtitle.textContent = detail
      ? `${scenePlan.length} story beat${scenePlan.length === 1 ? "" : "s"} ready for image and video generation.`
      : "The selected production will show prompt, video cues, and multimedia anchors.";
    refs.sunoDetailVisibility.textContent = detail ? formatVisibility(detail.visibility) : "Waiting";
    refs.sunoDetailVisibility.classList.toggle("is-public", detail?.visibility === "public");
    refs.sunoDetailVisibility.classList.toggle("is-private", detail?.visibility === "private_or_unlisted");
    refs.sunoSceneCount.textContent = `${scenePlan.length} scene${scenePlan.length === 1 ? "" : "s"}`;

    refs.sunoAudioPreview.hidden = !detail?.audioUrl;
    refs.sunoAudioPreview.src = detail?.audioUrl || "";

    refs.sunoDetailMeta.innerHTML = "";
    const metaItems = [
      generation.persona?.name ? `Persona: ${generation.persona.name}` : "",
      generation.model_name ? `Model: ${generation.model_name}` : "",
      generation.major_model_version ? `Version: ${generation.major_model_version}` : "",
      generation.duration_seconds ? `Duration: ${formatDurationSeconds(generation.duration_seconds)}` : "",
      detail?.collectionMembership?.length ? `Collections: ${detail.collectionMembership.join(", ")}` : "",
    ].filter(Boolean);
    normalizeTokenList(generation.tags).slice(0, 6).forEach((tagValue) => {
      metaItems.push(`#${tagValue}`);
    });
    metaItems.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "suno-meta-chip";
      chip.textContent = item;
      refs.sunoDetailMeta.appendChild(chip);
    });

    refs.sunoDetailPrompt.textContent = generation.prompt_text || lyrics.text || "No prompt loaded yet.";
    refs.sunoDetailVisualLanguage.classList.toggle("hidden", visualLanguage.length === 0);
    refs.sunoDetailVisualLanguage.innerHTML = "";
    visualLanguage.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "suno-meta-chip";
      chip.textContent = item;
      refs.sunoDetailVisualLanguage.appendChild(chip);
    });

    refs.sunoStoryBeatList.innerHTML = "";
    if (!detail) {
      return;
    }

    if (scenePlan.length === 0) {
      const empty = document.createElement("div");
      empty.className = "summary-note";
      empty.textContent = "No scene plan captured yet.";
      refs.sunoStoryBeatList.appendChild(empty);
      return;
    }

    scenePlan.forEach((scene) => {
      const cueFromMap = Array.isArray(storyMap.cues)
        ? storyMap.cues.find((cue) => cue.cue_id === scene.cue_id)
        : null;
      const card = document.createElement("article");
      card.className = "suno-story-beat";

      const head = document.createElement("div");
      head.className = "suno-story-beat-head";

      const timing = document.createElement("div");
      timing.className = "suno-story-beat-time";
      timing.textContent = `${scene.start_tc || "00:00"} - ${scene.end_tc || "00:00"}`;

      const role = document.createElement("div");
      role.className = "suno-story-beat-role";
      role.textContent = scene.narrative_function || cueFromMap?.narrative_function || scene.cue_id;

      head.appendChild(timing);
      head.appendChild(role);

      const anchor = document.createElement("div");
      anchor.className = "suno-story-beat-anchor";
      anchor.textContent = scene.lyric_anchor || cueFromMap?.lyric_anchor || "No lyric anchor";

      const slots = document.createElement("div");
      slots.className = "suno-story-beat-slots";
      [
        scene.primary_asset_role,
        scene.overlay_asset_role,
        scene.transition_asset_role,
        scene.preferred_provider ? `Primary: ${scene.preferred_provider}` : "",
        scene.fallback_provider ? `Fallback: ${scene.fallback_provider}` : "",
      ]
        .filter(Boolean)
        .forEach((item) => {
          const chip = document.createElement("span");
          chip.className = "suno-chip";
          chip.textContent = item;
          slots.appendChild(chip);
        });

      card.appendChild(head);
      card.appendChild(anchor);
      card.appendChild(slots);
      refs.sunoStoryBeatList.appendChild(card);
    });
  }

  function render() {
    const state = getState();

    refs.sunoSearchInput.value = state.searchQuery || "";
    refs.sunoVisibilityFilter.value = state.visibilityFilter || "all";
    refs.sunoRefreshButton.disabled = Boolean(state.loading);

    renderSummary(state);
    renderSongList(state);
    renderDetail(state);
  }

  return {
    render,
    summarizePrompt,
  };
}
