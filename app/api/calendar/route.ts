import { NextResponse } from "next/server";
import { getCalendar } from "@/app/lib/calendar";

export async function GET() {
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
