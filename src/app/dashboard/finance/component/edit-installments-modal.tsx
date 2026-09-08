"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateInstallment, addInstallment, deleteInstallment } from "@/utils/api";
import toast from "react-hot-toast";
import { X, Pencil, Plus, Save, Check, GraduationCap, Trash2 } from "lucide-react";
import AppDatePicker from "@/app/component/ui/app-date-picker";

interface Installment {
  _id: string;
  label: string;
  amount: number;
  dueDate: string | null;
  paidAt?: any;
  status: "PAID" | "PENDING";
  isAdvance: boolean;
  feeType?: "program" | "certificate" | "manual";
  paidAmount: number;
  notes?: string | null;
}

interface Props {
  invoice: any;
  onClose: () => void;
}

const fmt = (n: number) => `Rs ${Number(n || 0).toLocaleString("en-PK")}`;
const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "—";

export default function EditInstallmentsModal({ invoice, onClose }: Props) {
  const queryClient = useQueryClient();

  // ── ALL HOOKS FIRST — early return se pehle ─────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", amount: "", dueDate: "", notes: "" });
  const [notesOnlyId, setNotesOnlyId] = useState<string | null>(null);
  const [notesOnlyValue, setNotesOnlyValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    label: "", amount: "", dueDate: "", isAdvance: false, isCertificate: false, isManual: false, notes: "",
    programId: "", // 👈 sirf bundle invoices ke liye — kis program/enrollment ke liye fee hai
  });


  const { mutate: saveEdit, isPending: isSaving } = useMutation({
    mutationFn: ({ instId, data }: { instId: string; data: any }) =>
      updateInstallment(invoice?._id, instId, data),
    onSuccess: () => {
      toast.success("Installment updated!");
      setEditingId(null);
      setNotesOnlyId(null);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Update failed!"),
  });

  const { mutate: saveAdd, isPending: isAdding } = useMutation({
    mutationFn: (data: any) => addInstallment(invoice?._id, data),
    onSuccess: () => {
      toast.success("Installment added!");
      setShowAddForm(false);
      setAddForm({ label: "", amount: "", dueDate: "", isAdvance: false, isCertificate: false, isManual: false, notes: "", programId: "" });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Add failed!"),
  });

  const { mutate: removeInstallment, isPending: isDeleting } = useMutation({
    mutationFn: ({ instId }: { instId: string }) =>
      deleteInstallment(invoice?._id, instId),
    onSuccess: () => {
      toast.success("Installment deleted!");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Delete failed!"),
  });

  // ── EARLY RETURN — hooks ke baad ─────────────────────────────
  if (!invoice) return null;

  // ── Bundle invoice ke andar mojood programs (dropdown ke liye) ──
  // items[] mein har entry ka apna program + enrollment hota hai (bundle invoices mein multiple ho sakte hain)
  const programOptions: { programId: string; enrollmentId: string; label: string }[] =
    (invoice.items || [])
      .filter((it: any) => it.feeType === "program") // sirf base program items — certificate/manual duplicate items nahi
      .map((it: any) => ({
        programId: typeof it.program === "string" ? it.program : it.program?._id,
        enrollmentId: it.enrollment?._id || it.enrollment,
        label: it.programName || it.enrollment?.program?.name || "Program",
      }))
      .filter((opt: any) => opt.programId);

  const isBundleWithMultiplePrograms = invoice.isBundle && programOptions.length > 1;

  // ── Handlers ─────────────────────────────────────────────────
  const openEdit = (inst: Installment) => {
    setEditingId(inst._id);
    setEditForm({
      label: inst.label,
      amount: String(inst.amount),
      dueDate: inst.dueDate ? inst.dueDate.split("T")[0] : "",
      notes: inst.notes || "",
    });
  };

  const handleSaveEdit = (instId: string) => {
    if (!editForm.label || !editForm.amount)
      return toast.error("Label and amount are required!");

    const inst = installments.find((i) => i._id === instId);
    const isCertAndManu = inst?.feeType === "certificate" || inst?.feeType === "manual";

    saveEdit({
      instId,
      data: {
        label: editForm.label,
        amount: Number(editForm.amount),
        dueDate: isCertAndManu ? null : (editForm.dueDate || undefined),
        notes: editForm.notes || undefined,
      },
    });
  };

  const openNotesOnly = (inst: Installment) => {
    setNotesOnlyId(inst._id);
    setNotesOnlyValue(inst.notes || "");
  };

  const handleSaveNotesOnly = (instId: string) => {
    saveEdit({
      instId,
      data: { notes: notesOnlyValue || undefined },
    });
  };

  const handleAddInstallment = () => {
    if (!addForm.label || !addForm.amount)
      return toast.error("Label and amount required!");

    const isExtraFee = addForm.isCertificate || addForm.isManual;

    // 👇 Bundle invoice mein certificate/manual fee ke liye program select karna zaroori hai,
    // warna backend ko pata nahi chalega ye fee kis program ke liye hai
    if (isExtraFee && isBundleWithMultiplePrograms && !addForm.programId) {
      return toast.error("Please select which program this fee belongs to!");
    }

    const selectedOption = programOptions.find((o) => o.programId === addForm.programId);

    saveAdd({
      label: addForm.label,
      amount: Number(addForm.amount),
      dueDate: isExtraFee ? null : (addForm.dueDate || undefined),
      isAdvance: addForm.isAdvance,
      feeType: addForm.isCertificate ? "certificate" : addForm.isManual ? "manual" : "program",
      notes: addForm.notes || undefined,
      // 👇 sirf tab bhejo jab extra fee ho aur program select kiya gaya ho
      ...(isExtraFee && selectedOption
        ? { programId: selectedOption.programId, enrollmentId: selectedOption.enrollmentId }
        : {}),
    });
  };

  const installments: Installment[] = invoice.installments ?? [];

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-base">Edit Installments</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {invoice.invoiceNumber} &nbsp;·&nbsp;
              {invoice.enrollment?.program?.name || "—"} &nbsp;·&nbsp;
              <span className="font-semibold text-gray-600">
                Total: {fmt(invoice.totalAmount)}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {installments.map((inst, idx) => (
            <div
              key={inst._id}
              className={`rounded-xl border transition-all ${editingId === inst._id
                ? "border-indigo-300 bg-indigo-50/40"
                : "border-gray-100 bg-gray-50/60"
                }`}
            >
              {editingId !== inst._id && notesOnlyId !== inst._id ? (
                /* ── Normal Row ─────────────────────────────── */
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-7 h-7 flex-shrink-0 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{inst.label}</p>
                        {inst.isAdvance && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">
                            Advance
                          </span>
                        )}
                        {inst.feeType === "certificate" && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                            Certificate
                          </span>
                        )}

                        {inst.feeType === "manual" && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                            Manual Fee
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inst.status === "PAID"
                            ? "bg-green-100 text-green-700"
                            : "bg-sky-100 text-sky-700"
                            }`}
                        >
                          {inst.status}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 mt-0.5">
                        Due: {fmtDate(inst.dueDate)}  |  Paid at: {fmtDate(inst.paidAt) ? fmtDate(inst.paidAt) : "—"}
                      </p>
                      {inst.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic truncate">
                          "{inst.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-2">
                    <span className="font-mono font-bold text-sm text-gray-800">
                      {fmt(inst.amount)}
                    </span>
                    {inst.status !== "PAID" ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(inst)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-yellow-100 hover:text-yellow-600 transition"
                          title="Edit installment"
                        >
                          <Pencil size={13} />
                        </button>
                        {(!inst.feeType || inst.feeType === "program") && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${inst.label}"?`)) {
                                removeInstallment({ instId: inst._id });
                              }
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition"
                            title="Delete installment"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openNotesOnly(inst)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 transition"
                          title="Edit notes"
                        >
                          <Pencil size={12} />
                        </button>
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-green-500 bg-green-50">
                          <Check size={13} />
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              ) : notesOnlyId === inst._id ? (
                /* ── Notes-only Edit (for PAID installments) ── */
                <div className="px-4 py-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm">{inst.label}</p>
                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      PAID
                    </span>
                    <span className="font-mono font-bold text-sm text-gray-800 ml-auto">
                      {fmt(inst.amount)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={notesOnlyValue}
                      onChange={(e) => setNotesOnlyValue(e.target.value)}
                      placeholder="Any note about this payment..."
                      className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => setNotesOnlyId(null)}
                      className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveNotesOnly(inst._id)}
                      disabled={isSaving}
                      className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Save size={12} />
                      {isSaving ? "Saving..." : "Save Notes"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Edit Form ──────────────────────────────── */
                <div className="px-4 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Label</label>
                      <input
                        type="text"
                        value={editForm.label}
                        onChange={(e) => setEditForm((p) => ({ ...p, label: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="e.g. Installment 2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Amount (Rs)</label>
                      <input
                        type="number"
                        value={editForm.amount}
                        onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="0"
                        min={0}
                      />
                    </div>
                  </div>
                  {/* <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm((p) => ({ ...p, dueDate: e.target.value }))}
                      className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div> */}
                  {inst.feeType !== "certificate" && inst.feeType !== "manual" && (
                    <AppDatePicker
                      label="Due Date"
                      value={editForm.dueDate}
                      onChange={(value) => setEditForm((p) => ({ ...p, dueDate: value }))}
                    />
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editForm.notes}
                      onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Any note about this installment..."
                      className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(inst._id)}
                      disabled={isSaving}
                      className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Save size={12} />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ── Add Form ─────────────────────────────────────── */}
          {showAddForm && (
            <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 px-4 py-4 space-y-3">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">New Installment</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Label</label>
                  <input
                    type="text"
                    value={addForm.label}
                    onChange={(e) => setAddForm((p) => ({ ...p, label: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="e.g. Installment 3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Amount (Rs)</label>
                  <input
                    type="number"
                    value={addForm.amount}
                    onChange={(e) => setAddForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="0"
                    min={0}
                  />
                </div>
              </div>
              {/* <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Due Date</label>
                <input
                  type="date"
                  value={addForm.dueDate}
                  onChange={(e) => setAddForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div> */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={addForm.notes}
                  onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Any note about this installment..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>

              {/* 👇 Due Date — sirf tab dikhao jab certificate na ho */}
              {!addForm.isCertificate && !addForm.isManual && (
                <AppDatePicker
                  label="Due Date"
                  value={addForm.dueDate}
                  onChange={(value) => setAddForm((p) => ({ ...p, dueDate: value }))}
                />
              )}
              {/* <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={addForm.isAdvance}
                  onChange={(e) => setAddForm((p) => ({ ...p, isAdvance: e.target.checked }))}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <span className="text-xs font-semibold text-amber-700">Mark as Advance Payment</span>
              </label> */}
              <label className="flex items-center gap-2 cursor-pointer w-fit mt-2">
                <input
                  type="checkbox"
                  checked={addForm.isAdvance}
                  onChange={(e) => setAddForm((p) => ({ ...p, isAdvance: e.target.checked }))}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <span className="text-xs font-semibold text-amber-700">Mark as Advance Payment</span>
              </label>

              {/* 👇 Certificate fee checkbox */}
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={addForm.isCertificate}
                  onChange={(e) =>
                    setAddForm((p) => ({
                      ...p,
                      isCertificate: e.target.checked,
                      isManual: e.target.checked ? false : p.isManual,
                      dueDate: e.target.checked ? "" : p.dueDate, // ✅ clear on check
                    }))
                  }
                  className="w-4 h-4 accent-purple-500 rounded"
                />
                <span className="text-xs font-semibold text-purple-700">Mark as Certificate Fee</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={addForm.isManual}
                  onChange={(e) =>
                    setAddForm((p) => ({
                      ...p,
                      isManual: e.target.checked,
                      isCertificate: e.target.checked ? false : p.isCertificate,
                      dueDate: e.target.checked ? "" : p.dueDate,
                    }))
                  }
                  className="w-4 h-4 accent-teal-500 rounded"
                />
                <span className="text-xs font-semibold text-teal-700">Mark as Manual Fee</span>
              </label>

              {/* 👇 NEW: Program selector — sirf bundle invoice (multiple programs) + certificate/manual fee ke liye */}
              {(addForm.isCertificate || addForm.isManual) && isBundleWithMultiplePrograms && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Which program is this fee for? <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={addForm.programId}
                    onChange={(e) => setAddForm((p) => ({ ...p, programId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">Select program…</option>
                    {programOptions.map((opt) => (
                      <option key={opt.programId} value={opt.programId}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Ye invoice bundle hai — is fee ko sahi program se attach karne ke liye select karein.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddInstallment}
                  disabled={isAdding}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus size={12} />
                  {isAdding ? "Adding..." : "Add Installment"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex gap-5 text-xs">
            <div>
              <span className="text-gray-400">Paid: </span>
              <span className="font-bold text-green-600 font-mono">{fmt(invoice.paidAmount)}</span>
            </div>
            <div>
              <span className="text-gray-400">Remaining: </span>
              <span className="font-bold text-rose-500 font-mono">{fmt(invoice.remainingAmount)}</span>
            </div>
          </div>

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
            >
              <Plus size={13} />
              Add Installment
            </button>
          )}
        </div>

      </div>
    </div>
  );
}