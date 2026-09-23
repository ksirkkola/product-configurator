// Hailer's own error message is often just a generic top-level `msg` (e.g.
// "Error in fields, see details.") while the ACTUAL field-level problem sits
// in `.details`/`.debug`, which every catch block in this app was silently
// dropping — making failures impossible to diagnose from the UI alone. Pull
// the structured payload out too.
export function formatHailerError(err: unknown): string {
  const e = err as { msg?: string; message?: string; debug?: unknown; details?: unknown };
  const parts: string[] = [];
  if (e?.msg) parts.push(e.msg);
  else if (e?.message) parts.push(e.message);
  const structured = e?.details ?? e?.debug;
  if (structured && typeof structured === 'object') {
    try {
      const json = JSON.stringify(structured);
      if (json && json !== '{}' && json !== '[]') parts.push(json);
    } catch {
      // ignore — fall through to whatever we already have
    }
  }
  return parts.length > 0 ? parts.join(' — ') : String(err);
}
