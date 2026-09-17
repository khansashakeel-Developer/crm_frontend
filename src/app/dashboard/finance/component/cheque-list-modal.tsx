"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bounceCheque, discardCheque, returnCheque, updateCheque, getInvoiceCheques, getInvoiceById, recordChequePayment } from "@/utils/api";
import toast from "react-hot-toast";
import { X, FileText, Ban, CheckCircle2, Plus, Trash2 } from "lucide-react";


const fmt = (n: number) => `Rs ${Number(n || 0).toLocaleString("en-PK")}`;
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "No expiry";

const statusStyle = (status: string) => {
  const map: Record<string, string> = {
    pending: "bg-sky-100 text-sky-700",
    cleared: "bg-green-100 text-green-700",
    bounced: "bg-rose-100 text-rose-700",
    returned: "bg-gray-200 text-gray-600",
  };
  return map[status] || "bg-gray-100 text-gray-600";
};

// Computed, not stored — a pending cheque with a date is valid for 6 months
// from that date. No date = never expires.
function getValidity(cheque: any): "valid" | "expired" | null {
  if (cheque.status !== "pending") return null;
  if (!cheque.date) return "valid";
  const expiry = new Date(cheque.date);
  expiry.setMonth(expiry.getMonth() + 6);
  return Date.now() > expiry.getTime() ? "expired" : "valid";
}

const todayStr = () => new Date().toISOString().split("T")[0];

interface Props {
  invoice: any;
  onClose: () => void;
  preselectedInstallmentId?: string | null;
}

export default function ChequeListModal({ invoice, onClose, preselectedInstallmentId }: Props) {
  const queryClient = useQueryClient();
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [bouncingChequeId, setBouncingChequeId] = useState<string | null>(null);
  const [bounceForm, setBounceForm] = useState({ depositDate: "", bounceDate: "", reason: "" });
  const [editingChequeId, setEditingChequeId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ accountHolderName: "", chequeNumber: "", amount: "", date: "" });
  const [showAddForm, setShowAddForm] = useState(!!preselectedInstallmentId);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [cheques, setCheques] = useState([{ chequeNumber: "", amount: "", date: "" }]);
  const [isBackfill, setIsBackfill] = useState(false);

  const { data: liveInvoice } = useQuery({
    queryKey: ["invoice-cheques-invoice", invoice?._id],
    queryFn: () => getInvoiceById(invoice._id).then((r) => r.data.data),
    enabled: !!invoice?._id,
    initialData: invoice || undefined,
  });

  const { data: chequeList = [] } = useQuery({
    queryKey: ["invoice-cheques", invoice?._id],
    queryFn: () => getInvoiceCheques(invoice._id).then((r) => r.data.data),
    enabled: !!invoice?._id,
  });

  const resetForm = () => {
    setAccountHolderName("");
    setCheques([{ chequeNumber: "", amount: "", date: "" }]);
    setIsBackfill(false);
  };

  const addRow = () => setCheques((p) => [...p, { chequeNumber: "", amount: "", date: "" }]);
  const removeRow = (idx: number) => setCheques((p) => p.filter((_, i) => i !== idx));
  const updateRow = (idx: number, field: "chequeNumber" | "amount" | "date", value: string) =>
    setCheques((p) => p.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));

  const total = cheques.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const activeInvoice = liveInvoice || invoice;
  const isZeroRemaining = (activeInvoice?.remainingAmount || 0) <= 0;
  const isFormValid =
    accountHolderName.trim() &&
    cheques.length > 0 &&
    cheques.every((c) => c.chequeNumber.trim() && Number(c.amount) > 0) &&
    total > 0 &&
    (isBackfill
      ? total <= (activeInvoice?.totalAmount || 0)
      : total <= (activeInvoice?.remainingAmount || 0));

      const { mutate: submitCheques, isPending: isSubmitting } = useMutation({
    mutationFn: () =>
      recordChequePayment(invoice._id, {
        accountHolderName: accountHolderName.trim(),
        cheques: cheques.map((c) => ({
          chequeNumber: c.chequeNumber.trim(),
          amount: Number(c.amount),
          date: c.date || undefined,
        })),
        isBackfill,
      }),
    onSuccess: () => {
      toast.success("Cheque payment recorded");
      resetForm();
      setShowAddForm(false);
      queryClient.invalidateQueries({ queryKey: ["invoice-cheques", invoice._id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-cheques-invoice", invoice._id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to record cheque payment"),
  });

    const { mutate: runDiscard, isPending: isDiscarding, variables: pendingVars } = useMutation({
    mutationFn: ({ chequeId }: { chequeId: string }) =>
      discardCheque(invoice._id, chequeId, "Discarded by finance team"),
    onSuccess: () => {
      toast.success("Cheque cleared — payment recorded");
      setConfirmingKey(null);
      queryClient.invalidateQueries({ queryKey: ["invoice-cheques", invoice._id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-cheques-invoice", invoice._id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to clear cheque"),
  });

    const { mutate: runReturn, isPending: isReturning, variables: returnVars } = useMutation({
    mutationFn: ({ chequeId }: { chequeId: string }) => returnCheque(invoice._id, chequeId),
    onSuccess: () => {
      toast.success("Cheque returned to client");
      queryClient.invalidateQueries({ queryKey: ["invoice-cheques", invoice._id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to return cheque"),
  });

    const { mutate: runUpdate, isPending: isUpdating } = useMutation({
    mutationFn: ({ chequeId }: { chequeId: string }) =>
      updateCheque(invoice._id, chequeId, {
        accountHolderName: editForm.accountHolderName.trim(),
        chequeNumber: editForm.chequeNumber.trim(),
        amount: Number(editForm.amount),
        date: editForm.date || undefined,
      }),
    onSuccess: () => {
      toast.success("Cheque updated");
      setEditingChequeId(null);
      queryClient.invalidateQueries({ queryKey: ["invoice-cheques", invoice._id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to update cheque"),
  });

  const startEdit = (cheque: any) => {
    setEditingChequeId(cheque._id);
    setEditForm({
      accountHolderName: cheque.accountHolderName || "",
      chequeNumber: cheque.chequeNumber || "",
      amount: String(cheque.amount || ""),
      date: cheque.date ? cheque.date.split("T")[0] : "",
    });
  };

  const { mutate: runBounce, isPending: isBouncing } = useMutation({
    mutationFn: ({ chequeId }: { chequeId: string }) =>
      bounceCheque(invoice._id, chequeId, bounceForm),
    onSuccess: () => {
      toast.success("Cheque marked as bounced");
      setBouncingChequeId(null);
      setBounceForm({ depositDate: "", bounceDate: "", reason: "" });
      queryClient.invalidateQueries({ queryKey: ["invoice-cheques", invoice._id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to mark cheque bounced"),
  });

  if (!invoice) return null;

  const totalCount = chequeList.length;
  const totalAmount = chequeList.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
  const discardedAmount = chequeList
    .filter((c: any) => c.status === "discarded")
    .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
  const netAmount = totalAmount - discardedAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText size={16} className="text-violet-500" />
              Cheques
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{invoice.invoiceNumber} — {invoice.user?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400">Total</p>
              <p className="text-sm font-bold text-gray-800">{fmt(activeInvoice?.totalAmount)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400">Paid</p>
              <p className="text-sm font-bold text-green-700">{fmt(activeInvoice?.paidAmount)}</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400">Remaining</p>
              <p className="text-sm font-bold text-rose-600">{fmt(activeInvoice?.remainingAmount)}</p>
            </div>
          </div>

          {totalCount > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-700">{totalCount} cheque(s) total</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-violet-600">Cheque Amount</span>
                <span className="text-sm font-bold text-violet-800">{fmt(totalAmount)}</span>
              </div>
              {discardedAmount > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-rose-500">Discarded</span>
                    <span className="text-xs font-semibold text-rose-500">- {fmt(discardedAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-violet-200 pt-1.5">
                    <span className="text-xs font-semibold text-violet-700">Net Active</span>
                    <span className="text-sm font-bold text-emerald-600">{fmt(netAmount)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {chequeList.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No cheques recorded on this invoice yet.</p>
          )}

          {chequeList.length > 0 && (
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
              {chequeList.map((cheque: any) => {
                const validity = getValidity(cheque);
                const key = cheque._id;
                const isThisPending = isDiscarding && pendingVars?.chequeId === cheque._id;

                return (
                  <div key={cheque._id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">Cheque #{cheque.chequeNumber}</p>
                        <p className="text-xs text-gray-400">{fmtDate(cheque.date)} · {cheque.accountHolderName}</p>
                      
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">{fmt(cheque.amount)}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${statusStyle(cheque.status)}`}>
                          {cheque.status === "discarded" && <Ban size={10} />}
                          {cheque.status === "cleared" && <CheckCircle2 size={10} />}
                          {cheque.status}
                        </span>
                        {validity && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${validity === "valid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {validity}
                          </span>
                        )}
                      </div>
                    </div>

                                        {cheque.status === "pending" && validity !== "expired" && (
                      <>
                                                <div className="flex justify-end gap-3 mt-1.5">
                          {confirmingKey === key ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-gray-500">Deposit & count as payment?</span>
                              <button
                                onClick={() => runDiscard({ chequeId: cheque._id })}
                                disabled={isDiscarding}
                                className="text-[11px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 px-2 py-0.5 rounded-md disabled:opacity-50"
                              >
                                {isThisPending ? (
                                  <span className="w-3 h-3 inline-block border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                ) : (
                                  "Yes"
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmingKey(null)}
                                disabled={isDiscarding}
                                className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded-md disabled:opacity-50"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => runReturn({ chequeId: cheque._id })}
                                disabled={isReturning}
                                className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-50"
                              >
                                {isReturning && returnVars?.chequeId === cheque._id ? (
                                  <span className="w-3 h-3 inline-block border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                ) : (
                                  <CheckCircle2 size={12} />
                                )}
                                Return
                              </button>

                              <button
                                onClick={() => setConfirmingKey(key)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                              >
                                Deposit
                              </button>
                            </>
                          )}

                                                    {bouncingChequeId !== cheque._id && (
                            <button
                              onClick={() => setBouncingChequeId(cheque._id)}
                              className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600"
                            >
                              <Ban size={12} />
                              Bounce
                            </button>
                          )}

                          {confirmingKey !== key && bouncingChequeId !== cheque._id && (
                            <button
                              onClick={() => startEdit(cheque)}
                              className="text-[11px] font-semibold text-violet-500 hover:text-violet-600"
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {editingChequeId === cheque._id && (
                          <div className="mt-2 border border-violet-200 bg-violet-50/40 rounded-lg p-2.5 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Edit Cheque</p>
                            <input
                              type="text"
                              placeholder="Account Holder Name *"
                              value={editForm.accountHolderName}
                              onChange={(e) => setEditForm((p) => ({ ...p, accountHolderName: e.target.value }))}
                              className="w-full text-xs rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-300"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <input
                                type="text"
                                placeholder="Cheque No. *"
                                value={editForm.chequeNumber}
                                onChange={(e) => setEditForm((p) => ({ ...p, chequeNumber: e.target.value }))}
                                className="text-xs rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-300"
                              />
                              <input
                                type="number"
                                placeholder="Amount *"
                                value={editForm.amount}
                                onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                                className="text-xs rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-300"
                              />
                            </div>
                            <input
                              type="date"
                              value={editForm.date}
                              onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                              className="w-full text-xs rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                            />
                            <div className="flex gap-2 justify-end pt-0.5">
                              <button
                                onClick={() => setEditingChequeId(null)}
                                className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => runUpdate({ chequeId: cheque._id })}
                                disabled={
                                  isUpdating ||
                                  !editForm.accountHolderName.trim() ||
                                  !editForm.chequeNumber.trim() ||
                                  !(Number(editForm.amount) > 0)
                                }
                                className="text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1 rounded-md disabled:opacity-50"
                              >
                                {isUpdating ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        )}

                        {bouncingChequeId === cheque._id && (
                          <div className="mt-2 border border-rose-200 bg-rose-50 rounded-lg p-2.5 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Mark as Bounced</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="text-[9px] text-rose-500">Deposit Date *</label>
                                <input
                                  type="date"
                                  value={bounceForm.depositDate}
                                  onChange={(e) => setBounceForm((p) => ({ ...p, depositDate: e.target.value }))}
                                  className="w-full text-xs rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-rose-500">Bounce Date *</label>
                                <input
                                  type="date"
                                  value={bounceForm.bounceDate}
                                  onChange={(e) => setBounceForm((p) => ({ ...p, bounceDate: e.target.value }))}
                                  className="w-full text-xs rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
                                />
                              </div>
                            </div>
                            <input
                              type="text"
                              placeholder="Reason (optional)"
                              value={bounceForm.reason}
                              onChange={(e) => setBounceForm((p) => ({ ...p, reason: e.target.value }))}
                              className="w-full text-xs rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-300"
                            />
                            <div className="flex justify-end gap-2 pt-0.5">
                              <button
                                onClick={() => { setBouncingChequeId(null); setBounceForm({ depositDate: "", bounceDate: "", reason: "" }); }}
                                className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => runBounce({ chequeId: cheque._id })}
                                disabled={!bounceForm.depositDate || !bounceForm.bounceDate || isBouncing}
                                className="text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 px-3 py-1 rounded-md disabled:opacity-50"
                              >
                                {isBouncing ? "Saving..." : "Confirm Bounce"}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {cheque.status === "bounced" && (
                      <p className="text-[10px] text-rose-500 mt-1">
                        Deposited {fmtDate(cheque.depositDate)} · Bounced {fmtDate(cheque.bounceDate)}
                        {cheque.bounceReason ? ` · ${cheque.bounceReason}` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!showAddForm ? (
            <button
              onClick={() => { setShowAddForm(true); setIsBackfill(isZeroRemaining); }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-violet-200 text-sm font-semibold text-violet-600 hover:bg-violet-50"
            >
             <Plus size={14} />
              Record New Cheque(s)
            </button>
          ) : (
            <div className="border border-violet-200 rounded-xl bg-violet-50/40 p-3 space-y-2.5">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
                {isBackfill ? "Historical Cheque Entry" : "New Cheque Payment"}
              </p>

              <label className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-[10px] text-amber-700">
                <input
                  type="checkbox"
                  checked={isBackfill}
                  onChange={(e) => setIsBackfill(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  This is a historical cheque already accounted for (e.g. from before this system). Logging it here
                  is for record-keeping only — it will <b>not</b> change Paid/Remaining amounts.
                </span>
              </label>

              <input
                type="text"
                placeholder="Account Holder Name *"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                className="w-full text-xs rounded-lg border border-violet-200 bg-white px-3 py-2 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />

              <div className="space-y-2">
                {cheques.map((c, idx) => (
                  <div key={idx} className="rounded-lg border border-violet-200 bg-white p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400">Cheque {idx + 1}</span>
                      {cheques.length > 1 && (
                        <button onClick={() => removeRow(idx)} className="text-[10px] text-rose-400 hover:text-rose-600 font-semibold">
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="Cheque No. *"
                        value={c.chequeNumber}
                        onChange={(e) => updateRow(idx, "chequeNumber", e.target.value)}
                        className="text-xs rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                      <input
                        type="number"
                        placeholder="Amount *"
                        value={c.amount}
                        onChange={(e) => updateRow(idx, "amount", e.target.value)}
                        className="text-xs rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                    </div>
                    <input
                      type="date"
                      value={c.date}
                      onChange={(e) => updateRow(idx, "date", e.target.value)}
                      className="w-full text-xs rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                    <p className="text-[9px] text-slate-400">Date optional — leave blank if the cheque never expires.</p>
                  </div>
                ))}
              </div>

              <button onClick={addRow} className="text-[10px] font-bold text-violet-600 hover:text-violet-700">
                + Add another cheque
              </button>

              <div className={`flex items-center justify-between text-[10px] font-semibold px-2 py-1.5 rounded-lg ${
                total > 0 && (isBackfill ? total <= (activeInvoice?.totalAmount || 0) : total <= (activeInvoice?.remainingAmount || 0))
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-600"
              }`}>
                <span>Cheque Total: {fmt(total)}</span>
                {isBackfill ? (
                  <span>Invoice Total: {fmt(activeInvoice?.totalAmount || 0)}</span>
                ) : (
                  <span>Remaining: {fmt(activeInvoice?.remainingAmount || 0)}</span>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => { setShowAddForm(false); resetForm(); }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => submitCheques()}
                  disabled={!isFormValid || isSubmitting}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Cheques"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}