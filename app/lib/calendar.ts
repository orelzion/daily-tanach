import type { CalendarEntry } from "./types";

// ── Book schedule ─────────────────────────────────────────────────────────────
// tanachyomi.co.il Year 5787 (starts 2026-10-04): Nevi'im + Ketuvim
// Seder counts verified against masdirim.org GitHub data.

type BookDef = {
  masdirim: string;   // book name used in masdirim.org GitHub filenames
  count: number;      // number of sedarim
  bookHe: string;     // Hebrew display name
  book: string;       // Sefaria English name
};

const BOOKS_5787: BookDef[] = [
  { masdirim: "יהושע",        count: 14, bookHe: "יהושע",        book: "Joshua"           },
  { masdirim: "שופטים",       count: 14, bookHe: "שופטים",       book: "Judges"           },
  { masdirim: "שמואל",        count: 34, bookHe: "שמואל",        book: "I Samuel"         },
  { masdirim: "מלכים",        count: 35, bookHe: "מלכים",        book: "I Kings"          },
  { masdirim: "ישעיהו",       count: 26, bookHe: "ישעיהו",       book: "Isaiah"           },
  { masdirim: "ירמיהו",       count: 31, bookHe: "ירמיהו",       book: "Jeremiah"         },
  { masdirim: "יחזקאל",       count: 29, bookHe: "יחזקאל",       book: "Ezekiel"          },
  { masdirim: "תרי_עשר",      count: 21, bookHe: "תרי עשר",      book: "Hosea"            },
  { masdirim: "תהלים",        count: 19, bookHe: "תהלים",        book: "Psalms"           },
  { masdirim: "משלי",         count:  8, bookHe: "משלי",         book: "Proverbs"         },
  { masdirim: "איוב",         count:  8, bookHe: "איוב",         book: "Job"              },
  { masdirim: "שיר_השירים",   count:  1, bookHe: "שיר השירים",   book: "Song of Songs"    },
  { masdirim: "רות",          count:  1, bookHe: "רות",          book: "Ruth"             },
  { masdirim: "איכה",         count:  1, bookHe: "איכה",         book: "Lamentations"     },
  { masdirim: "קהלת",         count:  4, bookHe: "קהלת",         book: "Ecclesiastes"     },
  { masdirim: "אסתר",         count:  5, bookHe: "אסתר",         book: "Esther"           },
  { masdirim: "דניאל",        count:  7, bookHe: "דניאל",        book: "Daniel"           },
  { masdirim: "עזרא_ונחמיה",  count: 10, bookHe: "עזרא ונחמיה",  book: "Ezra"             },
  { masdirim: "דברי_הימים",   count: 25, bookHe: "דברי הימים",   book: "I Chronicles"     },
];

// ── Holidays (no reading) — Year 5787 (Oct 2026 – Sep 2027) ──────────────────
const HOLIDAYS = new Set([
  "2026-10-06",                   // Sukkot 1
  "2026-10-12", "2026-10-13",     // Hoshana Raba, Shemini Atzeret
  "2027-03-02", "2027-03-03",     // Taanis Esther, Purim
  "2027-04-18", "2027-04-24",     // Pesach 1 & 7
  "2027-05-21", "2027-05-22",     // Shavuot
  "2027-08-12",                   // Tisha B'Av
  "2027-09-11", "2027-09-12",     // Rosh Hashana 5788
  "2027-09-20", "2027-09-25", "2027-10-02", // YK, Sukkot, SA 5788
]);

const YEAR_5787_START = "2026-10-04";

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

function numToHeb(n: number): string {
  return VAL_HEB[n] ?? String(n);
}

function hebToNum(s: string): number | null {
  return HEB_VAL[s.trim()] ?? null;
}

// Count weekdays (non-Shabbat, non-holiday) from startDate up to (not including) targetDate.
function weekdaysBetween(startDate: string, targetDate: string): number {
  const d = new Date(startDate + "T12:00:00Z");
  const end = new Date(targetDate + "T12:00:00Z");
  let count = 0;
  while (d < end) {
    const ds = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    if (dow !== 6 && !HOLIDAYS.has(ds)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// Map a 0-based day index to {bookDef, sederNum (1-based)}.
function dayIndexToReading(
  dayIndex: number,
  books: BookDef[]
): { book: BookDef; sederNum: number } | null {
  let remaining = dayIndex;
  for (const book of books) {
    if (remaining < book.count) {
      return { book, sederNum: remaining + 1 };
    }
    remaining -= book.count;
  }
  return null; // past end of cycle
}

const GITHUB_RAW =
  "https://raw.githubusercontent.com/bambiker/sdarim/refs/heads/main/API";

type MasdirimVerse = {
  bookchapter: string;
  chapter: string;
  versechapter: string;
  bookseder: string;
  seder: string;
};

// Map bookchapter Hebrew name → Sefaria English name for split books.
const BOOKCHAPTER_TO_SEFARIA: Record<string, string> = {
  "שמואל א": "I Samuel", "שמואל ב": "II Samuel",
  "מלכים א": "I Kings",  "מלכים ב": "II Kings",
  "דברי הימים א": "I Chronicles", "דברי הימים ב": "II Chronicles",
  "עזרא": "Ezra", "נחמיה": "Nehemiah",
};

async function fetchSederVerseRange(
  masdirimBook: string,
  sederNum: number
): Promise<{ bookHe: string; book: string; ref: string } | null> {
  const sederHeb = numToHeb(sederNum);
  const url = `${GITHUB_RAW}/seder_${sederHeb}_${masdirimBook}.json`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;

  const verses: MasdirimVerse[] = await res.json();
  if (!Array.isArray(verses) || verses.length === 0) return null;

  const first = verses[0];
  const last = verses[verses.length - 1];

  const bookHe = first.bookchapter;
  const engBook =
    BOOKCHAPTER_TO_SEFARIA[bookHe] ??
    // Fall back to the book mapping we already have
    null;

  // For books not in BOOKCHAPTER_TO_SEFARIA, look up via book name
  const SEFARIA_BY_HE: Record<string, string> = {
    "יהושע": "Joshua", "שופטים": "Judges", "ישעיהו": "Isaiah",
    "ירמיהו": "Jeremiah", "יחזקאל": "Ezekiel",
    "הושע": "Hosea", "יואל": "Joel", "עמוס": "Amos",
    "עובדיה": "Obadiah", "יונה": "Jonah", "מיכה": "Micah",
    "נחום": "Nahum", "חבקוק": "Habakkuk", "צפניה": "Zephaniah",
    "חגי": "Haggai", "זכריה": "Zechariah", "מלאכי": "Malachi",
    "תהלים": "Psalms", "משלי": "Proverbs", "איוב": "Job",
    "שיר השירים": "Song of Songs", "רות": "Ruth", "איכה": "Lamentations",
    "קהלת": "Ecclesiastes", "אסתר": "Esther", "דניאל": "Daniel",
  };

  const resolvedBook = engBook ?? SEFARIA_BY_HE[bookHe] ?? bookHe;

  const ch1 = hebToNum(first.chapter);
  const v1  = hebToNum(first.versechapter);
  const ch2 = hebToNum(last.chapter);
  const v2  = hebToNum(last.versechapter);

  if (!ch1 || !v1 || !ch2 || !v2) return null;

  const ref =
    ch1 === ch2
      ? `${resolvedBook} ${ch1}:${v1}-${v2}`
      : `${resolvedBook} ${ch1}:${v1}-${ch2}:${v2}`;

  return { bookHe, book: resolvedBook, ref };
}

export async function getReadingForDate(
  date: string
): Promise<CalendarEntry | null> {
  const dow = new Date(date + "T12:00:00Z").getUTCDay();
  if (dow === 6 || HOLIDAYS.has(date)) return null; // Shabbat or holiday

  if (date < YEAR_5787_START) return null; // before program start

  const books = BOOKS_5787;
  const startDate = YEAR_5787_START;

  const dayIndex = weekdaysBetween(startDate, date);
  const reading = dayIndexToReading(dayIndex, books);
  if (!reading) return null;

  const entry = await fetchSederVerseRange(reading.book.masdirim, reading.sederNum);
  if (!entry) return null;

  // Use the Hebrew book name from BOOKS_* (better for display than masdirim bookchapter)
  return { bookHe: reading.book.bookHe, book: entry.book, ref: entry.ref };
}
