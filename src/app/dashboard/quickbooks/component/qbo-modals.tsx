"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Link2, Loader2, PlayCircle, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { linkQboRecord, dryRunQboInvoice, syncQboInvoiceNow, syncQboPaymentNow, getUnlinkedCrmRecords } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";

type EntityType = "invoice" | "payment" | "customer";

export function LinkQboModal({
  open, onClose, type, qboId, label,
}: { open: boolean; onClose: () => void; type: EntityType; qboId: string; label: string }) {
  const [search, setSearch] = useState("");
  // 🔎 debounced search term — the backend now does a live QBO fetch per search
  // (to catch stale/invalid links, not just null ones), so firing on every
  // keystroke would hammer the QBO API. 400ms after the user stops typing.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 📄 how many results to show — grows on "Load More" instead of a fixed top-20
  const [limit, setLimit] = useState(20);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // reset back to 20 whenever the search term changes
  useEffect(() => {
    setLimit(20);
  }, [debouncedSearch]);

  const { data: response, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["qbo-unlinked", type, debouncedSearch, limit],
    queryFn: () => getUnlinkedCrmRecords(type, debouncedSearch, limit).then((r) => r.data),
    enabled: open,
  });

  const data = response?.data;
  const total = response?.total ?? data?.length ?? 0;

  const { mutate: link, isPending } = useMutation({
    mutationFn: () => linkQboRecord(type, selectedId!, qboId),
    onSuccess: () => {
      toast.success("Linked to QBO ✅");
      queryClient.invalidateQueries({ queryKey: [`qbo-compare-${type}s`] });
      setSearch("");
      setDebouncedSearch("");
      setSelectedId(null);
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Link failed ❌"),
  });

  if (!open) return null;

  const showLoading = isLoading || isFetching;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-800 flex items-center gap-2">
            <Link2 size={16} className="text-yellow-500" />
            Link to CRM Record
          </p>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-400 mb-3">{label}</p>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedId(null); }}
            placeholder={type === "invoice" ? "Search invoice #..." : type === "customer" ? "Search name/email..." : "Search customer name..."}
            className="w-full border border-gray-200 placeholder:text-gray-400 text-gray-400 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
          />
        </div>

        <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-xl mb-4 divide-y divide-gray-50">
          {showLoading ? (
            <div className="p-4 text-center text-xs text-gray-400">Searching...</div>
          ) : isError ? (
            <div className="p-4 text-center text-xs text-rose-500">
              Couldn't load records — {(error as any)?.response?.data?.message || "check your connection and try again"}
            </div>
          ) : !data?.length ? (
            <div className="p-4 text-center text-xs text-gray-400">No unlinked CRM records found</div>
          ) : (
            data.map((rec: any) => (
              <button
                key={rec.id}
                onClick={() => setSelectedId(rec.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedId === rec.id ? "bg-yellow-50 text-gray-800" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {rec.label}
                {selectedId === rec.id && <CheckCircle2 size={14} className="text-yellow-500 shrink-0" />}
              </button>
            ))
          )}
        </div>

        {!showLoading && data && data.length > 0 && (
          <p className="text-[11px] text-gray-400 -mt-2.5 mb-3">
            Showing {data.length} of {total}
            {data.length < total && (
              <button
                onClick={() => setLimit((l) => l + 20)}
                className="ml-2 text-yellow-600 hover:text-yellow-700 font-medium"
              >
                Load More
              </button>
            )}
          </p>
        )}

        <button
          onClick={() => selectedId && link()}
          disabled={isPending || !selectedId}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
          Link Selected Record
        </button>
      </div>
    </div>
  );
}

export function DryRunModal({
  open, onClose, invoiceId,
}: { open: boolean; onClose: () => void; invoiceId: string }) {
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const runDryRun = async () => {
    setRunning(true);
    try {
      const res = await dryRunQboInvoice(invoiceId);
      setResult(res.data.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Dry run failed ❌");
    } finally {
      setRunning(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await syncQboInvoiceNow(invoiceId);
      toast.success("Synced to QBO ✅");
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Sync failed ❌");
    } finally {
      setSyncing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-800 flex items-center gap-2">
            <PlayCircle size={16} className="text-yellow-500" />
            Sync Preview (Dry Run)
          </p>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        {!result ? (
          <button
            onClick={runDryRun}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
            Run Preview
          </button>
        ) : (
          <>
            <pre className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 overflow-x-auto mb-4">
              {JSON.stringify(result, null, 2)}
            </pre>
            <p className="text-xs text-gray-400 mb-4">
              Nothing has been sent to QBO yet. Confirm to actually sync.
            </p>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
              Confirm & Sync Now
            </button>
          </>
        )}
      </div>
    </div>
  );
}



export function ConfirmModal({
  open, onClose, onConfirm, title, description, isLoading, confirmLabel = "Confirm", danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isLoading?: boolean;
  confirmLabel?: string;
  danger?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${danger ? "bg-rose-50" : "bg-yellow-50"}`}>
            <AlertTriangle size={18} className={danger ? "text-rose-500" : "text-yellow-500"} />
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <p className="font-semibold text-gray-800 mb-1">{title}</p>
        <p className="text-sm text-gray-500 mb-5">{description}</p>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-60 ${
              danger ? "bg-rose-600 hover:bg-rose-700" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}