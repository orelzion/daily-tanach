import { NextRequest, NextResponse } from "next/server";
import type { ReadingResponse, Verse } from "@/app/lib/types";
import { getReadingForDate } from "@/app/lib/calendar";

const SEFARIA = "https://www.sefaria.org/api";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

// Sefaria returns string (single verse), string[] (single chapter), or
// string[][] (multi-chapter range). Flatten to per-verse entries with chapter.
type NestedHe = string | string[] | string[][];

function flattenHe(
  he: NestedHe,
  sections: number[],
): { chapter: number; num: number; text: string }[] {
  const startChapter = sections[0] ?? 1;
  const startVerse   = sections[1] ?? 1;

  if (!Array.isArray(he)) {
    return [{ chapter: startChapter, num: startVerse, text: stripTags(he ?? "") }];
  }

  if (!Array.isArray(he[0])) {
    // Single chapter: string[]
    return (he as string[]).map((t, i) => ({
      chapter: startChapter,
      num: startVerse + i,
      text: stripTags(t ?? ""),
    }));
  }

  // Multi-chapter: string[][]
  const result: { chapter: number; num: number; text: string }[] = [];
  (he as string[][]).forEach((chVerses, chIdx) => {
    const chapter    = startChapter + chIdx;
    const verseStart = chIdx === 0 ? startVerse : 1;
    chVerses.forEach((t, vIdx) => {
      result.push({ chapter, num: verseStart + vIdx, text: stripTags(t ?? "") });
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

    const { ref, book, bookHe } = entry;
    const [textData, steinsaltzData] = await Promise.all([
      fetchText(ref),
      fetchSteinsaltz(ref, book),
    ]);

    if (!textData) {
      return NextResponse.json({ error: "שגיאה בקבלת הטקסט מ-Sefaria", ref }, { status: 502 });
    }

    const flat = flattenHe(textData.he, textData.sections);
    const steinsaltzFlat = steinsaltzData
      ? flattenHe(steinsaltzData, textData.sections)
      : [];

    const startChapter = textData.sections?.[0] ?? 1;
    const endChapter   = textData.toSections?.[0] ?? startChapter;

    const verses: Verse[] = flat.map((v, i) => ({
      chapter: v.chapter,
      num: v.num,
      text: v.text,
      steinsaltz: steinsaltzFlat[i]?.text ?? null,
    }));

    const body: ReadingResponse = {
      date,
      bookHe,
      book,
      chapter: startChapter,
      ...(endChapter !== startChapter && { chapterEnd: endChapter }),
      verses,
    };

    return NextResponse.json(body, {
      headers: { "Cache-Control": "s-maxage=604800, stale-while-revalidate=2592000" },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
