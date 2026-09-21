import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── shared colors (same palette as DownloadInvoice) ──────────────
const NAVY: [number, number, number] = [22, 33, 62];
const GOLD: [number, number, number] = [200, 168, 75];
const TEXT_DARK: [number, number, number] = [15, 17, 23];
const TEXT_GRAY: [number, number, number] = [74, 80, 96];
const TEXT_MUTED: [number, number, number] = [138, 146, 166];
const LINE: [number, number, number] = [221, 226, 236];
const PANEL: [number, number, number] = [244, 246, 251];
const GREEN: [number, number, number] = [22, 163, 74];
const GREEN_BG: [number, number, number] = [220, 252, 231];
const BLUE: [number, number, number] = [37, 99, 235];

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

/**
 * Client-side receipt PDF — same jsPDF pattern as DownloadInvoice.
 * @param invoice   full invoice object
 * @param user      student/user object
 * @param installments  the PAID installment(s) this receipt is for
 *                      (single selected one, or all paid ones)
 */
export default function DownloadReceipt(invoice: any, user: any, installments: any[]) {
    const fmtDate = (d: string) =>
        d ? new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "—";

    const fmtAmt = (n: number) => `Rs ${(n || 0).toLocaleString()}`;

    const invoiceNo = invoice.invoiceNumber || invoice._id?.slice(-6).toUpperCase();
    const receiptTotal = installments.reduce((sum, i) => sum + Number(i.paidAmount ?? i.amount ?? 0), 0);

    const doc = new jsPDF({ unit: "mm", format: "a4" });

    // ── HEADER ────────────────────────────────────────────────
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, PAGE_W, 34, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("ARSLAN LARIK & COMPANY", MARGIN, 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(180, 190, 205);
    doc.text("D86/1, Block 7, Gulshan-e-Iqbal, Karachi, Sindh PK", MARGIN, 19);
    doc.text("connect@arslanlarik.com  |  1+8886814808", MARGIN, 23.5);
    doc.text("https://arslanlarik.com/  |  NTN: 2826497-5", MARGIN, 28);

    doc.setFontSize(8);
    doc.setTextColor(180, 190, 205);
    doc.text("RECEIPT FOR INVOICE", PAGE_W - MARGIN, 11, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(String(invoiceNo), PAGE_W - MARGIN, 18, { align: "right" });

    const statusLabel = "PAYMENT RECEIVED";
    doc.setFontSize(8);
    const badgeW = doc.getTextWidth(statusLabel) + 8;
    doc.setFillColor(...GREEN_BG);
    doc.roundedRect(PAGE_W - MARGIN - badgeW, 21, badgeW, 6, 2, 2, "F");
    doc.setTextColor(...GREEN);
    doc.setFont("helvetica", "bold");
    doc.text(statusLabel, PAGE_W - MARGIN - badgeW / 2, 25, { align: "center" });

    doc.setFillColor(...GOLD);
    doc.rect(0, 34, PAGE_W, 1, "F");

    // ── META ROW ──────────────────────────────────────────────
    let y = 42;
    const metaCols = [
        { label: "RECEIPT DATE", value: fmtDate(new Date().toISOString()) },
        { label: "AMOUNT RECEIVED", value: fmtAmt(receiptTotal) },
    ];
    const colW = CONTENT_W / 2;
    metaCols.forEach((c, i) => {
        const x = MARGIN + i * colW;
        doc.setFontSize(7);
        doc.setTextColor(...TEXT_MUTED);
        doc.setFont("helvetica", "bold");
        doc.text(c.label, x, y);
        doc.setFontSize(9);
        doc.setTextColor(i === 1 ? GREEN[0] : TEXT_DARK[0], i === 1 ? GREEN[1] : TEXT_DARK[1], i === 1 ? GREEN[2] : TEXT_DARK[2]);
        doc.text(String(c.value), x, y + 5);
        if (i === 0) {
            doc.setDrawColor(...LINE);
            doc.line(x + colW - 3, y - 4, x + colW - 3, y + 7);
        }
    });
    y += 12;
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 8;

    // ── PARTIES (Received From / Issued By) ──────────────────
    const boxW = (CONTENT_W - 4) / 2;
    const boxH = 26;
    const drawBox = (x: number, title: string, lines: string[]) => {
        doc.setFillColor(...PANEL);
        doc.setDrawColor(...LINE);
        doc.roundedRect(x, y, boxW, boxH, 2, 2, "FD");
        doc.setFillColor(...GOLD);
        doc.rect(x + 5, y + 6, 4, 0.6, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...TEXT_MUTED);
        doc.text(title.toUpperCase(), x + 10, y + 7);
        let ly = y + 13;
        doc.setFontSize(9);
        lines.forEach((line, idx) => {
            doc.setFont("helvetica", idx === 0 ? "bold" : "normal");
            doc.setTextColor(...(idx === 0 ? TEXT_DARK : TEXT_GRAY));
            doc.text(line, x + 5, ly);
            ly += 4.5;
        });
    };

    drawBox(MARGIN, "Received From", [
        user?.name || invoice.user?.name || "—",
        user?.email || invoice.user?.email || "—",
        user?.phone || invoice.user?.phone || "—",
    ].filter(Boolean));

    drawBox(MARGIN + boxW + 4, "Issued By", [
        "ALCO — Finance Dept.",
        "finance@arslanlarik.com",
    ]);

    y += boxH + 8;

    // ── PAYMENT DETAILS TABLE ─────────────────────────────────
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`PAYMENT DETAILS  (${installments.length} item${installments.length !== 1 ? "s" : ""})`, MARGIN, y);
    y += 4;

    const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

    const rows = installments.map((inst: any, idx: number) => [
        inst.isAdvance ? "Advance Payment" : inst.label || `Installment ${idx + 1}`,
        capitalize(inst.method),
        inst.referenceNumber || "—",
        fmtDate(inst.paidAt || inst.dueDate),
        fmtAmt(inst.paidAmount ?? inst.amount),
    ]);

    autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [["Description", "Method", "Reference #", "Date", "Amount"]],
        body: rows,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2.5, textColor: TEXT_DARK, lineColor: LINE, lineWidth: 0.1 },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
        columnStyles: {
            0: { cellWidth: "auto" },
            1: { cellWidth: 26 },
            2: { cellWidth: 34 },
            3: { cellWidth: 28 },
            4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
        },
    });

    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── TOTALS ────────────────────────────────────────────────
    const totalsW = 80;
    const totalsX = PAGE_W - MARGIN - totalsW;
    const grossAmount = invoice.totalAmount || 0;
    const discountAmount = invoice.discountAmount || 0;
    const netAmount = Math.max(0, grossAmount - discountAmount);

    const totalsBody: any[] = [["Invoice Total (Gross)", fmtAmt(grossAmount)]];
    if (discountAmount > 0) {
        totalsBody.push(["Discount", `- ${fmtAmt(discountAmount)}`]);
        totalsBody.push(["Net Total", fmtAmt(netAmount)]);
    }
    totalsBody.push(["Total Paid To Date", fmtAmt(invoice.paidAmount)]);
    totalsBody.push(["Remaining Balance", fmtAmt(invoice.remainingAmount)]);
    totalsBody.push(["Received This Receipt", fmtAmt(receiptTotal)]);

    const paidRowIdx = totalsBody.findIndex((r) => r[0] === "Total Paid To Date");
    const remainingRowIdx = totalsBody.findIndex((r) => r[0] === "Remaining Balance");
    const discountRowIdx = totalsBody.findIndex((r) => r[0] === "Discount");
    const netRowIdx = totalsBody.findIndex((r) => r[0] === "Net Total");
    const grandRowIdx = totalsBody.length - 1;

    autoTable(doc, {
        startY: y,
        margin: { left: totalsX },
        tableWidth: totalsW,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: LINE, lineWidth: 0.1 },
        body: totalsBody,
        columnStyles: { 0: { cellWidth: 46, textColor: TEXT_GRAY }, 1: { cellWidth: 34, halign: "right", fontStyle: "bold", textColor: TEXT_DARK } },
        didParseCell: (data) => {
            if (data.row.index === paidRowIdx && data.column.index === 1) data.cell.styles.textColor = GREEN;
            if (data.row.index === remainingRowIdx && data.column.index === 1) data.cell.styles.textColor = [220, 38, 38];
            if (data.row.index === discountRowIdx && data.column.index === 1) data.cell.styles.textColor = BLUE;
            if (data.row.index === netRowIdx) {
                data.cell.styles.fillColor = PANEL;
                data.cell.styles.fontStyle = "bold";
            }
            if (data.row.index === grandRowIdx) {
                data.cell.styles.fillColor = NAVY;
                data.cell.styles.textColor = 255;
                data.cell.styles.fontStyle = "bold";
            }
        },
    });

    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── NOTES ─────────────────────────────────────────────────
    const notes = [
        "This is a system-generated receipt acknowledging payment received and requires no signature.",
        "All payments remitted are deemed final and non-refundable upon receipt.",
        "Please retain this receipt for your records.",
    ];
    const notesLineH = 4.2;
    const notesH = 10 + notes.length * notesLineH;
    if (y + notesH > 280) { doc.addPage(); y = 16; }

    doc.setFillColor(...PANEL);
    doc.setDrawColor(...LINE);
    doc.roundedRect(MARGIN, y, CONTENT_W, notesH, 2, 2, "FD");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_MUTED);
    doc.text("NOTES", MARGIN + 5, y + 6);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_GRAY);
    let ny = y + 11;
    notes.forEach((n) => {
        const wrapped = doc.splitTextToSize(`•  ${n}`, CONTENT_W - 12);
        doc.text(wrapped, MARGIN + 7, ny);
        ny += wrapped.length * notesLineH;
    });
    y = ny + 6;

    // ── FOOTER ────────────────────────────────────────────────
    if (y + 40 > 290) { doc.addPage(); y = 16; }
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_GRAY);
    doc.text("Payment Methods Accepted", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    const bankLines = [
        "Cash | Bank Transfer | Cheque",
        "HBL Bank",
        "Account Title: ARSLAN LARIK & Company",
        "Account Number: 19107901888203",
        "IBAN: PK94HABB0019107901888203",
        "Branch: Korangi Road, DHA Phase II",
    ];
    const footerStartY = y - 5;
    bankLines.forEach((l) => { doc.text(l, MARGIN, y); y += 4; });

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 58, 92);
    doc.text("ALCO", PAGE_W - MARGIN, footerStartY, { align: "right" });
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.text("This is a system-generated receipt.", PAGE_W - MARGIN, footerStartY + 5, { align: "right" });
    doc.text("No signature required.", PAGE_W - MARGIN, footerStartY + 9, { align: "right" });

    doc.save(`Receipt-${invoiceNo}.pdf`);
}