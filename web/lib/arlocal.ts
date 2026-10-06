/**
 * Arabic presentation of text the app prints from data rather than from the dictionaries:
 * digits, separators, units, plates, place and company names, and the people in the registry.
 * Codes that are printed on assets or in other systems (SC-1060, CS-1983, WO-0004, DR-1001, P1) stay as they are.
 */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const digit = (c: string) => AR_DIGITS[c.charCodeAt(0) - 48];

const PLATE: Record<string, string> = { A: "ا", B: "ب", D: "د", E: "ع", G: "ق", H: "هـ", J: "ح", K: "ك", L: "ل", N: "ن", R: "ر", S: "س", T: "ط", U: "و", V: "ى", X: "ص", Z: "م" };

const FIRST: Record<string, string> = {
  Ahmed: "أحمد", Khalid: "خالد", Fahad: "فهد", Saud: "سعود", Omar: "عمر", Yousef: "يوسف", Nasser: "ناصر", Majed: "ماجد", Salman: "سلمان", Faisal: "فيصل", Turki: "تركي", Abdullah: "عبدالله",
  Mansour: "منصور", Rashid: "راشد", Bandar: "بندر", Sultan: "سلطان", Hamad: "حمد", Talal: "طلال", Waleed: "وليد", Ibrahim: "إبراهيم", Mishal: "مشعل", Badr: "بدر", Saleh: "صالح", Mohammed: "محمد",
};
const FAMILY: Record<string, string> = {
  "Al-Harbi": "الحربي", "Al-Otaibi": "العتيبي", "Al-Qahtani": "القحطاني", "Al-Dosari": "الدوسري", "Al-Ghamdi": "الغامدي", "Al-Zahrani": "الزهراني", "Al-Shehri": "الشهري", "Al-Mutairi": "المطيري",
  "Al-Anazi": "العنزي", "Al-Subaie": "السبيعي", "Al-Juhani": "الجهني", "Al-Malki": "المالكي", "Al-Shammari": "الشمري", "Al-Rashidi": "الرشيدي", "Al-Yami": "اليامي", "Al-Balawi": "البلوي",
  "Al-Enezi": "العنزي", "Al-Harthi": "الحارثي", "Al-Asmari": "العسيري", "Al-Bishi": "البيشي", "Al-Thaqafi": "الثقفي", "Al-Sulami": "السلمي", "Al-Khaldi": "الخالدي", "Al-Maliki": "المالكي",
};

/** Labels that are a whole string on their own: grade and priority chips, and the few labels the markup keeps in English. */
const EXACT: Record<string, string> = {
  A: "أ", B: "ب", C: "ج", D: "د", P: "أ", L: "م", ID: "المعرّف",
  Main: "التنقل الرئيسي", "Status filter": "تصفية الحالة", "Map controls": "أدوات الخريطة", "Fleet table": "جدول الأسطول", "Container views": "أقسام الحاوية", "Report table": "جدول التقرير",
  km: "كم", "km/h": "كم/س", "km/h ·": "كم/س ·",
};

/** Whole phrases first (longest match wins), then single words. */
const PHRASES: [string, string][] = [
  ["Najd Haulage Co", "شركة نجد للنقل"], ["Hail Cold Chain Carriers", "ناقلو سلسلة التبريد في حائل"], ["Dammam Freight Partners", "شركاء الشحن في الدمام"], ["Jeddah Reefer Lines", "خطوط جدة للمبرّدات"],
  ["Red Coast Transport", "نقل الساحل الأحمر"], ["Tabuk Road Carriers", "ناقلو طرق تبوك"], ["Qassim Fleet Services", "خدمات أسطول القصيم"], ["Madinah Cargo Movers", "ناقلو بضائع المدينة"],
  ["Najd Fresh Foods", "نجد للأغذية الطازجة"], ["Red Sea Seafood", "مأكولات البحر الأحمر"], ["Gulf Pharma Supply", "الخليج لإمدادات الأدوية"], ["Hijaz Retail Group", "مجموعة الحجاز للتجزئة"],
  ["Eastern Dairy Co", "الشرقية للألبان"], ["Tabuk Produce", "منتجات تبوك"], ["Desert Gate Trading", "بوابة الصحراء للتجارة"], ["Peninsula Electronics", "إلكترونيات الجزيرة"],
  ["Jeddah", "جدة"], ["Riyadh", "الرياض"], ["Dammam", "الدمام"], ["Madinah", "المدينة المنورة"], ["Tabuk", "تبوك"], ["Jizan", "جازان"], ["Buraydah", "بريدة"], ["Hail", "حائل"],
  ["readings", "قراءة"], ["reading", "قراءة"], ["latest", "آخر قيمة"], ["now", "الآن"], ["to", "إلى"],
];

const PHRASE_RE = new RegExp("(?<![A-Za-z-])(" + PHRASES.map(([k]) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|") + ")(?![A-Za-z-])", "g");
const PHRASE = new Map(PHRASES);
const NAME_RE = new RegExp("(?<![A-Za-z-])(" + Object.keys(FIRST).join("|") + ")(?![A-Za-z-])", "g");
const FAM_RE = new RegExp("(?<![A-Za-z])(" + Object.keys(FAMILY).join("|") + ")(?![A-Za-z-])", "g");

/** Codes that keep their Latin shape and their Western digits. */
const CODE_RE = /\b(?:SC|CS|TR|DR|WO|FP|EV|TK|TKT|PRB|CHG|INC|SR|API|J)-?\d[\d-]*\b|\b[PL][1-4]\b/g;

export function arDigits(s: string): string {
  return s
    .replace(/(\d)\.(?=\d)/g, "$1٫")
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1٬")
    .replace(/(\d)\s?%/g, "$1٪")
    .replace(/[0-9]/g, digit);
}

function units(s: string): string {
  return s
    .replace(/(\d)\s?°C\b/g, "$1 °م")
    .replace(/(\d)\s?km\/h\b/g, "$1 كم/س")
    .replace(/(\d)\s?km\b/g, "$1 كم")
    .replace(/(\d)\s?h\b/g, "$1 س")
    .replace(/(\d)\s?min\b/g, "$1 د")
    .replace(/(?<![A-Za-z])°C\b/g, "°م")
    .replace(/(\d)h\b/g, "$1س")
    .replace(/(^|\s)km\/h(?![A-Za-z])/g, "$1كم/س")
    .replace(/(^|\s)km(?![A-Za-z/])/g, "$1كم");
}

/** Present one string in Arabic. Strings with nothing to change come back untouched. */
export function arText(input: string): string {
  if (!input || !/[A-Za-z0-9]/.test(input)) return input;
  const whole = EXACT[input.trim()];
  if (whole) return input.replace(input.trim(), whole);
  // Park the codes, convert the rest, then put the codes back.
  const parked: string[] = [];
  let s = input.replace(CODE_RE, (m) => { parked.push(m); return String.fromCharCode(0xe100 + parked.length - 1); });
  s = s.replace(/\b([ABDEGHJKLNRSTUVXZ]{3}) (\d{4})\b/g, (_m, l: string, d: string) => `${[...l].map((c) => PLATE[c] ?? c).join(" ")} ${d}`);
  s = s.replace(PHRASE_RE, (m) => PHRASE.get(m) ?? m);
  s = s.replace(NAME_RE, (m) => FIRST[m] ?? m).replace(FAM_RE, (m) => FAMILY[m] ?? m);
  s = s.replace(/(التقدير )([ABCD])\b/g, (_m, a: string, g: string) => a + (EXACT[g] ?? g)).replace(/ ?, (?=آخر قيمة)/g, "، ");
  s = units(s);
  s = arDigits(s);
  return s.replace(/[\ue100-\ue1ff]/g, (c) => parked[c.charCodeAt(0) - 0xe100]);
}

/** A number as Arabic digits with Arabic separators. */
export function arNum(n: number, maxFrac = 0): string {
  return new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: maxFrac }).format(n);
}
