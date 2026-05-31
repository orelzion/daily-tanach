import { HDate, HebrewCalendar, flags, months } from "@hebcal/core";
import type { CalendarEntry } from "./types";

// ── Book schedule (Nevi'im + Ketuvim) ────────────────────────────────────────
// One full cycle per Jewish year, starting 23 Tishrei (day after Shemini Atzeret).
// Seder counts verified against masdirim.org GitHub data.

type BookDef = {
  masdirim: string;   // filename fragment in masdirim.org GitHub
  count: number;      // number of sedarim
  bookHe: string;     // Hebrew display name
};

const BOOKS: BookDef[] = [
  { masdirim: "יהושע",        count: 14, bookHe: "יהושע"        },
  { masdirim: "שופטים",       count: 14, bookHe: "שופטים"       },
  { masdirim: "שמואל",        count: 34, bookHe: "שמואל"        },
  { masdirim: "מלכים",        count: 35, bookHe: "מלכים"        },
  { masdirim: "ישעיהו",       count: 26, bookHe: "ישעיהו"       },
  { masdirim: "ירמיהו",       count: 31, bookHe: "ירמיהו"       },
  { masdirim: "יחזקאל",       count: 29, bookHe: "יחזקאל"       },
  { masdirim: "תרי_עשר",      count: 21, bookHe: "תרי עשר"      },
  { masdirim: "תהלים",        count: 19, bookHe: "תהלים"        },
  { masdirim: "משלי",         count:  8, bookHe: "משלי"         },
  { masdirim: "איוב",         count:  8, bookHe: "איוב"         },
  { masdirim: "שיר_השירים",   count:  1, bookHe: "שיר השירים"   },
  { masdirim: "רות",          count:  1, bookHe: "רות"          },
  { masdirim: "איכה",         count:  1, bookHe: "איכה"         },
  { masdirim: "קהלת",         count:  4, bookHe: "קהלת"         },
  { masdirim: "אסתר",         count:  5, bookHe: "אסתר"         },
  { masdirim: "דניאל",        count:  7, bookHe: "דניאל"        },
  { masdirim: "עזרא_ונחמיה",  count: 10, bookHe: "עזרא ונחמיה"  },
  { masdirim: "דברי_הימים",   count: 25, bookHe: "דברי הימים"   },
];

// Total sedarim in one cycle
const TOTAL_SEDARIM = BOOKS.reduce((s, b) => s + b.count, 0); // 293

// ── Holiday skip logic ───────────────────────────────────────────────────────
// Skip rules for tanachyomi.co.il:
//   - Shabbat
//   - CHAG (major Yom Tov): RH×2, YK, Sukkot 1, Shemini Atzeret, Pesach 1 & 7, Shavuot
//   - Hoshana Raba (21 Tishrei) — confirmed from official PDF calendar
//   - Purim, Tisha B'Av, Yom HaAtzma'ut

// Cache skipped dates per Hebrew year so we only compute once per year.
const skipCache = new Map<number, Set<string>>();

function getSkipDatesForHebrewYear(year: number): Set<string> {
  if (skipCache.has(year)) return skipCache.get(year)!;

  // Cycle runs 23 Tishrei year → 22 Tishrei year+1
  const cycleStart = new HDate(23, months.TISHREI, year);
  const cycleEnd   = new HDate(22, months.TISHREI, year + 1);

  // Fetch all events — no mask filter so we see everything
  const events = HebrewCalendar.calendar({
    start: cycleStart,
    end:   cycleEnd,
    il:    true,
  });

  const skipped = new Set<string>();

  for (const ev of events) {
    const iso  = ev.date.greg().toISOString().slice(0, 10);
    const desc = ev.getDesc();

    if (ev.mask & flags.CHAG) {
      // Major Yom Tov: RH×2, YK, Sukkot 1, Shemini Atzeret, Pesach 1 & 7, Shavuot
      skipped.add(iso);
    } else if (desc === "Purim") {
      skipped.add(iso);
    } else if (desc === "Tish'a B'Av" || desc === "Tish'a B'Av (observed)") {
      skipped.add(iso);
    } else if (desc === "Yom HaAtzma'ut") {
      skipped.add(iso);
    } else if (desc.includes("Hoshana Raba")) {
      skipped.add(iso);
    }
  }

  skipCache.set(year, skipped);
  return skipped;
}

function isSkipDay(iso: string): boolean {
  const d = new Date(iso + "T12:00:00Z");
  if (d.getUTCDay() === 6) return true; // Shabbat

  const hd = new HDate(d);
  // The cycle year is defined by 23 Tishrei of its starting year.
  // A date between 23 Tishrei Y and 22 Tishrei Y+1 belongs to cycle year Y.
  const tishrei23 = new HDate(23, months.TISHREI, hd.getFullYear());
  const cycleYear = hd.abs() >= tishrei23.abs()
    ? hd.getFullYear()
    : hd.getFullYear() - 1;

  return getSkipDatesForHebrewYear(cycleYear).has(iso);
}

// ── Cycle date math ──────────────────────────────────────────────────────────

// Anchor: 23 Tishrei 5787 = 2026-10-04 = Joshua seder 1 (day 0 of cycle)
const ANCHOR_ISO = "2026-10-04";

// Signed count of reading days between anchor and date (negative = before anchor).
function readingDaysSinceAnchor(date: string): number {
  if (date >= ANCHOR_ISO) {
    return countReadingDays(ANCHOR_ISO, date);
  } else {
    return -countReadingDays(date, ANCHOR_ISO);
  }
}

function countReadingDays(fromIso: string, toIso: string): number {
  const d   = new Date(fromIso + "T12:00:00Z");
  const end = new Date(toIso   + "T12:00:00Z");
  let count = 0;
  while (d < end) {
    if (!isSkipDay(d.toISOString().slice(0, 10))) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

function dayIndexToReading(dayIndex: number): { book: BookDef; sederNum: number } | null {
  let remaining = dayIndex;
  for (const book of BOOKS) {
    if (remaining < book.count) return { book, sederNum: remaining + 1 };
    remaining -= book.count;
  }
  return null;
}

// ── masdirim.org verse lookup ─────────────────────────────────────────────────

const GITHUB_RAW =
  "https://raw.githubusercontent.com/bambiker/sdarim/refs/heads/main/API";

const HEB_VAL: Record<string, number> = {
  "א":1,"ב":2,"ג":3,"ד":4,"ה":5,"ו":6,"ז":7,"ח":8,"ט":9,
  "י":10,"יא":11,"יב":12,"יג":13,"יד":14,"טו":15,"טז":16,
  "יז":17,"יח":18,"יט":19,"כ":20,"כא":21,"כב":22,"כג":23,
  "כד":24,"כה":25,"כו":26,"כז":27,"כח":28,"כט":29,"ל":30,
  "לא":31,"לב":32,"לג":33,"לד":34,"לה":35,"לו":36,"לז":37,
  "לח":38,"לט":39,"מ":40,"מא":41,"מב":42,"מג":43,"מד":44,
  "מה":45,"מו":46,"מז":47,"מח":48,"מט":49,"נ":50,"נא":51,
  "נב":52,"נג":53,"נד":54,"נה":55,"נו":56,"נז":57,"נח":58,
  "נט":59,"ס":60,"סא":61,"סב":62,"סג":63,"סד":64,"סה":65,
  "סו":66,"סז":67,"סח":68,"סט":69,"ע":70,"עא":71,"עב":72,
  "עג":73,"עד":74,"עה":75,"עו":76,"עז":77,"עח":78,"עט":79,
  "פ":80,"פא":81,"פב":82,"פג":83,"פד":84,"פה":85,"פו":86,
  "פז":87,"פח":88,"פט":89,"צ":90,"צא":91,"צב":92,"צג":93,
  "צד":94,"צה":95,"צו":96,"צז":97,"צח":98,"צט":99,"ק":100,
};
const VAL_HEB = Object.fromEntries(Object.entries(HEB_VAL).map(([k, v]) => [v, k]));

function numToHeb(n: number): string { return VAL_HEB[n] ?? String(n); }
function hebToNum(s: string): number | null { return HEB_VAL[s.trim()] ?? null; }

const BOOKCHAPTER_TO_SEFARIA: Record<string, string> = {
  "שמואל א": "I Samuel",      "שמואל ב": "II Samuel",
  "מלכים א": "I Kings",       "מלכים ב": "II Kings",
  "דברי הימים א": "I Chronicles", "דברי הימים ב": "II Chronicles",
  "עזרא": "Ezra",             "נחמיה": "Nehemiah",
  "יהושע": "Joshua",          "שופטים": "Judges",
  "ישעיהו": "Isaiah",         "ירמיהו": "Jeremiah",
  "יחזקאל": "Ezekiel",        "הושע": "Hosea",
  "יואל": "Joel",             "עמוס": "Amos",
  "עובדיה": "Obadiah",        "יונה": "Jonah",
  "מיכה": "Micah",            "נחום": "Nahum",
  "חבקוק": "Habakkuk",        "צפניה": "Zephaniah",
  "חגי": "Haggai",            "זכריה": "Zechariah",
  "מלאכי": "Malachi",         "תהלים": "Psalms",
  "משלי": "Proverbs",         "איוב": "Job",
  "שיר השירים": "Song of Songs", "רות": "Ruth",
  "איכה": "Lamentations",     "קהלת": "Ecclesiastes",
  "אסתר": "Esther",           "דניאל": "Daniel",
};

type MasdirimVerse = {
  bookchapter: string;
  chapter: string;
  versechapter: string;
};

async function fetchSederVerseRange(
  masdirimBook: string,
  sederNum: number,
): Promise<{ bookHe: string; book: string; ref: string } | null> {
  const sederHeb = numToHeb(sederNum);
  const url = `${GITHUB_RAW}/seder_${sederHeb}_${masdirimBook}.json`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;

  const verses: MasdirimVerse[] = await res.json();
  if (!Array.isArray(verses) || verses.length === 0) return null;

  const first = verses[0];
  const last  = verses[verses.length - 1];

  const bookHe = first.bookchapter;
  const book   = BOOKCHAPTER_TO_SEFARIA[bookHe] ?? bookHe;

  const ch1 = hebToNum(first.chapter);
  const v1  = hebToNum(first.versechapter);
  const ch2 = hebToNum(last.chapter);
  const v2  = hebToNum(last.versechapter);
  if (!ch1 || !v1 || !ch2 || !v2) return null;

  const ref = ch1 === ch2
    ? `${book} ${ch1}:${v1}-${v2}`
    : `${book} ${ch1}:${v1}-${ch2}:${v2}`;

  return { bookHe, book, ref };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getReadingForDate(date: string): Promise<CalendarEntry | null> {
  if (isSkipDay(date)) return null;

  // Signed reading days from anchor → wrap with JS-safe modulo → 0-based seder index.
  const signed     = readingDaysSinceAnchor(date);
  const sederIndex = ((signed % TOTAL_SEDARIM) + TOTAL_SEDARIM) % TOTAL_SEDARIM;

  const reading = dayIndexToReading(sederIndex);
  if (!reading) return null;

  const entry = await fetchSederVerseRange(reading.book.masdirim, reading.sederNum);
  if (!entry) return null;

  return { bookHe: reading.book.bookHe, book: entry.book, ref: entry.ref };
}
