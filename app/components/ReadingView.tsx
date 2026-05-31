"use client";

import { useEffect, useState, useCallback } from "react";
import type { ReadingResponse } from "@/app/lib/types";
import { getCachedReading, setCachedReading } from "@/app/lib/db";

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isSaturday(iso: string): boolean {
  return new Date(iso + "T12:00:00").getDay() === 6;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toIso(d);
}

function formatDateHe(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Status = "loading" | "ok" | "error" | "offline";

export default function ReadingView() {
  const [date, setDate] = useState(() => toIso(new Date()));
  const [reading, setReading] = useState<ReadingResponse | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async (iso: string) => {
    setStatus("loading");
    setReading(null);

    // Serve from cache immediately if available
    const cached = await getCachedReading(iso);
    if (cached) {
      setReading(cached);
      setStatus("ok");
      // Background revalidate if online
      if (navigator.onLine) revalidate(iso, true);
      return;
    }

    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }

    await revalidate(iso, false);
  }, []);

  const revalidate = async (iso: string, background: boolean) => {
    try {
      const res = await fetch(`/api/reading?date=${iso}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (!background) {
          setErrorMsg(body.error ?? `שגיאה ${res.status}`);
          setStatus("error");
        }
        return;
      }
      const data: ReadingResponse = await res.json();
      await setCachedReading(data);
      setReading(data);
      setStatus("ok");
    } catch {
      if (!background) {
        setStatus(navigator.onLine ? "error" : "offline");
      }
    }
  };

  useEffect(() => { load(date); }, [date, load]);

  const prev = () => {
    let d = addDays(date, -1);
    setDate(d);
  };
  const next = () => {
    let d = addDays(date, 1);
    setDate(d);
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-gray-100 dark:border-zinc-800">
        <button
          onClick={next}
          aria-label="יום הבא"
          className="w-10 h-10 flex items-center justify-center rounded-full text-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          ←
        </button>

        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 text-center">
          {formatDateHe(date)}
        </span>

        <button
          onClick={prev}
          aria-label="יום קודם"
          className="w-10 h-10 flex items-center justify-center rounded-full text-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          →
        </button>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        {isSaturday(date) && <ShabbatState onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} />}
        {!isSaturday(date) && status === "loading" && <LoadingState />}
        {!isSaturday(date) && status === "offline" && <OfflineState onRetry={() => load(date)} />}
        {!isSaturday(date) && status === "error" && <ErrorState msg={errorMsg} onRetry={() => load(date)} />}
        {!isSaturday(date) && status === "ok" && reading && <Reading data={reading} />}
      </main>
    </div>
  );
}

function Reading({ data }: { data: ReadingResponse }) {
  const heading = data.multiBook
    ? data.bookHe
    : data.chapterEnd
      ? `${data.bookHe} פרקים ${data.chapter}–${data.chapterEnd}`
      : `${data.bookHe} פרק ${data.chapter}`;

  return (
    <article>
      <h1 className="text-2xl font-bold mb-6 text-center tracking-wide">{heading}</h1>
      <div className="space-y-5">
        {data.verses.map((v, i) => {
          const prev = i > 0 ? data.verses[i - 1] : null;
          const showBookHeader = !!v.bookHe;
          const showChapterHeader = !showBookHeader && data.chapterEnd && prev && v.chapter !== prev.chapter;
          return (
            <div key={`${v.bookHe ?? ""}${v.chapter}:${v.num}`}>
              {showBookHeader && (
                <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-500 mt-8 mb-3 text-center">
                  {v.bookHe}
                </h2>
              )}
              {showChapterHeader && (
                <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-500 mt-8 mb-3 text-center">
                  פרק {hebrewNumeral(v.chapter)}
                </h2>
              )}
              <p className="text-lg leading-8">
                <span className="font-bold text-amber-700 dark:text-amber-500 ml-1">
                  {hebrewNumeral(v.num)}
                </span>
                {v.text}
              </p>
              {v.steinsaltz && (
                <p className="mt-1 pr-3 text-base leading-7 text-gray-600 dark:text-gray-400 border-r-2 border-amber-300 dark:border-amber-700">
                  {v.steinsaltz}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

// Hebrew numerals for verse numbers (simple, up to 999)
function hebrewNumeral(n: number): string {
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const hundreds = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
  if (n === 15) return "ט״ו";
  if (n === 16) return "ט״ז";
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  const s = (hundreds[h] || "") + (tens[t] || "") + (ones[o] || "");
  if (s.length === 1) return s + "׳";
  return s.slice(0, -1) + "״" + s.slice(-1);
}

function ShabbatState({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <p className="text-2xl font-semibold">שבת שלום</p>
      <p className="text-gray-500 dark:text-gray-400">אין לימוד תנ״ך יומי בשבת</p>
      <div className="flex gap-4 mt-2">
        <button onClick={onPrev} className="px-5 py-2 rounded-full border border-gray-200 dark:border-zinc-700 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
          ← לימוד יום ו׳
        </button>
        <button onClick={onNext} className="px-5 py-2 rounded-full border border-gray-200 dark:border-zinc-700 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
          לימוד יום א׳ →
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5 animate-pulse">
      {[120, 80, 100, 60, 110].map((w, i) => (
        <div key={i} className="space-y-2">
          <div className="h-5 bg-gray-200 dark:bg-zinc-800 rounded" style={{ width: `${w}%`.replace("120%", "100%") }} />
          <div className="h-4 bg-gray-100 dark:bg-zinc-900 rounded w-4/5" />
        </div>
      ))}
    </div>
  );
}

function OfflineState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-xl font-medium">אין חיבור לאינטרנט</p>
      <p className="text-gray-500 dark:text-gray-400 text-sm">הקריאה לתאריך זה אינה שמורה במכשיר</p>
      <button
        onClick={onRetry}
        className="mt-2 px-6 py-2 rounded-full bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
      >
        נסה שוב
      </button>
    </div>
  );
}

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-xl font-medium">שגיאה בטעינת הקריאה</p>
      {msg && <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">{msg}</p>}
      <button
        onClick={onRetry}
        className="mt-2 px-6 py-2 rounded-full bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
      >
        נסה שוב
      </button>
    </div>
  );
}
