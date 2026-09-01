"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllInvoices, updateInvoice, sendInvoiceEmail,
  sendReceivingInvoiceEmail, sendReceivingReportEmail
} from "@/utils/api";
import PageHeader from "@/app/component/dashboard/page-header";
import DateRangeFilter from "@/app/component/dashboard/date-range-filter";
import ExportButton from "@/app/component/ui/export-button";
import DynamicTable from "@/app/component/dashboard/dynamic-table";
import { Send, Pencil, Eye, FileText, FileSpreadsheet, Download } from "lucide-react";
import toast from "react-hot-toast";
import EmailAdminDropdown from "@/app/component/ui/email-admin-dropdown";
import DownloadInvoice from "@/app/dashboard/payments/component/download-invoice";
import DownloadReceipt  from "@/app/dashboard/payments/component/download-receipt";

// ── Helpers for bundle / installment-notes display ────────────────
const getProgramNames = (inv: any): string[] => {
  if (inv?.isBundle && Array.isArray(inv?.items) && inv.items.length > 0) {
    return inv.items.map((it: any) => it.programName || it.program?.name || "—");
  }
  return [inv?.enrollment?.program?.name || "—"];
};

const statusColor = (status: string) => {
  const map: Record<string, string> = {
    PAID: "bg-green-100 text-green-700", PARTIAL: "bg-yellow-100 text-yellow-700",
    PENDING: "bg-sky-100 text-sky-700", OVERDUE: "bg-rose-100 text-rose-700",
    BLOCKED: "bg-gray-100 text-gray-600", EXTENDED: "bg-indigo-100 text-indigo-700",
    WARNING: "bg-orange-100 text-orange-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
};

const fmt = (n: number) => `Rs ${(n || 0).toLocaleString()}`;
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ── View Modal ───────────────────────────────────────────────────
export function InvoiceViewModal({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold text-gray-800">{invoice.invoiceNumber}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{invoice.user?.name} — {invoice.user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => DownloadInvoice(invoice, invoice.user)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download size={13} />
              Download Invoice
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Total</p><p className="font-bold text-gray-800">{fmt(invoice.totalAmount)}</p></div>
            <div className="bg-green-50 rounded-xl p-3"><p className="text-xs text-gray-400">Paid</p><p className="font-bold text-green-700">{fmt(invoice.paidAmount)}</p></div>
            <div className="bg-rose-50 rounded-xl p-3"><p className="text-xs text-gray-400">Remaining</p><p className="font-bold text-rose-600">{fmt(invoice.remainingAmount)}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {/* <div><span className="text-gray-400">Program: </span><span className="text-gray-700">{invoice.enrollment?.program?.name || "—"}</span></div>
            <div><span className="text-gray-400">Batch: </span><span className="text-gray-700">{invoice.enrollment?.batch?.name || "—"}</span></div> */}
            <div>
              <span className="text-gray-400">Program(s): </span>

              <div className="mt-1 space-y-1">
                {getProgramNames(invoice).map((program, index) => (
                  <div
                    key={index}
                    className="inline-flex mr-2 mb-1 px-2 py-1 rounded-lg bg-sky-50 text-sky-700 text-xs font-medium"
                  >
                    {program}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-gray-400">Batch: </span>

              <div className="mt-1 space-y-1">
                {invoice.isBundle ? (
                  invoice.items.map((item: any) => (
                    <div
                      key={item._id}
                      className="inline-flex mr-2 mb-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium"
                    >
                      {item.enrollment?.batch?.name || "—"}
                    </div>
                  ))
                ) : (
                  <span className="inline-flex mr-2 mb-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium">
                    {invoice.enrollment?.batch?.name || "—"}
                  </span>
                )}
              </div>
            </div>
            <div><span className="text-gray-400">Due Date: </span><span className="text-gray-700">{fmtDate(invoice.dueDate)}</span></div>
            <div>
              <span className="text-gray-400">Status: </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(invoice.status)}`}>{invoice.status}</span>
            </div>
            <div><span className="text-gray-400">Issue Date: </span><span className="text-gray-700">{fmtDate(invoice.issueDate)}</span></div>
          </div>
          {invoice.description && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Memo</p>
              <p className="text-sm text-gray-700 font-mono">{invoice.description}</p>
            </div>
          )}
          {invoice.installments?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Installments</p>
              <div className="space-y-2">
                {invoice.installments.map((inst: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{inst.isAdvance ? "Advance Payment" : inst.label || `Installment ${i + 1}`}</p>
                      <p className="text-xs text-gray-400">{fmtDate(inst.dueDate)}</p>
                      {inst.method && <p className="text-xs text-gray-400 capitalize">Method: {inst.method}</p>}
                      {inst.referenceNumber && <p className="text-xs font-mono text-gray-400">Ref: {inst.referenceNumber}</p>}
                      {/* {(inst.description || inst.notes) && ( */}
                      <p className="text-xs text-gray-500 mt-1">
                        {inst.description || inst.notes}
                      </p>
                      {/* )} */}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">{fmt(inst.amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inst.status === "PAID" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{inst.status}</span>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit Memo Modal ──────────────────────────────────────────────
function EditMemoModal({ invoice, onClose, onSave, isSaving }: {
  invoice: any; onClose: () => void; onSave: (id: string, memo: string) => void; isSaving: boolean;
}) {
  const [memo, setMemo] = useState(invoice?.description || "");
  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-800">Edit Memo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-400">{invoice.invoiceNumber} — {invoice.user?.name}</p>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={4}
            placeholder="Funds Transfer SM11103257A416C0..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            <button onClick={() => onSave(invoice._id, memo)} disabled={isSaving}
              className="px-4 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium disabled:opacity-50">
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Send Receipt Modal ───────────────────────────────────────────
function SendReceiptModal({ invoice, onClose, onSend, isSending }: {
  invoice: any; onClose: () => void; onSend: (body: any) => void; isSending: boolean;
}) {
  const [mode, setMode] = useState<"single" | "all">("single");
  const [selectedInstallmentId, setSelectedInstallmentId] = useState("");
  if (!invoice) return null;

  const paidInstallments = invoice.installments?.filter((inst: any) => inst.status === "PAID") || [];
  const selectedInst = paidInstallments.find((i: any) => i._id === selectedInstallmentId);

  const handleSubmit = () => {
    if (mode === "single" && !selectedInstallmentId) { toast.error("Installment select karo"); return; }
    onSend({ sendAll: mode === "all", installmentId: mode === "single" ? selectedInstallmentId : undefined });
  };

const handleDownloadReceipt = () => {
  if (mode === "single" && !selectedInstallmentId) {
    toast.error("Please select a paid installment");
    return;
  }

  if (paidInstallments.length === 0) {
    toast.error("No paid installment available");
    return;
  }

  const installmentsToInclude =
    mode === "single"
      ? paidInstallments.filter((i: any) => i._id === selectedInstallmentId)
      : paidInstallments;

  try {
    DownloadReceipt(invoice, invoice.user, installmentsToInclude);
    toast.success("Receipt downloaded successfully ✅");
  } catch (err: any) {
    toast.error(err?.message || "Receipt download failed ❌");
  }
};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold text-gray-800">Receipt</h2>
            <p className="text-xs text-gray-400 mt-0.5">{invoice.invoiceNumber} — {invoice.user?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            {["single", "all"].map((m) => (
              <button key={m} onClick={() => setMode(m as any)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${mode === m ? "bg-yellow-500 text-white border-yellow-500" : "bg-white text-gray-500 border-gray-200"}`}>
                {m === "single" ? "Single Installment" : "All Paid"}
              </button>
            ))}
          </div>
          {mode === "single" && (
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-widest mb-1.5 block">Installment Select Karo</label>
              {paidInstallments.length === 0
                ? <p className="text-sm text-rose-500">Koi paid installment nahi hai</p>
                : <select value={selectedInstallmentId} onChange={(e) => setSelectedInstallmentId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  <option value="">-- Select --</option>
                  {paidInstallments.map((inst: any) => (
                    <option key={inst._id} value={inst._id}>{inst.isAdvance ? "Advance Payment" : inst.label} — {fmt(inst.amount)}</option>
                  ))}
                </select>
              }
              {selectedInst && (
                <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Amount</span><span className="font-semibold text-gray-400">{fmt(selectedInst.amount)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Due Date</span><span className="text-gray-400">{fmtDate(selectedInst.dueDate)}</span></div>
                  {selectedInst.method && <div className="flex justify-between text-sm"><span className="text-gray-400">Method</span><span className="capitalize text-gray-400">{selectedInst.method}</span></div>}
                  {selectedInst.referenceNumber && <div className="flex justify-between text-sm"><span className="text-gray-400">Reference</span><span className="font-mono text-gray-400">{selectedInst.referenceNumber}</span></div>}
                </div>
              )}
            </div>
          )}
          {mode === "all" && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-yellow-800">{paidInstallments.length} paid installment(s) ki receipt jaayegi</p>
              {paidInstallments.map((inst: any, i: number) => (
                <div key={i} className="flex justify-between text-sm border-t border-yellow-100 pt-2">
                  <span className="text-yellow-700">{inst.isAdvance ? "Advance Payment" : inst.label}</span>
                  <span className="font-semibold text-yellow-800">{fmt(inst.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm border-t border-yellow-200 pt-2 font-bold">
                <span className="text-yellow-800">Total</span>
                <span className="text-yellow-900">{fmt(paidInstallments.reduce((s: number, i: any) => s + (i.amount || 0), 0))}</span>
              </div>
            </div>
          )}
          {/* {invoice.description && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Memo</p>
              <p className="text-xs font-mono text-gray-600">{invoice.description}</p>
            </div>
          )} */}
          <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-500">Balance Due</span>
            <span className="font-bold text-rose-600">{fmt(invoice.remainingAmount)}</span>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            <button
              type="button"
              onClick={handleDownloadReceipt}
              disabled={
                mode === "single" && !selectedInstallmentId
              }
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={15} />
              Download
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                isSending ||
                (mode === "single" && !selectedInstallmentId)
              }
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium disabled:opacity-50"
            >
              <Send size={15} />
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function InvoiceReceivingList() {
  const queryClient = useQueryClient();
  const [viewInvoice, setViewInvoice] = useState<any>(null);
  const [editMemoInvoice, setEditMemoInvoice] = useState<any>(null);
  const [sendReceiptInvoice, setSendReceiptInvoice] = useState<any>(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    search: "", status: "", dateFrom: "", dateTo: "", page: "1", limit: "10",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invoices-receiving", filters],
    queryFn: () =>
      getAllInvoices({ ...filters, page: Number(filters.page), limit: Number(filters.limit) })
        .then((r) => r.data),
  });

  const invoiceList = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const currentPage = data?.meta?.page ?? 1;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const toggleSelectAll = () =>
    setSelectedIds((prev) =>
      prev.length === invoiceList.length ? [] : invoiceList.map((inv: any) => inv._id)
    );

  const { mutate: saveMemo, isPending: isSaving } = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      updateInvoice(id, { description }),
    onSuccess: () => {
      toast.success("Memo saved!");
      setEditMemoInvoice(null);
      queryClient.invalidateQueries({ queryKey: ["invoices-receiving"] });
    },
    onError: () => toast.error("Failed to save memo!"),
  });

  const handleSendInvoice = async (invoiceId: string) => {
    setIsSendingInvoice(true);
    try { await sendInvoiceEmail(invoiceId); toast.success("Invoice email bhej diya gaya ✅"); }
    catch { toast.error("Email send nahi hui ❌"); }
    finally { setIsSendingInvoice(false); }
  };

  const handleSendReceipt = async (invoiceId: string, body: any) => {
    setIsSendingReceipt(true);
    try {
      await sendReceivingInvoiceEmail(invoiceId, body);
      toast.success("Receipt bhej diya gaya ✅");
      setSendReceiptInvoice(null);
    } catch { toast.error("Receipt send nahi hui ❌"); }
    finally { setIsSendingReceipt(false); }
  };

  const columns = [
    {
      key: "invoiceNumber", label: "Invoice #",
      render: (inv: any) => (
        <div className="font-medium text-sm text-gray-800 flex h-full pt-1"><div>{inv.invoiceNumber}</div></div>
      ),
    },
    {
      key: "user", label: "Student",
      render: (inv: any) => (
        <div>
          <p className="font-medium text-sm text-gray-800">{inv.user?.name || "—"}</p>
          <p className="text-xs text-gray-400">{inv.user?.email}</p>
        </div>
      ),
    },
    {
      // ── Program(s) — bundle invoices show every program bundled ──
      key: "program", label: "Program",
      render: (inv: any) => {
        const names = getProgramNames(inv);
        if (names.length <= 1) {
          return <span className="text-sm text-gray-600">{names[0] || "—"}</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            {names.map((name, i) => (
              <span
                key={i}
                className="text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-100 rounded-md px-1.5 py-0.5 w-fit"
              >
                {name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "totalAmount", label: "Total",
      render: (inv: any) => <span className="font-semibold text-sm">Rs {(inv.totalAmount || 0).toLocaleString()}</span>,
    },
    {
      key: "remainingAmount", label: "Remaining",
      render: (inv: any) => (
        <span className={`font-medium text-sm ${(inv.remainingAmount || 0) > 0 ? "text-rose-500" : "text-green-600"}`}>
          Rs {(inv.remainingAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "status", label: "Status",
      render: (inv: any) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(inv.status)}`}>{inv.status}</span>
      ),
    },
    //   {
    //     key: "description", label: "Description",
    //     render: (inv: any) => inv.description
    //       ? <span className="text-xs text-gray-500 font-mono truncate max-w-[180px] block">{inv.description}</span>
    //       : <span className="text-xs text-gray-300 italic">No Description</span>,
    //   },
  ];

  const actions = [
    { icon: <Eye size={14} />, label: "View Invoice", onClick: (inv: any) => setViewInvoice(inv), className: "hover:bg-sky-50 hover:text-sky-600" },
    // { icon: <Pencil size={14} />, label: "Edit Memo", onClick: (inv: any) => setEditMemoInvoice(inv), className: "hover:bg-yellow-50 hover:text-yellow-600" },
    { icon: <Send size={14} />, label: "Send Invoice", onClick: (inv: any) => handleSendInvoice(inv._id), className: "hover:bg-blue-50 hover:text-blue-600", disabled: () => isSendingInvoice },
    { icon: <FileText size={14} />, label: "Send Receipt", onClick: (inv: any) => setSendReceiptInvoice(inv), className: "hover:bg-green-50 hover:text-green-600" },
  ];

  return (
    <>
      <PageHeader
        title="Payment Receiving"
        subtitle="Manage invoice receipts and memos"
        titleIcon={<FileSpreadsheet size={24} />}
        totalCount={data?.meta?.total || invoiceList.length}
        filters={filters}
        setFilters={setFilters}
        filterFields={[
          { type: "input", name: "search", placeholder: "Search student name, email..." },
          {
            type: "select", name: "status",
            options: [
              { label: "Pending", value: "PENDING" },
              { label: "Partial", value: "PARTIAL" },
              { label: "Paid", value: "PAID" },
              { label: "Overdue", value: "OVERDUE" },
            ],
          },
        ]}
        exportBtn={
          <div className="flex items-center gap-2">
            <DateRangeFilter
              from={filters.dateFrom}
              to={filters.dateTo}
              onChange={(from, to) => setFilters((f) => ({ ...f, dateFrom: from, dateTo: to, page: "1" }))}
            />
            <ExportButton
              filename="receiving-invoices"
              label="Download Excel"
              fetchData={async () => {
                const res = await getAllInvoices({ ...filters, limit: 10000 });
                return res.data.data;
              }}
              columns={[
                { header: "Invoice #", key: "invoiceNumber" },
                { header: "Student", key: "user.name" },
                { header: "Email", key: "user.email" },
                { header: "Program", key: "enrollment.program.name" },
                { header: "Total (Rs)", key: "totalAmount", format: (v) => Number(v || 0).toLocaleString() },
                { header: "Paid (Rs)", key: "paidAmount", format: (v) => Number(v || 0).toLocaleString() },
                { header: "Remaining (Rs)", key: "remainingAmount", format: (v) => Number(v || 0).toLocaleString() },
                { header: "Status", key: "status" },
                { header: "Description", key: "description" },
              ]}
            />
            <EmailAdminDropdown
              filters={filters}
              selectedIds={selectedIds}
              onEmailSend={(body) => sendReceivingReportEmail(body)}
            />
          </div>
        }
      />

      <DynamicTable
        data={invoiceList}
        isLoading={isLoading}
        isError={isError}
        columns={columns}
        actions={actions}
        currentPage={currentPage}
        pageSize={Number(filters.limit)}
        totalPages={totalPages}
        onPageChange={(page) => setFilters((f) => ({ ...f, page: String(page) }))}
        selectedIds={selectedIds}
        onSelectAll={toggleSelectAll}
        onToggleSelect={toggleSelect}
      />

      <InvoiceViewModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
      <EditMemoModal invoice={editMemoInvoice} onClose={() => setEditMemoInvoice(null)}
        onSave={(id, description) => saveMemo({ id, description })} isSaving={isSaving} />
      <SendReceiptModal invoice={sendReceiptInvoice} onClose={() => setSendReceiptInvoice(null)}
        onSend={(body) => sendReceiptInvoice && handleSendReceipt(sendReceiptInvoice._id, body)}
        isSending={isSendingReceipt} />
    </>
  );
}