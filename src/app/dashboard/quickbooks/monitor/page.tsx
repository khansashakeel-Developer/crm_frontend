"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/app/component/protected-route";
import PageHeader from "@/app/component/dashboard/page-header";
import {
  Activity, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { getQboHealth, retryQboFailed, retryQboSingle } from "@/utils/api";

const fmt = (n: number) => `Rs ${(n || 0).toLocaleString()}`;

function StatusCard({ label, synced, failed, notSynced }: { label: string; synced: number; failed: number; notSynced: number }) {
  const total = synced + failed + notSynced;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        <span className="text-xs text-gray-400">{total} total</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-50 rounded-xl py-2">
          <p className="text-lg font-bold text-green-600">{synced}</p>
          <p className="text-[10px] text-green-600">Synced</p>
        </div>
        <div className="bg-rose-50 rounded-xl py-2">
          <p className="text-lg font-bold text-rose-600">{failed}</p>
          <p className="text-[10px] text-rose-600">Failed</p>
        </div>
        <div className="bg-gray-50 rounded-xl py-2">
          <p className="text-lg font-bold text-gray-500">{notSynced}</p>
          <p className="text-[10px] text-gray-500">Not Synced</p>
        </div>
      </div>
    </div>
  );
}

function QboMonitorContent() {
  const queryClient = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["qbo-health"],
    queryFn: () => getQboHealth().then((r) => r.data.data),
    refetchInterval: 60000,
  });

  const { mutate: retryAll, isPending: retryingAll } = useMutation({
    mutationFn: (type: "invoices" | "payments" | "both") => retryQboFailed(type),
    onSuccess: (res) => {
      const s = res.data.summary;
      toast.success(
        `Retried ${s.invoicesRetried + s.paymentsRetried} — ${s.invoicesSucceeded + s.paymentsSucceeded} succeeded`
      );
      queryClient.invalidateQueries({ queryKey: ["qbo-health"] });
    },
    onError: () => toast.error("Retry failed"),
  });

  const handleRetrySingle = async (type: "invoice" | "payment", id: string) => {
    setRetryingId(id);
    try {
      await retryQboSingle(type, id);
      toast.success("Synced successfully ✅");
      queryClient.invalidateQueries({ queryKey: ["qbo-health"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Sync failed ❌");
    } finally {
      setRetryingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading sync health...</p>
      </div>
    );
  }

  if (isError || !data) {
    return <div className="text-center py-16 text-rose-500 text-sm">Failed to load sync health</div>;
  }

  const { token, invoices, payments, customers, recentFailures } = data;
  const totalFailed = (invoices.failed || 0) + (payments.failed || 0);

  return (
    <>
      <PageHeader
        title="QBO Sync Health"
        subtitle="Monitor sync status and retry failed records"
        titleIcon={<Activity size={24} />}
      />

      {/* Token status */}
      <div
        className={`rounded-2xl p-4 mb-6 flex items-center justify-between ${
          token.warning ? "bg-rose-50 border border-rose-100" : "bg-green-50 border border-green-100"
        }`}
      >
        <div className="flex items-center gap-3">
          {token.warning ? (
            <AlertTriangle size={18} className="text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="text-green-600 shrink-0" />
          )}
          <div>
            <p className={`text-sm font-medium ${token.warning ? "text-rose-700" : "text-green-700"}`}>
              {token.warning || "QuickBooks connection healthy"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {token.environment} · {token.realmId ? `Realm ${token.realmId}` : "No realm"}
              {token.expiresAt ? ` · Expires ${new Date(token.expiresAt).toLocaleDateString("en-PK")}` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white transition-colors"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatusCard label="Invoices" synced={invoices.synced} failed={invoices.failed} notSynced={invoices.not_synced} />
        <StatusCard label="Payments" synced={payments.synced} failed={payments.failed} notSynced={payments.not_synced} />
        <StatusCard label="Customers" synced={customers.synced} failed={customers.failed} notSynced={customers.not_synced} />
      </div>

      {/* Retry all */}
      {totalFailed > 0 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-rose-600">{totalFailed}</span> record(s) failed to sync
          </p>
          <button
            onClick={() => retryAll("both")}
            disabled={retryingAll}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-800 text-white text-xs font-medium hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            {retryingAll ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Retry All Failed
          </button>
        </div>
      )}

      {/* Recent failures — invoices */}
      {recentFailures.invoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <XCircle size={14} className="text-rose-500" />
            Recent Failed Invoices
          </p>
          <div className="space-y-2">
            {recentFailures.invoices.map((inv: any) => (
              <div key={inv._id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">{inv.invoiceNumber}</p>
                  <p className="text-xs text-rose-500 mt-0.5">{inv.qboSyncError || "Unknown error"}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    <Clock size={10} className="inline mr-1" />
                    {new Date(inv.updatedAt).toLocaleString("en-PK")}
                  </p>
                </div>
                <button
                  onClick={() => handleRetrySingle("invoice", inv._id)}
                  disabled={retryingId === inv._id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white transition-colors disabled:opacity-60"
                >
                  {retryingId === inv._id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Retry
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent failures — payments */}
      {recentFailures.payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <XCircle size={14} className="text-rose-500" />
            Recent Failed Payments
          </p>
          <div className="space-y-2">
            {recentFailures.payments.map((p: any) => (
              <div key={p._id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {fmt(p.amount)} · {p.invoice?.invoiceNumber || "—"}
                  </p>
                  <p className="text-xs text-rose-500 mt-0.5">{p.qboSyncError || "Unknown error"}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    <Clock size={10} className="inline mr-1" />
                    {new Date(p.updatedAt).toLocaleString("en-PK")}
                  </p>
                </div>
                <button
                  onClick={() => handleRetrySingle("payment", p._id)}
                  disabled={retryingId === p._id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white transition-colors disabled:opacity-60"
                >
                  {retryingId === p._id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Retry
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalFailed === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle2 size={32} className="text-green-400" />
          <p className="text-sm text-gray-400">No failed syncs — everything up to date</p>
        </div>
      )}
    </>
  );
}

export default function QboMonitorPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin", "finance_manager"]}>
      <QboMonitorContent />
    </ProtectedRoute>
  );
}