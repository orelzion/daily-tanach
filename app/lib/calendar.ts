import type { CalendarData } from "./types";

// Populated by running: node scripts/build-calendar.mjs
// eslint-disable-next-line @typescript-eslint/no-require-imports
const calendarData: CalendarData = require("@/data/calendar.json");

export async function getCalendar(): Promise<CalendarData> {
  return calendarData;
}
