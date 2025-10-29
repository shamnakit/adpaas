// src/lib/format.ts
export const fmtMoney = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPercent = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";

export const fmtDateTimeICT = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(dt);
};

const DOW = ["อา","จ","อ","พ","พฤ","ศ","ส"]; // 0..6

export function minutesToHHMM(m: number) {
  const h = Math.floor(m / 60).toString().padStart(2,"0");
  const mm = (m % 60).toString().padStart(2,"0");
  return `${h}:${mm}`;
}

export type ScheduleRow = { day_of_week: number; start_minute: number; end_minute: number; };

export function groupSchedule(rows: ScheduleRow[]) {
  // คืน string แบบ "จ–ศ 08:00–16:00, ส–อา 11:00–17:00"
  if (!rows?.length) return "—";
  // จัดกลุ่มตามช่วงเวลาเดียวกัน
  const key = (r: ScheduleRow) => `${minutesToHHMM(r.start_minute)}-${minutesToHHMM(r.end_minute)}`;
  const map = new Map<string, number[]>();
  rows.forEach(r=>{
    const k = key(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r.day_of_week);
  });
  const ranges: string[] = [];
  for (const [k, days] of map) {
    days.sort((a,b)=>a-b);
    // รวมเป็นช่วงต่อเนื่อง
    let s = days[0], prev = days[0];
    const parts: string[] = [];
    for (let i=1;i<days.length;i++){
      if (days[i] === prev+1) { prev = days[i]; continue; }
      parts.push(s===prev ? DOW[s] : `${DOW[s]}–${DOW[prev]}`);
      s = prev = days[i];
    }
    parts.push(s===prev ? DOW[s] : `${DOW[s]}–${DOW[prev]}`);
    ranges.push(`${parts.join(", ")} ${k.replace("-", "–")}`);
  }
  return ranges.join(", ");
}
