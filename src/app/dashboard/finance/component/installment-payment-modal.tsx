"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markInstallmentPaid } from "@/utils/api";
import toast from "react-hot-toast";
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Zap,
  Banknote,
  Building2,
  FileText,
  Settings,
  CreditCard,
  Pencil,
} from "lucide-react";
import CorrectInstallmentModal from "./CorrectInstallmentModal";
import AppDatePicker from "@/app/component/ui/app-date-picker";
// import VoidInstallmentModal from "./VoidInstallmentModal";

interface Installment {
  _id: string;
  label: string;
  amount: number;
  dueDate: string;
  status: "PENDING" | "PAID" | "OVERDUE";
  isAdvance: boolean;
  feeType?: "program" | "certificate" | "manual";   // 👈 add
  paidAmount?: number;
  receiptUrl?: string | null;
  method?: string | null;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  installments: Installment[];
  user?: { name: string; email: string };
}

interface Props {
  invoice: Invoice | null;
  onClose: () => void;
  onGoToCheques?: (installmentId: string) => void;
}

type PaymentMethod = "cash" | "bank" | "cheque" | "manual";

interface PaymentFormState {
  method: PaymentMethod | null;
  referenceNumber: string;
  notes: string;
  receipt: File | null;
  paidDate: string;
}

const formatDate = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "—";

const formatAmt = (n: number) => Number(n || 0).toLocaleString("en-PK");

const PAYMENT_TABS: {
  key: PaymentMethod;
  label: string;
  icon: React.ReactNode;
  color: string;
  activeColor: string;
}[] = [
    {
      key: "cash",
      label: "Cash",
      icon: <Banknote size={13} />,
      color: "text-slate-500",
      activeColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
        {
      key: "bank",
      label: "Bank Transfer",
      icon: <Building2 size={13} />,
      color: "text-slate-500",
      activeColor: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      key: "cheque",
      label: "Cheque",
      icon: <FileText size={13} />,
      color: "text-slate-500",
      activeColor: "text-violet-600 bg-violet-50 border-violet-200",
    },
    {
      key: "manual",
      label: "Manual",
      icon: <Settings size={13} />,
      color: "text-slate-500",
      activeColor: "text-orange-600 bg-orange-50 border-orange-200",
    },
  ];

export default function InstallmentPaymentModal({ invoice, onClose, onGoToCheques }: Props) {
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const todayStr = () => new Date().toISOString().split("T")[0];
    const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    method: null,
    referenceNumber: "",
    notes: "",
    receipt: null,
    paidDate: todayStr(),
  });
    const [correctingInstallment, setCorrectingInstallment] = useState<any>(null);
  // const [voidingInstallment, setVoidingInstallment] = useState<any>(null);

  // Check if form is valid to enable Confirm button
  const isFormValid = () => {
    if (!paymentForm.method) return false;

    if (!paymentForm.paidDate) return false;

    if (
      paymentForm.method === "bank" &&
      !paymentForm.referenceNumber.trim()
    ) {
      return false;
    }

    return true;
  };

    const { mutate: payInstallment, isPending } = useMutation({
    mutationFn: ({ installmentId }: { installmentId: string }) =>
      markInstallmentPaid(invoice!._id, installmentId, {
        method: paymentForm.method!,
        referenceNumber: paymentForm.referenceNumber || undefined,
        notes: paymentForm.notes || undefined,
        receipt: paymentForm.receipt || undefined,
        paidDate: paymentForm.paidDate,
      }),
    onSuccess: (res) => {
      const msg = res.data?.message || "Installment marked as paid!";
      toast.success(msg);
      setConfirmingId(null);
      setPaymentForm({ method: null, referenceNumber: "", notes: "", receipt: null, paidDate: todayStr() });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
      if (res.data?.data?.status === "PAID") onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Failed to mark installment!"),
  });

      const handleConfirmingOpen = (id: string) => {
    setConfirmingId(id);
    setPaymentForm({ method: null, referenceNumber: "", notes: "", receipt: null, paidDate: todayStr() });
  };

  const handleConfirmingClose = () => {
    setConfirmingId(null);
    setPaymentForm({ method: null, referenceNumber: "", notes: "", receipt: null, paidDate: todayStr() });
  };

  if (!invoice) return null;

  const paidCount = invoice.installments.filter((i) => i.status === "PAID").length;
  const totalCount = invoice.installments.length;
  const progressPct = Math.round((paidCount / totalCount) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase mb-1">
                Payment Schedule
              </p>
              <h2 className="text-white text-lg font-bold leading-tight">
                {invoice.invoiceNumber}
              </h2>
              {invoice.user && (
                <p className="text-slate-300 text-sm mt-0.5">
                  {invoice.user.name}
                  <span className="text-slate-500 mx-1.5">·</span>
                  <span className="text-slate-400 text-xs">{invoice.user.email}</span>
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-slate-400 text-xs">
                {paidCount} of {totalCount} installments paid
              </span>
              <span className="text-slate-300 text-xs font-semibold">{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-3 border-b border-slate-100">
          <div className="px-5 py-3 border-r border-slate-100">
            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Total</p>
            <p className="text-slate-800 text-sm font-bold">Rs {formatAmt(invoice.totalAmount)}</p>
          </div>
          <div className="px-5 py-3 border-r border-slate-100">
            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Paid</p>
            <p className="text-emerald-600 text-sm font-bold">Rs {formatAmt(invoice.paidAmount)}</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Remaining</p>
            <p className={`text-sm font-bold ${invoice.remainingAmount > 0 ? "text-rose-500" : "text-emerald-600"}`}>
              Rs {formatAmt(invoice.remainingAmount)}
            </p>
          </div>
        </div>

        {/* Installments List */}
        <div className="px-4 py-3 max-h-[420px] overflow-y-auto">
          <div className="space-y-2">
            {invoice.installments.map((inst, idx) => {
              const isPaid = inst.status === "PAID";
              const isConfirming = confirmingId === inst._id;

              return (
                <div
                  key={inst._id}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden ${isPaid
                    ? "border-emerald-100 bg-emerald-50/60"
                    : isConfirming
                      ? "border-slate-200 bg-slate-50"
                      : inst.isAdvance
                        ? "border-amber-100 bg-amber-50/40 hover:border-amber-200"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                >

                  {/* Top Row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isPaid ? "bg-emerald-100" : inst.isAdvance ? "bg-amber-100" : "bg-slate-100"
                      }`}>

                      {isPaid ? (
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      ) : inst.isAdvance ? (
                        <Zap size={15} className="text-amber-600" />
                      ) : (
                        <Clock size={14} className="text-slate-400" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${isPaid ? "text-slate-500" : "text-slate-800"}`}>
                          {inst.isAdvance ? "Advance Payment" : inst.label || `Installment ${idx + 1}`}
                        </span>
                        {inst.isAdvance && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                            Advance
                          </span>
                        )}
                        {isPaid && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full">
                            Paid
                          </span>
                        )}
                        {isPaid && inst.receiptUrl && (
                          <a
                            href={inst.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ms-auto text-[9px] font-bold uppercase tracking-wider text-gray-600 hover:text-gray-700 underline underline-offset-2"
                          >
                            View Slip
                          </a>
                        )}
                        <div className="flex gap-2 ms-auto">

                          {/* {inst.status === "PAID" && (
                          <button
                            onClick={() => setVoidingInstallment(inst)}
                            className="text-[9px] font-bold uppercase tracking-wider bg-red-200 text-red-700 px-2 py-0.5 rounded-full"
                          >
                            Void
                          </button>
                        )} */}

                          {inst.status === "PAID" && (
                            <button
                              onClick={() => setCorrectingInstallment(inst)}
                              className="text-xs text-gray-500 hover:text-gray-600 font-medium flex items-center gap-1"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-400">Due: {formatDate(inst.dueDate)}</span>
                        <span className="text-xs font-semibold text-slate-600">
                          Rs {formatAmt(inst.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    {!isPaid && (
                      <div className="flex-shrink-0">
                        {!isConfirming ? (
                          <button
                            onClick={() => handleConfirmingOpen(inst._id)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${inst.isAdvance
                              ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                          >
                            Mark Paid
                            <ChevronRight size={12} />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                    <button
                    onClick={handleConfirmingClose}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>

                  {paymentForm.method !== "cheque" && (
                  <button
                    onClick={() => payInstallment({ installmentId: inst._id })}
                    disabled={!isFormValid() || isPending}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${isFormValid() && !isPending
                                ? "bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                                }`}
                            >
                              {isPending ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Processing
                                </span>
                              ) : (
                                <>
                                  <CheckCircle2 size={12} />
                                  Confirm
                                </>
                              )}
                                                        </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payment Method Panel — shown when confirming */}
                  {isConfirming && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">

                                            {/* Warning */}
                                            <div className="flex items-start gap-2">
                        <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-700">
                          Marking <strong>Rs {formatAmt(inst.amount)}</strong> as paid.
                          {inst.isAdvance && (
                            <span className="block text-amber-600 mt-0.5">
                              This will activate the student enrollment.
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Method Toolbar Header */}
                      <div className="flex items-center gap-1.5">
                        <CreditCard size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Select Payment Method
                        </span>
                      </div>

                      {/* Method Tabs */}
                          <div className="grid grid-cols-4 gap-1.5">
                        {PAYMENT_TABS.map((tab) => (
                          <button
                            key={tab.key}
                            onClick={() =>
                              setPaymentForm((prev) => ({
                                ...prev,
                                method: tab.key,
                                referenceNumber: "",
                              }))
                            }
                            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all ${paymentForm.method === tab.key
                              ? tab.activeColor + " border"
                              : "border-slate-100 bg-white text-slate-400 hover:bg-slate-50 hover:border-slate-200"
                              }`}
                          >
                            {tab.icon}
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Dynamic Fields based on selected method */}
                      {paymentForm.method === "cash" && (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                            Cash Payment
                          </p>
                          <textarea
                            rows={2}
                            placeholder="Description"
                            value={paymentForm.notes}
                            onChange={(e) =>
                              setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                            }
                            className="w-full text-xs rounded-lg border border-emerald-200 bg-white px-3 py-2 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
                          />
                        </div>
                      )}

                      {paymentForm.method === "bank" && (
                        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                            Bank Transfer Details
                          </p>
                          <input
                            type="text"
                            placeholder="Transaction / Reference Number *"
                            value={paymentForm.referenceNumber}
                            onChange={(e) =>
                              setPaymentForm((prev) => ({
                                ...prev,
                                referenceNumber: e.target.value,
                              }))
                            }
                            className="w-full text-xs rounded-lg border border-blue-200 bg-white px-3 py-2 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <textarea
                            rows={2}
                            placeholder="Description"
                            value={paymentForm.notes}
                            onChange={(e) =>
                              setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                            }
                            className="w-full text-xs rounded-lg border border-blue-200 bg-white px-3 py-2 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                          />
                          {!paymentForm.referenceNumber.trim() && (
                            <p className="text-[10px] text-rose-500 font-medium">
                              Reference number is required for bank transfer.
                            </p>
                          )}
                        </div>
                      )}

                                            
                                            {paymentForm.method === "cheque" && (
                        <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-3 space-y-2 text-center">
                          <FileText size={18} className="text-violet-400 mx-auto" />
                          <p className="text-xs text-violet-700 font-medium">
                            Cheque payments are recorded on the Cheques screen, where each cheque is tracked individually.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              handleConfirmingClose();
                              onGoToCheques?.(inst._id);
                            }}
                            className="text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-lg"
                          >
                            Go to Cheques Screen →
                          </button>
                        </div>
                      )}

                      {paymentForm.method === "manual" && (
                        <div className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2.5 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                            Manual Entry
                          </p>
                          <input
                            type="text"
                            placeholder="Reference Number (optional)"
                            value={paymentForm.referenceNumber}
                            onChange={(e) =>
                              setPaymentForm((prev) => ({
                                ...prev,
                                referenceNumber: e.target.value,
                              }))
                            }
                            className="w-full text-xs rounded-lg border border-orange-200 bg-white px-3 py-2 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-300"
                          />
                          <textarea
                            rows={2}
                            placeholder="Description"
                            value={paymentForm.notes}
                            onChange={(e) =>
                              setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                            }
                            className="w-full text-xs rounded-lg border border-orange-200 bg-white px-3 py-2 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                          />
                        </div>
                      )}

                    {/* receipt upload, common for all methods */}
                      {paymentForm.method && (
                        <div className="rounded-lg bg-slate-50 border border-dashed border-slate-200 px-3 py-2.5 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Payment Proof <span className="text-slate-400 normal-case font-normal">(optional)</span>
                          </p>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) =>
                              setPaymentForm((prev) => ({
                                ...prev,
                                receipt: e.target.files?.[0] || null,
                              }))
                            }
                            className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-600 hover:file:bg-slate-300 cursor-pointer"
                          />
                          {paymentForm.receipt && (
                            <p className="text-[10px] text-emerald-600 font-medium truncate">
                              ✓ {paymentForm.receipt.name}
                            </p>
                          )}
                        </div>
                      )}

                      {paymentForm.method && (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Payment Date
                          </p>
                          <AppDatePicker
                            value={paymentForm.paidDate}
                            onChange={(value) =>
                              setPaymentForm((prev) => ({
                                ...prev,
                                paidDate: value,
                              }))
                            }
                            required
                            max={todayStr()}
                          />
                        </div>
                      )}
                      {!paymentForm.paidDate && (
                        <p className="text-[10px] text-rose-500 font-medium">
                          Payment date is required.
                        </p>
                      )}

                      {/* Hint when no method selected */}
                      {!paymentForm.method && (
                        <p className="text-[10px] text-slate-400 text-center py-1">
                          Please select a payment method to continue.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {correctingInstallment && (
          <CorrectInstallmentModal
            invoice={invoice}
            installment={correctingInstallment}
            onClose={() => setCorrectingInstallment(null)}
          />
        )}

        {/* {voidingInstallment && (
          <VoidInstallmentModal
            invoice={invoice}
            installment={voidingInstallment}
            onClose={() => setVoidingInstallment(null)}
          />
        )} */}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}