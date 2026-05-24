import { NextResponse } from "next/server";

// Scrapes the Tanach Yomi calendar from tanachyomi.co.il and returns
// a map of ISO date → { book, startRef, endRef } for the current cycle.
// TODO: implement scraper once we can inspect the live page HTML.
export async function GET() {
  return NextResponse.json(
    { error: "לא מומש עדיין" },
    { status: 501 }
  );
}
