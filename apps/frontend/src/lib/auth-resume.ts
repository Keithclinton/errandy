// Where to send a guest back to once they've registered/verified. Needed alongside React
// Router's `location.state.from` because that doesn't survive the one hop it can't reach:
// the full external redirect to accounts.google.com and back.
const KEY = "errandspot:auth-resume-path";

export function setResumePath(path: string): void {
  try {
    localStorage.setItem(KEY, path);
  } catch {
    // ignore
  }
}

export function peekResumePath(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function consumeResumePath(): string | null {
  const path = peekResumePath();
  clearResumePath();
  return path;
}

export function clearResumePath(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
