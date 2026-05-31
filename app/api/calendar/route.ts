import { NextRequest, NextResponse } from "next/server";
import { getReadingForDate } from "@/app/lib/calendar";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "חסר פרמטר date (YYYY-MM-DD)" }, { status: 400 });
  }
  try {
    const entry = await getReadingForDate(date);
    if (!entry) {
      return NextResponse.json({ error: "אין קריאה לתאריך זה", date }, { status: 404 });
    }
    return NextResponse.json(entry);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
