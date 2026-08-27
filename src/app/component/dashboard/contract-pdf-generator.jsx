// contract-pdf-generator.jsx
// Client-side PDF generation using pdf-lib
// npm install pdf-lib

"use client";
import { useState, useRef, useEffect } from "react";

const loadPdfLib = () =>
  new Promise((resolve, reject) => {
    if (window.PDFLib) return resolve(window.PDFLib);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
    s.onload = () => resolve(window.PDFLib);
    s.onerror = reject;
    document.head.appendChild(s);
  });

// ─── Signature Canvas ────────────────────────────────────────
function SignatureCanvas({ onSave }) {
  const ref = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [empty, setEmpty] = useState(true);

  const pos = (e, canvas) => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const start = (e) => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    const p = pos(e, c);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    setDrawing(true); setEmpty(false);
  };
  const move = (e) => {
    if (!drawing) return;
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#1a1a2e";
    const p = pos(e, c);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const stop = () => setDrawing(false);
  const clear = () => {
    const c = ref.current; if (!c) return;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };
  const save = () => {
    if (!ref.current || empty) return;
    onSave(ref.current.toDataURL("image/png"));
  };

  return (
    <div>
      <canvas
        ref={ref} width={460} height={120}
        onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
        style={{ width: "100%", height: 120, border: "2px dashed #d1d5db", borderRadius: 12, background: "#f9fafb", cursor: "crosshair", touchAction: "none", display: "block" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" onClick={clear} style={btnSm}>↺ Clear</button>
        <button type="button" onClick={save} disabled={empty} style={{ ...btnSm, color: "#0d9488", borderColor: "#99f6e4", opacity: empty ? 0.4 : 1 }}>✓ Use Signature</button>
      </div>
    </div>
  );
}

const btnSm = {
  fontSize: 12, padding: "6px 12px", borderRadius: 8,
  border: "1px solid #e5e7eb", background: "white", cursor: "pointer",
  display: "flex", alignItems: "center", gap: 4, color: "#6b7280"
};

const ordinalDay = (d) => {
  const day = d.getDate();
  const suffix = (day % 10 === 1 && day !== 11) ? "st"
    : (day % 10 === 2 && day !== 12) ? "nd"
      : (day % 10 === 3 && day !== 13) ? "rd"
        : "th";
  return `${day}${suffix}`;
};

// ─── PDF Generator ───────────────────────────────────────────
async function generateContractPDF(data) {
  const PDFLib = await loadPdfLib();
  const { PDFDocument, rgb, StandardFonts } = PDFLib;

  const doc = await PDFDocument.create();
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);

  // ── Colors matching AL&CO brand ──
  const C = {
    navy: rgb(0.11, 0.20, 0.40),   // dark navy header/footer
    gold: rgb(0.83, 0.65, 0.05),   // AL&CO gold stripe
    blue: rgb(0.22, 0.38, 0.64),   // blue stripe
    black: rgb(0.10, 0.10, 0.10),
    gray: rgb(0.40, 0.40, 0.40),
    lgray: rgb(0.65, 0.65, 0.65),
    white: rgb(1, 1, 1),
    line: rgb(0.80, 0.80, 0.80),
  };

  const W = 595, H = 842; // A4
  const ML = 56, MR = 56; // margins
  const TW = W - ML - MR; // text width

  const fmt = (n) => `Rs ${Number(n || 0).toLocaleString("en-PK")}`;
  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    : "_______________";

  // Pehle logo embed karo — ONCE, page se bahar
  let logoImg = null;
  try {
    const logoRes = await fetch("/assets/logo.png");
    const logoBytes = await logoRes.arrayBuffer();
    logoImg = await doc.embedPng(new Uint8Array(logoBytes));
  } catch (_) {
    logoImg = null;
  }

  // Add near the top of generateContractPDF, after color/font setup:

  const sanitize = (str) => {
    if (str === null || str === undefined) return str;
    return String(str)
      // invisible bidi/formatting marks — the actual culprit (U+202A etc.)
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
      // common smart punctuation → WinAnsi-safe equivalents
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u2026/g, "...")
      // anything else outside Latin-1 (e.g. Urdu/Arabic script, emoji) — strip
      .replace(/[^\x00-\xFF]/g, "");
  };

  // addPage ab sync rahega — logo upar embed ho chuka
  const addPage = () => {
    const pg = doc.addPage([W, H]);

    // Sanitize every drawText call on this page automatically
    const _drawText = pg.drawText.bind(pg);
    pg.drawText = (text, opts) => _drawText(sanitize(text), opts);

    // Logo
    if (logoImg) {
      const dims = logoImg.scaleToFit(100, 44);
      pg.drawImage(logoImg, { x: ML, y: H - 60, width: dims.width, height: dims.height });
    } else {
      pg.drawText("AL&CO", { x: ML, y: H - 38, size: 13, font: boldFont, color: C.navy });
      pg.drawText("CENTER FOR HUMAN BRILLIANCE &", { x: ML, y: H - 48, size: 5.5, font, color: C.gray });
      pg.drawText("BEHAVIORAL REENGINEERING", { x: ML, y: H - 54, size: 5.5, font, color: C.gray });
    }

    // Header stripes (top RIGHT)
    pg.drawRectangle({ x: W - 210, y: H - 14, width: 210, height: 4, color: C.blue });
    pg.drawRectangle({ x: W - 190, y: H - 23, width: 190, height: 4, color: C.blue });
    pg.drawRectangle({ x: W - 170, y: H - 32, width: 170, height: 4, color: C.gold });
    pg.drawRectangle({ x: W - 140, y: H - 41, width: 140, height: 4, color: C.gold });

    // Footer stripes (bottom LEFT, bilkul bottom se)
    pg.drawRectangle({ x: 0, y: 0, width: 140, height: 4, color: C.gold });
    pg.drawRectangle({ x: 0, y: 9, width: 170, height: 4, color: C.gold });
    pg.drawRectangle({ x: 0, y: 18, width: 190, height: 4, color: C.blue });
    pg.drawRectangle({ x: 0, y: 27, width: 210, height: 4, color: C.blue });

    // Footer right text
    pg.drawText("Arslan Larik & Company", {
      x: W - MR - 128, y: 18,
      size: 10, font: boldFont, color: C.navy
    });

    return pg;
  };

  // ── Horizontal line helper ──
  const hLine = (pg, x, y, w, color = C.line, thick = 0.5) => {
    pg.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: thick, color });
  };

  // ── Underline field ──
  const uField = (pg, label, value, x, y, w) => {
    pg.drawText(label, { x, y: y + 10, size: 8.5, font, color: C.black });
    const textX = x + pg.getFont?.()?.widthOfTextAtSize?.(label, 8.5) + 4 || x + label.length * 4.8 + 4;
    const val = (value || "").slice(0, Math.floor((w - label.length * 4.8) / 5));
    pg.drawText(val, { x: textX, y: y + 10, size: 8.5, font, color: C.black });
    hLine(pg, x, y, w);
  };

  // ── Full-width labeled line ──
  const labelLine = (pg, label, value, x, y, w) => {
    pg.drawText(`* ${label}`, { x, y: y + 14, size: 9, font: boldFont, color: C.black });
    const truncated = (value || "").slice(0, Math.floor(w / 4.8));
    if (truncated) {
      pg.drawText(truncated, { x, y: y - 2, size: 9, font, color: C.black });
    }
    hLine(pg, x, y - 6, w);
  };

  // ── Wrap text helper ──
  const drawWrapped = (pg, text, x, y, maxW, size, f, color) => {
    const words = text.split(" ");
    const charsPerLine = Math.floor(maxW / (size * 0.52));
    let line = "", lineY = y;
    for (const word of words) {
      if ((line + " " + word).trim().length > charsPerLine) {
        pg.drawText(line.trim(), { x, y: lineY, size, font: f, color });
        lineY -= size * 1.55;
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    if (line.trim()) pg.drawText(line.trim(), { x, y: lineY, size, font: f, color });
    return lineY - size * 1.55;
  };

  // ════════════════════════════════════════════
  // PAGE 1 — Participant Agreement and Release
  // ════════════════════════════════════════════
  const p1 = addPage();
  let y = H - 80;

  // Title centered
  p1.drawText("Participant Agreement and Release", {
    x: W / 2 - 110, y, size: 11, font: boldFont, color: C.black
  });
  y -= 36;

  // Sub heading
  p1.drawText("Please identify which training you", { x: ML, y, size: 11, font: boldFont, color: C.black });
  y -= 14;
  p1.drawText("are attending:", { x: ML, y, size: 11, font: boldFont, color: C.black });
  y -= 20;

  // Training name line
  p1.drawText("Training Name:", { x: ML, y, size: 9, font, color: C.black });
  const tnVal = data.programName || "";
  p1.drawText(tnVal, { x: ML + 80, y, size: 9, font, color: C.black });
  hLine(p1, ML + 78, y - 3, TW - 78);
  y -= 20;

  // Intro paragraph
  const intro = "(Applicable to all and any training program or programs / certification / coaching; offered by Arslan Larik & Company or Team Arslan Larik & Company in Pakistan & Dubai or Online and Virtually)";
  y = drawWrapped(p1, intro, ML, y, TW, 8.5, font, C.black);
  y -= 14;

  // Agreement paragraphs — exact text from image
  const paras = [
    "I understand that the information contained and presented in this training is useful in creating rapid and lasting change and do hereby agree to use this information only for the purpose of self improvement and/or to achieve a positive outcome when working with others.  The power of these techniques requires care, integrity and respect  for the highest intention of all individuals.",
    "By attending or participating in the above mentioned seminar or training course, I acknowledge that I hereby indemnify the Arslan Larik & Company – Pakistan and Arslan Larik & Company – FZCO Dubai and the consequent boards ABH-ABNLP, Time Line Therapy Association, NGH and ICF against any loss or damage whatsoever and howsoever incurred by the participant (myself) as a result of my participation.",
    "I certify that my participation in this training is of my own free will and I always accept complete responsibility for my well-being. I further certify that I am a healthy individual and that I am physically and psychologically fit to fully participate in this training, and I know of no reason, nor have I been informed by my physician or psychologist or psychiatrist of any reason, why my participation in this training would do me harm of any nature. I agree to release and hold harmless Arslan Larik & Company their agents, representatives and employees for the results of any portion of the training in which I voluntarily participate. If this does not accurately reflect my situation, I agree that I will notify one of the Arslan Larik & Company representatives before participating in this training.",
    "I understand that although this training may raise emotional issues, it is not intended to provide a therapeutic environment or be a substitute for ongoing counseling or psychotherapy, and that any unresolved issues which may surface  and which  may warrant counseling, will be at my own expense.",
    "I understand that if I am found unfit (or disruptive) to participate in this training by a representative and/or staff member of the Arslan Larik & Company, I will be required to leave the training immediately. No questions or discussions will be entered, and the Arslan Larik & Company representatives and/or staff will be the sole judge. No refunds will be given. This also accounts to my behavior during the training, or any violations set forth by Arslan Larik & Company mentioned here or not mentioned. I am in full compliance to following instructions,",
    "I agree that any recorded or written material included as part of this training is protected by Trademark and Copyright laws and may not be used without obtaining prior written permission of the appropriate parties. As a participant, I agree to NOT record this training or any part thereof.",
    "If any legal action, including arbitration or an action for declaratory relief is brought to reenforce this agreement, The Arslan Larik & Company will be entitled to attorney's fees, which may be set by the arbitrators or the court in the same action or in a separate action brought for that purpose, in addition to any other relief to which the Arslan Larik & Company may be entitled.",
  ];

  for (const para of paras) {
    y = drawWrapped(p1, para, ML, y, TW, 8.5, font, C.black);
    y -= 10;
    if (y < 120) break;
  }

  y -= 14;
  p1.drawText("I acknowledge that I have carefully read and understood this agreement, and", { x: ML, y, size: 9, font: boldFont, color: C.black });
  y -= 13;
  p1.drawText("release:", { x: ML, y, size: 9, font: boldFont, color: C.black });
  y -= 26;

  // Print Name
  p1.drawText("Print Name:", { x: ML, y, size: 9, font, color: C.black });
  p1.drawText(data.fullName || "", { x: ML + 60, y, size: 9, font, color: C.black });
  hLine(p1, ML + 58, y - 3, 200);
  y -= 26;

  // Date + Signature
  p1.drawText("Date:", { x: ML, y, size: 9, font, color: C.black });
  p1.drawText(fmtDate(data.signedAt), { x: ML + 30, y, size: 9, font, color: C.black });
  hLine(p1, ML + 28, y - 3, 140);

  p1.drawText("Signature:", { x: ML + 200, y, size: 9, font, color: C.black });
  // Embed signature if drawn
  if (data.signatureData?.startsWith("data:image")) {
    try {
      const imgBytes = Uint8Array.from(atob(data.signatureData.split(",")[1]), c => c.charCodeAt(0));
      const img = await doc.embedPng(imgBytes);
      const dims = img.scaleToFit(140, 28);
      p1.drawImage(img, { x: ML + 265, y: y - 18, width: dims.width, height: dims.height });
    } catch (_) {
      p1.drawText(data.fullName || "", { x: ML + 265, y, size: 9, font: italicFont, color: C.black });
    }
  } else if (data.signatureData) {
    p1.drawText(data.signatureData, { x: ML + 265, y, size: 9, font: italicFont, color: C.black });
  }
  hLine(p1, ML + 263, y - 3, 150);

  // ════════════════════════════════════════════
  // PAGE 2 — Photo Audio Video Release
  // ════════════════════════════════════════════
  const p2 = addPage();
  y = H - 100;

  p2.drawText("PHOTOGRAPH, AUDIO AND VIDEO RELEASE", {
    x: W / 2 - 120, y, size: 11, font: boldFont, color: C.black
  });
  y -= 40;

  // Fields with underlines
  p2.drawText("Name of Training:", { x: ML, y, size: 9, font, color: C.black });
  p2.drawText(data.programName || "", { x: ML + 94, y, size: 9, font, color: C.black });
  hLine(p2, ML + 92, y - 3, 180);
  y -= 26;

  p2.drawText("City:", { x: ML, y, size: 9, font, color: C.black });
  p2.drawText("Karachi", { x: ML + 28, y, size: 9, font, color: C.black });
  hLine(p2, ML + 26, y - 3, 160);
  p2.drawText("or (Online Module) / Virtual", { x: ML + 195, y, size: 9, font, color: C.black });
  y -= 26;

  p2.drawText("Dated:", { x: ML, y, size: 9, font, color: C.black });
  p2.drawText(fmtDate(data.signedAt), { x: ML + 36, y, size: 9, font, color: C.black });
  hLine(p2, ML + 34, y - 3, 160);
  y -= 26;

  p2.drawText("I,", { x: ML, y, size: 9, font, color: C.black });
  p2.drawText(data.fullName || "", { x: ML + 14, y, size: 9, font, color: C.black });
  hLine(p2, ML + 12, y - 3, 170);
  y -= 26;

  p2.drawText("understand that portions of this", { x: ML, y, size: 9, font, color: C.black });
  y -= 16;

  const photoParas = [
    "training may be photographed, and/or recorded on video or audio tape. I understand that my",
    "likeness may appear in photographs and/or my voice and/or image may appear on video/audio",
    "tapes, and I agree that no compensation will be paid to me for any products or revenues or any",
    "other value derived from these photographs and audio/video recordings. I waive all rights I may",
    "be entitled to from the use of such images or recordings. I do not ask for nor expect any",
    "compensation from any of the photographs taken or audio/video recordings made during this",
    "seminar.",
  ];

  for (const line of photoParas) {
    p2.drawText(line, { x: ML, y, size: 9, font, color: C.black });
    y -= 16;
  }
  y -= 30;

  p2.drawText("Signature:", { x: ML, y, size: 9, font, color: C.black });
  if (data.signatureData?.startsWith("data:image")) {
    try {
      const imgBytes = Uint8Array.from(atob(data.signatureData.split(",")[1]), c => c.charCodeAt(0));
      const img = await doc.embedPng(imgBytes);
      const dims = img.scaleToFit(140, 28);
      p2.drawImage(img, { x: ML + 60, y: y - 18, width: dims.width, height: dims.height });
    } catch (_) {
      p2.drawText(data.fullName || "", { x: ML + 62, y, size: 9, font: italicFont, color: C.black });
    }
  } else if (data.signatureData) {
    p2.drawText(data.signatureData, { x: ML + 62, y, size: 9, font: italicFont, color: C.black });
  }
  hLine(p2, ML + 58, y - 3, 160);

  // ════════════════════════════════════════════
  // PAGE 3 — Contract for Training Program Enrolment
  // ════════════════════════════════════════════
  const p3 = addPage();
  y = H - 95;

  p3.drawText("Contract for Training Program Enrolment", {
    x: W / 2 - 138, y, size: 14, font: boldFont, color: C.black
  });
  y -= 36;

  // Intro line
  p3.drawText("This Contract is made and entered into on", { x: ML, y, size: 9, font, color: C.black });
  p3.drawText(fmtDate(data.signedAt), { x: ML + 205, y, size: 9, font, color: C.black });
  hLine(p3, ML + 203, y - 3, 130);
  p3.drawText("by and between", { x: ML + 340, y, size: 9, font, color: C.black });
  hLine(p3, ML + 415, y - 3, 84);

  const fullName = data.fullName || "_______________";

  p3.drawText(fullName, { x: ML + 420, y, size: 9, font: boldFont, color: C.black });

  y -= 16;


  p3.drawText(`(Participants Name), hereinafter referred to as the "Client," and Arslan Larik & Company, hereinafter referred to as`, { x: ML, y, size: 8.5, font, color: C.black });
  y -= 14;
  p3.drawText('"AL&CO."', { x: W / 2 - 20, y, size: 8.5, font, color: C.black });
  y -= 30;

  // 1. Enrollment
  p3.drawText("1. Enrollment:", { x: ML, y, size: 10, font: boldFont, color: C.black });
  y -= 20;

  p3.drawText("1.1 The Client hereby enrolls in the", { x: ML, y, size: 9, font, color: C.black });
  p3.drawText(data.programName || "_______________", { x: ML + 175, y, size: 9, font, color: C.black });
  hLine(p3, ML + 173, y - 3, 155);
  p3.drawText("training program offered", { x: ML + 333, y, size: 9, font, color: C.black });   // "[Training Program Name] " hata diya
  y -= 14;
  p3.drawText("by AL&CO.", { x: ML, y, size: 9, font, color: C.black });
  y -= 20;

  const pp = data.paymentPlan;
  const totalAmt = pp?.totalAmount || 0;
  const numInst = pp?.installments?.length || 0;
  const instAmt = numInst > 0 ? Math.round((totalAmt - (pp?.advanceAmount || 0)) / numInst) : 0;
  const advAmt = pp?.advanceAmount || 0;
  const remainingAmt = totalAmt - advAmt;

  // Line 1
  p3.drawText("1.2 The Client agrees to pay the total fee of", { x: ML, y, size: 9, font, color: C.black });
  p3.drawText(fmt(totalAmt), { x: ML + 215, y, size: 9, font, color: C.black });
  hLine(p3, ML + 213, y - 3, 100);
  p3.drawText("in advance of", { x: ML + 318, y, size: 9, font, color: C.black });
  y -= 14;

  // Line 2
  p3.drawText(fmt(advAmt), { x: ML, y, size: 9, font, color: C.black });
  hLine(p3, ML - 2, y - 3, 90);
  p3.drawText("and remaining", { x: ML + 94, y, size: 9, font, color: C.black });
  p3.drawText(fmt(remainingAmt), { x: ML + 168, y, size: 9, font, color: C.black });
  hLine(p3, ML + 166, y - 3, 90);
  p3.drawText("Details on INVOICE NO#", { x: ML + 262, y, size: 9, font, color: C.black });
  y -= 14;

  // Line 3 — invoice blank
  if (data.invoiceNumber) {
    p3.drawText(data.invoiceNumber, { x: ML, y, size: 9, font: boldFont, color: C.black });
  }
  hLine(p3, ML, y - 3, 160);
  y -= 30;

  p3.drawText("same are on INVOICE NO#", { x: ML, y, size: 9, font, color: C.black });
  if (data.invoiceNumber) {
    p3.drawText(data.invoiceNumber, { x: ML + 118, y, size: 9, font: boldFont, color: C.black });
  }
  hLine(p3, ML + 118, y - 3, 140);
  y -= 30;

  // 2. Payment Terms
  p3.drawText("2. Payment Terms:", { x: ML, y, size: 10, font: boldFont, color: C.black });
  y -= 20;

  const advanceDueDate = pp?.advanceDueDate;
  const dueDateLabel = advanceDueDate ? fmtDate(advanceDueDate) : "[Date]";
  const dueDayLabel = advanceDueDate ? ordinalDay(new Date(advanceDueDate)) : "[Day]";

  p3.drawText("2.1 The first installment is due on", { x: ML, y, size: 9, font, color: C.black });
  p3.drawText(dueDateLabel, { x: ML + 168, y, size: 9, font, color: C.black });
  hLine(p3, ML + 166, y - 3, 130);
  p3.drawText("and subsequent installments are due on the", { x: ML + 300, y, size: 9, font, color: C.black });
  y -= 14;
  p3.drawText(dueDayLabel, { x: ML, y, size: 9, font, color: C.black });
  hLine(p3, ML, y - 3, 130);
  p3.drawText("of each month thereafter until the full fee is paid.", { x: ML + 135, y, size: 9, font, color: C.black });
  y -= 20;

  const payTermParas = [
    "2.2 The Client agrees to make timely payments as per the agreed schedule. Timely payments are essential to ensure the smooth delivery of the training program and to maintain accurate financial records for both the Client and AL&CO.",
    "2.3 The Client understands that timely payments are crucial for the smooth delivery of the training program. Failure to make timely payments may result in delays or interruptions in the training services.",
  ];
  for (const para of payTermParas) {
    y = drawWrapped(p3, para, ML, y, TW, 9, font, C.black);
    y -= 14;
  }

  // 3. Understanding
  p3.drawText("3. Understanding of the Training Program:", { x: ML, y, size: 10, font: boldFont, color: C.black });
  y -= 20;

  const understandParas = [
    "3.1 The Client acknowledges that the training program is a valuable investment in their personal and professional development. While the program cannot be physically returned, the knowledge and skills gained will have a lasting impact.",
    "3.2 The Client understands that the training program is similar to purchasing a product like a TV or a Car on installments. Once the product is purchased, it cannot be returned to the store for a refund. If you feel this training isn't up to your standards, this may be mentioned to the client on the very first day of the training and all subsequent material given to the client must be returned undamaged. Such must also come to information before taking the decision to acquiring the services. Services when consumed cannot be refunded.",
  ];
  for (const para of understandParas) {
    y = drawWrapped(p3, para, ML, y, TW, 9, font, C.black);
    y -= 14;
  }

  // ════════════════════════════════════════════
  // PAGE 4 — Client Information
  // ════════════════════════════════════════════
  const p4 = addPage();
  y = H - 95;

  p4.drawText("4. Client Information:", { x: ML, y, size: 10, font: boldFont, color: C.black });
  y -= 18;
  p4.drawText("4.1 The Client agrees to provide the following information:", { x: ML, y, size: 9, font, color: C.black });
  y -= 28;

  // ── Single-line fields (in image order) ──
  const singleLineFields = [
    ["Full Name", data.fullName],
    ["Father's Name/Husband's Name", data.fatherHusbandName],
    ["CNIC Number (of Participant)", data.cnic],
  ];

  for (const [label, value] of singleLineFields) {
    p4.drawText(`* ${label}:`, { x: ML, y, size: 9, font: boldFont, color: C.black });
    y -= 16;
    if (value) p4.drawText(value, { x: ML, y, size: 9, font, color: C.black });
    hLine(p4, ML, y - 3, TW);
    y -= 20;
  }

  // ── Bank Account Number — 2 lines ──
  p4.drawText("* Bank Account Number:", { x: ML, y, size: 9, font: boldFont, color: C.black });
  y -= 16;
  if (data.bankAccountNumber) p4.drawText(data.bankAccountNumber, { x: ML, y, size: 9, font, color: C.black });
  hLine(p4, ML, y - 3, TW);
  y -= 14;
  hLine(p4, ML, y - 3, TW);
  y -= 26;

  // ── Bank example note — right after Bank Account Number ──
  p4.drawText("[Example of Bank Details as to how it needs to be provided] Account Title: Arslan Larik & Company, Account", { x: ML, y, size: 7.5, font: boldFont, color: C.black });
  y -= 12;
  p4.drawText("Number: 19107901888203, IBAN: PK94HABB0019107901888203, Address of the Bank Branch: Korangi Rd", { x: ML, y, size: 7.5, font: boldFont, color: C.black });
  y -= 12;
  p4.drawText("DHA Phase II", { x: ML, y, size: 7.5, font: boldFont, color: C.black });
  y -= 24;

  // ── Current Address — 2 lines ──
  p4.drawText("* Current Address:", { x: ML, y, size: 9, font: boldFont, color: C.black });
  y -= 16;
  if (data.currentAddress) p4.drawText(data.currentAddress, { x: ML, y, size: 9, font, color: C.black });
  hLine(p4, ML, y - 3, TW);
  y -= 14;
  hLine(p4, ML, y - 3, TW);
  y -= 26;

  // ── Remaining single-line fields ──
  const restFields = [
    ["Primary Cell Phone Number", data.phone],
    ["Emergency Contact Name: (Next to KIN)", data.emergencyContactName],
    ["Current Occupation/Company", data.occupation],
  ];

  for (const [label, value] of restFields) {
    p4.drawText(`* ${label}:`, { x: ML, y, size: 9, font: boldFont, color: C.black });
    y -= 16;
    if (value) p4.drawText(value, { x: ML, y, size: 9, font, color: C.black });
    hLine(p4, ML, y - 3, TW);
    y -= 20;
  }

  // ── Occupation examples (static reference text — kept as per original template) ──
  y -= 6;
  p4.drawText("Example:", { x: ML, y, size: 9, font: boldFont, color: C.black });
  y -= 16;
  p4.drawText("For a working professional:", { x: ML + 16, y, size: 9, font: boldFont, color: C.black });
  y -= 14;
  p4.drawText("o  Current Occupation/Company: Software Engineer at [Company Name]", { x: ML + 32, y, size: 9, font, color: C.black });
  y -= 14;
  p4.drawText("For a student:", { x: ML + 16, y, size: 9, font: boldFont, color: C.black });
  y -= 14;
  p4.drawText("o  Current Occupation/Company: Student at [University/School Name]", { x: ML + 32, y, size: 9, font, color: C.black });
  // ════════════════════════════════════════════
  // PAGE 5 — Acceptance and Signatures
  // ════════════════════════════════════════════
  const p5 = addPage();
  y = H - 95;

  p5.drawText("For a housewife:", { x: ML + 16, y, size: 9, font: boldFont, color: C.black });
  y -= 14;
  p5.drawText("o  Current Occupation/Company: Housewife, dependent on [Husband's Name]", { x: ML + 32, y, size: 9, font, color: C.black });
  y -= 28;

  p5.drawText("4.2 The Client agrees to submit a copy of their CNIC and a blank crossed cheque of their bank account to AL&CO's", { x: ML, y, size: 9, font, color: C.black });
  y -= 14;
  p5.drawText("office address.", { x: ML, y, size: 9, font, color: C.black });
  y -= 30;

  // 5. Acceptance
  p5.drawText("5. Acceptance and Agreement:", { x: ML, y, size: 10, font: boldFont, color: C.black });
  y -= 20;

  const acceptText = "By signing below, the Client acknowledges that they have read, understood, and agreed to all the terms and conditions of this Contract. The Client also understands that the collection of personal information is necessary for administrative, financial, and compliance purposes.";
  y = drawWrapped(p5, acceptText, ML, y, TW, 9, font, C.black);
  y -= 60;

  // Client signature block
  p5.drawText("Client's Signature:", { x: ML, y, size: 9, font: boldFont, color: C.black });
  // Embed signature
  if (data.signatureData?.startsWith("data:image")) {
    try {
      const imgBytes = Uint8Array.from(atob(data.signatureData.split(",")[1]), c => c.charCodeAt(0));
      const img = await doc.embedPng(imgBytes);
      const dims = img.scaleToFit(130, 30);
      p5.drawImage(img, { x: ML + 2, y: y - 34, width: dims.width, height: dims.height });
    } catch (_) {
      p5.drawText(data.fullName || "", { x: ML + 2, y: y - 20, size: 9, font: italicFont, color: C.black });
    }
  } else if (data.signatureData) {
    p5.drawText(data.signatureData, { x: ML + 2, y: y - 20, size: 9, font: italicFont, color: C.black });
  }
  hLine(p5, ML, y - 3, 150);


  p5.drawText("Date:", { x: ML + 300, y, size: 9, font: boldFont, color: C.black });
  p5.drawText(fmtDate(data.signedAt), { x: ML + 335, y, size: 9, font, color: C.black })
  hLine(p5, ML + 298, y - 3, 180);
  y -= 70;

  // AL&CO signature block
  p5.drawText("Arslan Larik & Company", { x: ML, y, size: 9, font: boldFont, color: C.black });
  y -= 14;
  p5.drawText("*and anyone on Behalf of AL&CO", { x: ML, y, size: 9, font: boldFont, color: C.black });
  y -= 36;

  p5.drawText("Signature:", { x: ML, y, size: 9, font: boldFont, color: C.black });
  hLine(p5, ML + 52, y - 3, 120);
  y -= 36;

  p5.drawText("Bismillah Pervez CEO - AL&CO", { x: ML, y, size: 9, font, color: C.black });
  y -= 14;
  p5.drawText("D-86/1, Block 7, Gulshan-E-Iqbal,", { x: ML, y, size: 9, font, color: C.black });
  y -= 14;
  p5.drawText("Karachi, Sindh Pakistan", { x: ML, y, size: 9, font, color: C.black });

  return await doc.save();
}

// ─── Main Component ──────────────────────────────────────────
// mode: "standalone" (default, editable form + generate PDF, no save-to-server)
//       "preview"    (read-only signed badge, no editable fields)
//       "edit"       (editable form like standalone, PLUS a "Save Changes"
//                     button that calls onSubmit(form) so the parent can
//                     persist the updated contract details, e.g. before a
//                     lead is converted)
export default function ContractPDFGenerator({
  contractData,
  onGenerated = undefined,
  mode = "standalone",
  onSubmit = undefined,      // (updatedContractDetails) => void — called on Save Changes
  isSubmitting = false,      // shows a saving state on the Save Changes button
}) {
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", programName: "",
    fatherHusbandName: "", cnic: "", bankAccountNumber: "",
    currentAddress: "", emergencyContactName: "", occupation: "",
    participationAgreement: false, photoVideoRelease: false,
    signatureType: "draw", signatureData: "", signedAt: new Date().toISOString(),
    paymentPlan: null,
    ...contractData,
  });

  const [sigSaved, setSigSaved] = useState(!!contractData?.signatureData);
  const [sigLoadError, setSigLoadError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const pdfBytesRef = useRef(null);

  useEffect(() => {
    if (contractData) {
      setForm(f => ({ ...f, ...contractData }));
      setSigSaved(!!contractData.signatureData);
      setSigLoadError(false);
    }
  }, [contractData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const bytes = await generateContractPDF(form);
      pdfBytesRef.current = bytes;
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfReady(true);
      onGenerated && onGenerated(bytes);
    } catch (e) {
      alert("PDF generation failed: " + e.message);
    }
    setGenerating(false);
  };

  const handleDownload = () => {
    if (!pdfBytesRef.current) return;
    const blob = new Blob([pdfBytesRef.current], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ALCO_Contract_${(form.fullName || "Participant").replace(/\s+/g, "_")}.pdf`;
    a.click();
  };

  const handleSave = () => {
    if (!onSubmit) return;
    onSubmit(form);
  };

  const inp = (label, key, placeholder, full) => (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>{label}</label>
      <input
        value={form[key] || ""}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#111", outline: "none", boxSizing: "border-box" }}
      />
    </div>
  );

  // Read-only badge view only applies to "preview" mode.
  // "edit" mode falls through to the full editable form below (same as "standalone"),
  // just with an extra Save Changes action.
  const isPreviewMode = mode === "preview" && contractData;
  const isEditMode = mode === "edit";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "0 auto", padding: 20 }}>

      {!isPreviewMode && (
        <>
          <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Program Information</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {inp("Full Name", "fullName", "Enter full name")}
              {inp("Email", "email", "email@example.com")}
              {inp("Phone", "phone", "+92 300 0000000")}
              {inp("Program Name", "programName", "e.g. NLP Practitioner")}
            </div>
          </div>

          <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Personal Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {inp("Father / Husband Name", "fatherHusbandName", "Enter name")}
              {inp("CNIC Number", "cnic", "XXXXX-XXXXXXX-X")}
              {inp("Current Address", "currentAddress", "Full address", true)}
              {inp("Bank Account Number", "bankAccountNumber", "Account number")}
              {inp("Emergency Contact", "emergencyContactName", "Next of kin name")}
              {inp("Occupation / Company", "occupation", "e.g. Software Engineer at XYZ", true)}
            </div>
          </div>

          <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Agreements</p>
            {[
              ["participationAgreement", "Participation Agreement", "I agree to use this training for self-improvement and accept responsibility for my well-being."],
              ["photoVideoRelease", "Photo / Video Release", "I consent to be photographed/recorded during training without compensation."],
            ].map(([key, title, desc]) => (
              <div key={key} onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                style={{ border: `1px solid ${form[key] ? "#99f6e4" : "#f0f0f0"}`, background: form[key] ? "#f0fdf9" : "#fafafa", borderRadius: 12, padding: "12px 14px", marginBottom: 10, cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${form[key] ? "#0d9488" : "#d1d5db"}`, background: form[key] ? "#0d9488" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {form[key] && <span style={{ color: "white", fontSize: 12, fontWeight: 900 }}>✓</span>}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 2 }}>{title}</p>
                  <p style={{ fontSize: 12, color: "#6b7280" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Signature</p>
            <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 14 }}>
              {["draw", "type"].map(t => (
                <button key={t} type="button" onClick={() => { setForm(f => ({ ...f, signatureType: t, signatureData: "" })); setSigSaved(false); }}
                  style={{ padding: "6px 16px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: form.signatureType === t ? "white" : "transparent", color: form.signatureType === t ? "#111" : "#6b7280", boxShadow: form.signatureType === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                  {t === "draw" ? "✏️ Draw" : "⌨️ Type"}
                </button>
              ))}
            </div>
            {form.signatureType === "draw" ? (
              sigSaved && form.signatureData && !sigLoadError ? (
                <div>
                  <img
                    src={form.signatureData}
                    alt="Signature"
                    onError={() => setSigLoadError(true)}
                    style={{ width: "100%", height: 100, objectFit: "contain", border: "1px solid #99f6e4", borderRadius: 10, background: "#f9fafb" }}
                  />
                  <button type="button" onClick={() => { setForm(f => ({ ...f, signatureData: "" })); setSigSaved(false); setSigLoadError(false); }} style={{ ...btnSm, marginTop: 8 }}>↺ Redo</button>
                </div>
              ) : sigSaved && form.signatureData && sigLoadError ? (
                <div>
                  <div style={{ width: "100%", height: 100, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #fca5a5", borderRadius: 10, background: "#fef2f2", padding: 12, boxSizing: "border-box" }}>
                    <p style={{ fontSize: 11, color: "#b91c1c", textAlign: "center" }}>
                      ⚠️ Saved signature couldn't load — the stored data looks corrupted or truncated ({form.signatureData.length} chars). Please redraw.
                    </p>
                  </div>
                  <button type="button" onClick={() => { setForm(f => ({ ...f, signatureData: "" })); setSigSaved(false); setSigLoadError(false); }} style={{ ...btnSm, marginTop: 8 }}>↺ Redraw Signature</button>
                </div>
              ) : (
                <SignatureCanvas onSave={d => { setForm(f => ({ ...f, signatureData: d })); setSigSaved(true); setSigLoadError(false); }} />
              )
            ) : (
              <input value={form.signatureData} onChange={e => setForm(f => ({ ...f, signatureData: e.target.value }))}
                placeholder="Type your full name as signature"
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 20, fontFamily: "Georgia, serif", color: "#111", boxSizing: "border-box" }} />
            )}
          </div> */}
        </>
      )}

      {isPreviewMode && (
        <div style={{ background: "#f0fdf9", border: "1px solid #99f6e4", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#0d9488" }}>Contract Signed</p>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Signed by <strong>{form.fullName}</strong> on {new Date(form.signedAt || Date.now()).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
      )}

      {/* ── Save Changes (edit mode only) ── */}
      {isEditMode && onSubmit && (
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          style={{
            width: "100%", padding: "13px 0", borderRadius: 14,
            background: isSubmitting ? "#e5e7eb" : "#0d9488",
            border: "none", color: isSubmitting ? "#9ca3af" : "white",
            fontWeight: 800, fontSize: 14,
            cursor: isSubmitting ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            marginBottom: 10,
          }}
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      )}

      {!pdfReady ? (
        <button onClick={handleGenerate} disabled={generating}
          style={{ width: "100%", padding: "13px 0", borderRadius: 14, background: generating ? "#e5e7eb" : "#f59e0b", border: "none", color: generating ? "#9ca3af" : "#111", fontWeight: 800, fontSize: 14, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {generating ? "Generating PDF..." : "Generate Contract PDF"}
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "#f0fdf9", border: "1px solid #6ee7b7", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>PDF Ready!</span>
            <div style={{ display: "flex", gap: 8 }}>
              <a href={pdfUrl} target="_blank" rel="noreferrer"
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #6ee7b7", background: "white", color: "#065f46", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                Preview
              </a>
              <button onClick={handleDownload}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#0d9488", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Download
              </button>
            </div>
          </div>
          <button onClick={() => { setPdfReady(false); setPdfUrl(null); }}
            style={{ ...btnSm, justifyContent: "center", width: "100%" }}>
            ↺ Regenerate
          </button>
        </div>
      )}

      <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 12 }}>
        PDF is generated locally in your browser — no data is sent to any server.
      </p>
    </div>
  );
}