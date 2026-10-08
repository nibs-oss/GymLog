import { addDaysIso, weekStartIso } from "./fitness.ts";

/**
 * iCalendar feed of the weekly plan for calendar apps (Apple Calendar,
 * Google Calendar "From URL", Outlook). Each training weekday becomes a
 * repeating all-day event with an alert at 8:05 PM the evening before.
 */
export interface PlannedDay {
  weekday: number; // 0 = Sunday … 6 = Saturday
  routineName: string;
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
/** All-day events start at midnight, so 3h55m before = 8:05 PM the day before */
const REMINDER = "-PT3H55M";

/** Escape text per RFC 5545 */
function text(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets continue on the next line, indented by a space */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function planCalendar(days: PlannedDay[], opts: { token: string; today: string; now: Date }): string {
  const stamp = opts.now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const monday = weekStartIso(opts.today);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GymLog//Weekly plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:GymLog plan",
    "X-WR-CALDESC:Your weekly training plan from GymLog",
    // Ask calendar apps to check for plan changes about every hour
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const d of [...days].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7))) {
    // First occurrence: that weekday in the current Monday–Sunday week
    const start = addDaysIso(monday, (d.weekday + 6) % 7).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${opts.token}-${BYDAY[d.weekday]}@gymlog`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[d.weekday]}`,
      `SUMMARY:${text(d.routineName)}`,
      "DESCRIPTION:Planned in GymLog",
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${text(`Tomorrow: ${d.routineName}`)}`,
      `TRIGGER:${REMINDER}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
