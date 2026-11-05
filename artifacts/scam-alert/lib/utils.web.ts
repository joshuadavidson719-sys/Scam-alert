/**
 * Firestore returns Timestamp objects, not millisecond numbers. The web
 * formatter also accepts serialized timestamps from cached/API records.
 */
export function toDisplayDate(value: unknown): Date | null {
  try {
    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      date = new Date(value);
    } else if (typeof value === "string" && value.trim()) {
      date = new Date(value);
    } else if (value && typeof value === "object") {
      const timestamp = value as {
        toDate?: () => Date;
        seconds?: number;
        nanoseconds?: number;
        _seconds?: number;
        _nanoseconds?: number;
      };
      if (typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
      } else {
        const seconds = timestamp.seconds ?? timestamp._seconds;
        const nanoseconds =
          timestamp.nanoseconds ?? timestamp._nanoseconds ?? 0;
        if (
          typeof seconds !== "number" ||
          !Number.isFinite(seconds) ||
          typeof nanoseconds !== "number" ||
          !Number.isFinite(nanoseconds)
        ) return null;
        date = new Date(seconds * 1000 + nanoseconds / 1_000_000);
      }
    } else {
      return null;
    }
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

// Keep the shared import name; Metro selects this module only for web.
export function formatTimeAgo(timestamp: unknown): string {
  const date = toDisplayDate(timestamp);
  // A pending server timestamp resolves through the existing live listener.
  // Never invent a posting date when the saved value is missing or malformed.
  if (!date) return "Date unavailable";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
