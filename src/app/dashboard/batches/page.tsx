"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminGetBatches,
  adminCreateBatch,
  adminUpdateBatch,
  adminDeleteBatch,
  adminExportAllBatches,
  getNamesPrograms,
} from "@/utils/api";
import PageHeader, { FilterField } from "@/app/component/dashboard/page-header";
import Modal from "@/app/component/ui/model/modal";
import Popup from "@/app/component/ui/popup/popup";
import ProtectedRoute from "@/app/component/protected-route";
import { ModalField } from "@/types/ui";
import toast from "react-hot-toast";
import {
  CalendarDays,
  Pencil,
  Trash2,
  Users,
  Clock,
  ChevronRight,
  GraduationCap,
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Program {
  _id: string;
  name: string;
}

interface Batch {
  _id: string;
  name: string;
  program_id: Program | string;
  date_required?: boolean
  start_date: string;
  end_date?: string;
  max_students: number;
  current_students: number;
  status: "upcoming" | "active" | "completed" | "cancelled";
  instructor_id?: string;
}

// ─── Field Configs ─────────────────────────────────────────────────────────────

const batchFields = (programs: Program[]): ModalField[] => [
  {
    name: "program_id",
    label: "Program",
    type: "select",
    options: programs.map((p) => ({ label: p.name, value: p._id })),
  },
  {
    name: "name",
    label: "Batch Name",
    type: "input",
    inputType: "text",
    placeholder: "e.g. Batch 2026-A",
  },
  {
    name: "date_required",
    label: "Date Required",
    type: "checkbox",
  },
  {
    name: "start_date",
    label: "Start Date",
    type: "input",
    inputType: "date",
    placeholder: "",
  },
  {
    name: "end_date",
    label: "End Date",
    type: "input",
    inputType: "date",
    placeholder: "",
  },
  {
    name: "max_students",
    label: "Max Students",
    type: "input",
    inputType: "number",
    placeholder: "30",
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Upcoming", value: "upcoming" },
      { label: "Active", value: "active" },
      { label: "Completed", value: "completed" },
      { label: "Cancelled", value: "cancelled" },
    ],
  },
];

// const cardColors = [
//   "bg-blue-50/60 border-blue-100",
//   "bg-emerald-50/60 border-emerald-100",
//   "bg-amber-50/60 border-amber-100",
//   "bg-violet-50/60 border-violet-100",
//   "bg-pink-50/60 border-pink-100",
//   "bg-cyan-50/60 border-cyan-100",
//   "bg-orange-50/60 border-orange-100",
//   "bg-lime-50/60 border-lime-100",
// ];

// const getCardColor = (id: string) => {
//   // id ke basis pe consistent color (refresh pe change nahi hoga)
//   let hash = 0;
//   for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
//   return cardColors[Math.abs(hash) % cardColors.length];
// };

// ─── Badge Helpers ─────────────────────────────────────────────────────────────

const statusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "upcoming":
      return "bg-blue-100 text-blue-700";
    case "completed":
      return "bg-gray-100 text-gray-600";
    case "cancelled":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function BatchesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
    const [filters, setFilters] = useState({
    search: "",
    status: "",
    program_id: "",
  });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // component ke andar
  const { user: authUser } = useAppSelector((state) => state.auth);
  const isAdmin = ["admin", "super_admin"].includes(authUser?.role);
  const canAdd = ["admin", "super_admin", "finance_manager"].includes(authUser?.role);

  // ── Load programs for filter + modal dropdowns ─────────────────────────────
  const { data: programsRes } = useQuery({
    queryKey: ["program-names"],
    queryFn: getNamesPrograms,
    // staleTime: 1000 * 60 * 5,
  });
  // getNamesPrograms returns { data: Program[] } — safely fallback to []
  const programs: Program[] = programsRes ?? [];

  console.log("Loaded programsRes for batches:", programsRes);

  // ── Filter fields ──────────────────────────────────────────────────────────
  const filterFields: FilterField[] = [
    { name: "search", type: "input", placeholder: "Search batches..." },
    {
      name: "status",
      type: "select",
      options: [
        { label: "Upcoming", value: "upcoming" },
        { label: "Active", value: "active" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
      ],
    },
    {
      name: "program_id",
      type: "select",
      options: programs.map((p) => ({ label: p.name, value: p._id })),
    },
  ];

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-batches", filters],
    queryFn: () => adminGetBatches(filters).then((res) => res.data),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const { mutate: addBatch, isPending: isAdding } = useMutation({
    mutationFn: (data: any) => adminCreateBatch(data),
    onSuccess: () => {
      toast.success("Batch created! ✅");
      setIsAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-batches"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Failed!"),
  });

  const { mutate: updateBatch, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      adminUpdateBatch(id, data),
    onSuccess: () => {
      toast.success("Batch updated! ✅");
      setEditingBatch(null);
      queryClient.invalidateQueries({ queryKey: ["admin-batches"] });
    },
    onError: () => toast.error("Update failed!"),
  });

  const { mutate: deleteBatch, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => adminDeleteBatch(id),
    onSuccess: () => {
      toast.success("Batch deleted! 🗑️");
      setDeletingBatch(null);
      queryClient.invalidateQueries({ queryKey: ["admin-batches"] });
    },
    onError: () => toast.error("Delete failed!"),
  });
    // ── Export all batches ──
  const handleExportAll = async (format: "xlsx" | "csv" | "pdf") => {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const res = await adminExportAllBatches({ ...filters, format });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `all-batches-payments.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Export downloaded ✅");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to export");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Close export menu on outside click ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const batches: Batch[] = data?.data ?? [];

  // ── Filtered client-side search ────────────────────────────────────────────
  const filtered = batches.filter((b) => {
    if (!filters.search) return true;
    return b.name.toLowerCase().includes(filters.search.toLowerCase());
  });

  // ── Enrollment % helper ────────────────────────────────────────────────────
  const enrollPct = (b: Batch) =>
    b.max_students > 0
      ? Math.round((b.current_students / b.max_students) * 100)
      : 0;

  const getProgramName = (batch: Batch) => {
    if (!batch.program_id) return "—";
    if (typeof batch.program_id === "object") {
      return batch.program_id.name ?? "—";
    }
    return programs.find((p) => p._id === batch.program_id)?.name ?? "—";
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin", "sales_manager", "finance_manager", "sales_rep"]}>
            <PageHeader
        title="Batches"
        subtitle="Manage all program batches and enrollments"
        titleIcon={<CalendarDays size={24} />}
        totalCount={data?.meta?.total ?? batches.length}
        onAdd={canAdd ? () => setIsAddOpen(true) : undefined}
        filters={filters}
        setFilters={setFilters}
        filterFields={filterFields}
        exportBtn={
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50 shadow-sm"
              title="Export all batches"
            >
              {isExporting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Export All
              <ChevronDown size={12} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl border border-gray-100 shadow-lg py-1.5 z-50">
                <button
                  onClick={() => handleExportAll("xlsx")}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition"
                >
                  <FileSpreadsheet size={13} className="text-emerald-500" />
                  Export as Excel
                </button>
                <button
                  onClick={() => handleExportAll("csv")}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition"
                >
                  <FileText size={13} className="text-indigo-500" />
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExportAll("pdf")}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition"
                >
                  <FileText size={13} className="text-rose-500" />
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* ── Summary Stats ── */}
      {!isLoading && !isError && batches.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            {
              label: "Total",
              value: batches.length,
              color: "text-gray-700",
              bg: "bg-gray-50",
            },
            {
              label: "Active",
              value: batches.filter((b) => b.status === "active").length,
              color: "text-emerald-700",
              bg: "bg-emerald-50",
            },
            {
              label: "Upcoming",
              value: batches.filter((b) => b.status === "upcoming").length,
              color: "text-blue-700",
              bg: "bg-blue-50",
            },
            {
              label: "Total Enrolled",
              value: batches.reduce(
                (acc, b) => acc + (b.current_students ?? 0),
                0
              ),
              color: "text-indigo-700",
              bg: "bg-indigo-50",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`${s.bg} rounded-xl px-4 py-3 flex flex-col gap-0.5`}
            >
              <span className="text-xs text-gray-400 font-medium">
                {s.label}
              </span>
              <span className={`text-2xl font-semibold ${s.color}`}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Batch Grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-20 text-red-500">
          Failed to load batches.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          No batches found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((batch) => {
            const pct = enrollPct(batch);
            return (
              <div
                key={batch._id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition"
              // className={`${getCardColor(batch._id)} rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition`}
              >
                {/* Card Header */}
                <div className="p-5 border-b border-gray-50">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(batch.status)}`}
                    >
                      {batch.status}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-indigo-50 text-indigo-600">
                      {getProgramName(batch)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 text-base mb-1">
                    {batch.name}
                  </h3>

                  {/* Dates */}
                  {batch.date_required !== false && (
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatDate(batch.start_date)}
                      </span>
                      {batch.end_date && (
                        <>
                          <ChevronRight size={10} />
                          <span>{formatDate(batch.end_date)}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Enrollment Progress */}
                <div className="px-5 py-3 border-b border-gray-50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users size={11} />
                      Enrollment
                    </span>
                    <span className="text-xs font-medium text-gray-700">
                      {batch.current_students ?? 0} / {batch.max_students ?? 0}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 90
                        ? "bg-red-400"
                        : pct >= 60
                          ? "bg-yellow-400"
                          : "bg-emerald-400"
                        }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-right text-xs text-gray-400 mt-0.5">
                    {pct}% full
                  </div>
                </div>

                {/* Actions */}
                <div className="px-5 py-3 flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/batches/${batch._id}`)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition font-medium"
                  >
                    <GraduationCap size={12} />
                    Students
                    <ChevronRight size={12} />
                  </button>
                  {canAdd && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => setEditingBatch(batch)}
                        className="p-1.5 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 transition"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingBatch(batch)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Modal ── */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Batch"
        fields={batchFields(programs)}
        onSubmit={(data) => addBatch(data)}
        isLoading={isAdding}
        mode="add"
      />

      {/* ── Edit Modal ── */}
      {editingBatch && (
        <Modal
          isOpen={!!editingBatch}
          onClose={() => setEditingBatch(null)}
          title="Edit Batch"
          subtitle={editingBatch.name}
          fields={batchFields(programs)}
          initialValues={{
            program_id:
              editingBatch.program_id && typeof editingBatch.program_id === "object"
                ? editingBatch.program_id._id
                : editingBatch.program_id ?? "",
            name: editingBatch.name,
            date_required: editingBatch.date_required ?? true,
            start_date: editingBatch.start_date?.split("T")[0] ?? "",
            end_date: editingBatch.end_date?.split("T")[0] ?? "",
            max_students: editingBatch.max_students?.toString(),
            status: editingBatch.status,
          }}
          onSubmit={(data) => updateBatch({ id: editingBatch._id, data })}
          isLoading={isUpdating}
          mode="edit"
        />
      )}

      {/* ── Delete Popup ── */}
      {deletingBatch && (
        <Popup
          isOpen={!!deletingBatch}
          onClose={() => setDeletingBatch(null)}
          onConfirm={() => deleteBatch(deletingBatch._id)}
          variant="danger"
          title="Delete Batch"
          description={
            <>
              Are you sure you want to delete{" "}
              <span className="font-bold text-red-500">
                {deletingBatch.name}
              </span>
              ? This action cannot be undone.
            </>
          }
          confirmText="Yes, Delete"
          isLoading={isDeleting}
          loadingText="Deleting..."
        />
      )}
    </ProtectedRoute>
  );
}
