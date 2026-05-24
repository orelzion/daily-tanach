import { NextRequest, NextResponse } from "next/server";
import { getCalendar, fetchRawCalendarHtml } from "@/app/lib/calendar";
import * as cheerio from "cheerio";

export async function GET(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get("debug");

  // ?debug=1 → raw HTML
  if (debug === "1") {
    try {
      const html = await fetchRawCalendarHtml();
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ?debug=links → all hrefs + link text found on the page
  if (debug === "links") {
    try {
      const html = await fetchRawCalendarHtml();
      const $ = cheerio.load(html);
      const links: { text: string; href: string }[] = [];
      $("a[href]").each((_, el) => {
        links.push({
          text: $(el).text().trim(),
          href: $(el).attr("href") ?? "",
        });
      });
      return NextResponse.json(links);
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
