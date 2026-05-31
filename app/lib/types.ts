export type CalendarEntry = {
  bookHe: string;
  book: string;      // Sefaria English name of the first (or only) book
  refs: string[];    // Sefaria refs, one per book (cross-book sedarim have >1)
};

export type CalendarData = Record<string, CalendarEntry>; // keyed YYYY-MM-DD

export type Verse = {
  chapter: number;
  num: number;
  text: string;
  steinsaltz: string | null;
  bookHe?: string;   // set when this verse starts a new book within a cross-book seder
};

export type ReadingResponse = {
  date: string;
  bookHe: string;
  book: string;
  chapter: number;
  chapterEnd?: number;
  multiBook?: boolean;  // true when the seder spans multiple Sefaria books
  verses: Verse[];
};
