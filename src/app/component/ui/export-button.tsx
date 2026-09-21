// components/ui/ExportButton.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Loader2, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportButtonProps {
  filename: string; // e.g. "invoices", "expenses"
  fetchData: () => Promise<any[]>; // function jo data fetch kare
  columns: {
    header: string; // Column heading
    key: string; // dot notation supported e.g. "user.name"
    format?: (val: any) => string; // optional formatter
  }[];
  label?: string;
  title?: string; // PDF ka heading (default: filename)
}

// Dot notation support: getNestedValue(obj, "user.name")
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

export default function ExportButton({
  filename,
  fetchData,
  columns,
  label = "Export",
  title,
}: ExportButtonProps) {
  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Outside click par dropdown band ho jaye
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buildRows = (data: any[]) =>
    data.map((item) => {
      const row: Record<string, any> = {};
      columns.forEach((col) => {
        const raw = getNestedValue(item, col.key);
        row[col.header] = col.format ? col.format(raw) : raw ?? "—";
      });
      return row;
    });

  function safeSheetName(name: string): string {
    // Excel forbids these characters in sheet names: \ / ? * [ ]
    const cleaned = name.replace(/[\\/?*[\]]/g, "");
    // Excel sheet names cannot exceed 31 characters
    return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned || "Sheet1";
  }

  const handleExcelExport = async () => {
    try {
      setLoading("excel");
      setIsOpen(false);

      const data = await fetchData();
      if (!data || data.length === 0) {
        alert("No data to export");
        return;
      }

      const rows = buildRows(data);
      const ws = XLSX.utils.json_to_sheet(rows);

      ws["!cols"] = columns.map((col) => ({
        wch: Math.max(col.header.length + 4, 16),
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(filename));

      const date = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `${filename}-${date}.xlsx`);
    } catch (err: any) {
      console.error("Export error:", err);
      alert(`Export failed: ${err?.message || err}`);
    } finally {
      setLoading(null);
    }
  };

  const handlePdfExport = async () => {
    try {
      setLoading("pdf");
      setIsOpen(false);

      const data = await fetchData();
      if (!data || data.length === 0) {
        alert("No data to export");
        return;
      }

      const rows = buildRows(data);
      const doc = new jsPDF({
        orientation: columns.length > 6 ? "landscape" : "portrait",
        unit: "pt",
      });

      // Heading
      doc.setFontSize(14);
      doc.text(title || filename, 40, 40);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Generated on ${new Date().toLocaleDateString("en-PK")}`, 40, 56);

      autoTable(doc, {
        startY: 70,
        head: [columns.map((c) => c.header)],
        body: rows.map((row) => columns.map((c) => String(row[c.header] ?? "—"))),
        styles: { fontSize: 8, cellPadding: 5 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255 }, // gray-800
        alternateRowStyles: { fillColor: [249, 250, 251] }, // gray-50
        margin: { left: 40, right: 40 },
      });

      const date = new Date().toISOString().split("T")[0];
      doc.save(`${filename}-${date}.pdf`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed");
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-600 text-gray-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-60 shadow-sm"
        title="Export options"
      >
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Download size={14} />
        )}
        {label}
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white border border-gray-100 rounded-lg shadow-lg py-1 z-20">
          <button
            onClick={handleExcelExport}
            disabled={isLoading}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-teal-700 transition-colors disabled:opacity-60"
          >
            {loading === "excel" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={14} className="text-teal-600" />
            )}
            Export as Excel
          </button>
          <button
            onClick={handlePdfExport}
            disabled={isLoading}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-rose-700 transition-colors disabled:opacity-60"
          >
            {loading === "pdf" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileText size={14} className="text-rose-600" />
            )}
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}