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

type Tab = "invoices" | "payments" | "customers";
type MatchFilter = "all" | "matched" | "only_crm" | "only_qbo";

const PAGE_SIZE = 10;

const fmt = (n: number) => `Rs ${(n || 0).toLocaleString()}`;

const matchBadge: Record<string, { label: string; color: string }> = {
  matched: { label: "Matched", color: "bg-green-100 text-green-700" },
  only_crm: { label: "Only in CRM", color: "bg-yellow-100 text-yellow-700" },
  only_qbo: { label: "Only in QBO", color: "bg-rose-100 text-rose-700" },
};

function MatchTag({ match }: { match: string }) {
  const cfg = matchBadge[match] || matchBadge.matched;
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function SummaryBar({ summary }: { summary: { matched: number; onlyCrm: number; onlyQbo: number } }) {
  const items = [
    { label: "Matched", value: summary.matched, color: "text-green-600", bg: "bg-green-50" },
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

function QboCompareContent() {
  const [tab, setTab] = useState<Tab>("invoices");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [linkTarget, setLinkTarget] = useState<{ type: Tab; qboId: string } | null>(null);
  // 🔑 replaces window.confirm() — holds the row pending unlink confirmation
  const [unlinkTarget, setUnlinkTarget] = useState<any>(null);
  const [importTarget, setImportTarget] = useState<string | null>(null);

  // 🔎 header search
  const [filters, setFilters] = useState<{ search: string }>({ search: "" });

  // 📄 client-side pagination (compare endpoints return the full reconciled set in one go)
  const [page, setPage] = useState(1);

  const invoicesQ = useQuery({
    queryKey: ["qbo-compare-invoices"],
    queryFn: () => compareQboInvoices().then((r) => r.data),
    enabled: tab === "invoices",
  });

  const paymentsQ = useQuery({
    queryKey: ["qbo-compare-payments"],
    queryFn: () => compareQboPayments().then((r) => r.data),
    enabled: tab === "payments",
  });

  const customersQ = useQuery({
    queryKey: ["qbo-compare-customers"],
    queryFn: () => compareQboCustomers().then((r) => r.data),
    enabled: tab === "customers",
  });

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

  const totalPages = Math.max(1, Math.ceil(searchFiltered.length / PAGE_SIZE));
  const rows = searchFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // reset to page 1 whenever the tab, status filter, or search term changes
  useEffect(() => {
    setPage(1);
  }, [tab, matchFilter, filters.search]);

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
      // customer/invoice unlinks cascade on the backend (customer → invoices → payments,
      // invoice → payments), so refresh all three tabs, not just the one currently open —
      // otherwise a tab you already visited earlier keeps showing its stale cached data.
      queryClient.invalidateQueries({ queryKey: ["qbo-compare-customers"] });
      queryClient.invalidateQueries({ queryKey: ["qbo-compare-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["qbo-compare-payments"] });
      setUnlinkTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Unlink failed ❌"),
  });

  // opens the popup — actual unlink happens on Confirm
  const handleUnlinkClick = (r: any) => setUnlinkTarget(r);

  const handleUnlinkConfirm = () => {
    if (!unlinkTarget) return;
    const type = tab === "invoices" ? "invoice" : tab === "payments" ? "payment" : "customer";
    // r.crm.crmId requires the backend to include it in the compare response — see earlier note
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
            placeholder:
              tab === "customers" ? "Search by name or email…" : "Search by invoice # or customer…",
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

      <SummaryBar summary={summary} />

      <div className="flex items-center gap-2 mb-4">
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
                <div>
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
                <div>
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
        initialQboInvoiceId={importTarget || undefined}  // seedha Step 2 khulega
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