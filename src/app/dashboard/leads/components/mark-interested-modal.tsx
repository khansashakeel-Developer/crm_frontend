"use client";
import { useState, useEffect } from "react";
import { adminGetProgramById } from "@/utils/api";
import { X, Plus, Trash2, Star } from "lucide-react";
import InputField from "@/app/component/ui/inputField";
import toast from "react-hot-toast";
import { useAppSelector } from "@/store/hooks";

interface Installment {
  dueDate: string;
  amount: number;
  label: string;
}

interface FormState {
  invoiceNumber: string;
  issueDate: string;
  totalAmount: number;
  discount: number;
  advanceAmount: number;
  advanceDueDate: string;
  installments: Installment[];
  notes: string;
  certificateFee?: number;
  manualFee?: number
}

interface FormErrors {
  advanceAmount?: string;
  advanceDueDate?: string;
  installments?: { amount?: string; dueDate?: string }[];
}

interface Props {
  lead: any;
  onClose: () => void;
  onSubmit: (data: { paymentPlan: FormState }) => void;
  isSubmitting?: boolean;
}

const toDateInput = (dateStr?: string) => {
  if (!dateStr) return "";
  try { return new Date(dateStr).toISOString().split("T")[0]; } catch { return ""; }
};

export default function MarkInterestedModal({ lead, onClose, onSubmit, isSubmitting }: Props) {
  const { user } = useAppSelector((state) => state.auth);
  const canSeeInvoiceMeta = ["admin", "super_admin", "finance_manager"].includes(user?.role);
  const baseAmount = lead?.opportunity_value ?? 0;
  const existingPlan = lead?.paymentPlan;
  const certFeeLocked = Boolean(existingPlan?.certificateFee > 0);
  const manualFeeLocked = Boolean(existingPlan?.manualFee > 0);
  const todayStr = () => new Date().toISOString().split("T")[0];

  const [includeCertFee, setIncludeCertFee] = useState(Boolean(existingPlan?.certificateFee));
  const [certificateFee, setCertificateFee] = useState(existingPlan?.certificateFee || 0);
  const [includeManualFee, setIncludeManualFee] = useState(Boolean(existingPlan?.manualFee));
  const [manualFee, setManualFee] = useState(existingPlan?.manualFee || 5000);

  useEffect(() => {
    if (!lead?.program_id) return;
    if (existingPlan?.certificateFee || existingPlan?.manualFee) return;

    const programId = typeof lead.program_id === "object" ? lead.program_id._id : lead.program_id;
    adminGetProgramById(programId).then((res) => {
      setCertificateFee(res.data?.data?.certificateFee || 0);
      setManualFee(res.data?.data?.manualFee ?? 5000);
    }).catch(() => { });
  }, [lead?.program_id]);

  const [form, setForm] = useState<FormState>({
    invoiceNumber: existingPlan?.invoiceNumber ?? "",
    issueDate: toDateInput(existingPlan?.issueDate) || todayStr(),
    totalAmount: existingPlan?.totalAmount
      ? existingPlan.totalAmount - (existingPlan.certificateFee || 0) - (existingPlan.manualFee || 0)
      : baseAmount,
    discount: existingPlan?.discountAmount ?? 0,
    advanceAmount: existingPlan?.advanceAmount ?? 0,
    advanceDueDate: toDateInput(existingPlan?.advanceDueDate) ?? "",
    installments: existingPlan?.installments?.length
      ? existingPlan.installments.map((inst: any) => ({
        label: inst.label || "Installment",
        amount: inst.amount || 0,
        dueDate: toDateInput(inst.dueDate),
      }))
      : [{ label: "Installment 1", amount: 0, dueDate: "" }],
    notes: existingPlan?.notes ?? "",
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // const handleDiscountChange = (value: number) => {
  //   const safeValue = Math.max(0, value);
  //   setForm((p) => ({
  //     ...p,
  //     discount: safeValue,
  //     totalAmount: Math.max(0, baseAmount - safeValue),
  //   }));
  // };

  const handleDiscountChange = (value: number) => {
    const safeValue = Math.max(0, value);
    setForm((p) => ({ ...p, discount: safeValue }));
  };

  // ── Advance fill check ──────────────────────────────────────────
  const isAdvanceFilled = form.advanceAmount > 0 && form.advanceDueDate !== "";

  const grossWithFees = form.totalAmount + (includeCertFee ? certificateFee : 0) + (includeManualFee ? manualFee : 0);
  const netPayable = grossWithFees - form.discount;

  const remaining =
    netPayable -
    form.advanceAmount -
    form.installments.reduce((s, i) => s + Number(i.amount), 0);

  // ── Validation ─────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.advanceAmount || form.advanceAmount <= 0) {
      newErrors.advanceAmount = "Advance amount is required";
    }
    if (!form.advanceDueDate) {
      newErrors.advanceDueDate = "Advance due date is required";
    }

    setErrors(newErrors);
    return (
      !newErrors.advanceAmount &&
      !newErrors.advanceDueDate &&
      remaining >= 0
    );
  };

  const addInstallment = () =>
    setForm((p) => ({
      ...p,
      installments: [
        ...p.installments,
        { label: `Installment ${p.installments.length + 1}`, amount: 0, dueDate: "" },
      ],
    }));

  const removeInstallment = (idx: number) =>
    setForm((p) => ({ ...p, installments: p.installments.filter((_, i) => i !== idx) }));

  const updateInstallment = (idx: number, field: keyof Installment, value: any) => {
    setForm((p) => ({
      ...p,
      installments: p.installments.map((inst, i) =>
        i === idx ? { ...inst, [field]: value } : inst
      ),
    }));
    // clear that installment's error on change
    setErrors((prev) => {
      const instErrors = [...(prev.installments ?? [])];
      if (instErrors[idx]) instErrors[idx] = { ...instErrors[idx], [field === "amount" ? "amount" : "dueDate"]: undefined };
      return { ...prev, installments: instErrors };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (includeCertFee && certificateFee <= 0) {
      toast.error("Certificate fee amount is required if you're including it");
      return;
    }

    const filledInstallments = form.installments.filter(
      (inst) => inst.amount > 0 || inst.dueDate !== ""
    );

    onSubmit({
      paymentPlan: {
        ...form,
        installments: filledInstallments,
        certificateFee: includeCertFee ? certificateFee : 0,
        manualFee: includeManualFee ? manualFee : 0,
      },
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Star size={15} className="text-yellow-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Mark as Interested</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {lead?.first_name} {lead?.last_name} — Set payment plan
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Info box */}
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
            <p className="text-xs text-yellow-700 font-medium">
              The lead status will be updated to <strong>Interested</strong>, and the user will receive
              an email and notification. The payment plan will also be attached automatically.
            </p>
          </div>

          {/* {canSeeInvoiceMeta && (
            <div className="grid grid-cols-2 gap-3">
              <InputField
                label="Old Invoice Number (Optional)"
                type="text"
                value={form.invoiceNumber}
                onChange={(e: any) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))}
                placeholder="e.g. INV-2024-0045"
              />
              <InputField
                label="Issue Date"
                type="date"
                value={form.issueDate}
                onChange={(e: any) => setForm((p) => ({ ...p, issueDate: e.target.value }))}
              />
            </div>
          )} */}

          {/* Total Amount + Discount */}
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Total Program Fee (Rs)"
              type="number"
              value={String(form.totalAmount)}
              onChange={(e: any) =>
                setForm((p) => ({ ...p, totalAmount: Number(e.target.value) }))
              }
              placeholder="e.g. 50000"
            />
            <InputField
              label="Discount (Rs) — optional"
              type="number"
              value={String(form.discount || "")}
              onChange={(e: any) => handleDiscountChange(Number(e.target.value))}
              placeholder="0"
            />
          </div>

          {/* Certificate Fee — checkbox + editable input */}
          <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
            <label className={`flex items-center gap-2 ${certFeeLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                checked={includeCertFee}
                disabled={certFeeLocked}
                onChange={(e) => setIncludeCertFee(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 rounded disabled:cursor-not-allowed"
              />
              <span className="text-xs font-semibold text-gray-700">Include Certificate Fee in this invoice</span>
              {certFeeLocked && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">Locked</span>
              )}
            </label>

            {includeCertFee && (
              <div className="mt-2">
                <InputField
                  label="Certificate Fee (Rs)"
                  type="number"
                  value={String(certificateFee || "")}
                  disabled={certFeeLocked}
                  readOnly={certFeeLocked}
                  onChange={(e: any) => {
                    if (certFeeLocked) return;
                    setCertificateFee(Number(e.target.value));
                  }}
                  placeholder="e.g. 5000"
                  bg={certFeeLocked ? "bg-gray-100" : "bg-white"}
                />
                {certFeeLocked && (
                  <p className="text-[10px] text-gray-400 mt-1">Locked once set — can't be changed until conversion</p>
                )}
              </div>
            )}
          </div>

          {/* Manual Fee checkbox, same pattern */}
          <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
            <label className={`flex items-center gap-2 ${manualFeeLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                checked={includeManualFee}
                disabled={manualFeeLocked}
                onChange={(e) => setIncludeManualFee(e.target.checked)}
                className="w-4 h-4 accent-teal-500 rounded disabled:cursor-not-allowed"
              />
              <span className="text-xs font-semibold text-gray-700">Include Manual Fee</span>
              {manualFeeLocked && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">Locked</span>
              )}
            </label>

            {includeManualFee && (
              <div className="mt-2">
                <InputField
                  label="Manual Fee (Rs)"
                  type="number"
                  value={String(manualFee || "")}
                  disabled={manualFeeLocked}
                  readOnly={manualFeeLocked}
                  onChange={(e: any) => {
                    if (manualFeeLocked) return;
                    setManualFee(Number(e.target.value));
                  }}
                  placeholder="e.g. 5000"
                  bg={manualFeeLocked ? "bg-gray-100" : "bg-white"}
                />
                {manualFeeLocked && (
                  <p className="text-[10px] text-gray-400 mt-1">Locked once set — can't be changed until conversion</p>
                )}
              </div>
            )}
          </div>

          {/* Advance */}
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Advance Amount (Rs) *"
              type="number"
              value={String(form.advanceAmount || "")}
              onChange={(e: any) => {
                setForm((p) => ({ ...p, advanceAmount: Number(e.target.value) }));
                setErrors((p) => ({ ...p, advanceAmount: undefined }));
              }}
              placeholder="e.g. 5000"
              error={errors.advanceAmount}
            />
            <InputField
              label="Advance Due Date *"
              type="date"
              value={form.advanceDueDate}
              onChange={(e: any) => {
                setForm((p) => ({ ...p, advanceDueDate: e.target.value }));
                setErrors((p) => ({ ...p, advanceDueDate: undefined }));
              }}
              error={errors.advanceDueDate}
            />
          </div>

          {/* Remaining badge */}
          {isAdvanceFilled && (
            <div
              className={`text-xs font-semibold px-3 py-2 rounded-lg ${remaining < 0
                ? "bg-rose-50 text-rose-600"
                : remaining === 0
                  ? "bg-teal-50 text-teal-600"
                  : "bg-orange-50 text-orange-600"
                }`}
            >
              {remaining < 0
                ? `Over-allocated by Rs ${Math.abs(remaining).toLocaleString()}`
                : remaining === 0
                  ? "Fully allocated"
                  : `Remaining to allocate: Rs ${remaining.toLocaleString()}`} of Rs {netPayable.toLocaleString()} (after fees & discount)
            </div>
          )}

          {/* Installments — locked until advance is filled */}
          <div className={!isAdvanceFilled ? "opacity-50 pointer-events-none select-none" : ""}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600">
                Installments
                {!isAdvanceFilled && (
                  <span className="ml-2 text-[10px] text-gray-400 font-normal">(Fill advance first)</span>
                )}
              </label>
              <button
                type="button"
                onClick={addInstallment}
                className="flex items-center gap-1 text-xs text-yellow-500 hover:text-yellow-600 font-medium"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {form.installments.map((inst, idx) => (
                <div key={idx} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="text"
                      value={inst.label}
                      onChange={(e) => updateInstallment(idx, "label", e.target.value)}
                      className="text-xs font-medium text-gray-700 bg-transparent border-none outline-none flex-1"
                      placeholder="Label e.g. Month 1"
                    />
                    {form.installments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInstallment(idx)}
                        className="text-rose-400 hover:text-rose-600 ml-2"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <InputField
                      label=""
                      type="number"
                      placeholder="Amount (Rs)"
                      value={String(inst.amount || "")}
                      onChange={(e: any) => updateInstallment(idx, "amount", Number(e.target.value))}
                      error={errors.installments?.[idx]?.amount}
                      bg="bg-white"
                    />
                    <div className="relative">
                      <InputField
                        label=""
                        type="date"
                        value={inst.dueDate}
                        onChange={(e: any) => updateInstallment(idx, "dueDate", e.target.value)}
                        error={errors.installments?.[idx]?.dueDate}
                        bg="bg-white"
                        rightIcon={
                          inst.dueDate ? (
                            <button
                              type="button"
                              onClick={() => updateInstallment(idx, "dueDate", "")}
                              className="text-gray-400 hover:text-rose-500"
                            >
                              <X size={12} />
                            </button>
                          ) : undefined
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (Optional)</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Any special instructions..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 resize-none text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || remaining < 0 || !isAdvanceFilled}
            className="flex-1 py-2 rounded-xl bg-yellow-400 text-gray-900 text-sm font-semibold hover:bg-yellow-500 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Mark as Interested & Save Payment Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}