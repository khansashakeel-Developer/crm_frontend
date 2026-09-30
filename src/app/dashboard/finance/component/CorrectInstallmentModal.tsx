"use client";
import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { correctPaidInstallment } from "@/utils/api";
import toast from "react-hot-toast";

export default function CorrectInstallmentModal({ invoice, installment, onClose }: any) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(installment?.amount || 0);
  const [paidDate, setPaidDate] = useState(
    installment?.paidAt ? new Date(installment.paidAt).toISOString().split("T")[0] : ""
  );
  const [reason, setReason] = useState("");
  const [adjustTotal, setAdjustTotal] = useState(false);
  const [syncQbo, setSyncQbo] = useState(false);

  const { mutate: correct, isPending } = useMutation({
    mutationFn: () =>
      correctPaidInstallment(invoice._id, installment._id, { amount, paidDate, reason, adjustTotal, syncQbo }),
    onSuccess: (res: any) => {
      const q = res?.data?.qboSync;
      if (q?.status === "failed") {
        toast.error(`CRM corrected, but QBO sync failed: ${q.message}`);
      } else if (q?.status === "synced") {
        toast.success("Payment corrected in CRM & QuickBooks ✅");
      } else if (q?.status === "skipped") {
        toast.success(`Payment corrected in CRM. QBO skipped: ${q.message}`);
      } else {
        toast.success("Payment corrected — journal & balances updated ✅");
      }
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Correction failed!"),
  });

  if (!installment) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            Correct Payment — {installment.label}
          </h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Use this if the recorded amount or bank date was wrong (e.g. confirmed via bank statement).
          The old journal entry will be reversed and reposted with corrected figures.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Correct Amount (Rs)</label>
            <input
              type="number" value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full placeholder:text-gray-600 text-gray-600 border rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Correct Bank Received Date</label>
            <input
              type="date" value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full placeholder:text-gray-600 text-gray-600 border rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">
              Reason for correction <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bank statement confirmed amount was 50,000 not 55,000; received 1 day earlier"
              rows={2}
              className="w-full placeholder:text-gray-600 text-gray-600 border rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-xs text-gray-600 mt-2">
          <input
            type="checkbox"
            checked={adjustTotal}
            onChange={(e) => setAdjustTotal(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            The <strong>fee amount has been changed automatically</strong>. Please adjust the invoice total accordingly.
            <br />
            <span className="text-gray-400">
              If only the collection/receipt was recorded incorrectly, leave this unchecked.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-xs text-gray-600 mt-3">
          <input
            type="checkbox"
            checked={syncQbo}
            onChange={(e) => setSyncQbo(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <strong>Also update in QuickBooks</strong>
            <br />
            <span className="text-gray-400">
              Corrected amount, date and method will be pushed to the linked QBO payment. Leave unchecked to correct in CRM only.
            </span>
          </span>
        </label>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border text-sm text-gray-500">Cancel</button>
          <button
            onClick={() => reason.trim() ? correct() : toast.error("Reason is required")}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {isPending ? "Correcting..." : "Confirm Correction"}
          </button>
        </div>
      </div>
    </div>
  );
}