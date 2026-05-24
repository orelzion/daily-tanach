import { NextRequest, NextResponse } from "next/server";

// Fetches the Hebrew text and Steinsaltz commentary from Sefaria for a given date.
// Query param: ?date=YYYY-MM-DD
// TODO: wire up once /api/calendar is returning real data.
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "חסר פרמטר date" }, { status: 400 });
  }

  return NextResponse.json(
    { error: "לא מומש עדיין", date },
    { status: 501 }
  );
}
