import * as cheerio from "cheerio";
import { BOOK_MAP, normalizeHebrew } from "./books";
import type { CalendarData, CalendarEntry } from "./types";

export const CALENDAR_URL =
  "https://www.tanachyomi.co.il/%D7%9C%D7%95%D7%97_%D7%9C%D7%99%D7%9E%D7%95%D7%93_%D7%A9%D7%A0%D7%AA%D7%99";

function parseDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseRef(book: string, raw: string): string | null {
  const clean = raw
    .replace(/פרק|פרקים|פסוק|פסוקים/g, "")
    .replace(/[^\d:\-,–]/g, " ")
    .trim();

  const rangeMatch = clean.match(/(\d+)\s*:\s*(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    const [, ch, v1, v2] = rangeMatch;
    return `${book} ${ch}:${v1}-${v2}`;
  }
  const singleMatch = clean.match(/(\d+)\s*:\s*(\d+)/);
  if (singleMatch) {
    const [, ch, v] = singleMatch;
    return `${book} ${ch}:${v}`;
  }
  const chapRange = clean.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (chapRange) {
    const [, c1, c2] = chapRange;
    return `${book}.${c1}-${c2}`;
  }
  const chapOnly = clean.match(/(\d+)/);
  if (chapOnly) {
    return `${book} ${chapOnly[1]}`;
  }
  return null;
}

export function parseCalendarHtml(html: string): CalendarData {
  const $ = cheerio.load(html);
  const data: CalendarData = {};

  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((_, td) => $(td).text().trim())
      .get();
    if (cells.length < 2) return;

    let date: string | null = null;
    let bookHe: string | null = null;
    let refRaw: string | null = null;

    for (const cell of cells) {
      if (!date) date = parseDate(cell);
    }

    for (const cell of cells) {
      const norm = normalizeHebrew(cell);
      const match = Object.keys(BOOK_MAP).find(
        (k) => norm === k || norm.startsWith(k) || k.startsWith(norm)
      );
      if (match) {
        bookHe = match;
        break;
      }
    }

    for (const cell of cells) {
      if (cell !== bookHe && /\d/.test(cell)) {
        refRaw = cell;
        break;
      }
    }

    if (!date || !bookHe) return;
    const englishBook = BOOK_MAP[bookHe];
    if (!englishBook) return;
    const ref = refRaw ? parseRef(englishBook, refRaw) : null;
    if (!ref) return;

    const entry: CalendarEntry = { bookHe, book: englishBook, ref };
    data[date] = entry;
  });

  return data;
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
};

let memCache: { data: CalendarData; at: number } | null = null;
const CACHE_TTL = 12 * 60 * 60 * 1000;

export async function getCalendar(): Promise<CalendarData> {
  if (memCache && Date.now() - memCache.at < CACHE_TTL) return memCache.data;
  const res = await fetch(CALENDAR_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`);
  const html = await res.text();
  const data = parseCalendarHtml(html);
  memCache = { data, at: Date.now() };
  return data;
}

export async function fetchRawCalendarHtml(): Promise<string> {
  const res = await fetch(CALENDAR_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}
