'use client';

// src/app/page.tsx — ADPAAS Landing (Multi-platform)
// Theme: Warm→Cool mesh gradient (แดง/ชมพู→ม่วง→น้ำเงิน)

import React, { useEffect } from 'react';

/* ---------------- Icons (inline SVG) ---------------- */
const Icon = ({ path, className = 'w-5 h-5' }: { path: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d={path} />
  </svg>
);
const Star = (props: any) => <Icon {...props} path="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />;
const Check = (props: any) => <Icon {...props} path="M9 16.17 4.83 12 3.41 13.41 9 19l12-12-1.41-1.41z" />;
const Shield = (props: any) => <Icon {...props} path="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" />;
const Spark = (props: any) => <Icon {...props} path="M12 2l1.76 5.41L19 9l-5.24 1.59L12 16l-1.76-5.41L5 9l5.24-1.59L12 2z" />;
const Clock = (props: any) => <Icon {...props} path="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 11h5v-2h-4V6h-2v7z" />;
const Target = (props: any) => <Icon {...props} path="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />;
const MapPin = (props: any) => <Icon {...props} path="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />;
const Calendar = (props: any) => <Icon {...props} path="M7 2h2v2h6V2h2v2h3v16H4V4h3V2zm13 6H4v10h16V8z" />;
const Diff = (props: any) => <Icon {...props} path="M14 3H6a2 2 0 0 0-2 2v8h2V5h8V3zm4 4H10a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-3 3v2h-2v2h-2v-2H9v-2h2V7h2v2h2z" />;

/* ---------------- Data (Multi-platform) ---------------- */
const painSolutions = [
  { title: 'เสียเวลายิงแอดหลายแพลตฟอร์มซ้ำ ๆ', desc: 'ข้อมูลเดิมต้องกรอกใหม่ทีละระบบ', solution: 'Single-page Request เติมครั้งเดียว ใช้ได้หลายแพลตฟอร์ม', icon: <Spark className="w-6 h-6" /> },
  { title: 'KPI ไม่สอดคล้องกับเป้าหมาย', desc: 'ตั้ง KPI กว้าง/วัดไม่ได้ → ถูกตีกลับ', solution: 'KPI Template Builder บังคับครบ 5 ช่อง + แนะนำตาม Funnel/Platform', icon: <Target className="w-6 h-6" /> },
  { title: 'บรีฟไม่ครบ ส่งช้า', desc: 'ต้องตามเอกสารหลายรอบ (URL/Location/Language/เวลา/งบ)', solution: 'Real-time Checklist เตือนสิ่งที่ขาด + Prevent ส่งถ้ายังไม่ครบ', icon: <Check className="w-6 h-6" /> },
  { title: 'ต้องแก้หลายรอบ', desc: 'สื่อสารคลาดเคลื่อนระหว่างทีม/ผู้อนุมัติ', solution: 'Review Modal + Comment in-context ก่อนกดส่ง', icon: <Diff className="w-6 h-6" /> },
  { title: 'ตั้งเวลาซ้อน/ชนกลุ่มเป้าหมาย', desc: 'Ad schedule ซ้ำซ้อน หรือยิงช่วงไม่มี conversion', solution: 'Ad Schedule Guard หลายช่วง/หลายวัน + กันเวลาซ้อน', icon: <Calendar className="w-6 h-6" /> },
  { title: 'ตั้งค่าประเทศ/ภาษา/วัตถุประสงค์ผิด', desc: 'งบรั่วจากทราฟฟิกนอกเป้า', solution: 'Location & Language Guard + Presence Mode Assist (รองรับหลายแพลตฟอร์ม)', icon: <MapPin className="w-6 h-6" /> },
];

const features = [
  { title: 'Single-page Request (Multi-platform)', desc: 'บรีฟครั้งเดียว ใช้กับ Google / Meta / TikTok / LINE / YouTube', icon: <Spark className="w-6 h-6" /> },
  { title: 'Real-time Checklist', desc: 'บอกทันทีว่ายังขาดอะไรบ้าง ปิดจุดพลาดก่อนส่ง', icon: <Check className="w-6 h-6" /> },
  { title: 'KPI Template Builder', desc: '≥/≤/= + ค่าเป้า/หน่วย/วิธีวัด (ครบ 5 ช่อง) ≥1 แถว', icon: <Target className="w-6 h-6" /> },
  { title: 'Review Modal ก่อนส่ง', desc: 'ทวนรายการ + คอมเมนต์ในบริบทก่อน submit', icon: <Diff className="w-6 h-6" /> },
  { title: 'Ad Schedule Guard', desc: 'หลายช่วง/หลายวัน + ปุ่มคัดลอก weekday/weekend + กันเวลาซ้อน', icon: <Calendar className="w-6 h-6" /> },
  { title: 'Approval Workflow', desc: 'สถานะ/ลำดับขั้น (Draft → Review → Approved) พร้อมบันทึกผู้อนุมัติ', icon: <Clock className="w-6 h-6" /> },
];

const differentiators = [
  { title: 'Plan Once, Launch Everywhere', desc: 'บรีฟเดียว ครอบคลุมหลายแพลตฟอร์ม ลดงานซ้ำ และลดเวลายิงแอด', icon: <Spark className="w-6 h-6" />, badge: 'เฉพาะ ADPAAS' },
  { title: 'KPI–Objective Congruence (Cross-platform)', desc: 'แนะนำ KPI ตาม Funnel/Objective/Platform + บังคับครบ 5 ช่อง เพื่อวัดผลได้จริง', icon: <Target className="w-6 h-6" />, badge: 'เฉพาะ ADPAAS' },
  { title: 'Built-in Approvals', desc: 'เวิร์กโฟลว์อนุมัติในตัว เห็นว่า “ค้างที่ใคร” ลดการไล่ถามในแชต', icon: <Check className="w-6 h-6" />, badge: 'เฉพาะ ADPAAS' },
];

const kpiExamples = [
  { funnel: 'Conversion', objective: 'Leads',  sample: 'CPL ≤ 60 THB',                         measure: 'GA4: event `generate_lead` / 30 วัน' },
  { funnel: 'Conversion', objective: 'Sales',  sample: 'ROAS ≥ 300% หรือ CPA ≤ 120 THB',       measure: 'GA4: purchase + revenue' },
  { funnel: 'Consideration', objective: 'Traffic', sample: 'CTR ≥ 2.5% & Sessions ≥ 500/7 วัน', measure: 'GA4: sessions / UTM' },
  { funnel: 'Awareness', objective: 'Reach/Impr.',  sample: 'Impr. ≥ 50,000/7 วัน & CPM ≤ 70 THB', measure: 'Platform metrics' },
];

const testimonials = [
  { quote: 'จากเดิมต้องกรอกซ้ำหลายระบบ ตอนนี้บรีฟครั้งเดียวแล้วเลือกแพลตฟอร์มได้เลย ประหยัดเวลามาก', author: 'นีล',  role: 'Head of Performance',  org: 'เอเจนซี SME' },
  { quote: 'มีเวิร์กโฟลว์อนุมัติครบ เห็นชัดว่า “ค้างที่ใคร” งานผ่านเร็วขึ้น',                         author: 'พิม',  role: 'Marketing Manager',     org: 'ธุรกิจบริการ' },
  { quote: 'คนยิงแอดใหม่ก็มั่นใจขึ้น เพราะระบบบังคับ KPI ครบ 5 ช่อง และมี Checklist ปิดช่องโหว่',        author: 'โฟกัส', role: 'Owner',                 org: 'แบรนด์เครื่องดื่ม' },
] as const;

const faqs = [
  { q: 'ต้องใช้บัตรเครดิตไหม?', a: 'ไม่ต้อง (ช่วง Beta) เริ่มใช้งานฟรีได้ทันที' },
  { q: 'รองรับแพลตฟอร์มอะไรบ้าง?', a: 'เริ่มต้นรองรับ Google / Meta / TikTok / LINE / YouTube และจะเพิ่มต่อเนื่อง' },
  { q: 'มีลิมิตช่วง Beta ไหม?', a: 'มี — ฟรีทุกฟีเจอร์แต่จำกัด “จำนวนคำขอ/เดือน”' },
  { q: 'หลัง Beta จะคิดเงินอย่างไร?', a: 'มี Free/Starter/Growth/Business โดย Free จำกัดโควตา/เดือน' },
  { q: 'ต่างจากสเปรดชีตอย่างไร?', a: 'Plan ครั้งเดียวใช้ได้หลายแพลตฟอร์ม + Checklist/Guard + เวิร์กโฟลว์อนุมัติในตัว' },
];

/* ---------------- Building blocks ---------------- */
const Section = ({ id, children, className = '' }: any) => <section id={id} className={`py-16 md:py-24 ${className}`}>{children}</section>;
const Container = ({ children, className = '' }: any) => <div className={`mx-auto w-full max-w-6xl px-4 md:px-6 ${className}`}>{children}</div>;
const Card = ({ children, className = '' }: any) => <div className={`card ${className}`}>{children}</div>;

/* ---------------- Sections ---------------- */
const Hero = () => (
  <Section id="hero" className="pt-24 md:pt-28 relative overflow-hidden">
    <div className="bg-mesh" aria-hidden />
    <div className="bg-mesh-fade" aria-hidden />
    <Container>
      <div className="grid md:grid-cols-2 items-center gap-10 z-front">
        {/* Copy */}
        <div>
          {/* ★ เปลี่ยน Pill ให้เป็นขาวโปร่งบนพื้นมืด */}
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white/90 border border-white/25 bg-white/10 backdrop-blur">
            ADPAAS — Ads Planner, Audit & Approve System
          </span>

          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight text-white text-glow">
            วางแผน–ตรวจ–อนุมัติ แคมเปญโฆษณา <span className="text-brand">เร็วขึ้น ถูกต้องขึ้น มีระบบอนุมัติ</span>
          </h1>
          <p className="mt-4 text-white/90 md:text-lg text-glow">
            บรีฟครั้งเดียว ใช้ได้หลายแพลตฟอร์ม พร้อม KPI ที่สอดคล้อง และ Checklist ป้องกันข้อผิดพลาดก่อนส่งอนุมัติ
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="/login" onClick={() => console.log('cta_login_clicked')} className="btn-primary">ไปที่หน้าเข้าสู่ระบบ</a>
            <a href="#features" className="btn-ghost">ดูฟีเจอร์</a>
          </div>
          <div className="mt-4 flex items-center gap-3 text-sm text-white/85">
            <Check className="w-4 h-4 text-brand" /> ช่วง Beta: ฟรีทุกฟีเจอร์แต่จำกัดคำขอ/เดือน • ไม่ต้องใช้บัตรเครดิต
          </div>
        </div>

        {/* Mockup (กระจกขาวสว่างขึ้น + ข้อความเข้มขึ้นเพื่อไม่กลืน) */}
        <div className="relative z-front">
          <Card className="relative p-4 md:p-6 bg-white/85 backdrop-blur-xl border-white/50">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-ink-900">Request • #AD-2025-001</div>
              <span className="text-xs text-ink-600">Draft</span>
            </div>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="block text-xs text-ink-700">Platforms</label>
                <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">Google, Meta, TikTok</div>
                <label className="block text-xs text-ink-700">Objective</label>
                <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">Leads (Form)</div>
                <label className="block text-xs text-ink-700">KPI (≥/≤/=)</label>
                <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">CPL ≤ 60.00 THB</div>
              </div>
              <div className="space-y-3">
                <label className="block text-xs text-ink-700">Ad Schedule</label>
                <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">Mon–Fri • 09:00–17:30</div>
                <label className="block text-xs text-ink-700">Approval</label>
                <div className="rounded-lg border border-brand text-ink-800 bg-white/80 px-3 py-2 flex items-center gap-2">
                  <Check className="w-4 h-4 text-brand" /> Checklist ผ่านแล้ว • พร้อมยื่น
                </div>
                <label className="block text-xs text-ink-700">Checklist</label>
                <ul className="text-sm text-ink-800 space-y-1">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand" /> KPI ≥ 1 แถว (ครบ 5 ช่อง)</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand" /> Platforms เลือกครบถ้วน</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand" /> Schedule ไม่ชน</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Container>
  </Section>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl md:text-4xl font-bold text-ink-900">{children}</h2>
);

const PainSolution = () => (
  <Section id="pain" className="bg-white">
    <Container>
      <div className="max-w-3xl">
        <SectionTitle>ยิงแอดหลายแพลตฟอร์มให้ <span className="text-brand">เร็ว ถูกต้อง และผ่านอนุมัติ</span></SectionTitle>
        <p className="mt-3 text-ink-700">เราจับคู่ Painpoint → Solution แบบตรงประเด็น ลดเวลาทำงานซ้ำและปิดจุดผิดพลาด</p>
      </div>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {painSolutions.map((p, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center gap-3">
              <div className="text-brand">{p.icon}</div>
              <h3 className="font-semibold text-ink-900">{p.title}</h3>
            </div>
            <p className="mt-2 text-sm text-ink-700">{p.desc}</p>
            <div className="mt-3 rounded-lg border border-brand bg-white/70 text-ink-800 text-sm p-3">
              <span className="font-medium">Solution: </span>{p.solution}
            </div>
          </Card>
        ))}
      </div>
    </Container>
  </Section>
);

const HowItWorks = () => (
  <Section id="how" className="section-soft">
    <Container>
      <div className="text-center max-w-2xl mx-auto">
        <SectionTitle>เริ่มคำขอแรกใน <span className="text-brand">3 ขั้นตอน</span></SectionTitle>
        <p className="mt-3 text-ink-700">เลือกแพลตฟอร์ม/Objective → ใส่ KPI ≥1 แถว (ครบ 5 ช่อง) → Review & Checklist ผ่าน → ส่งอนุมัติ</p>
      </div>
      <div className="mt-10 grid md:grid-cols-3 gap-6">
        {[
          { t: 'เลือกแพลตฟอร์ม & Objective', d: 'Google / Meta / TikTok / LINE / YouTube' },
          { t: 'ตั้ง KPI ให้สอดคล้อง', d: '≥/≤/= + ค่าเป้า/หน่วย/วิธีวัด ครบถ้วน' },
          { t: 'Review & Approve', d: 'เปิด Review Modal → Checklist ผ่าน จึงส่ง' },
        ].map((s, i) => (
          <Card key={i} className="p-6 text-center">
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-xl bg-white text-brand border border-brand">{i + 1}</div>
            <h3 className="mt-4 font-semibold text-ink-900">{s.t}</h3>
            <p className="mt-2 text-ink-700">{s.d}</p>
          </Card>
        ))}
      </div>
    </Container>
  </Section>
);

const Features = () => (
  <Section id="features" className="bg-white">
    <Container>
      <div className="max-w-3xl">
        <SectionTitle>ประหยัดเวลาในการยิงแอด <span className="text-brand">ถูกต้องตั้งแต่ต้น</span> และมีระบบอนุมัติ</SectionTitle>
        <p className="mt-3 text-ink-700">ฟีเจอร์ที่จำเป็นต่อการยื่นอนุมัติให้รวดเร็วและแม่นยำ</p>
      </div>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center gap-3">
              <div className="text-brand">{f.icon}</div>
              <h3 className="font-semibold text-ink-900">{f.title}</h3>
            </div>
            <p className="mt-2 text-sm text-ink-700">{f.desc}</p>
          </Card>
        ))}
      </div>
    </Container>
  </Section>
);

const KPIExamples = () => (
  <Section id="examples" className="bg-gradient-to-b from-white to-[#f5f3ff]">
    <Container>
      <div className="max-w-3xl">
        <SectionTitle>ตัวอย่าง KPI & วิธีวัด (ข้ามแพลตฟอร์ม)</SectionTitle>
        <p className="mt-3 text-ink-700">ตั้งต้นง่าย ๆ แล้วปรับตามงบและบริบทของคุณ</p>
      </div>
      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiExamples.map((row, i) => (
          <Card key={i} className="p-5">
            <div className="text-xs uppercase tracking-wide text-brand font-semibold">{row.funnel}</div>
            <div className="mt-1 text-sm text-ink-600">{row.objective}</div>
            <div className="mt-3 font-semibold text-ink-900">{row.sample}</div>
            <div className="mt-2 text-xs text-ink-600">วิธีวัด: {row.measure}</div>
          </Card>
        ))}
      </div>
    </Container>
  </Section>
);

const Differentiators = () => (
  <Section id="why" className="bg-white">
    <Container>
      <div className="max-w-3xl">
        <SectionTitle>สิ่งที่ทำให้ <span className="text-brand">ADPAAS</span> ไม่เหมือนใคร</SectionTitle>
        <p className="mt-3 text-ink-700">โฟกัส “เร็ว ถูกต้อง อนุมัติไว” ด้วยเครื่องยนต์วางแผน-ตรวจ-อนุมัติแบบครบลูป</p>
      </div>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {differentiators.map((d, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center gap-3">
              <div className="text-brand">{d.icon}</div>
              <h3 className="font-semibold text-ink-900">{d.title}</h3>
            </div>
            <p className="mt-2 text-sm text-ink-700">{d.desc}</p>
            <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-medium text-ink-800 bg-white/60 rounded-full px-2 py-1 border border-brand">
              {d.badge}
            </div>
          </Card>
        ))}
      </div>
    </Container>
  </Section>
);

const Testimonials = () => (
  <Section id="testimonials" className="bg-white">
    <Container>
      <div className="text-center max-w-2xl mx-auto">
        <SectionTitle>สิ่งที่ผู้ใช้พูดถึงเรา</SectionTitle>
        <p className="mt-3 text-ink-700">เสียงจากผู้ใช้จริง/เคสอ้างอิงเบื้องต้น</p>
      </div>
      <div className="mt-10 grid md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <Card key={i} className="p-6">
            <p className="text-ink-800">“{t.quote}”</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/70 border border-brand flex items-center justify-center text-brand font-bold">
                {t.author[0]}
              </div>
              <div className="text-sm">
                <div className="font-semibold text-ink-900">{t.author}</div>
                <div className="text-ink-600">{t.role} • {t.org}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Container>
  </Section>
);

const FAQs = () => (
  <Section id="faqs" className="section-soft">
    <Container>
      <div className="max-w-3xl">
        <SectionTitle>คำถามที่พบบ่อย</SectionTitle>
        <p className="mt-3 text-ink-700">สรุปข้อกังวลหลัก ๆ ให้ตัดสินใจได้เร็ว</p>
      </div>
      <div className="mt-8 divide-y divide-slate-200 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {faqs.map((f, i) => (
          <details key={i} className="group open:bg-white" onToggle={(e) => {
            const el = e.currentTarget as HTMLDetailsElement;
            if (el.open) console.log('faq_opened', { index: i, q: f.q });
          }}>
            <summary className="cursor-pointer list-none px-6 py-4 font-medium text-ink-900 hover:bg-slate-50 flex items-center justify-between">
              <span>{f.q}</span>
              <span className="text-ink-600 group-open:rotate-180 transition">⌄</span>
            </summary>
            <div className="px-6 pb-5 text-ink-700">{f.a}</div>
          </details>
        ))}
      </div>
    </Container>
  </Section>
);

const SecondaryCTA = () => (
  <Section id="start" className="bg-white">
    <Container>
      <div className="rounded-3xl p-[1px]" style={{ backgroundImage: 'linear-gradient(90deg, #ff4d57, #8b5cf6 55%, #3b82f6)' }}>
        <div className="rounded-3xl bg-white p-8 md:p-12 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-ink-900">พร้อมเริ่มคำขอแรกของคุณแล้วหรือยัง?</h3>
          <p className="mt-2 text-ink-700">ช่วง Beta: ฟรีทุกฟีเจอร์แต่จำกัดคำขอ/เดือน — ไม่ต้องใช้บัตรเครดิต</p>
          <div className="mt-5 flex items-center justify-center">
            <a href="/login" onClick={() => console.log('cta_login_clicked_secondary')} className="btn-primary">ไปที่หน้าเข้าสู่ระบบ</a>
          </div>
        </div>
      </div>
    </Container>
  </Section>
);

const Footer = () => (
  <footer className="py-10 bg-ink-900 text-slate-300">
    <Container>
      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div>
          <div className="text-white font-bold text-lg">ADPAAS</div>
          <p className="mt-2 text-sm text-slate-400">Ads Planner, Audit & Approve System — Plan once, launch everywhere.</p>
          <div className="mt-3 text-xs text-slate-500">เวอร์ชันหน้า: v1.6 • © {new Date().getFullYear()} BizBuild/OwnerOS</div>
        </div>
        <div>
          <div className="font-semibold text-white">ลิงก์</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><a href="#how" onClick={() => console.log('nav_how_clicked')} className="hover:text-white">วิธีการทำงาน</a></li>
            <li><a href="#features" onClick={() => console.log('nav_features_clicked')} className="hover:text-white">ฟีเจอร์</a></li>
            <li><a href="#examples" onClick={() => console.log('nav_examples_clicked')} className="hover:text-white">ตัวอย่าง KPI</a></li>
            <li><a href="#why" onClick={() => console.log('nav_why_clicked')} className="hover:text-white">เหตุผลที่ต่าง</a></li>
            <li><a href="#faqs" onClick={() => console.log('nav_faqs_clicked')} className="hover:text-white">คำถามที่พบบ่อย</a></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white">ติดต่อ</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li>อีเมล: justacost@bizbuild.net</li>
            <li>เว็บไซต์: justacost.bizbuild.net</li>
            <li>โทร: 088-016-7030</li>
          </ul>
        </div>
      </div>
    </Container>
  </footer>
);

/* ---------------- Page ---------------- */
export default function ADPAASLanding() {
  useEffect(() => {
    console.log('view_hero');
    const onScroll = () => {
      const h = document.documentElement;
      const d = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      if (d >= 25 && d < 50) console.log('scroll_depth_25');
      if (d >= 50 && d < 75) console.log('scroll_depth_50');
      if (d >= 75 && d < 100) console.log('scroll_depth_75');
      if (d >= 100) console.log('scroll_depth_100');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className="min-h-screen">
      <Hero />
      <PainSolution />
      <HowItWorks />
      <Features />
      <KPIExamples />
      <Differentiators />
      <Testimonials />
      <FAQs />
      <SecondaryCTA />
      <Footer />
      <a
        href="#hero"
        onClick={() => console.log('back_to_top_clicked')}
        className="fixed bottom-6 right-6 inline-flex items-center justify-center w-12 h-12 rounded-full text-white shadow-lg hover:opacity-95"
        style={{ backgroundImage: 'linear-gradient(90deg, #ff4d57, #8b5cf6 55%, #3b82f6)' }}
        aria-label="Back to top"
      >↑</a>
    </main>
  );
}
