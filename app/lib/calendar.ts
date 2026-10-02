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

// ── Date helpers ─────────────────────────────────────────────────────────────

// HDate.greg() returns local midnight, so read local fields (toISOString would
// shift the date back a day in timezones east of UTC, e.g. Israel).
function hdToIso(hd: HDate): string {
  const d = hd.greg();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// The cycle year is defined by 23 Tishrei of its starting year.
// A date between 23 Tishrei Y and 22 Tishrei Y+1 belongs to cycle year Y.
function cycleYearOf(hd: HDate): number {
  const tishrei23 = new HDate(23, months.TISHREI, hd.getFullYear());
  return hd.abs() >= tishrei23.abs() ? hd.getFullYear() : hd.getFullYear() - 1;
}

// ── Holiday skip logic ───────────────────────────────────────────────────────
// Skip rules for tanachyomi.co.il (verified against the official 5787 calendar):
//   - Shabbat
//   - CHAG (major Yom Tov): RH×2, YK, Sukkot 1, Shemini Atzeret, Pesach 1 & 7, Shavuot
//   - Purim, Tisha B'Av, Yom HaAtzma'ut
//   Fast days, Chol HaMoed and Hoshana Raba have a regular reading.

// Cache skipped dates → Hebrew label, per Hebrew year, so we only compute once per year.
const skipCache = new Map<number, Map<string, string>>();

function getSkipDatesForHebrewYear(year: number): Map<string, string> {
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

  const skipped = new Map<string, string>();

  for (const ev of events) {
    const iso  = hdToIso(ev.date);
    const desc = ev.getDesc();

    const isSkippable =
      // Major Yom Tov: RH×2, YK, Sukkot 1, Shemini Atzeret, Pesach 1 & 7, Shavuot
      !!(ev.mask & flags.CHAG) ||
      desc === "Purim" ||
      desc === "Tish'a B'Av" || desc === "Tish'a B'Av (observed)" ||
      desc === "Yom HaAtzma'ut";

    if (isSkippable) skipped.set(iso, ev.render("he-x-NoNikud"));
  }

  skipCache.set(year, skipped);
  return skipped;
}

// Returns a Hebrew label for why a date has no reading ("שבת", a holiday/fast
// name, etc.), or null if the date has a normal reading.
export function getSkipReason(iso: string): string | null {
  const d = new Date(iso + "T12:00:00Z");
  if (d.getUTCDay() === 6) return "שבת";

  return getSkipDatesForHebrewYear(cycleYearOf(new HDate(d))).get(iso) ?? null;
}

function isSkipDay(iso: string): boolean {
  return getSkipReason(iso) !== null;
}

// ── Yearly cycle schedule ────────────────────────────────────────────────────
// Every cycle restarts at Joshua 1 on 23 Tishrei and reads one unit per
// reading day until Hoshana Raba. A regular year has about 293 reading days,
// one per seder. The official 5787 (leap year) calendar fills the extra days
// like this:
//   - Divrei HaYamim (exactly 25 sedarim) is read a second time at the end.
//   - Any days still left over are filled by reading a seder over two days.
//     5787 needs four such splits, listed below in book order.
// Only the 5787 calendar has been checked. For other years the same rule
// applies, using the first N splits for the N left-over days. That choice is
// an assumption — re-check it when the official calendar for a year comes out.

type Reading = {
  book: BookDef;
  sederNum: number;
  refs?: string[];  // set for half of a split seder
};

const SPLIT_SEDARIM: { masdirim: string; sederNum: number; halves: [string[], string[]] }[] = [
  { masdirim: "יהושע",      sederNum: 4, halves: [["Joshua 6:27-7:26"],       ["Joshua 8:1-32"]]          },
  { masdirim: "ירמיהו",     sederNum: 9, halves: [["Jeremiah 17:7-25"],       ["Jeremiah 17:26-18:18"]]   },
  { masdirim: "שיר_השירים", sederNum: 1, halves: [["Song of Songs 1:1-5:1"],  ["Song of Songs 5:2-8:14"]] },
  { masdirim: "רות",        sederNum: 1, halves: [["Ruth 1:1-2:11"],          ["Ruth 2:12-4:22"]]         },
];

const REPEATED_IN_LEAP_YEAR = BOOKS.find((b) => b.masdirim === "דברי_הימים")!;

type Cycle = {
  dayIndex: Map<string, number>;  // reading-day ISO date → 0-based index
  schedule: Reading[];
};

const cycleCache = new Map<number, Cycle>();

function getCycle(year: number): Cycle {
  if (cycleCache.has(year)) return cycleCache.get(year)!;

  const dayIndex = new Map<string, number>();
  const end = new HDate(23, months.TISHREI, year + 1).abs();
  for (let abs = new HDate(23, months.TISHREI, year).abs(); abs < end; abs++) {
    const iso = hdToIso(new HDate(abs));
    if (!isSkipDay(iso)) dayIndex.set(iso, dayIndex.size);
  }

  const repeated = HDate.isLeapYear(year) ? REPEATED_IN_LEAP_YEAR.count : 0;
  const extraDays = dayIndex.size - TOTAL_SEDARIM - repeated;
  const splits = SPLIT_SEDARIM.slice(0, Math.max(0, extraDays));

  const schedule: Reading[] = [];
  for (const book of BOOKS) {
    for (let sederNum = 1; sederNum <= book.count; sederNum++) {
      const split = splits.find((s) => s.masdirim === book.masdirim && s.sederNum === sederNum);
      if (split) {
        schedule.push({ book, sederNum, refs: split.halves[0] });
        schedule.push({ book, sederNum, refs: split.halves[1] });
      } else {
        schedule.push({ book, sederNum });
      }
    }
  }
  for (let sederNum = 1; sederNum <= repeated; sederNum++) {
    schedule.push({ book: REPEATED_IN_LEAP_YEAR, sederNum });
  }

  const cycle = { dayIndex, schedule };
  cycleCache.set(year, cycle);
  return cycle;
}

// ── Fallback refs for sedarim missing/wrong in masdirim.org GitHub ───────────
// Many books are missing their seder 6/7 (and a few beyond) JSON files from
// the bambiker/sdarim repo's per-seder API. All ranges below were verified
// against the repo's full sdarim.json manifest (which does tag these verses
// with the right seder, even though no per-seder file was ever published)
// and cross-checked against the surrounding sedarim's start/end boundaries.
//
// קהלת/איכה are a special case: the repo's per-seder files for these two
// books have swapped content — "seder_X_קהלת.json" contains all of Eichah
// (Lamentations), and "seder_X_איכה.json" contains Kohelet (Ecclesiastes)
// split into 4 parts. We bypass those files entirely via fallback so the
// correct book is always shown.
const FALLBACK_REFS: Record<string, Record<number, string[]>> = {
  "יהושע": {
    6: ["Joshua 10:8-41"],
    7: ["Joshua 10:42-12:24"],
  },
  "שופטים": {
    6: ["Judges 8:3-9:6"],
    7: ["Judges 9:7-57"],
  },
  "שמואל": {
    6: ["I Samuel 10:24-12:21"],
    7: ["I Samuel 12:22-14:22"],
  },
  "מלכים": {
    6: ["I Kings 7:21-8:10"],
    7: ["I Kings 8:11-57"],
  },
  "ישעיהו": {
    6: ["Isaiah 14:2-16:4"],
    7: ["Isaiah 16:5-19:24"],
  },
  "ירמיהו": {
    6: ["Jeremiah 9:23-12:14"],
    7: ["Jeremiah 12:15-14:21"],
  },
  "יחזקאל": {
    6: ["Ezekiel 11:20-13:23"],
    7: ["Ezekiel 14:1-16:13"],
  },
  "תרי_עשר": {
    6: ["Amos 2:10-5:13"],
    7: ["Amos 5:14-7:14"],
  },
  "תהלים": {
     1: ["Psalms 1:1-11:6"],
     2: ["Psalms 11:7-20:9"],
     3: ["Psalms 20:10-29:10"],
     4: ["Psalms 29:11-35:27"],
     5: ["Psalms 35:28-41:13"],
     6: ["Psalms 41:14-49:18"],
     7: ["Psalms 49:19-57:11"],
     8: ["Psalms 57:12-67:7"],
     9: ["Psalms 67:8-72:19"],
    10: ["Psalms 72:20-78:37"],
    11: ["Psalms 78:38-84:12"],
    12: ["Psalms 84:13-90:16"],
    13: ["Psalms 90:17-100:5"],
    14: ["Psalms 101:1-105:44"],
    15: ["Psalms 105:45-111:9"],
    16: ["Psalms 111:10-119:71"],
    17: ["Psalms 119:72-128:5"],
    18: ["Psalms 128:6-140:13"],
    19: ["Psalms 140:14-150:6"],
  },
  "משלי": {
    6: ["Proverbs 22:21-25:12"],
    7: ["Proverbs 25:13-28:15"],
  },
  "איוב": {
    6: ["Job 29:14-33:32"],
    7: ["Job 33:33-38:34"],
    8: ["Job 38:35-42:17"],
  },
  "קהלת": {
    1: ["Ecclesiastes 1:1-3:12"],
    2: ["Ecclesiastes 3:13-6:12"],
    3: ["Ecclesiastes 7:1-9:6"],
    4: ["Ecclesiastes 9:7-12:14"],
  },
  "איכה": {
    1: ["Lamentations 1:1-5:22"],
  },
  "דניאל": {
    6: ["Daniel 9:4-10:20"],
    7: ["Daniel 10:21-12:13"],
  },
  "עזרא_ונחמיה": {
    6: ["Nehemiah 3:38-6:14"],
    7: ["Nehemiah 6:15-8:9"],
  },
  "דברי_הימים": {
    6: ["I Chronicles 12:41-16:35"],
    7: ["I Chronicles 16:36-19:12"],
    8: ["I Chronicles 19:13-22:18"],
  },
};

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
  "קא":101,"קב":102,"קג":103,"קד":104,"קה":105,"קו":106,"קז":107,"קח":108,"קט":109,
  "קי":110,"קיא":111,"קיב":112,"קיג":113,"קיד":114,"קטו":115,"קטז":116,"קיז":117,"קיח":118,"קיט":119,
  "קכ":120,"קכא":121,"קכב":122,"קכג":123,"קכד":124,"קכה":125,"קכו":126,"קכז":127,"קכח":128,"קכט":129,
  "קל":130,"קלא":131,"קלב":132,"קלג":133,"קלד":134,"קלה":135,"קלו":136,"קלז":137,"קלח":138,"קלט":139,
  "קמ":140,"קמא":141,"קמב":142,"קמג":143,"קמד":144,"קמה":145,"קמו":146,"קמז":147,"קמח":148,"קמט":149,
  "קנ":150,
};
const VAL_HEB = Object.fromEntries(Object.entries(HEB_VAL).map(([k, v]) => [v, k]));

function numToHeb(n: number): string { return VAL_HEB[n] ?? String(n); }
function hebToNum(s: string): number | null { return HEB_VAL[s.trim()] ?? null; }

// "Song of Songs 1:1-5:1" → "Song of Songs"
function refBook(ref: string): string { return ref.replace(/\s+[\d:-]+$/, ""); }

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
): Promise<{ bookHe: string; book: string; refs: string[] } | null> {
  // Use hardcoded fallback when masdirim file is known to be missing.
  const fallback = FALLBACK_REFS[masdirimBook]?.[sederNum];
  if (fallback) {
    return { bookHe: masdirimBook.replace("_", " "), book: refBook(fallback[0]), refs: fallback };
  }

  const sederHeb = numToHeb(sederNum);
  const url = `${GITHUB_RAW}/seder_${sederHeb}_${masdirimBook}.json`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;

  const verses: MasdirimVerse[] = await res.json();
  if (!Array.isArray(verses) || verses.length === 0) return null;

  // Group consecutively by bookchapter to handle cross-book sedarim (e.g. תרי_עשר).
  const groups: { bookHe: string; verses: MasdirimVerse[] }[] = [];
  for (const v of verses) {
    const last = groups[groups.length - 1];
    if (last && last.bookHe === v.bookchapter) {
      last.verses.push(v);
    } else {
      groups.push({ bookHe: v.bookchapter, verses: [v] });
    }
  }

  const refs: string[] = [];
  let firstBook = "";

  for (const { bookHe, verses: bVerses } of groups) {
    const book = BOOKCHAPTER_TO_SEFARIA[bookHe] ?? bookHe;
    if (!firstBook) firstBook = book;

    const first = bVerses[0];
    const last  = bVerses[bVerses.length - 1];
    const ch1 = hebToNum(first.chapter);
    const v1  = hebToNum(first.versechapter);
    const ch2 = hebToNum(last.chapter);
    const v2  = hebToNum(last.versechapter);
    if (!ch1 || !v1 || !ch2 || !v2) continue;

    const ref = ch1 === ch2
      ? `${book} ${ch1}:${v1}-${v2}`
      : `${book} ${ch1}:${v1}-${ch2}:${v2}`;
    refs.push(ref);
  }

  if (refs.length === 0) return null;

  const firstBookHe = groups[0].bookHe;
  return { bookHe: firstBookHe, book: firstBook, refs };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getReadingForDate(date: string): Promise<CalendarEntry | null> {
  if (isSkipDay(date)) return null;

  const cycle = getCycle(cycleYearOf(new HDate(new Date(date + "T12:00:00Z"))));
  const index = cycle.dayIndex.get(date);
  const reading = index === undefined ? undefined : cycle.schedule[index];
  if (!reading) return null;

  if (reading.refs) {
    return { bookHe: reading.book.bookHe, book: refBook(reading.refs[0]), refs: reading.refs };
  }

  const entry = await fetchSederVerseRange(reading.book.masdirim, reading.sederNum);
  if (!entry) return null;

  return { bookHe: reading.book.bookHe, book: entry.book, refs: entry.refs };
}
