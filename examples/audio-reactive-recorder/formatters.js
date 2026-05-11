export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function formatSignedValue(value, suffix = "") {
  const numeric = Math.round(Number(value) || 0);
  if (numeric === 0) {
    return `0${suffix}`;
  }
  return `${numeric > 0 ? "+" : ""}${numeric}${suffix}`;
}

export function formatAudioDeviceLabel(device, index) {
  if (device.label) {
    return device.label;
  }

  return `Input ${index + 1} - allow mic for full name`;
}

export function formatShortDate(dateString) {
  if (!dateString) {
    return "Not cached yet";
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return "Not cached yet";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatMonitorDelta(baseValue, appliedValue, suffix = "") {
  const delta = Math.round((appliedValue || 0) - (baseValue || 0));
  if (!delta) {
    return `${Math.round(appliedValue || 0)}${suffix}`;
  }

  return `${Math.round(appliedValue || 0)}${suffix} (${delta > 0 ? "+" : ""}${delta})`;
}

export function formatPhaseLabel(phase) {
  if (!phase) {
    return "Standby";
  }

  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

export function formatSectionLabel(section) {
  if (!section) {
    return "Steady";
  }

  return section
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
