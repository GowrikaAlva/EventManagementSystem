// ─── Valora Redactor ─────────────────────────────────────────────────────────
// Replaces every occurrence of every matched sensitive value inside a string
// with the token [REDACTED].
//
// Why last-to-first?
//   If we replaced left-to-right, replacing "secret@company.com" (18 chars)
//   with "[REDACTED]" (10 chars) would shift all subsequent character positions
//   by -8, making every pre-calculated index wrong.
//   Processing from the end of the string backwards keeps earlier positions valid.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replace all sensitive values in `text` with "[REDACTED]".
 *
 * @param {string}   text    - Original input text from the AI chat box
 * @param {{ type: string, value: string }[]} matches
 *                           - Array returned by findSensitiveData()
 * @returns {string}         - New string with sensitive values replaced
 *
 * Example:
 *   redactText("Call hr@company.com about EMP-001234", [
 *     { type: "Company email", value: "hr@company.com" },
 *     { type: "Employee ID",   value: "EMP-001234" }
 *   ])
 *   → "Call [REDACTED] about [REDACTED]"
 */
function redactText(text, matches) {
  if (!text || typeof text !== "string") return text;
  if (!matches || matches.length === 0) return text;

  // ── Build a flat list of every { start, end } span that must be redacted ──
  // One match value may appear multiple times in the text — find them all.
  const spans = [];

  matches.forEach(({ value }) => {
    if (!value) return;
    const lowerText = text.toLowerCase();
    const lowerValue = value.toLowerCase();
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const pos = lowerText.indexOf(lowerValue, searchFrom);
      if (pos === -1) break;
      spans.push({ start: pos, end: pos + value.length });
      searchFrom = pos + 1; // advance by 1 to catch overlapping occurrences
    }
  });

  if (spans.length === 0) return text;

  // ── Merge overlapping/adjacent spans so we don't double-redact ────────────
  spans.sort((a, b) => a.start - b.start);
  const merged = [spans[0]];
  for (let i = 1; i < spans.length; i++) {
    const last = merged[merged.length - 1];
    if (spans[i].start <= last.end) {
      last.end = Math.max(last.end, spans[i].end); // extend the current span
    } else {
      merged.push(spans[i]);
    }
  }

  // ── Apply replacements right-to-left to preserve earlier offsets ──────────
  merged.sort((a, b) => b.start - a.start); // descending

  let result = text;
  merged.forEach(({ start, end }) => {
    result = result.slice(0, start) + "[REDACTED]" + result.slice(end);
  });

  return result;
}
