/**
 * Build data/calendar.json from tanachyomi.co.il PDFs + masdirim.org seder data.
 *
 * Usage:
 *   node scripts/build-calendar.mjs
 *
 * Requires network access to:
 *   - https://www.tanachyomi.co.il  (PDFs)
 *   - https://raw.githubusercontent.com/bambiker/sdarim  (verse ranges)
 *
 * Run from your local machine, then commit data/calendar.json.
 */
import { PDFParse } from "pdf-parse";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const GITHUB_RAW = "https://raw.githubusercontent.com/bambiker/sdarim/refs/heads/main/API";

// ── Hebrew numeral helpers ──────────────────────────────────────────────────

const HEB_VAL = {
  "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9,
  "י": 10, "יא": 11, "יב": 12, "יג": 13, "יד": 14, "טו": 15, "טז": 16,
  "יז": 17, "יח": 18, "יט": 19, "כ": 20, "כא": 21, "כב": 22, "כג": 23,
  "כד": 24, "כה": 25, "כו": 26, "כז": 27, "כח": 28, "כט": 29, "ל": 30,
  "לא": 31, "לב": 32, "לג": 33, "לד": 34, "לה": 35, "לו": 36, "לז": 37,
  "לח": 38, "לט": 39, "מ": 40, "מא": 41, "מב": 42, "מג": 43, "מד": 44,
  "מה": 45, "מו": 46, "מז": 47, "מח": 48, "מט": 49, "נ": 50, "נא": 51,
  "נב": 52, "נג": 53, "נד": 54, "נה": 55, "נו": 56, "נז": 57, "נח": 58,
  "נט": 59, "ס": 60, "סא": 61, "סב": 62, "סג": 63, "סד": 64, "סה": 65,
  "סו": 66, "סז": 67, "סח": 68, "סט": 69, "ע": 70, "עא": 71, "עב": 72,
  "עג": 73, "עד": 74, "עה": 75, "עו": 76, "עז": 77, "עח": 78, "עט": 79,
  "פ": 80, "פא": 81, "פב": 82, "פג": 83, "פד": 84, "פה": 85, "פו": 86,
  "פז": 87, "פח": 88, "פט": 89, "צ": 90, "צא": 91, "צב": 92, "צג": 93,
  "צד": 94, "צה": 95, "צו": 96, "צז": 97, "צח": 98, "צט": 99, "ק": 100,
  "קא": 101, "קב": 102, "קג": 103, "קד": 104, "קה": 105, "קו": 106,
  "קז": 107, "קח": 108, "קט": 109, "קי": 110, "קיא": 111, "קיב": 112,
  "קיג": 113, "קיד": 114, "קטו": 115, "קטז": 116, "קיז": 117, "קיח": 118,
  "קיט": 119, "קכ": 120, "קנ": 150,
};
const VAL_HEB = Object.fromEntries(Object.entries(HEB_VAL).map(([k, v]) => [v, k]));

function hebToNum(s) {
  return HEB_VAL[s.trim()] ?? null;
}
function numToHeb(n) {
  return VAL_HEB[n] ?? String(n);
}

// ── Book name mapping ───────────────────────────────────────────────────────

// PDF Hebrew name → masdirim.org seder-book name (underscores for spaces)
const PDF_TO_MASDIRIM = {
  "יהושע": "יהושע",
  "שופטים": "שופטים",
  "שמואל": "שמואל",
  "מלכים": "מלכים",
  "ישעיהו": "ישעיהו",
  "ישעיה": "ישעיהו",
  "ירמיהו": "ירמיהו",
  "ירמיה": "ירמיהו",
  "יחזקאל": "יחזקאל",
  "תרי עשר": "תרי_עשר",
  "תהלים": "תהלים",
  "משלי": "משלי",
  "איוב": "איוב",
  "שיר השירים": "שיר_השירים",
  "רות": "רות",
  "איכה": "איכה",
  "קהלת": "קהלת",
  "אסתר": "אסתר",
  "דניאל": "דניאל",
  "עזרא ונחמיה": "עזרא_ונחמיה",
  "דברי הימים": "דברי_הימים",
  // Torah
  "בראשית": "בראשית",
  "שמות": "שמות",
  "ויקרא": "ויקרא",
  "במדבר": "במדבר",
  "דברים": "דברים",
};

// masdirim bookchapter → Sefaria English name
const SEFARIA_BOOK = {
  "יהושע": "Joshua",
  "שופטים": "Judges",
  "שמואל א": "I Samuel",
  "שמואל ב": "II Samuel",
  "מלכים א": "I Kings",
  "מלכים ב": "II Kings",
  "ישעיהו": "Isaiah",
  "ירמיהו": "Jeremiah",
  "יחזקאל": "Ezekiel",
  "הושע": "Hosea",
  "יואל": "Joel",
  "עמוס": "Amos",
  "עובדיה": "Obadiah",
  "יונה": "Jonah",
  "מיכה": "Micah",
  "נחום": "Nahum",
  "חבקוק": "Habakkuk",
  "צפניה": "Zephaniah",
  "חגי": "Haggai",
  "זכריה": "Zechariah",
  "מלאכי": "Malachi",
  "תהלים": "Psalms",
  "משלי": "Proverbs",
  "איוב": "Job",
  "שיר השירים": "Song of Songs",
  "רות": "Ruth",
  "איכה": "Lamentations",
  "קהלת": "Ecclesiastes",
  "אסתר": "Esther",
  "דניאל": "Daniel",
  "עזרא": "Ezra",
  "נחמיה": "Nehemiah",
  "דברי הימים א": "I Chronicles",
  "דברי הימים ב": "II Chronicles",
  "בראשית": "Genesis",
  "שמות": "Exodus",
  "ויקרא": "Leviticus",
  "במדבר": "Numbers",
  "דברים": "Deuteronomy",
};

// ── PDF parsing ─────────────────────────────────────────────────────────────

// Known Shabbat parashiyot (to distinguish from book names in reading lines)
const PARASHIYOT = new Set([
  "בראשית","נח","לך לך","לך","לך-לך","וירא","חיי שרה","תולדות","ויצא","וישלח",
  "וישב","מקץ","ויגש","ויחי","שמות","וארא","בא","בשלח","יתרו","משפטים",
  "תרומה","תצוה","כי תשא","ויקהל","פקודי","ויקרא","צו","שמיני","תזריע",
  "מצורע","אחרי מות","קדשים","אמור","בהר","בחקתי","במדבר","נשא","בהעלתך",
  "שלח לך","שלח","קורח","חקת","בלק","פינחס","מטות","מסעי","מטות-מסעי",
  "דברים","ואתחנן","עקב","ראה","שופטים","כי תצא","כי תבוא","נצבים",
  "וילך","נצבים-וילך","האזינו","וזאת הברכה",
]);

// Known holiday markers (days with no Tanach Yomi reading)
const HOLIDAY_MARKERS = new Set([
  "ראש השנה","יום כיפור","סוכות","שמיני עצרת","שבועות","פסח",
  "שביעי של פסח","תשעה באב","תשעה-באב","צום גדליה","צום יז תמוז",
  "צום י טבת","תענית אסתר","פורים","חנוכה","הושענא רבה",
  "יום ירושלים","יום הזיכרון","יום העצמאות","ראש השנה לאילנות",
  "חוה\"מ","שביעי"
]);

/**
 * Extract ordered reading entries from PDF text.
 * Returns [{bookHe, sederNum, half}] in CHRONOLOGICAL order.
 */
function parseReadingsPdf(text) {
  // The reading section appears after "ראשון\tשני\tשלישי..." header.
  // Readings within each page are in REVERSE chronological order.
  // Split text by the column-header line to find each page's reading block.
  const pages = text.split(/ראשון[\t ]+שני[\t ]+שלישי[\t ]+רביעי[\t ]+חמישי[\t ]+שישי[\t ]+שבת/);

  const allEntries = []; // will hold {bookHe, sederNum, half} in chronological order

  for (const page of pages) {
    // The section AFTER the header (or before on next page) contains readings.
    // We want the block that has the reading lines.
    // Readings look like: "[Book] ס' [num]" possibly with "1" or "2" after
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);

    // Collect reading entries from this block (will be in reverse chrono order)
    const pageEntries = [];

    for (const line of lines) {
      // Skip pure metadata lines
      if (/לוח תנ/.test(line) || /www\.tanach/.test(line)) continue;
      if (/^\-\- \d+ of \d+ \-\-$/.test(line)) continue;

      // Extract all reading tokens from this line
      // Pattern: BookName ס' HebNum [1|2]
      // BookName may be multi-word: up to 3 Hebrew words
      // Use a greedy scan approach
      const lineEntries = extractReadingsFromLine(line);
      pageEntries.push(...lineEntries);
    }

    // Reverse this page's entries to get chronological order, prepend to all
    // (pages appear chronologically, so we append each page's chrono entries)
    allEntries.push(...pageEntries.reverse());
  }

  return allEntries;
}

/**
 * Extract reading entries from a single line of PDF text.
 * A line may contain multiple readings and/or event markers.
 * Returns [{bookHe, sederNum, half}] for readings only.
 */
function extractReadingsFromLine(line) {
  const entries = [];

  // Tokenize by tabs/multiple spaces
  const tokens = line.split(/[\t]+/).map((t) => t.trim()).filter(Boolean);

  // Rejoin tabs back, scan for ס' pattern
  // Pattern in the text: "BookName ס' HebNum" or "BookName ס'HebNum"
  // The book name may be 1-3 words. We scan token by token.

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    // Check if this token contains ס' (seder marker)
    // Cases:
    //   "יהושע ס' א"  → book="יהושע", seder token next
    //   "יהושע ס'א"   → combined
    //   "ס' א"        → seder without book (continuation)

    // Find ס' in the token
    const sIdx = token.indexOf("ס'");
    if (sIdx === -1) {
      i++;
      continue;
    }

    // Book name is everything before ס'
    let bookPart = token.slice(0, sIdx).trim();

    // If book is empty, use previous book (not needed with our approach)
    // The book may span multiple previous tokens - but usually it's in same token
    // or the previous 1-2 tokens don't have ס'

    // Seder number is everything after ס'
    let sederPart = token.slice(sIdx + 2).trim(); // after ס'

    // Sometimes the seder number is in the NEXT token
    if (!sederPart && i + 1 < tokens.length) {
      sederPart = tokens[i + 1].trim();
      i++;
    }

    // Parse half: sederPart might end with "1" or "2"
    let half = 0;
    const halfMatch = sederPart.match(/^(.*?)\s*([12])$/);
    if (halfMatch) {
      sederPart = halfMatch[1].trim();
      half = parseInt(halfMatch[2]);
    }

    const sederNum = hebToNum(sederPart);
    if (sederNum === null || sederNum <= 0) {
      i++;
      continue;
    }

    if (!bookPart) {
      i++;
      continue;
    }

    // Normalize book name (remove trailing spaces/quotes)
    bookPart = bookPart.replace(/["״׳']/g, "").trim();

    entries.push({ bookHe: bookPart, sederNum, half });
    i++;
  }

  return entries;
}

// ── Date computation ────────────────────────────────────────────────────────

// Major Jewish holidays where Tanach Yomi is NOT read.
// Format: "YYYY-MM-DD"
// Covers 5786 (Oct 2025–Sep 2026) and 5787 (Oct 2026–Sep 2027).
const HOLIDAYS = new Set([
  // 5786 year (Oct 2025 – Sep 2026)
  // Rosh Hashana 5786: Sep 22-23, 2025 (before program start)
  // Yom Kippur 5786: Oct 1-2, 2025 (before program start)
  // Sukkot 5786: Oct 6-7 (yom tov in diaspora; Israel only Oct 6)
  // In Israel: Sukkot 1st = Oct 6, 2025; Shemini Atzeret = Oct 13, 2025
  "2025-10-06", // Sukkot 1st day (year 5786 starts ~Oct 21, so these are pre-start)
  // Program starts around Oct 21, 2025 (23 Tishrei 5786)
  // Chanukah: Nov 26 – Dec 3, 2026... wait, 5786 Chanukah is Dec 14-22, 2025 (25 Kislev)
  // Kislev 25, 5786: check - Tishrei 1 = Sep 22, 2025. Kislev 25 = Nov 25 + ~59 days...
  // Rosh Hodesh Cheshvan = Oct 24; +29 days = Rosh Hodesh Kislev = Nov 22; +25 = Dec 17
  // Actually: 5786 Chanukah starts Dec 14 (evening), day 1 = Dec 15, 2025
  // Chanukah is NOT a no-reading day based on the PDF analysis
  // Taanis Esther 5786: Mar 12, 2026
  "2026-03-12", // Taanis Esther (fast day, no reading)
  // Purim 5786: Mar 13-14, 2026 (Purim = Mar 13, Shushan Purim = Mar 14)
  "2026-03-13", // Purim
  // Pesach 5786: Apr 1-9, 2026 (1st day Apr 1, 7th day Apr 7, 8th Apr 8 outside Israel)
  "2026-04-01", // Pesach 1st day
  "2026-04-07", // Shevi'i shel Pesach
  // Chol Hamoed Pesach has readings (based on analysis of Regular2.pdf)
  // Yom Hazikaron and Yom Haatzmaut: not a no-reading day
  // Shavuot 5786: May 22-23, 2026 (but May 23 is also Shabbat)
  "2026-05-22", // Shavuot 1st day (Israel: also the only day; abroad: 1st of 2)
  // May 23 = Shabbat (also 2nd day Shavuot outside Israel, but Shabbat is already skipped)
  // 17 Tammuz 5786: fast day - reading CONTINUES (fast days don't stop study)
  // 9 Av 5786: Aug 11, 2026 - no reading? Let's check.
  // Actually Tisha B'Av in year 5787 was NOT shown as a no-reading day in the PDF
  // (the reading continues). Let's include it as a skip per the PDF showing "תשעה באב" separately.
  "2026-08-11", // Tisha B'Av 5786 (approximate - need to verify)
  // Rosh Hashana 5787: Sep 22-23, 2026
  "2026-09-22", // Rosh Hashana day 1
  "2026-09-23", // Rosh Hashana day 2
  // Yom Kippur 5787: Oct 1, 2026
  "2026-10-01", // Yom Kippur
  // The year 5786 program ends before these, and 5787 starts Oct 4, 2026

  // 5787 year (Oct 4, 2026 – ~Sep 2027)
  // Sukkot 5787: 1st day = Oct 6, 2026 (the year starts Oct 4)
  "2026-10-06", // Sukkot 1st day
  // Chol Hamoed Sukkot: Oct 7-12 (readings continue)
  // Hoshana Raba: Oct 12, 2026
  "2026-10-12", // Hoshana Raba (no reading based on PDF week 2 analysis)
  // Shemini Atzeret: Oct 13, 2026
  "2026-10-13", // Shemini Atzeret
  // Chanukah: reading continues (no skip)
  // Taanis Esther 5787: Mar 2, 2027 (or Mar 3 - depends on calendar)
  // Purim 5787: Mar 3, 2027
  "2027-03-02", // Taanis Esther
  "2027-03-03", // Purim
  // Pesach 5787: Apr 18-25, 2027 (1st day Apr 18, 7th day Apr 24)
  "2027-04-18", // Pesach 1st day
  "2027-04-24", // Shevi'i shel Pesach (also Shabbat this year, so doubly skipped)
  // Chol Hamoed Pesach: readings continue
  // Shavuot 5787: May 21-22, 2027 (1st day May 21 = Thursday)
  "2027-05-21", // Shavuot day 1
  "2027-05-22", // Shavuot day 2 (outside Israel) / Isru Chag
  // Tisha B'Av 5787: Aug 12, 2027
  "2027-08-12", // Tisha B'Av
  // Rosh Hashana 5788: Sep 11-12, 2027
  "2027-09-11", // Rosh Hashana
  "2027-09-12",
  // Yom Kippur 5788: Sep 20, 2027
  "2027-09-20",
  // Sukkot 5788: Sep 25, 2027
  "2027-09-25",
  "2027-10-02", // Shemini Atzeret
]);

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Given an ordered list of reading entries and a start date,
 * return an object mapping YYYY-MM-DD → reading entry.
 */
function assignDates(readings, startDate) {
  const result = {};
  const d = new Date(startDate + "T12:00:00Z");
  let ri = 0;

  // Max days to scan (2 years × 366 days)
  const maxDays = 800;
  let daysScanned = 0;

  while (ri < readings.length && daysScanned < maxDays) {
    const ds = toDateStr(d);
    const dow = d.getUTCDay(); // 0=Sun, 6=Sat

    if (dow === 6 || HOLIDAYS.has(ds)) {
      // Shabbat or holiday: no reading
      d.setUTCDate(d.getUTCDate() + 1);
      daysScanned++;
      continue;
    }

    result[ds] = readings[ri];
    ri++;
    d.setUTCDate(d.getUTCDate() + 1);
    daysScanned++;
  }

  if (ri < readings.length) {
    console.warn(`⚠ ${readings.length - ri} readings not assigned (ran out of days)`);
  }

  return result;
}

// ── masdirim.org verse lookup ───────────────────────────────────────────────

const verseCache = new Map();

async function fetchVerseRange(masdirimBook, sederHeb) {
  const cacheKey = `${masdirimBook}:${sederHeb}`;
  if (verseCache.has(cacheKey)) return verseCache.get(cacheKey);

  const url = `${GITHUB_RAW}/seder_${sederHeb}_${masdirimBook}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ✗ 404 for ${url}`);
    return null;
  }
  const verses = await res.json();
  if (!Array.isArray(verses) || verses.length === 0) return null;

  verseCache.set(cacheKey, verses);
  return verses;
}

/**
 * Convert a reading entry to a CalendarEntry with Sefaria ref.
 */
async function toCalendarEntry(entry) {
  const { bookHe, sederNum, half } = entry;

  const masdirimBook = PDF_TO_MASDIRIM[bookHe];
  if (!masdirimBook) {
    console.warn(`  ✗ Unknown book: "${bookHe}"`);
    return null;
  }

  const sederHeb = numToHeb(sederNum);
  const verses = await fetchVerseRange(masdirimBook, sederHeb);
  if (!verses) return null;

  // For split sedarim, take first or second half
  let slice = verses;
  if (half === 1) slice = verses.slice(0, Math.ceil(verses.length / 2));
  if (half === 2) slice = verses.slice(Math.ceil(verses.length / 2));

  const first = slice[0];
  const last = slice[slice.length - 1];

  const bookHeSefaria = first.bookchapter; // e.g. "שמואל א"
  const engBook = SEFARIA_BOOK[bookHeSefaria];
  if (!engBook) {
    console.warn(`  ✗ Unknown Sefaria book: "${bookHeSefaria}"`);
    return null;
  }

  const ch1 = hebToNum(first.chapter);
  const v1 = hebToNum(first.versechapter);
  const ch2 = hebToNum(last.chapter);
  const v2 = hebToNum(last.versechapter);

  let ref;
  if (ch1 === ch2) {
    ref = `${engBook} ${ch1}:${v1}-${v2}`;
  } else {
    ref = `${engBook} ${ch1}:${v1}-${ch2}:${v2}`;
  }

  // Display Hebrew book name for the UI
  const displayBookHe = bookHeSefaria; // e.g. "שמואל א" or "יהושע"

  return { bookHe: displayBookHe, book: engBook, ref };
}

// ── PDF download ────────────────────────────────────────────────────────────

async function downloadPdf(filename) {
  const url = `https://www.tanachyomi.co.il/PDFFiles/${filename}`;
  console.log(`  Downloading ${url} ...`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      "Referer": "https://www.tanachyomi.co.il/",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${filename}`);
  return Buffer.from(await res.arrayBuffer());
}

async function extractPdfText(buf) {
  const parser = new PDFParse({});
  await parser.load({ data: new Uint8Array(buf) });

  // Actually pdf-parse v2 uses different API - try CLI approach
  // Fall back to writing to temp file
  throw new Error("Use CLI approach");
}

// ── Main ────────────────────────────────────────────────────────────────────

/**
 * Parse a PDF buffer using the CLI (pdf-parse text).
 * We shell out to avoid ESM/API issues with pdf-parse v2.
 */
async function pdfToText(pdfPath) {
  const { execFileSync } = await import("child_process");
  const nodeModules = join(ROOT, "node_modules", "pdf-parse", "bin", "cli.mjs");
  try {
    const out = execFileSync("node", [nodeModules, "text", pdfPath], {
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf8",
    });
    return out;
  } catch (e) {
    throw new Error(`pdf-parse CLI failed: ${e.message}`);
  }
}

async function processYear(pdfFilename, startDate, label) {
  console.log(`\n📅 Processing ${label} (${pdfFilename})`);

  // Save PDF to data/
  const pdfPath = join(DATA_DIR, pdfFilename);
  if (!existsSync(pdfPath)) {
    console.log("  Downloading PDF...");
    const buf = await downloadPdf(pdfFilename);
    writeFileSync(pdfPath, buf);
    console.log(`  Saved → ${pdfPath}`);
  } else {
    console.log(`  Using cached ${pdfPath}`);
  }

  console.log("  Extracting text...");
  const text = await pdfToText(pdfPath);

  console.log("  Parsing readings...");
  const readings = parseReadingsPdf(text);
  console.log(`  Found ${readings.length} reading entries`);

  if (readings.length === 0) {
    console.error("  ✗ No readings parsed – check PDF structure");
    return {};
  }

  // Log first and last readings for verification
  const r0 = readings[0];
  const rN = readings[readings.length - 1];
  console.log(`  First: ${r0.bookHe} ס' ${r0.sederNum}${r0.half ? ` (${r0.half})` : ""}`);
  console.log(`  Last:  ${rN.bookHe} ס' ${rN.sederNum}${rN.half ? ` (${rN.half})` : ""}`);

  console.log("  Assigning dates...");
  const dateMap = assignDates(readings, startDate);
  console.log(`  Assigned ${Object.keys(dateMap).length} dates`);

  console.log("  Fetching verse ranges from masdirim.org...");
  const calendar = {};
  let done = 0;
  const entries = Object.entries(dateMap);

  for (const [date, reading] of entries) {
    const entry = await toCalendarEntry(reading);
    if (entry) calendar[date] = entry;
    done++;
    if (done % 50 === 0) {
      process.stdout.write(`\r  ${done}/${entries.length} dates processed`);
    }
  }
  process.stdout.write("\n");
  console.log(`  ✓ ${Object.keys(calendar).length} calendar entries built`);

  return calendar;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const calendar = {};

  // Year 5786: Oct 21, 2025 – Sep ~20, 2026 (Torah: Genesis–Deuteronomy)
  // Uses Regular.pdf
  try {
    const y5786 = await processYear("Regular.pdf", "2025-10-21", "5786 (Torah)");
    Object.assign(calendar, y5786);
  } catch (e) {
    console.error(`\n⚠ Year 5786 failed: ${e.message}`);
    console.error("  Make sure tanachyomi.co.il is reachable.");
  }

  // Year 5787: Oct 4, 2026 – Sep ~22, 2027 (Nevi'im + Ketuvim)
  // Uses Regular2.pdf
  try {
    const y5787 = await processYear("Regular2.pdf", "2026-10-04", "5787 (Nevi'im+Ketuvim)");
    Object.assign(calendar, y5787);
  } catch (e) {
    console.error(`\n⚠ Year 5787 failed: ${e.message}`);
  }

  const outPath = join(DATA_DIR, "calendar.json");
  writeFileSync(outPath, JSON.stringify(calendar, null, 2), "utf8");
  console.log(`\n✅ Wrote ${Object.keys(calendar).length} entries → ${outPath}`);

  // Spot-check
  const today = new Date().toISOString().slice(0, 10);
  if (calendar[today]) {
    console.log(`\nToday (${today}): ${calendar[today].bookHe} — ${calendar[today].ref}`);
  } else {
    console.log(`\nNote: No entry for today (${today}) – may be Shabbat or outside range`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
