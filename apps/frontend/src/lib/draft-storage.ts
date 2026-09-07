const PREFIX = "errandspot:draft:";

interface StoredDraft<T> {
  values: T;
  resumePath: string;
  savedAt: number;
}

export function saveDraft<T>(key: string, values: T, resumePath: string): void {
  try {
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ values, resumePath, savedAt: Date.now() }));
  } catch {
    // storage unavailable/full — the draft just won't survive a reload, not fatal
  }
}

export function loadDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as StoredDraft<T>) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    // ignore
  }
}
