"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProtectedRoute from "@/app/component/protected-route";
import PageHeader from "@/app/component/dashboard/page-header";
import DynamicTable from "@/app/component/dashboard/dynamic-table";
import { Users, FileText, Receipt, Landmark } from "lucide-react";
import { getQboCustomers, getQboInvoices, getQboPayments } from "@/utils/api";

type Tab = "customers" | "invoices" | "payments";

const fmt = (n: number) => `Rs ${(n || 0).toLocaleString()}`;

function QuickBooksContent() {
  const [tab, setTab] = useState<Tab>("customers");
  const [search, setSearch] = useState("");

  const customersQ = useQuery({
    queryKey: ["qbo-customers", search],
    queryFn: () => getQboCustomers({ search }).then((r) => r.data),
    enabled: tab === "customers",
  });

  const invoicesQ = useQuery({
    queryKey: ["qbo-invoices"],
    queryFn: () => getQboInvoices({}).then((r) => r.data),
    enabled: tab === "invoices",
  });

  const paymentsQ = useQuery({
    queryKey: ["qbo-payments"],
    queryFn: () => getQboPayments({}).then((r) => r.data),
    enabled: tab === "payments",
  });

  const active = tab === "customers" ? customersQ : tab === "invoices" ? invoicesQ : paymentsQ;
  const rows = active.data?.data || [];

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "customers", label: "Customers", icon: Users },
    { key: "invoices", label: "Invoices", icon: FileText },
    { key: "payments", label: "Payments", icon: Receipt },
  ];

  return (
    <>
      <PageHeader
        title="QuickBooks"
        subtitle="Live data synced from QuickBooks Online"
        titleIcon={<Landmark size={24} />}
        totalCount={rows.length}
        filters={tab === "customers" ? { search } : undefined}
        setFilters={
          tab === "customers"
            ? (f: any) => setSearch(f.search ?? "")
            : undefined
        }
        filterFields={
          tab === "customers"
            ? [{ type: "input", name: "search", placeholder: "Search customer name..." }]
            : []
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-100">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-yellow-400 text-gray-800"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "customers" && (
        <DynamicTable
          data={rows}
          isLoading={customersQ.isLoading}
          isError={customersQ.isError}
          columns={[
            {
              key: "displayName", label: "Customer",
              render: (c: any) => (
                <div>
                  <p className="font-medium text-sm text-gray-800">{c.displayName}</p>
                  <p className="text-xs text-gray-400">{c.email || "—"}</p>
                </div>
              ),
            },
            {
              key: "phone", label: "Phone",
              render: (c: any) => <span className="text-sm text-gray-500">{c.phone || "—"}</span>,
            },
            {
              key: "balance", label: "Balance",
              render: (c: any) => (
                <span className={`font-medium text-sm ${c.balance > 0 ? "text-rose-500" : "text-green-600"}`}>
                  {fmt(c.balance)}
                </span>
              ),
            },
            {
              key: "active", label: "Status",
              render: (c: any) => (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {c.active ? "Active" : "Inactive"}
                </span>
              ),
            },
            {
              key: "qboId", label: "QBO ID",
              render: (c: any) => <span className="text-xs text-gray-400">{c.qboId}</span>,
            },
          ]}
        />
      )}

      {tab === "invoices" && (
        <DynamicTable
          data={rows}
          isLoading={invoicesQ.isLoading}
          isError={invoicesQ.isError}
          columns={[
            {
              key: "docNumber", label: "Invoice #",
              render: (inv: any) => <span className="font-medium text-sm text-gray-800">{inv.docNumber}</span>,
            },
            {
              key: "customer", label: "Customer",
              render: (inv: any) => <span className="text-sm text-gray-600">{inv.customer || "—"}</span>,
            },
            {
              key: "totalAmt", label: "Total",
              render: (inv: any) => <span className="font-semibold text-sm text-gray-800">{fmt(inv.totalAmt)}</span>,
            },
            {
              key: "balance", label: "Balance",
              render: (inv: any) => (
                <span className={`font-medium text-sm ${inv.balance > 0 ? "text-rose-500" : "text-green-600"}`}>
                  {fmt(inv.balance)}
                </span>
              ),
            },
            {
              key: "txnDate", label: "Txn Date",
              render: (inv: any) => (
                <span className="text-sm text-gray-500">
                  {inv.txnDate ? new Date(inv.txnDate).toLocaleDateString("en-PK") : "—"}
                </span>
              ),
            },
            {
              key: "dueDate", label: "Due Date",
              render: (inv: any) => (
                <span className="text-sm text-gray-500">
                  {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-PK") : "—"}
                </span>
              ),
            },
          ]}
        />
      )}

      {tab === "payments" && (
        <DynamicTable
          data={rows}
          isLoading={paymentsQ.isLoading}
          isError={paymentsQ.isError}
          columns={[
            {
              key: "customer", label: "Customer",
              render: (p: any) => <span className="text-sm text-gray-800 font-medium">{p.customer || "—"}</span>,
            },
            {
              key: "totalAmt", label: "Amount",
              render: (p: any) => <span className="font-semibold text-sm text-green-600">{fmt(p.totalAmt)}</span>,
            },
            {
              key: "txnDate", label: "Date",
              render: (p: any) => (
                <span className="text-sm text-gray-500">
                  {p.txnDate ? new Date(p.txnDate).toLocaleDateString("en-PK") : "—"}
                </span>
              ),
            },
            {
              key: "refNumber", label: "Ref #",
              render: (p: any) => <span className="text-xs text-gray-400">{p.refNumber || "—"}</span>,
            },
            {
              key: "linkedInvoiceId", label: "Linked Invoice",
              render: (p: any) => <span className="text-xs text-gray-400">{p.linkedInvoiceId || "—"}</span>,
            },
          ]}
        />
      )}
    </>
  );
}

export default function QuickBooksPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin", "finance_manager"]}>
      <QuickBooksContent />
    </ProtectedRoute>
  );
}
