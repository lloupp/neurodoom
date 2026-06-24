// Best-effort crash/error capture. Persists a small ring buffer of runtime
// errors to localStorage so they survive a reload/crash, for support/debugging.

export interface ErrorLogEntry {
  time: number;
  message: string;
  stack?: string;
  source: 'error' | 'unhandledrejection';
}

const KEY = 'neurodoom:errorlog';
const MAX_ENTRIES = 50;

function appendEntry(entry: ErrorLogEntry): void {
  try {
    const log = getErrorLog();
    log.push(entry);
    while (log.length > MAX_ENTRIES) log.shift();
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // localStorage unavailable/full — logging is best-effort only
  }
}

export function getErrorLog(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupt/unavailable — treat as empty
  }
  return [];
}

export function clearErrorLog(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}

let installed = false;

export function installGlobalErrorLogging(): void {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (e: ErrorEvent) => {
    appendEntry({
      time: Date.now(),
      message: e.message,
      stack: e.error?.stack,
      source: 'error',
    });
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    appendEntry({
      time: Date.now(),
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      source: 'unhandledrejection',
    });
  });
}
