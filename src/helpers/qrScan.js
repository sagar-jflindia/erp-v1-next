/**
 * Shared QR / scan parsing for stickers, boxes, and locations.
 * Keep behavior aligned across Inward, Override, and similar flows.
 */

export function extractLocationId(rawValue) {
  const normalizedValue = String(rawValue ?? "").trim();
  if (!normalizedValue) return null;

  if (/\bbox(?:_no)?\s*uid\b/i.test(normalizedValue)) return null;

  const locationIdMatch = normalizedValue.match(/\blocation[_\s]*id\s*[:=-]?\s*(\d+)\b/i);
  if (locationIdMatch?.[1]) return locationIdMatch[1];

  const idMatch = normalizedValue.match(/\b(?:id|location\s*id)\s*[:=-]?\s*(\d+)\b/i);
  if (idMatch?.[1]) return idMatch[1];

  const plainNumeric = normalizedValue.match(/^\d+$/);
  if (plainNumeric) return plainNumeric[0];

  return normalizedValue;
}

export function detectQrType(rawValue) {
  const trimmed = String(rawValue ?? "").trim();
  const normalized = trimmed.toLowerCase();
  if (!normalized) return "unknown";

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const p = JSON.parse(trimmed);
      if (p?.box_uid != null || p?.box_no_uid) return "box";
      if (p?.location_id != null && p?.box_uid == null && p?.box_no_uid == null) return "location";
    } catch {
      // continue
    }
  }

  if (/\bbox(?:_no)?\s*uid\b/.test(normalized)) return "box";
  if (/\blocation[_\s]*id\b/.test(normalized)) return "location";
  return "unknown";
}

export function extractBoxCode(rawValue) {
  const normalizedValue = String(rawValue ?? "").trim();
  if (!normalizedValue) return "";

  if (normalizedValue.startsWith("{") && normalizedValue.endsWith("}")) {
    try {
      const parsed = JSON.parse(normalizedValue);
      if (parsed?.location_id != null && parsed?.box_uid == null && parsed?.box_no_uid == null) {
        return "";
      }
      if (parsed?.box_uid) return String(parsed.box_uid).trim();
      if (parsed?.box_no_uid) return String(parsed.box_no_uid).trim();
    } catch {
      // continue
    }
  }

  const uidMatch = normalizedValue.match(
    /\b(?:box_uid|box_no_uid|uid|box(?:\s*id)?)\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i
  );
  if (uidMatch?.[1]) return uidMatch[1].trim();

  const idMatch = normalizedValue.match(/\bid\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i);
  if (idMatch?.[1]) return idMatch[1].trim();

  return normalizedValue.split(/\r?\n/)[0].trim();
}

/** Same as legacy `parseScannedValue` — sticker/box QR text → candidate UID */
export function parseBoxScanRaw(raw) {
  return extractBoxCode(raw);
}
