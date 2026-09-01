"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAppSelector } from "@/store/hooks";
import ProtectedRoute from "@/app/component/protected-route";
import PageHeader from "@/app/component/dashboard/page-header";
import {
  CreditCard, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
  Download, FileText, Loader2, Mail, Receipt as ReceiptIcon,
} from "lucide-react";
import { useState } from "react";
import {
  getMe, getMyInvoices,
  sendInvoiceEmail as sendInvoiceEmailApi,
  sendReceivingInvoiceEmail as sendReceivingInvoiceEmailApi,
} from "@/utils/api";
import DownloadInvoice from "./component/download-invoice";
import DocumentsGalleryModal from "../profile/component/documents-gallery-modal";
import DocumentsSection from "../profile/component/documents-section";
import ExportButton from "@/app/component/ui/export-button";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import DownloadReceipt from "./component/download-receipt";

// ── Helpers ───────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PAID: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle },
  PARTIAL: { label: "Partial", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  PENDING: { label: "Pending", color: "bg-sky-100 text-sky-700", icon: Clock },
  OVERDUE: { label: "Overdue", color: "bg-rose-100 text-rose-700", icon: AlertCircle },
  EXTENDED: { label: "Extended", color: "bg-indigo-100 text-indigo-700", icon: Clock },
  BLOCKED: { label: "Blocked", color: "bg-gray-100 text-gray-600", icon: AlertCircle },
};

const installmentStatus: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-sky-100 text-sky-700",
  OVERDUE: "bg-rose-100 text-rose-700",
};

function fmt(n: number) {
  return `Rs ${(n || 0).toLocaleString()}`;
}

function daysLeft(date: string) {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: `${Math.abs(diff)} days overdue`, overdue: true };
  if (diff === 0) return { text: "Due today", overdue: true };
  return { text: `${diff} days left`, overdue: false };
}

// ── Invoice Card ──────────────────────────────────────────────
function InvoiceCard({ invoice }: { invoice: any }) {
  const [open, setOpen] = useState(false);
  const [sendingInstallment, setSendingInstallment] = useState<string | null>(null);

  console.log(invoice, "invoice ================>");

  const user = invoice.user || {};
  const contractDetails = invoice.enrollment?.leadSnapshot?.contractDetails || {};

  const userForInvoice = {
    name: user.name || contractDetails.fullName,
    email: user.email || contractDetails.email,
    phone: user.phone || contractDetails.phone,
    cnic: contractDetails.cnic,
    address: contractDetails.currentAddress,
  };

  // NAYA:
  const cfg = statusConfig[invoice.status] || statusConfig.PENDING;
  const Icon = cfg.icon;
  const paid = invoice.paidAmount || 0;
  const gross = invoice.totalAmount || 0;
  const discount = invoice.discountAmount || 0;
  const net = gross - discount;
  const pct = net > 0 ? Math.round((paid / net) * 100) : 0;

  // ── Overdue sirf UNPAID installments se calculate karo ─────
  const unpaidInstallments = (invoice.installments || []).filter((i: any) => i.status !== "PAID");
  const nextUnpaid = [...unpaidInstallments].sort(
    (a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )[0];

  const allInstallmentsPaid =
    (invoice.installments?.length ?? 0) > 0 && unpaidInstallments.length === 0;

  // Sab paid hain → sabse latest paidAt date dikhao
  const lastPaidAt = allInstallmentsPaid
    ? invoice.installments.reduce((latest: string | null, i: any) => {
      if (!i.paidAt) return latest;
      if (!latest || new Date(i.paidAt) > new Date(latest)) return i.paidAt;
      return latest;
    }, null)
    : null;

  const due = nextUnpaid?.dueDate ? daysLeft(nextUnpaid.dueDate) : null;

  // ── Email invoice to self ──────────────────────────────────
  const { mutate: emailInvoice, isPending: sendingInvoice } = useMutation({
    mutationFn: () => sendInvoiceEmailApi(invoice._id),
    onSuccess: () => toast.success("Invoice emailed to you! 📧"),
    onError: () => toast.error("Failed to send email"),
  });

  // ── Email receipt for a specific installment (or "all") ────
  const { mutate: emailReceipt, isPending: sendingReceipt } = useMutation({
    mutationFn: (installmentId: string) => {
      if (installmentId === "all") {
        return sendReceivingInvoiceEmailApi(invoice._id, { sendAll: true });
      }
      return sendReceivingInvoiceEmailApi(invoice._id, { installmentId });
    },
    onSuccess: () => {
      toast.success("Receipt emailed to you! 📧");
      setSendingInstallment(null);
    },
    onError: () => {
      toast.error("Failed to send receipt");
      setSendingInstallment(null);
    },
  });

  const handleSendReceipt = (installmentId: string) => {
    setSendingInstallment(installmentId);
    emailReceipt(installmentId);
  };

  const handleDownloadReceipt = (installment: any) => {
  try {
    DownloadReceipt(
      invoice,
      userForInvoice,
      [installment]
    );

    toast.success("Receipt downloaded successfully ✅");
  } catch (err: any) {
    toast.error(err?.message || "Receipt download failed ❌");
  }
};

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* ── Card Header ── */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="font-semibold text-gray-800 text-base">
              {invoice.enrollment?.program?.name || "Program"}
            </p>
            {(invoice.enrollment?.program?.short_description || invoice.enrollment?.program?.shortDescription) && (
              <p className="text-xs text-gray-400 mt-0.5 italic">
                {invoice.enrollment?.program?.short_description || invoice.enrollment?.program?.shortDescription}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              Invoice # {invoice.invoiceNumber || invoice._id?.slice(-6).toUpperCase()}
              {nextUnpaid?.dueDate
                ? ` · Due: ${new Date(nextUnpaid.dueDate).toLocaleDateString()}`
                : invoice.dueDate
                  ? ` · Due: ${new Date(invoice.dueDate).toLocaleDateString()}`
                  : ""}
            </p>
            {allInstallmentsPaid && lastPaidAt ? (
              <p className="text-xs font-medium mt-1 text-green-600">
                ✓ Paid on {new Date(lastPaidAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            ) : (
              due && (
                <p className={`text-xs font-medium mt-1 ${due.overdue ? "text-rose-500" : "text-gray-400"}`}>
                  {due.text}
                </p>
              )
            )}
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full shrink-0 ${cfg.color}`}>
            <Icon size={12} />
            {cfg.label}
          </span>
        </div>

        {/* ── Action buttons row ── */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => DownloadInvoice(invoice, userForInvoice)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} />
            Download Invoice
          </button>

          <button
            onClick={() => emailInvoice()}
            disabled={sendingInvoice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors disabled:opacity-60 "
          >
            {sendingInvoice ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
            Email Me Invoice
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-1">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Payment progress</span>
            <span className="font-medium text-gray-600">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${pct >= 100 ? "bg-green-400" : pct > 0 ? "bg-yellow-400" : "bg-gray-200"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Gross Amount</span>
            <span className="font-medium text-gray-600">{fmt(gross)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between">
              <span className="text-sky-500">Discount</span>
              <span className="font-medium text-sky-500">
                - {fmt(discount)}
              </span>
            </div>
          )}

          <div className="flex justify-between border-t pt-2">
            <span className=" text-gray-500">Net Amount</span>
            <span className="font-semibold text-gray-600">{fmt(net)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-green-600">Paid</span>
            <span className="font-medium text-green-600">
              {fmt(invoice.paidAmount)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-rose-500">Remaining</span>
            <span className="font-medium text-rose-500">
              {fmt(invoice.remainingAmount)}
            </span>
          </div>
        </div>

        {/* Installments toggle */}
        {invoice.installments?.length > 0 && (
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 text-xs text-yellow-700 font-medium mt-3 hover:text-yellow-800 transition-colors"
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {open ? "Hide" : "Show"} installments ({invoice.installments.length})
          </button>
        )}
      </div>

      {/* ── Installments ── */}
      {open && invoice.installments?.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50">
          <div className="px-5 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Installment Plan
            </p>
            <div className="space-y-2">
              {invoice.installments.map((inst: any, idx: number) => {
                const instDue = inst.dueDate ? daysLeft(inst.dueDate) : null;
                const isPaid = inst.status === "PAID";
                const isSendingThis = sendingInstallment === inst._id;

                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-xl border ${isPaid
                      ? "bg-green-50 border-green-100"
                      : inst.status === "OVERDUE"
                        ? "bg-rose-50 border-rose-100"
                        : "bg-white border-gray-100"
                      }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {/* Installment {idx + 1} */} {inst.label || `Installment ${idx + 1}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {inst.dueDate
                          ? new Date(inst.dueDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </p>
                      {instDue && !isPaid && (
                        <p className={`text-[11px] font-medium mt-0.5 ${instDue.overdue ? "text-rose-500" : "text-gray-400"}`}>
                          {instDue.text}
                        </p>
                      )}

                      {/* ✅ Email receipt button — only for PAID installments */}
                      {isPaid && (
                        <div className="flex items-center gap-2 flex-wrap mt-2">

                          <button
                            type="button"
                            onClick={() => handleDownloadReceipt(inst)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <Download size={10} />
                            Download Receipt
                          </button>

                          <button
                            onClick={() => handleSendReceipt(inst._id)}
                            disabled={isSendingThis}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-60"
                          >
                            {isSendingThis ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Mail size={10} />
                            )}
                            Email me this receipt
                          </button>

                        </div>
                      )}


                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold mb-1 text-gray-400 placeholder:text-gray-400">{fmt(inst.amount)}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${installmentStatus[inst.status] || "bg-gray-100 text-gray-500"}`}>
                        {isPaid ? "✓ Paid" : inst.status === "OVERDUE" ? "Overdue" : "Pending"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Email ALL paid receipts at once ── */}
            {invoice.installments.some((i: any) => i.status === "PAID") && (
              <button
                onClick={() => handleSendReceipt("all")}
                disabled={sendingInstallment === "all"}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500 hover:bg-white transition-colors disabled:opacity-60"
              >
                {sendingInstallment === "all" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ReceiptIcon size={13} />
                )}
                Email me all receipts
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Payment History ── */}
      {invoice.payments?.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Payment History
          </p>
          <div className="space-y-2">
            {invoice.payments.map((p: any, idx: number) => {
              const paymentDate = p.paidAt || p.createdAt;
              return (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <div>
                      <p className="text-gray-700 font-medium capitalize">{p.label}</p>
                      <p className="text-xs text-gray-400">
                        {paymentDate
                          ? new Date(paymentDate).toLocaleDateString("en-PK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                          : "—"}
                        {p.referenceNumber ? ` · Ref: ${p.referenceNumber}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-green-600">{fmt(p.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {invoice.user?.documents?.filter((d: any) => d.type === "receipt").length > 0 && (
        <div className="px-5 pb-4">
          <DocumentsSection
            userId={invoice.user?._id}
            documents={invoice.user?.documents || []}
            defaultType="receipt"
            showDropdown={false}
            filterType="receipt"
            queryKey={["my-invoices"]}
            title="Payment Receipts"
            description="Upload your payment receipt for verification"
          />
        </div>
      )}

      {/* Notice */}
      {invoice.status !== "PAID" && (
        <div className="px-5 pb-4">
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 text-center">
            💡 Please contact your finance manager to make a payment
          </p>
        </div>
      )}
    </div>
  );
}

// ── Summary Stats ─────────────────────────────────────────────
function SummaryStats({ invoices }: { invoices: any[] }) {
  const total = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const paid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const remaining = invoices.reduce((s, i) => s + (i.remainingAmount || 0), 0);
  const overdue = invoices.filter((i) => i.status === "OVERDUE").length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Total Amount", value: fmt(total), color: "text-gray-800", bg: "bg-gray-50" },
        { label: "Total Paid", value: fmt(paid), color: "text-green-600", bg: "bg-green-50" },
        { label: "Remaining", value: fmt(remaining), color: "text-rose-500", bg: "bg-rose-50" },
        { label: "Overdue", value: `${overdue} invoice${overdue !== 1 ? "s" : ""}`, color: overdue > 0 ? "text-rose-500" : "text-gray-400", bg: overdue > 0 ? "bg-rose-50" : "bg-gray-50" },
      ].map((s) => (
        <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
          <p className="text-xs text-gray-400 mb-1">{s.label}</p>
          <p className={`font-bold text-base ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
function PaymentsContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-invoices"],
    queryFn: getMyInvoices,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const [filters, setFilters] = useState({ search: "" });

  const invoices = data?.data?.data || [];


  const filteredInvoices = invoices.filter((inv: any) => {
    const q = (filters.search || "").toLowerCase().trim();
    if (!q) return true;
    return (
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.enrollment?.program?.name?.toLowerCase().includes(q)
    );
  });

  const active = filteredInvoices.filter((i: any) => i.status !== "PAID");
  const paid = filteredInvoices.filter((i: any) => i.status === "PAID");

  return (
    <>
      <PageHeader
        title="My Payments"
        subtitle="View your invoices and payment history"
        titleIcon={<CreditCard size={24} />}
        totalCount={invoices.length}
        filters={filters}
        setFilters={setFilters}
        filterFields={[
          {
            type: "input",
            name: "search",
            placeholder: "Search by program or invoice #...",
          },
        ]}
        exportBtn={
          invoices.length > 0 ? (
            <ExportButton
              filename="my-payments"
              label="Export Excel"
              fetchData={async () => invoices}
              columns={[
                { header: "Invoice #", key: "invoiceNumber" },
                { header: "Program", key: "enrollment.program.name" },
                { header: "Total (Rs)", key: "totalAmount", format: (v) => Number(v || 0).toLocaleString() },
                { header: "Paid (Rs)", key: "paidAmount", format: (v) => Number(v || 0).toLocaleString() },
                { header: "Remaining (Rs)", key: "remainingAmount", format: (v) => Number(v || 0).toLocaleString() },
                { header: "Status", key: "status" },
                { header: "Due Date", key: "dueDate", format: (v) => v ? new Date(v).toLocaleDateString("en-PK") : "—" },
                { header: "Batch", key: "enrollment.batch.name" },
                { header: "Created At", key: "createdAt", format: (v) => v ? new Date(v).toLocaleDateString("en-PK") : "—" },
              ]}
            />
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading payments...</p>
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-rose-500 text-sm">Failed to load payments</div>
      ) : !invoices.length ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-yellow-50 flex items-center justify-center">
            <CreditCard size={28} className="text-yellow-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-700">No invoices found</p>
            <p className="text-sm text-gray-400 mt-1">Please contact your finance manager</p>
          </div>
        </div>
      ) : !filteredInvoices.length ? (             // 👈 naya
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-gray-400">No invoices match "{filters.search}"</p>
        </div>
      ) : (
        <>
          <SummaryStats invoices={filteredInvoices} />

          {active.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock size={14} />
                Pending ({active.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {active.map((inv: any) => <InvoiceCard key={inv._id} invoice={inv} />)}
              </div>
            </div>
          )}

          {paid.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle size={14} />
                Paid ({paid.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {paid.map((inv: any) => <InvoiceCard key={inv._id} invoice={inv} />)}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function PaymentsPage() {
  return (
    <ProtectedRoute allowedRoles={["user", "admin", "super_admin"]}>
      <PaymentsContent />
    </ProtectedRoute>
  );
}