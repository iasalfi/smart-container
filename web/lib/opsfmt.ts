import type { Lang } from "./types";

/** Local Saudi time, printed from the stored UTC reading so it never shifts with the viewer's zone. */
export function fmtTime(ms: number, lang: Lang): string {
  const loc = lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
  return new Intl.DateTimeFormat(loc, { timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
}

export function fmtDuration(min: number, lang: Lang): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (lang === "ar") return h === 0 ? `${m} د` : m === 0 ? `${h} س` : `${h} س ${m} د`;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}
