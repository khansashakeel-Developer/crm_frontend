"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllPayments, addPayment, updatePayment, approvePayment, rejectPayment,
  sendPaymentsReportEmail, syncQboPaymentNow
} from "@/utils/api";
import PageHeader, { FilterField } from "@/app/component/dashboard/page-header";
import DynamicTable from "@/app/component/dashboard/dynamic-table";
import Modal from "@/app/component/ui/model/modal";
import Popup from "@/app/component/ui/popup/popup";
import { ModalField } from "@/types/ui";
import toast from "react-hot-toast";
import { Receipt, CheckCircle, XCircle, Pencil, UploadCloud, Loader2 } from "lucide-react";
import ExportButton from "@/app/component/ui/export-button";
import DateRangeFilter from "@/app/component/dashboard/date-range-filter";
import EmailAdminDropdown from "@/app/component/ui/email-admin-dropdown"; // 👈 naya import

const statusColor = (status: string) => {
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    rejected: "bg-rose-100 text-rose-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
};

const methodColor = (method: string) => {
  const map: Record<string, string> = {
    cash: "bg-teal-100 text-teal-700",
    bank: "bg-indigo-100 text-indigo-700",
    cheque: "bg-purple-100 text-purple-700",
    manual: "bg-gray-100 text-gray-600",
  };
  return map[method] || "bg-gray-100 text-gray-600";
};

const addPaymentFields: ModalField[] = [
  { name: "invoice", label: "Invoice ID", type: "input", inputType: "text", placeholder: "MongoDB ObjectId" },
  { name: "enrollment", label: "Enrollment ID", type: "input", inputType: "text", placeholder: "MongoDB ObjectId" },
  { name: "user", label: "User ID", type: "input", inputType: "text", placeholder: "MongoDB ObjectId" },
  { name: "amount", label: "Amount (Rs)", type: "input", inputType: "number", placeholder: "25000" },
  {
    name: "method", label: "Payment Method", type: "select",
    options: [
      { label: "Cash", value: "cash" },
      { label: "Bank Transfer", value: "bank" },
      { label: "Cheque", value: "cheque" },
      { label: "Manual", value: "manual" },
    ],
  },
  { name: "referenceNumber", label: "Reference No. (for bank/cheque)", type: "input", inputType: "text", placeholder: "TXN-2025-001" },
  { name: "notes", label: "Notes", type: "textarea", placeholder: "Any notes..." },
];

const rejectFields: ModalField[] = [
  { name: "reason", label: "Rejection Reason", type: "textarea", placeholder: "Invalid reference number..." },
];

const editPaymentFields: ModalField[] = [
  { name: "amount", label: "Amount (Rs)", type: "input", inputType: "number" },
  {
    name: "method", label: "Payment Method", type: "select",
    options: [
      { label: "Cash", value: "cash" },
      { label: "Bank Transfer", value: "bank" },
      { label: "Cheque", value: "cheque" },
      { label: "Manual", value: "manual" },
    ],
  },
  { name: "referenceNumber", label: "Reference No.", type: "input", inputType: "text" },
  { name: "notes", label: "Notes", type: "textarea" },
];

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ status: "", method: "", search: "", page: "1", limit: "10", dateFrom: "", dateTo: "" });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [approvingPayment, setApprovingPayment] = useState<any>(null);
  const [rejectingPayment, setRejectingPayment] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // 👈 naya state — checkbox selection k liye
  const [syncingNowId, setSyncingNowId] = useState<string | null>(null);

  const filterFields: FilterField[] = [
    {
      type: "input",
      name: "search",
      placeholder: "Search by name or email...",
    },
    {
      type: "select", name: "status",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
      ],
    },
    {
      type: "select", name: "method",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Bank", value: "bank" },
        { label: "Cheque", value: "cheque" },
        { label: "Manual", value: "manual" },
      ],
    },
  ];

  const { data, isLoading, isError } = useQuery({
    queryKey: ["payments", filters],
    queryFn: () =>
      getAllPayments({
        ...filters,
        page: parseInt(filters.page),
        limit: parseInt(filters.limit),
      }).then((r) => r.data),
  });

  const paymentList = data?.data ?? []; // 👈 select-all k liye

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const toggleSelectAll = () =>
    setSelectedIds((prev) =>
      prev.length === paymentList.length ? [] : paymentList.map((p: any) => p._id)
    );

  const { mutate: addPay, isPending: isAdding } = useMutation({
    mutationFn: addPayment,
    onSuccess: () => { toast.success("Payment added! ✅"); setIsAddOpen(false); queryClient.invalidateQueries({ queryKey: ["payments"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed!"),
  });

  const { mutate: editPay, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updatePayment(id, data),
    onSuccess: () => { toast.success("Payment updated! ✅"); setEditingPayment(null); queryClient.invalidateQueries({ queryKey: ["payments"] }); },
    onError: () => toast.error("Failed!"),
  });

  const { mutate: approvePay, isPending: isApproving } = useMutation({
    mutationFn: (id: string) => approvePayment(id),
    onSuccess: () => { toast.success("Payment approved! ✅"); setApprovingPayment(null); queryClient.invalidateQueries({ queryKey: ["payments"] }); },
    onError: () => toast.error("Failed!"),
  });

  const { mutate: rejectPay, isPending: isRejecting } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => rejectPayment(id, data),
    onSuccess: () => { toast.success("Payment rejected!"); setRejectingPayment(null); queryClient.invalidateQueries({ queryKey: ["payments"] }); },
    onError: () => toast.error("Failed!"),
  });

  const handleSyncNow = async (paymentId: string) => {
    setSyncingNowId(paymentId);
    try {
      await syncQboPaymentNow(paymentId);
      toast.success("Synced to QuickBooks ✅");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "QBO sync failed ❌");
    } finally {
      setSyncingNowId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Manage, approve & reject payments"
        titleIcon={<Receipt size={24} />}
        totalCount={data?.meta?.total ?? 0}
        onAdd={() => setIsAddOpen(true)}
        filters={filters}
        setFilters={setFilters}
        filterFields={filterFields}
        exportBtn={
          <div className="flex items-center gap-2">
            <DateRangeFilter
              from={filters.dateFrom}
              to={filters.dateTo}
              onChange={(from, to) =>
                setFilters((f) => ({ ...f, dateFrom: from, dateTo: to, page: "1" }))
              }
            />
            <ExportButton
              filename="payments"
              label="Export Excel"
              fetchData={async () => {
                const res = await getAllPayments({
                  limit: 10000,
                  status: filters.status,
                  method: filters.method,
                  search: filters.search,
                  dateFrom: filters.dateFrom,
                  dateTo: filters.dateTo,
                });
                return res.data.data;
              }}
              columns={[
                { header: "Student", key: "user.name" },
                { header: "Email", key: "user.email" },
                { header: "Invoice #", key: "invoice.invoiceNumber" },
                { header: "Amount (Rs)", key: "amount", format: (v) => Number(v || 0).toLocaleString() },
                { header: "Method", key: "method" },
                { header: "Reference #", key: "referenceNumber" },
                { header: "Description", key: "notes" },
                { header: "Status", key: "status" },
                { header: "Approved By", key: "approvedBy.name" },
                { header: "Date", key: "paidAt", format: (v) => v ? new Date(v).toLocaleDateString("en-PK") : "—" },
              ]}
            />
            {/* 👇 Naya: Email report to admins — same dropdown jo invoices mein hai */}
            <EmailAdminDropdown
              filters={filters}
              selectedIds={selectedIds}
              onEmailSend={(body) => sendPaymentsReportEmail(body)}
            />
            <div className="flex justify-end">
              <div className="bg-white border border-gray-100 rounded-lg px-4 py-1.5 shadow-sm">
                <span className="text-xs text-gray-400 uppercase tracking-wide mr-2">Total Amount</span>
                <span className="text-sm font-semibold text-gray-800">
                  Rs {(data?.meta?.totalAmount ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        }
      />

      <DynamicTable
        data={paymentList}
        isLoading={isLoading}
        isError={isError}
        currentPage={data?.meta?.page || 1}
        pageSize={data?.meta?.limit || 10}
        totalPages={data?.meta?.totalPages || 1}
        onPageChange={(page) => setFilters((f) => ({ ...f, page: String(page) }))}
        selectedIds={selectedIds}
        onSelectAll={toggleSelectAll}
        onToggleSelect={toggleSelect}
        showSerial={false}
        columns={[
          {
            key: "invoiceNumber", label: "Invoice #",
            render: (p) => (
              <span className="text-gray-600 text-sm font-mono font-semibold">
                {p.invoice?.invoiceNumber || "—"}
              </span>
            ),
          },
          {
            key: "user", label: "Student",
            render: (p) => (
              <div>
                <p className="font-medium text-gray-800">{p.user?.name || "—"}</p>
                {p.user?.email && (
                  <p className="text-xs text-gray-400 mt-0.5">{p.user.email}</p>
                )}
              </div>
            ),
          },
          { key: "amount", label: "Amount", render: (p) => <span className="font-bold text-gray-800">Rs {(p.amount || 0).toLocaleString()}</span> },
          {
            key: "method", label: "Method",
            render: (p) => <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${methodColor(p.method)}`}>{p.method}</span>,
          },
          { key: "referenceNumber", label: "Reference", render: (p) => <span className="text-gray-500 text-sm">{p.referenceNumber || "—"}</span> },
          {
            key: "notes", label: "Description",
            render: (p) => (
              <span className="text-gray-500 text-sm max-w-[200px] truncate block" title={p.notes || ""}>
                {p.notes || "—"}
              </span>
            ),
          },
          {
            key: "status", label: "Status",
            render: (p) => <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusColor(p.status)}`}>{p.status}</span>,
          },
          { key: "receivedBy", label: "Received By", render: (p) => <span className="text-gray-500 text-sm">{p.receivedBy?.name || "—"}</span> },
          { key: "paidAt", label: "Paid At", render: (p) => <span className="text-gray-400 text-sm">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}</span> },
          { key: "createdAt", label: "Created At", render: (p) => <span className="text-gray-400 text-sm">{new Date(p.createdAt).toLocaleDateString()}</span> },
        ]}
        actions={[
          {
            icon: <CheckCircle size={14} />, label: "Approve",
            onClick: (p) => setApprovingPayment(p),
            className: "hover:bg-green-50 hover:text-green-600",
            hidden: (p) => p.status !== "pending",
          },
          {
            icon: <XCircle size={14} />, label: "Reject",
            onClick: (p) => setRejectingPayment(p),
            className: "hover:bg-rose-50 hover:text-rose-500",
            hidden: (p) => p.status !== "pending",
          },
          {
            icon: <Pencil size={14} />, label: "Edit",
            onClick: (p) => setEditingPayment(p),
            className: "hover:bg-yellow-50 hover:text-yellow-600",
          },
          // {
          //   icon: syncingNowId ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />,
          //   label: syncingNowId ? "Syncing..." : "Sync to QBO",
          //   onClick: (p: any) => handleSyncNow(p._id),
          //   className: "hover:bg-blue-50 hover:text-blue-600",
          //   hidden: (p: any) => p.status !== "approved",
          //   disabled: (p: any) => syncingNowId === p._id,
          // },
        ]}
      />

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Payment" fields={addPaymentFields} onSubmit={addPay} isLoading={isAdding} mode="add" />

      {editingPayment && (
        <Modal
          isOpen={!!editingPayment}
          onClose={() => setEditingPayment(null)}
          title="Edit Payment"
          fields={editPaymentFields}
          initialValues={{ amount: editingPayment.amount, method: editingPayment.method, referenceNumber: editingPayment.referenceNumber || "", notes: editingPayment.notes || "" }}
          onSubmit={(data) => editPay({ id: editingPayment._id, data })}
          isLoading={isUpdating}
          mode="edit"
        />
      )}

      {approvingPayment && (
        <Popup
          isOpen={!!approvingPayment}
          onClose={() => setApprovingPayment(null)}
          onConfirm={() => approvePay(approvingPayment._id)}
          variant="info"
          title="Approve Payment"
          description={<>Approve payment of <span className="font-bold text-green-600">Rs {approvingPayment.amount?.toLocaleString()}</span> by <span className="font-bold">{approvingPayment.user?.name}</span>?</>}
          confirmText="Yes, Approve"
          isLoading={isApproving}
          loadingText="Approving..."
        />
      )}

      {rejectingPayment && (
        <Modal
          isOpen={!!rejectingPayment}
          onClose={() => setRejectingPayment(null)}
          title="Reject Payment"
          subtitle={`Rs ${rejectingPayment.amount?.toLocaleString()} — ${rejectingPayment.user?.name}`}
          fields={rejectFields}
          onSubmit={(data) => rejectPay({ id: rejectingPayment._id, data })}
          isLoading={isRejecting}
          mode="add"
        />
      )}
    </>
  );
}