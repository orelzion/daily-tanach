export type CalendarEntry = {
  bookHe: string;
  book: string;      // Sefaria English name
  ref: string;       // e.g. "Joshua.10.1-15"
};

export type CalendarData = Record<string, CalendarEntry>; // keyed YYYY-MM-DD

export type Verse = {
  num: number;
  text: string;
  steinsaltz: string | null;
};

export type ReadingResponse = {
  date: string;
  bookHe: string;
  book: string;
  chapter: number;
  chapterEnd?: number;
  verses: Verse[];
};
