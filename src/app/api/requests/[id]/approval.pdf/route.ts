// src/app/api/requests/[id]/approval.pdf/route.ts
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import fs from "node:fs";
import path from "node:path";

type PdfDoc = InstanceType<typeof PDFDocument>;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_TAG = "approval.pdf@NO-JUMP";

/* =============== Utils =============== */
const fmtMoney = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDateTimeICT = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(dt);
};

type SchRow = { day_of_week: number; start_minute: number; end_minute: number; };
const DOW = ["อา","จ","อ","พ","พฤ","ศ","ส"] as const;
const minutesToHHMM = (m: number) => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
function groupSchedule(rows: SchRow[]) {
  if (!rows?.length) return "—";
  const key = (r: SchRow) => `${minutesToHHMM(r.start_minute)}-${minutesToHHMM(r.end_minute)}`;
  const map = new Map<string, number[]>();
  rows.forEach(r => {
    const k = key(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r.day_of_week);
  });
  const ranges: string[] = [];
  for (const [k, days] of map) {
    days.sort((a,b)=>a-b);
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

/* =============== Types =============== */
type ReqRow = {
  id: string;
  org_id: string;
  status: "draft" | "submitted" | "needs_changes" | "approved" | "rejected";
  funnel_stage: string | null;
  objective: string | null;
  platform: string | null;
  campaign_name: string | null;
  budget_daily: number | null;
  final_url: string | null;
  languages: string[] | null;
  locations: string[] | null;
  created_at: string;
  submitted_at: string | null;
};
type KpiRow = {
  idx: number;
  type: string;
  operator: ">=" | "<=" | "=";
  target: number;
  unit: "COUNT"|"PERCENT"|"BAHT"|"PER_DAY"|"PER_7D"|"PER_30D";
  label: string | null;
  method: string | null;
};

/* =============== Auth helpers =============== */
function getAuthHeaderOrCookie(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (header) return header;
  const cookieToken = req.cookies.get("sb-access-token")?.value || cookies().get("sb-access-token")?.value;
  return cookieToken ? `Bearer ${cookieToken}` : null;
}
function createSbFromReq(req: NextRequest, authHeader: string | null) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value || cookies().get(name)?.value; },
        set() {}, remove() {},
      },
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    } as any
  );
}

/* =============== Fonts =============== */
function fontPath(file: string) { return path.join(process.cwd(), "public", "fonts", file); }
function useEmbeddedThaiFonts(doc: PdfDoc) {
  try {
    const regData = fs.readFileSync(fontPath("Sarabun-Regular.ttf"));
    const boldData = fs.readFileSync(fontPath("Sarabun-Bold.ttf"));
    doc.registerFont("TH_REG", regData);
    doc.registerFont("TH_BOLD", boldData);
    doc.font("TH_REG");
  } catch (e) {
    console.error("Failed to load custom fonts, fallback to Courier:", e);
    doc.font("Courier");
  }
}

/* =============== Handler =============== */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);

  // debug: ยืนยันว่าเรียกไฟล์นี้
  if (url.searchParams.get("debug") === "id") {
    return new Response(JSON.stringify({
      route: "approval.pdf",
      tag: ROUTE_TAG,
      now: new Date().toISOString(),
    }, null, 2), { status: 200, headers: { "Content-Type": "application/json" }});
  }

  try {
    const authHeader = getAuthHeaderOrCookie(req);
    const supabase = createSbFromReq(req, authHeader);

    // auth
    if (authHeader?.startsWith("Bearer ")) {
      const jwt = authHeader.slice("Bearer ".length);
      const { data, error } = await supabase.auth.getUser(jwt);
      if (error || !data?.user) return new Response("Unauthorized", { status: 401 });
    } else {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) return new Response("Unauthorized", { status: 401 });
    }

    // org context (RLS)
    const { error: joinErr } = await supabase.rpc("join_default_org");
    if (joinErr) console.warn("join_default_org error:", joinErr);

    // head
    const { data: reqRow, error: reqErr } = await supabase
      .from("ad_requests")
      .select("id,org_id,status,funnel_stage,objective,platform,campaign_name,budget_daily,final_url,languages,locations,created_at,submitted_at")
      .eq("id", params.id)
      .single();
    if (reqErr || !reqRow) return new Response("Not Found", { status: 404 });

    // kpis/schedules/events
    const [{ data: kpis }, { data: schs }, { data: evs }] = await Promise.all([
      supabase.from("ad_request_kpis")
        .select("idx,type,operator,target,unit,label,method")
        .eq("request_id", params.id)
        .order("idx", { ascending: true }),
      supabase.from("ad_request_schedules")
        .select("day_of_week,start_minute,end_minute")
        .eq("request_id", params.id)
        .order("day_of_week", { ascending: true }),
      supabase.from("ad_request_events")
        .select("event_type,actor,created_at")
        .eq("request_id", params.id)
        .order("created_at", { ascending: true }),
    ]);

    // outside approve?
    let outsideApproved: null | { by: string | null; at: string | null } = null;
    if (evs?.length) {
      const stack: string[] = [];
      for (const e of evs) {
        if (e.event_type === "approve_outside_pdf") stack.push(e.created_at);
        if (e.event_type === "revoke_approve_outside_pdf") stack.pop();
      }
      if (stack.length) {
        const last = [...evs].reverse().find(e => e.event_type === "approve_outside_pdf");
        if (last) outsideApproved = { by: last.actor ?? null, at: last.created_at ?? null };
      }
    }
    const isApproved = reqRow.status === "approved";
    const approvedContext = isApproved
      ? { by: null as string | null, at: outsideApproved?.at ?? null }
      : outsideApproved;

    /* ===== PDF stream ===== */
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    useEmbeddedThaiFonts(doc);

    const nodeStream = doc as unknown as NodeJS.ReadableStream;
    const body = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() { try { doc.end(); } catch {} },
    });

    // Header (เปลี่ยนหัวเมื่ออนุมัติ)
    const title = approvedContext
      ? "อนุมัติแล้ว — Campaign Approval Form"
      : "ADPAAS — Campaign Approval Form";

    doc.font("TH_BOLD")
       .fontSize(16)
       .fillColor(approvedContext ? "#ef4444" : "#000")
       .text(title);

    doc.fillColor("#000").font("TH_REG").fontSize(10)
       .text(`Printed: ${fmtDateTimeICT(new Date())}`);

    doc.moveDown(0.4);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();

    // APPROVED watermark (เล็กลง + สีแดง + ไม่ตัดบรรทัด + ไม่กิน cursor)
    if (approvedContext) {
      const cx = doc.page.width / 2;
      const cy = doc.page.height / 2;

      const yKeep = doc.y; // เก็บตำแหน่ง cursor เดิม

      doc.save();
      doc.rotate(-20, { origin: [cx, cy] });
      doc.font("TH_BOLD").fontSize(36).fillColor("#ef4444").opacity(0.18);
      doc.text("APPROVED", doc.page.margins.left, cy - 18, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
        lineBreak: false,
      });
      doc.restore();
      doc.opacity(1).fillColor("#000");

      doc.y = yKeep; // คืน cursor กลับมา ไม่ให้เนื้อหาถัดไปโดนดันลง
    }

    // Summary (ลดช่องว่างขึ้นเล็กน้อย)
    const pair = (label: string, value: string) => {
      doc.font("TH_REG").fontSize(10).fillColor("#000").text(label + "  ", { continued: true });
      doc.fillColor("#111").text(value ?? "—");
    };
    const toCSV = (arr?: string[] | null) => (arr?.length ? arr.join(", ") : "—");

    doc.moveDown(0.3);
    doc.font("TH_BOLD").fontSize(12).text("CAMPAIGN SUMMARY  /  สรุปแคมเปญ");
    doc.moveDown(0.15);

    pair("Campaign Name / ชื่อแคมเปญ", reqRow.campaign_name ?? "—");
    pair("Platform / แพลตฟอร์ม", reqRow.platform ?? "—");
    pair("Funnel / Objective / ฟันเนล / วัตถุประสงค์", `${reqRow.funnel_stage ?? "—"} / ${reqRow.objective ?? "—"}`);
    pair("Languages / ภาษา", toCSV(reqRow.languages));
    pair("Locations / พื้นที่", toCSV(reqRow.locations));
    pair("Status / สถานะ", reqRow.status);
    pair("Created / วันที่สร้าง", fmtDateTimeICT(reqRow.created_at));
    pair("Submitted / วันที่ส่งอนุมัติ", fmtDateTimeICT(reqRow.submitted_at));

    doc.moveDown(0.5);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();

    // KPI
    doc.moveDown(0.6);
    doc.font("TH_BOLD").fontSize(12).text("KPI SUMMARY");
    doc.moveDown(0.15);

    const tableX = doc.page.margins.left;
    let y = doc.y;
    const widths = [30, 140, 70, 80, 70, 150];
    const headers = ["#", "KPI", "Operator", "Target", "Unit", "Method"];

    const drawRow = (cells: string[], bold = false) => {
      let x = tableX;
      doc.font(bold ? "TH_BOLD" : "TH_REG").fontSize(10).fillColor("#000");
      for (let i=0;i<cells.length;i++){
        doc.text(String(cells[i] ?? "—"), x+4, y+4, { width: widths[i]-8 });
        x += widths[i];
      }
    };

    doc.rect(tableX, y, widths.reduce((a,b)=>a+b,0), 22).stroke();
    drawRow(headers, true);
    y += 22;

    const kRows = (kpis ?? []) as KpiRow[];
    for (let i=0;i<Math.max(1, kRows.length); i++){
      const k = kRows[i];
      const isEmpty = !k;
      const idx = isEmpty ? "" : String((k.idx ?? i)+1);
      const kpiName = isEmpty ? "—" : (k.type === "OTHER" ? (k.label ?? "OTHER") : k.type);
      const operator = isEmpty ? "—" : k.operator;
      const target = isEmpty ? "—"
        : (k.unit === "PERCENT" ? `${fmtMoney(k.target)} %`
           : k.unit === "BAHT" ? `${fmtMoney(k.target)} บาท`
           : fmtMoney(k.target));
      const unit = isEmpty ? "—" : k.unit;
      const method = isEmpty ? "—" : (k.method ?? "—");

      doc.rect(tableX, y, widths.reduce((a,b)=>a+b,0), 22).stroke();
      drawRow([idx, kpiName, operator, target, unit, method], !isEmpty && (k.idx ?? i) === 0);
      y += 22;

      if (y > doc.page.height - doc.page.margins.bottom - 120) {
        doc.addPage();
        y = doc.y;
        doc.rect(tableX, y, widths.reduce((a,b)=>a+b,0), 22).stroke();
        drawRow(headers, true);
        y += 22;
      }
    }

    doc.moveDown(0.5);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();

    // Schedule
    doc.moveDown(0.6);
    doc.font("TH_BOLD").fontSize(12).text("AD SCHEDULE");
    doc.moveDown(0.15);
    doc.font("TH_REG").fontSize(10).text(groupSchedule((schs ?? []) as SchRow[]));

    // Signatures
    doc.moveDown(0.8);
    const line = (label: string) => {
      const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const mid = doc.page.margins.left + w * 0.62;
      doc.font("TH_REG").fontSize(10).text(label, { continued: true });
      doc.text("  ");
      const y0 = doc.y + 12;
      doc.moveTo(mid, y0).lineTo(mid + w*0.35, y0).stroke();
      doc.moveDown(1.0);
    };
    line("Requested by");
    line("Reviewed by");
    line("Approved by");

    // Footer + end
    doc.moveTo(doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 20)
       .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - doc.page.margins.bottom - 20)
       .stroke();
    doc.font("TH_REG").fontSize(9).text(
      "ADPAAS — Adwords Planner, Audit & Approve System",
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom - 16,
      { continued: true }
    );
    doc.text(`Printed on ${fmtDateTimeICT(new Date())}`, { align: "right" });

    doc.end();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="adpaas-approval-${params.id}.pdf"`,
        "Cache-Control": "no-store, max-age=0",
        "X-ADPAAS-Route": ROUTE_TAG,
      },
    });
  } catch (err: any) {
    const debugMode = new URL(req.url).searchParams.get("debug") === "1";
    if (debugMode) {
      return new Response(JSON.stringify({
        reason: "PDF_GENERATION_ERROR",
        message: err?.message ?? String(err),
        stack: err?.stack ?? null,
        tag: ROUTE_TAG,
      }, null, 2), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}
