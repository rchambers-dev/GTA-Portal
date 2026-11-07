export function startOfLocalDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date, count) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + count);
  return copy;
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function normaliseDateKey(value) {
  const key = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  const date = dateFromKey(key);
  if (!date || Number.isNaN(date.getTime())) return "";
  return toDateKey(date);
}

export function addWeeksToDateKey(dateKey, weeks) {
  const date = dateFromKey(normaliseDateKey(dateKey));
  if (!date) return "";
  return toDateKey(addDays(date, weeks * 7));
}

export function dateKeyFromIso(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toDateKey(date);
}

export function daysBetweenDateKeys(fromKey, toKey) {
  const from = dateFromKey(fromKey);
  const to = dateFromKey(toKey);
  if (!from || !to) return null;
  return Math.round(
    (startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / 86400000,
  );
}

// Fractional days between ISO timestamps. Not the same as daysBetweenDateKeys.
export function daysBetween(fromIso, toIso) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return (to.getTime() - from.getTime()) / 86400000;
}

export function parseFormDate(value) {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;
  const uk = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (!uk) return "";
  let year = Number(uk[3]);
  if (year < 100) year += 2000;
  if (year >= 2000 && year <= 2009) year += 20;
  return `${year}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
}

export function dateKeyFromFilename(name) {
  const text = String(name || "");
  const iso = text.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = text.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{2,4})/);
  if (!uk) return "";
  return parseFormDate(`${uk[1]}/${uk[2]}/${uk[3]}`);
}
