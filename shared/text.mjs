export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

// Neutralizes markup, links, and line breaks in untrusted record text; curated code goes through mdFence.
export function mdText(value) {
  return String(value).replace(/\s*[\r\n]+\s*/g, " ").replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\\`\[\]]/g, "\\$&").replace(/(https?):\/\//gi, "$1:\u200b//");
}

export function mdFence(value) {
  const body = String(value).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
  const longest = Math.max(2, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  return `${fence}text\n${body}\n${fence}`;
}

export function mdUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(`Refusing non-HTTPS or credentialed link: ${value}`);
  return url.href.replace(/[()<>\s]/g, (character) => encodeURIComponent(character).replace(/[()]/g, (paren) => (paren === "(" ? "%28" : "%29")));
}

export function formatDate(value) {
  return value ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }) : "not human verified";
}

export function formatUtcTimestamp(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "UTC",
  });
}
