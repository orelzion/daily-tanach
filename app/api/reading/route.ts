import { NextRequest, NextResponse } from "next/server";
import type { ReadingResponse, Verse } from "@/app/lib/types";
import { getReadingForDate } from "@/app/lib/calendar";

const SEFARIA = "https://www.sefaria.org/api";

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\{[פסרנ]\}/g, "");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).trim();
}

// Like stripTags but keeps <b>…</b> for bold rendering in the UI.
function processCommentary(s: string): string {
  const safe = s
    .replace(/<b>/gi, "\x00B")
    .replace(/<\/b>/gi, "\x00/B")
    .replace(/<[^>]+>/g, "")
    .replace(/\x00B/g, "<b>")
    .replace(/\x00\/B/g, "</b>");
  return decodeEntities(safe).trim();
}

// Sefaria returns string (single verse), string[] (single chapter), or
// string[][] (multi-chapter range). Flatten to per-verse entries with chapter.
type NestedHe = string | string[] | string[][];

function flattenHe(
  he: NestedHe,
  sections: number[],
  process: (s: string) => string = stripTags,
): { chapter: number; num: number; text: string }[] {
  const startChapter = sections[0] ?? 1;
  const startVerse   = sections[1] ?? 1;

  if (!Array.isArray(he)) {
    return [{ chapter: startChapter, num: startVerse, text: process(he ?? "") }];
  }

  if (!Array.isArray(he[0])) {
    return (he as string[]).map((t, i) => ({
      chapter: startChapter,
      num: startVerse + i,
      text: process(t ?? ""),
    }));
  }

  const result: { chapter: number; num: number; text: string }[] = [];
  (he as string[][]).forEach((chVerses, chIdx) => {
    const chapter    = startChapter + chIdx;
    const verseStart = chIdx === 0 ? startVerse : 1;
    chVerses.forEach((t, vIdx) => {
      result.push({ chapter, num: verseStart + vIdx, text: process(t ?? "") });
    });
  });
  return result;
}

type SefariaText = {
  he: NestedHe;
  sections: number[];
  toSections: number[];
};

async function fetchText(ref: string): Promise<SefariaText | null> {
  const url = `${SEFARIA}/texts/${encodeURIComponent(ref)}?lang=he&context=0&pad=0`;
  const res = await fetch(url, { next: { revalidate: 604800 } });
  if (!res.ok) return null;
  return res.json();
}

async function fetchSteinsaltz(ref: string, book: string): Promise<NestedHe | null> {
  for (const candidate of [`Steinsaltz on ${ref}`, `Steinsaltz on ${book}`]) {
    const url = `${SEFARIA}/texts/${encodeURIComponent(candidate)}?lang=he&context=0&pad=0`;
    const res = await fetch(url, { next: { revalidate: 604800 } });
    if (!res.ok) continue;
    const data = await res.json() as SefariaText;
    const flat = flattenHe(data.he, data.sections);
    if (flat.some((v) => v.text)) return flat.map((v) => v.text) as unknown as NestedHe;
  }
  return null;
}

const SEFARIA_TO_HEB: Record<string, string> = {
  "I Samuel": "שמואל א", "II Samuel": "שמואל ב",
  "I Kings": "מלכים א", "II Kings": "מלכים ב",
  "I Chronicles": "דברי הימים א", "II Chronicles": "דברי הימים ב",
  Ezra: "עזרא", Nehemiah: "נחמיה", Joshua: "יהושע", Judges: "שופטים",
  Isaiah: "ישעיהו", Jeremiah: "ירמיהו", Ezekiel: "יחזקאל",
  Hosea: "הושע", Joel: "יואל", Amos: "עמוס", Obadiah: "עובדיה",
  Jonah: "יונה", Micah: "מיכה", Nahum: "נחום", Habakkuk: "חבקוק",
  Zephaniah: "צפניה", Haggai: "חגי", Zechariah: "זכריה", Malachi: "מלאכי",
  Psalms: "תהלים", Proverbs: "משלי", Job: "איוב",
  "Song of Songs": "שיר השירים", Ruth: "רות", Lamentations: "איכה",
  Ecclesiastes: "קהלת", Esther: "אסתר", Daniel: "דניאל",
};

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "חסר פרמטר date (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const entry = await getReadingForDate(date);
    if (!entry) {
      return NextResponse.json({ error: "לא נמצאה קריאה לתאריך זה", date }, { status: 404 });
    }

    const { refs, book, bookHe } = entry;
    const multiBook = refs.length > 1;

    // Fetch all refs in parallel (text + Steinsaltz per ref).
    const fetched = await Promise.all(
      refs.map(async (ref, idx) => {
        const refBook = ref.split(" ")[0];
        const [textData, steinsaltzData] = await Promise.all([
          fetchText(ref),
          fetchSteinsaltz(ref, refBook),
        ]);
        return { ref, refBook, textData, steinsaltzData, isFirst: idx === 0 };
      }),
    );

    const firstFailed = fetched.find((f) => !f.textData);
    if (firstFailed) {
      return NextResponse.json(
        { error: "שגיאה בקבלת הטקסט מ-Sefaria", ref: firstFailed.ref },
        { status: 502 },
      );
    }

    let startChapter = 1;
    let endChapter   = 1;
    const verses: Verse[] = [];

    for (const { textData, steinsaltzData, refBook, isFirst } of fetched) {
      const flat = flattenHe(textData!.he, textData!.sections);
      const steinsaltzFlat = steinsaltzData
        ? flattenHe(steinsaltzData, textData!.sections, processCommentary)
        : [];

      if (isFirst) startChapter = textData!.sections?.[0] ?? 1;
      endChapter = textData!.toSections?.[0] ?? (textData!.sections?.[0] ?? 1);

      const segBookHe = multiBook ? (SEFARIA_TO_HEB[refBook] ?? refBook) : undefined;

      flat.forEach((v, i) => {
        verses.push({
          chapter: v.chapter,
          num: v.num,
          text: v.text,
          steinsaltz: steinsaltzFlat[i]?.text ?? null,
          ...(segBookHe && i === 0 && { bookHe: segBookHe }),
        });
      });
    }

    const body: ReadingResponse = {
      date,
      bookHe,
      book,
      chapter: startChapter,
      ...(!multiBook && endChapter !== startChapter && { chapterEnd: endChapter }),
      ...(multiBook && { multiBook: true }),
      verses,
    };

    return NextResponse.json(body, {
      headers: { "Cache-Control": "s-maxage=604800, stale-while-revalidate=2592000" },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
