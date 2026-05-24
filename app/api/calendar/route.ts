import { NextRequest, NextResponse } from "next/server";
import { getCalendar, fetchRawCalendarHtml } from "@/app/lib/calendar";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("debug") === "1") {
    try {
      const html = await fetchRawCalendarHtml();
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  try {
    const data = await getCalendar();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=43200, stale-while-revalidate=86400",
        "X-Entry-Count": String(Object.keys(data).length),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
