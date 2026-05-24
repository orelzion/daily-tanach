import { NextRequest, NextResponse } from "next/server";
import type { ReadingResponse, Verse } from "@/app/lib/types";
import { getCalendar } from "@/app/lib/calendar";

const SEFARIA = "https://www.sefaria.org/api";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

type SefariaText = {
  he: string | string[];
  heTitle: string;
  book: string;
  sections: number[];
  toSections: number[];
};

async function fetchText(ref: string): Promise<SefariaText | null> {
  const url = `${SEFARIA}/texts/${encodeURIComponent(ref)}?lang=he&context=0&pad=0`;
  const res = await fetch(url, { next: { revalidate: 604800 } });
  if (!res.ok) return null;
  return res.json();
}

async function fetchSteinsaltz(ref: string, book: string): Promise<(string | null)[]> {
  for (const candidate of [`Steinsaltz on ${ref}`, `Steinsaltz on ${book}`]) {
    const url = `${SEFARIA}/texts/${encodeURIComponent(candidate)}?lang=he&context=0&pad=0`;
    const res = await fetch(url, { next: { revalidate: 604800 } });
    if (!res.ok) continue;
    const data = await res.json() as SefariaText;
    const arr = Array.isArray(data.he) ? data.he : [data.he];
    if (arr.some(Boolean)) return arr.map((t) => (t ? stripTags(t) : null));
  }
  return [];
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "חסר פרמטר date (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const calendar = await getCalendar();
    const entry = calendar[date];
    if (!entry) {
      return NextResponse.json({ error: "לא נמצאה קריאה לתאריך זה", date }, { status: 404 });
    }

    const { ref, book, bookHe } = entry;
    const [textData, steinsaltzArr] = await Promise.all([
      fetchText(ref),
      fetchSteinsaltz(ref, book),
    ]);

    if (!textData) {
      return NextResponse.json({ error: "שגיאה בקבלת הטקסט מ-Sefaria", ref }, { status: 502 });
    }

    const heVerses = Array.isArray(textData.he) ? textData.he : [textData.he];
    const startVerse = textData.sections?.[1] ?? 1;
    const chapter = textData.sections?.[0] ?? 1;
    const chapterEnd =
      textData.toSections?.[0] !== chapter ? textData.toSections?.[0] : undefined;

    const verses: Verse[] = heVerses.map((text, i) => ({
      num: startVerse + i,
      text: stripTags(text ?? ""),
      steinsaltz: steinsaltzArr[i] ?? null,
    }));

    const body: ReadingResponse = {
      date,
      bookHe,
      book,
      chapter,
      ...(chapterEnd && { chapterEnd }),
      verses,
    };

    return NextResponse.json(body, {
      headers: { "Cache-Control": "s-maxage=604800, stale-while-revalidate=2592000" },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
