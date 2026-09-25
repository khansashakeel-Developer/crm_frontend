"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import ProtectedRoute from "@/app/component/protected-route";
import PageHeader from "@/app/component/dashboard/page-header";
import DynamicTable from "@/app/component/dashboard/dynamic-table";
import { Users, FileText, Receipt, GitCompare, LinkIcon, Unlink, Download } from "lucide-react";
import { compareQboCustomers, compareQboInvoices, compareQboPayments, unlinkQboRecord } from "@/utils/api";
import { LinkQboModal, ConfirmModal } from "../component/qbo-modals";
import toast from "react-hot-toast";
import { QboImportModal } from "../../finance/component/qbo-import-modal";
import ExportButton from "@/app/component/ui/export-button"; // ✅ path apne project ke hisab se adjust karein

type Tab = "invoices" | "payments" | "customers";
type MatchFilter = "all" | "matched" | "only_crm" | "only_qbo";

const PAGE_SIZE = 10;

const fmt = (n: number) => `Rs ${(n || 0).toLocaleString()}`;
const norm = (s: string) => (s || "").trim().toLowerCase();

const matchBadge: Record<string, { label: string; color: string }> = {
  matched: { label: "Matched", color: "bg-green-100 text-green-700" },
  only_crm: { label: "Only in CRM", color: "bg-yellow-100 text-yellow-700" },
  only_qbo: { label: "Only in QBO", color: "bg-rose-100 text-rose-700" },
};

function MatchTag({ match }: { match: string }) {
  const cfg = matchBadge[match] || matchBadge.matched;
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function SummaryBar({
  summary,
  missingInvoice,
  missingPayment,
}: {
  summary: { matched: number; onlyCrm: number; onlyQbo: number };
  missingInvoice?: boolean;
  missingPayment?: boolean;
}) {
  const items = [
    { label: missingInvoice || missingPayment ? "Filtered" : "Matched", value: summary.matched, color: "text-green-600", bg: "bg-green-50" },
    { label: "Only in CRM", value: summary.onlyCrm, color: "text-yellow-700", bg: "bg-yellow-50" },
    { label: "Only in QBO", value: summary.onlyQbo, color: "text-rose-600", bg: "bg-rose-50" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {items.map((i) => (
        <div key={i.label} className={`${i.bg} rounded-2xl p-4 text-center`}>
          <p className="text-xs text-gray-400 mb-1">{i.label}</p>
          <p className={`font-bold text-lg ${i.color}`}>{i.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── shows how many of the currently-filtered rows exist in CRM vs QBO ──
function FilterCounterBar({ rows }: { rows: any[] }) {
  const inCrm = rows.filter((r) => r.crm?.exists).length;
  const inQbo = rows.filter((r) => r.qbo?.exists).length;
  return (
    <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
      <span>Filtered: <b className="text-gray-700">{rows.length}</b></span>
      <span>In CRM: <b className="text-green-600">{inCrm}</b></span>
      <span>In QBO: <b className="text-indigo-600">{inQbo}</b></span>
    </div>
  );
}

// ── Detail modal: shows one invoice's full detail + all its payments ──
// ✅ Fix: ExportButton yahan se hata diya — ye modal ke scope mein
// matchFilter/tab/recordFiltered use kar raha tha jo yahan define hi nahi hote.
function InvoiceDetailModal({
  invoiceNumber,
  onClose,
}: {
  invoiceNumber: string | null;
  onClose: () => void;
}) {
  const invoicesQ = useQuery({
    queryKey: ["qbo-compare-invoices"],
    queryFn: () => compareQboInvoices().then((r) => r.data),
    enabled: !!invoiceNumber,
  });
  const paymentsQ = useQuery({
    queryKey: ["qbo-compare-payments"],
    queryFn: () => compareQboPayments().then((r) => r.data),
    enabled: !!invoiceNumber,
  });

  if (!invoiceNumber) return null;

  const invRow = (invoicesQ.data?.data || []).find((r: any) => String(r.invoiceNumber) === String(invoiceNumber));
  const payRows = (paymentsQ.data?.data || []).filter((r: any) => String(r.invoiceNumber) === String(invoiceNumber));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Invoice #{invoiceNumber}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>

        {invRow ? (
          <div className="border border-gray-100 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-500 mb-2">{invRow.customer || "—"}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">CRM Amount</p>
                <p className="font-semibold">{invRow.crm.exists ? `Rs ${(invRow.crm.netAmount || 0).toLocaleString()}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">QBO Amount</p>
                <p className="font-semibold">{invRow.qbo.exists ? `Rs ${(invRow.qbo.totalAmt || 0).toLocaleString()}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">CRM Status</p>
                <p>{invRow.crm.exists ? invRow.crm.status : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">QBO Sync</p>
                <p>{invRow.crm.exists ? invRow.crm.qboSyncStatus : "—"}{invRow.crm.qboSyncError ? ` — ${invRow.crm.qboSyncError}` : ""}</p>
              </div>
            </div>
            <div className="mt-2">
              <MatchTag match={invRow.match} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-4">Invoice details not found</p>
        )}

        <p className="text-sm font-semibold text-gray-700 mb-2">Payments ({payRows.length})</p>
        <div className="space-y-2">
          {payRows.length === 0 && <p className="text-sm text-gray-400">No payments found</p>}
          {payRows.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  CRM: {p.crm.exists ? `Rs ${(p.crm.amount || 0).toLocaleString()}` : "—"}
                  {"  ·  "}
                  QBO: {p.qbo.exists ? `Rs ${(p.qbo.totalAmt || 0).toLocaleString()}` : "—"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.crm.exists ? `CRM: ${p.crm.qboSyncStatus}${p.crm.qboSyncError ? ` — ${p.crm.qboSyncError}` : ""}` : "Not in CRM"}
                </p>
              </div>
              <MatchTag match={p.match} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QboCompareContent() {
  const [tab, setTab] = useState<Tab>("invoices");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [linkTarget, setLinkTarget] = useState<{ type: Tab; qboId: string } | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<any>(null);
  const [importTarget, setImportTarget] = useState<string | null>(null);
  const [detailInvoiceNumber, setDetailInvoiceNumber] = useState<string | null>(null);

  const [filters, setFilters] = useState<{ search: string }>({ search: "" });

  const [missingInvoice, setMissingInvoice] = useState(false);
  const [missingPayment, setMissingPayment] = useState(false);

  const [page, setPage] = useState(1);

  const invoicesQ = useQuery({
    queryKey: ["qbo-compare-invoices"],
    queryFn: () => compareQboInvoices().then((r) => r.data),
  });

  const paymentsQ = useQuery({
    queryKey: ["qbo-compare-payments"],
    queryFn: () => compareQboPayments().then((r) => r.data),
  });

  const customersQ = useQuery({
    queryKey: ["qbo-compare-customers"],
    queryFn: () => compareQboCustomers().then((r) => r.data),
    enabled: tab === "customers",
  });

  const openDetail = (invoiceNumber: string | null) => {
    if (!invoiceNumber) return;
    setDetailInvoiceNumber(invoiceNumber);
  };

  const invoiceRows = invoicesQ.data?.data || [];
  const paymentRows = paymentsQ.data?.data || [];

  const customersWithInvoice = new Set(
    invoiceRows.filter((r: any) => r.crm.exists || r.qbo.exists).map((r: any) => norm(r.customer))
  );
  const customersWithPayment = new Set(
    paymentRows.filter((r: any) => r.crm.exists || r.qbo.exists).map((r: any) => norm(r.customer))
  );
  const invoiceNumbersWithPayment = new Set(
    paymentRows.filter((r: any) => r.crm.exists || r.qbo.exists).map((r: any) => String(r.invoiceNumber))
  );

  const active = tab === "invoices" ? invoicesQ : tab === "payments" ? paymentsQ : customersQ;
  const allRows = active.data?.data || [];
  const summary = active.data?.summary || { matched: 0, onlyCrm: 0, onlyQbo: 0 };

  const matchFiltered = matchFilter === "all" ? allRows : allRows.filter((r: any) => r.match === matchFilter);

  const searchTerm = filters.search.trim().toLowerCase();
  const searchFiltered = !searchTerm
    ? matchFiltered
    : matchFiltered.filter((r: any) => {
      if (tab === "customers") {
        return (
          (r.name || "").toLowerCase().includes(searchTerm) ||
          (r.email || "").toLowerCase().includes(searchTerm)
        );
      }
      return (
        (r.invoiceNumber || "").toLowerCase().includes(searchTerm) ||
        (r.customer || "").toLowerCase().includes(searchTerm)
      );
    });

  let recordFiltered = searchFiltered;

  if (tab === "customers") {
    if (missingInvoice) {
      recordFiltered = recordFiltered.filter((r: any) => !customersWithInvoice.has(norm(r.name)));
    }
    if (missingPayment) {
      recordFiltered = recordFiltered.filter((r: any) => !customersWithPayment.has(norm(r.name)));
    }
  } else if (tab === "invoices") {
    if (missingPayment) {
      recordFiltered = recordFiltered.filter(
        (r: any) => !r.invoiceNumber || !invoiceNumbersWithPayment.has(String(r.invoiceNumber))
      );
    }
  }

  const totalPages = Math.max(1, Math.ceil(recordFiltered.length / PAGE_SIZE));
  const rows = recordFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [tab, matchFilter, filters.search, missingInvoice, missingPayment]);

  useEffect(() => {
    setMissingInvoice(false);
    setMissingPayment(false);
  }, [tab]);

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "invoices", label: "Invoices", icon: FileText },
    { key: "payments", label: "Payments", icon: Receipt },
    { key: "customers", label: "Customers", icon: Users },
  ];

  const queryClient = useQueryClient();

  const { mutate: unlinkRecord, isPending: unlinking } = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) => unlinkQboRecord(type, id),
    onSuccess: () => {
      toast.success("Unlinked ✅");
      queryClient.invalidateQueries({ queryKey: ["qbo-compare-customers"] });
      queryClient.invalidateQueries({ queryKey: ["qbo-compare-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["qbo-compare-payments"] });
      setUnlinkTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Unlink failed ❌"),
  });

  const handleUnlinkClick = (r: any) => setUnlinkTarget(r);

  const handleUnlinkConfirm = () => {
    if (!unlinkTarget) return;
    const type = tab === "invoices" ? "invoice" : tab === "payments" ? "payment" : "customer";
    unlinkRecord({ type, id: unlinkTarget.crm?.crmId || unlinkTarget.crmId });
  };

  const rowActions = [
    {
      icon: <LinkIcon size={16} />,
      label: "Link to CRM",
      onClick: (r: any) => setLinkTarget({ type: tab, qboId: r.qbo.qboId }),
      hidden: (r: any) => r.match !== "only_qbo",
    },
    {
      icon: <Unlink size={16} />,
      label: "Unlink",
      onClick: handleUnlinkClick,
      hidden: (r: any) => r.match !== "matched",
    },
    {
      icon: <Download size={16} />,
      label: "Import to CRM",
      onClick: (r: any) => setImportTarget(r.qbo.qboId),
      hidden: (r: any) => r.match !== "only_qbo",
    }
  ];

  const unlinkLabel =
    tab === "invoices" ? unlinkTarget?.invoiceNumber
      : tab === "payments" ? unlinkTarget?.invoiceNumber
        : unlinkTarget?.name;

  return (
    <>
      <PageHeader
        title="QBO ↔ CRM Comparison"
        subtitle="See what's synced, and what's missing on either side"
        titleIcon={<GitCompare size={24} />}
        totalCount={allRows.length}
        filters={filters}
        setFilters={setFilters}
        filterFields={[
          {
            type: "input",
            name: "search",
            placeholder: tab === "customers" ? "Search by name or email…" : "Search by invoice # or customer…",
          },
        ]}
      />

      <div className="flex items-center gap-2 mb-4 border-b border-gray-100">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setMatchFilter("all"); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-yellow-400 text-gray-800" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <SummaryBar summary={summary} missingInvoice={missingInvoice} missingPayment={missingPayment} />




      {/* ✅ Match-filter buttons + Export button (sirf "Only in QBO" active hone par) */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(["all", "matched", "only_crm", "only_qbo"] as MatchFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setMatchFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${matchFilter === f ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
            >
              {f === "all" ? "All" : matchBadge[f].label}
            </button>
          ))}
        </div>

        {matchFilter === "only_qbo" && (
          <div className="flex gap-2">

            {(missingInvoice || missingPayment) && <FilterCounterBar rows={recordFiltered} />}
            {(tab === "customers" || tab === "invoices") && (
              <div className="flex items-center gap-2 ">
                {tab === "customers" && (
                  <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-600 text-gray-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-60 shadow-sm">
                    <input
                      type="checkbox"
                      checked={missingInvoice}
                      onChange={(e) => setMissingInvoice(e.target.checked)}
                    />
                    No Invoice
                  </label>
                )}
                {(tab === "customers" || tab === "invoices") && (
                  <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-600 text-gray-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-60 shadow-sm"
                  >
                    <input
                      type="checkbox"
                      checked={missingPayment}
                      onChange={(e) => setMissingPayment(e.target.checked)}
                    />
                    No Payment
                  </label>
                )}
              </div>
            )}
            <ExportButton
              filename={`qbo-only-${tab}`}
              title={`Only in QBO — ${tab.charAt(0).toUpperCase() + tab.slice(1)}`}
              fetchData={async () => recordFiltered.filter((r: any) => r.match === "only_qbo")}
              columns={
                tab === "customers"
                  ? [
                    { header: "Customer", key: "name" },
                    { header: "Email", key: "email" },
                    { header: "QBO Balance", key: "qbo.balance", format: (v: any) => `Rs ${Number(v || 0).toLocaleString()}` },
                  ]
                  : tab === "invoices"
                    ? [
                      { header: "Invoice #", key: "invoiceNumber" },
                      { header: "Customer", key: "customer" },
                      { header: "QBO Amount", key: "qbo.totalAmt", format: (v: any) => `Rs ${Number(v || 0).toLocaleString()}` },
                      { header: "QBO Balance", key: "qbo.balance", format: (v: any) => `Rs ${Number(v || 0).toLocaleString()}` },
                      { header: "Txn Date", key: "qbo.txnDate" },
                    ]
                    : [
                      { header: "Invoice #", key: "invoiceNumber" },
                      { header: "Customer", key: "customer" },
                      { header: "QBO Amount", key: "qbo.totalAmt", format: (v: any) => `Rs ${Number(v || 0).toLocaleString()}` },
                      { header: "Txn Date", key: "qbo.txnDate" },
                    ]
              }
            />
          </div>
        )}
      </div>

      {tab === "invoices" && (
        <DynamicTable
          data={rows}
          isLoading={invoicesQ.isLoading}
          isError={invoicesQ.isError}
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          onPageChange={setPage}
          columns={[
            {
              key: "invoiceNumber", label: "Invoice #",
              render: (r: any) => (
                <div
                  className="cursor-pointer hover:text-indigo-600"
                  onClick={() => openDetail(r.invoiceNumber)}
                >
                  <p className="font-medium text-sm text-gray-800">{r.invoiceNumber || "—"}</p>
                  <p className="text-xs text-gray-400">{r.customer || "—"}</p>
                </div>
              ),
            },
            {
              key: "crmAmount", label: "CRM Amount",
              render: (r: any) => r.crm.exists ? <span className="text-sm text-gray-700">{fmt(r.crm.netAmount)}</span> : <span className="text-xs text-gray-300">—</span>,
            },
            {
              key: "qboAmount", label: "QBO Amount",
              render: (r: any) => r.qbo.exists ? <span className="text-sm text-gray-700">{fmt(r.qbo.totalAmt)}</span> : <span className="text-xs text-gray-300">—</span>,
            },
            {
              key: "syncStatus", label: "Sync Status",
              render: (r: any) => r.crm.exists
                ? <span className="text-xs text-gray-500">{r.crm.qboSyncStatus}{r.crm.qboSyncError ? ` — ${r.crm.qboSyncError}` : ""}</span>
                : <span className="text-xs text-gray-300">—</span>,
            },
            { key: "match", label: "Status", render: (r: any) => <MatchTag match={r.match} /> },
          ]}
          actions={rowActions}
        />
      )}

      {tab === "payments" && (
        <DynamicTable
          data={rows}
          isLoading={paymentsQ.isLoading}
          isError={paymentsQ.isError}
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          onPageChange={setPage}
          columns={[
            {
              key: "invoiceNumber", label: "Invoice #",
              render: (r: any) => (
                <div
                  className="cursor-pointer hover:text-indigo-600"
                  onClick={() => openDetail(r.invoiceNumber)}
                >
                  <p className="font-medium text-sm text-gray-800">{r.invoiceNumber || "—"}</p>
                  <p className="text-xs text-gray-400">{r.customer || "—"}</p>
                </div>
              ),
            },
            {
              key: "crmAmount", label: "CRM Amount",
              render: (r: any) => r.crm.exists ? <span className="text-sm text-gray-700">{fmt(r.crm.amount)}</span> : <span className="text-xs text-gray-300">—</span>,
            },
            {
              key: "qboAmount", label: "QBO Amount",
              render: (r: any) => r.qbo.exists ? <span className="text-sm text-gray-700">{fmt(r.qbo.totalAmt)}</span> : <span className="text-xs text-gray-300">—</span>,
            },
            {
              key: "syncStatus", label: "Sync Status",
              render: (r: any) => r.crm.exists
                ? <span className="text-xs text-gray-500">{r.crm.qboSyncStatus}{r.crm.qboSyncError ? ` — ${r.crm.qboSyncError}` : ""}</span>
                : <span className="text-xs text-gray-300">—</span>,
            },
            { key: "match", label: "Status", render: (r: any) => <MatchTag match={r.match} /> },
          ]}
          actions={rowActions}
        />
      )}

      {tab === "customers" && (
        <DynamicTable
          data={rows}
          isLoading={customersQ.isLoading}
          isError={customersQ.isError}
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          onPageChange={setPage}
          columns={[
            {
              key: "name", label: "Customer",
              render: (r: any) => (
                <div>
                  <p className="font-medium text-sm text-gray-800">{r.name || "—"}</p>
                  <p className="text-xs text-gray-400">{r.email || "—"}</p>
                </div>
              ),
            },
            {
              key: "qboBalance", label: "QBO Balance",
              render: (r: any) => r.qbo.exists ? <span className="text-sm text-gray-700">{fmt(r.qbo.balance)}</span> : <span className="text-xs text-gray-300">—</span>,
            },
            {
              key: "syncStatus", label: "Sync Status",
              render: (r: any) => r.crm.exists
                ? <span className="text-xs text-gray-500">{r.crm.qboSyncStatus}{r.crm.qboSyncError ? ` — ${r.crm.qboSyncError}` : ""}</span>
                : <span className="text-xs text-gray-300">—</span>,
            },
            { key: "match", label: "Status", render: (r: any) => <MatchTag match={r.match} /> },
          ]}
          actions={rowActions}
        />
      )}

      <LinkQboModal
        open={!!linkTarget}
        onClose={() => setLinkTarget(null)}
        type={linkTarget?.type === "invoices" ? "invoice" : linkTarget?.type === "payments" ? "payment" : "customer"}
        qboId={linkTarget?.qboId || ""}
        label={`QBO ID: ${linkTarget?.qboId}`}
      />

      <ConfirmModal
        open={!!unlinkTarget}
        onClose={() => setUnlinkTarget(null)}
        onConfirm={handleUnlinkConfirm}
        isLoading={unlinking}
        title="Unlink this record?"
        description={`"${unlinkLabel || "This record"}" will be unlinked from QBO. It'll show as unsynced until re-synced or re-linked.`}
        confirmLabel="Unlink"
        danger
      />

      <QboImportModal
        open={!!importTarget}
        onClose={() => setImportTarget(null)}
        initialQboInvoiceId={importTarget || undefined}
      />

      <InvoiceDetailModal
        invoiceNumber={detailInvoiceNumber}
        onClose={() => setDetailInvoiceNumber(null)}
      />
    </>
  );
}

export default function QboComparePage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin", "finance_manager"]}>
      <QboCompareContent />
    </ProtectedRoute>
  );
}