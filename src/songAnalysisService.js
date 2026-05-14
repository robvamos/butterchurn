import { loadSongAnalysis, loadSongReference, saveSongAnalysis, saveSongReference } from "./songAnalysisDb.js";

const KNOWN_EXTERNAL_SONG_REFERENCES = [
  {
    canonicalKey: "red-snapper-regrettable",
    aliases: [
      "01 - red snapper - regrettable.mp3",
      "red snapper regrettable",
      "regrettable",
    ],
    artist: "Red Snapper",
    title: "Regrettable",
    provider: "Tunebat Analyzer",
    sourceUrl: "https://tunebat.com/Analyzer",
    bpm: 58,
    key: "F# minor",
    altKey: "11A",
    capturedAt: "2026-05-11",
  },
  {
    canonicalKey: "red-snapper-regrettable",
    aliases: [
      "01 - red snapper - regrettable.mp3",
      "red snapper regrettable",
      "regrettable",
    ],
    artist: "Red Snapper",
    title: "Regrettable",
    provider: "Vocal Remover Key BPM Finder",
    sourceUrl: "https://vocalremover.org/key-bpm-finder",
    bpm: 58,
    key: "F# minor",
    altKey: "",
    capturedAt: "2026-05-11",
  },
  {
    canonicalKey: "in-mourning-colossus",
    aliases: [
      "01 - colossus.mp3",
      "colossus",
      "in mourning colossus",
    ],
    artist: "In Mourning",
    title: "Colossus",
    provider: "Tunebat Analyzer",
    sourceUrl: "https://tunebat.com/Analyzer",
    bpm: 111,
    key: "C# minor",
    altKey: "12A",
    capturedAt: "2026-05-11",
  },
  {
    canonicalKey: "in-mourning-colossus",
    aliases: [
      "01 - colossus.mp3",
      "colossus",
      "in mourning colossus",
    ],
    artist: "In Mourning",
    title: "Colossus",
    provider: "Vocal Remover Key BPM Finder",
    sourceUrl: "https://vocalremover.org/key-bpm-finder",
    bpm: 111,
    key: "C# minor",
    altKey: "",
    capturedAt: "2026-05-11",
  },
  {
    canonicalKey: "my-sleeping-karma-ahimsa",
    aliases: [
      "ahimsa",
      "my sleeping karma ahimsa",
      "01 - ahimsa.mp3",
    ],
    artist: "My Sleeping Karma",
    title: "Ahimsa",
    provider: "Vocal Remover Key BPM Finder",
    sourceUrl: "https://vocalremover.org/key-bpm-finder",
    bpm: 82,
    key: "A minor",
    altKey: "",
    capturedAt: "2026-05-11",
  },
  {
    canonicalKey: "singata-mystic-queen",
    aliases: [
      "01 singata mystic queen.mp3",
      "singata mystic queen",
      "mystic queen",
    ],
    artist: "",
    title: "Singata Mystic Queen",
    provider: "BPM Finder Batch Analyzer",
    sourceUrl: "https://bpm-finder.net/?mode=batch-upload#bpm-analyzer",
    bpm: 114.8,
    key: "",
    altKey: "",
    capturedAt: "2026-05-11",
  },
  {
    canonicalKey: "zahra-beautiful-tango",
    aliases: [
      "01-hindi_zahra-beautiful_tango.mp3",
      "hindi zahra beautiful tango",
      "beautiful tango",
    ],
    artist: "Hindi Zahra",
    title: "Beautiful Tango",
    provider: "BPM Finder Batch Analyzer",
    sourceUrl: "https://bpm-finder.net/?mode=batch-upload#bpm-analyzer",
    bpm: 126,
    key: "",
    altKey: "",
    capturedAt: "2026-05-11",
  },
  {
    canonicalKey: "zahra-beautiful-tango",
    aliases: [
      "01-hindi_zahra-beautiful_tango.mp3",
      "hindi zahra beautiful tango",
      "beautiful tango",
    ],
    artist: "Hindi Zahra",
    title: "Beautiful Tango",
    provider: "LANDR Key & BPM Finder",
    sourceUrl: "https://samples.landr.com/key-bpm-finder",
    bpm: 126,
    key: "B minor",
    altKey: "",
    capturedAt: "2026-05-11",
  },
  {
    canonicalKey: "il-secondo-secondo-me",
    aliases: [
      "01._il_secondo_secondo_me.mp3",
      "il secondo secondo me",
      "secondo secondo me",
    ],
    artist: "",
    title: "Il secondo secondo me",
    provider: "BPM Finder Batch Analyzer",
    sourceUrl: "https://bpm-finder.net/?mode=batch-upload#bpm-analyzer",
    bpm: 104,
    key: "",
    altKey: "",
    capturedAt: "2026-05-11",
  },
];

function normalizeTrackName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeReferenceEntry(entry) {
  return {
    canonicalKey: entry.canonicalKey,
    provider: entry.provider,
    sourceUrl: entry.sourceUrl,
    bpm: entry.bpm,
    key: entry.key,
    altKey: entry.altKey,
    artist: entry.artist,
    title: entry.title,
    capturedAt: entry.capturedAt,
    kind: "manual-benchmark",
  };
}

function findKnownExternalSongReferences(track) {
  const trackName = normalizeTrackName(track?.name || track);
  if (!trackName) {
    return [];
  }

  return KNOWN_EXTERNAL_SONG_REFERENCES
    .filter((entry) => Array.isArray(entry.aliases) && entry.aliases.some((alias) => trackName.includes(normalizeTrackName(alias))))
    .map(normalizeReferenceEntry);
}

function mergeExternalReferences(analysis, externalReference) {
  if (!externalReference) {
    return analysis;
  }

  const referenceList = Array.isArray(externalReference?.externalReferences)
    ? externalReference.externalReferences
    : [externalReference].filter(Boolean);
  const benchmark = referenceList[referenceList.length - 1] || null;

  return {
    ...analysis,
    externalReference: benchmark,
    externalReferences: referenceList,
    benchmark: benchmark
      ? {
        provider: benchmark.provider,
        sourceUrl: benchmark.sourceUrl,
        bpm: benchmark.bpm,
        key: benchmark.key,
        altKey: benchmark.altKey,
        capturedAt: benchmark.capturedAt,
      }
      : analysis?.benchmark,
  };
}

function buildSongAnalysisTrackId(track) {
  if (!track) {
    return "";
  }

  if (track.file) {
    return `${track.name}:${track.file.size}:${track.file.lastModified}`;
  }

  if (track.url) {
    return `${track.name}:${track.url}`;
  }

  return track.name || "";
}

async function loadSongAnalysisForTrack(track) {
  if (!track) {
    return null;
  }
  const songId = buildSongAnalysisTrackId(track);
  const [analysis, externalReference] = await Promise.all([
    loadSongAnalysis(songId),
    loadSongReference(songId),
  ]);
  if (!analysis) {
    return null;
  }
  return mergeExternalReferences(analysis, externalReference);
}

async function analyzeAndStoreSong({
  track,
  audioContext,
  offlineSongAnalyzer,
  onProgress,
} = {}) {
  if (!track) {
    throw new Error("track is required");
  }
  if (!audioContext) {
    throw new Error("audioContext is required");
  }
  if (!offlineSongAnalyzer) {
    throw new Error("offlineSongAnalyzer is required");
  }

  const { buffer, meta } = await offlineSongAnalyzer.decodeTrack(track, audioContext);
  const songId = meta.songId || buildSongAnalysisTrackId(track);
  const analysis = await offlineSongAnalyzer.analyzeAudioBuffer(buffer, {
    ...meta,
    songId,
  }, {
    onProgress,
  });
  const externalReference = await ensureKnownSongReferenceForTrack(track, songId);
  return saveSongAnalysis(songId, mergeExternalReferences(analysis, externalReference));
}

async function ensureKnownSongReferenceForTrack(track, songId = buildSongAnalysisTrackId(track)) {
  if (!track || !songId) {
    return null;
  }
  const knownReferences = findKnownExternalSongReferences(track);
  if (!knownReferences.length) {
    return loadSongReference(songId);
  }
  return saveSongReference(songId, {
    trackName: track.name || "",
    externalReferences: knownReferences,
  });
}

async function seedKnownSongReferencesForTracks(tracks = []) {
  const seeded = [];
  for (const track of tracks) {
    const reference = await ensureKnownSongReferenceForTrack(track);
    if (reference) {
      seeded.push(reference);
    }
  }
  return seeded;
}

export {
  analyzeAndStoreSong,
  buildSongAnalysisTrackId,
  ensureKnownSongReferenceForTrack,
  findKnownExternalSongReferences,
  loadSongAnalysisForTrack,
  seedKnownSongReferencesForTracks,
};
