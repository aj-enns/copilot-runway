export const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const forbiddenKeys = new Set(["__proto__", "constructor", "prototype"]);

export function inert(value, depth = 0, maxString = 20_000) {
  if (depth > 16) throw new Error("Automation data nesting exceeds limit");
  if (typeof value === "string" && (value.length > maxString || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))) throw new Error("Invalid automation string");
  if (value && typeof value === "object") {
    if (Object.keys(value).length > 500) throw new Error("Automation object exceeds limit");
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) throw new Error(`Forbidden data key: ${key}`);
      inert(item, depth + 1, maxString);
    }
  }
  return value;
}

export function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: expected an object`);
}

export function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label}: expected an array`);
}

export function exactKeys(value, required, optional = []) {
  assertRecord(value, "Fields");
  if (required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new Error(`Expected fields: ${required.join(", ")}; optional: ${optional.join(", ")}`);
  }
}

export function isOfficialUrl(value, allowedHosts) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      (!url.port || url.port === "443") && allowedHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

export function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
