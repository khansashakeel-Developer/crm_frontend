"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllEnrollments,
  updateEnrollment,
  deleteEnrollment,
  graduateEnrollment,
  suspendEnrollment,
  reactivateEnrollment,
  getNamesPrograms,
  getAllUsersForRole,
  adminGetBatches,
  assignEnrollment,
  createEnrollmentDirect,
  adminGetAllUsers,
  createEnrollmentDirectBundle,
  compareQboInvoices,
  compareQboPayments
} from "@/utils/api";
import PageHeader, { FilterField } from "@/app/component/dashboard/page-header";
import DynamicTable from "@/app/component/dashboard/dynamic-table";
import Modal from "@/app/component/ui/model/modal";
import Popup from "@/app/component/ui/popup/popup";
import { ModalField } from "@/types/ui";
import toast from "react-hot-toast";
import {
  BookOpen,
  Pencil,
  Trash2,
  GraduationCap,
  PauseCircle,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle as CheckIcon, XCircle as XIcon
} from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import ProtectedRoute from "@/app/component/protected-route";
import EnrollmentActionsPopup from "./components/enrollment-actions-popup";
import AssignLeadModal from "../leads/components/assign-lead-modal";
import { UserBooksCell } from "./components/user-books-cell";
import { AddBookPopup } from "./components/add-book-popup";
import CollapsedCell from "./components/collapsed-cell";
import ExportButton from "@/app/component/ui/export-button";
import { useRouter } from "next/navigation";
import BatchPickerModal from "@/app/component/dashboard/batch-model";
import ImportButton from "@/app/dashboard/enrollments/components/import-button";

// ─── Badge Helpers ─────────────────────────────────────────────────────────────

export const statusColor = (status: string) => {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    completed: "bg-teal-100 text-teal-700",
    suspended: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-gray-100 text-gray-600",
    blocked: "bg-rose-100 text-rose-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
};

const accessColor = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    GRACE: "bg-yellow-100 text-yellow-700",
    EXTENDED: "bg-indigo-100 text-indigo-700",
    RESTRICTED: "bg-orange-100 text-orange-700",
    BLOCKED: "bg-rose-100 text-rose-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
};

const roleColor = (role: string) => {
  const map: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    super_admin: "bg-rose-100 text-rose-700",
    student: "bg-blue-100 text-blue-700",
    instructor: "bg-amber-100 text-amber-700",
    finance_manager: "bg-teal-100 text-teal-700",
  };
  return map[role] || "bg-gray-100 text-gray-600";
};

// ─── Edit Fields (static) ──────────────────────────────────────────────────────

// const editFields: ModalField[] = [
//   {
//     name: "progress",
//     label: "Progress (%)",
//     type: "input",
//     inputType: "number",
//     placeholder: "0-100",
//   },
//   {
//     name: "status",
//     label: "Status",
//     type: "select",
//     options: [
//       { label: "Active", value: "active" },
//       { label: "Pending", value: "pending" },
//       { label: "Completed", value: "completed" },
//       { label: "Suspended", value: "suspended" },
//       { label: "Cancelled", value: "cancelled" },
//       { label: "Blocked", value: "blocked" },
//     ],
//   },
// ];


// ── Program checklist with per-program batch badge ──────────────
function ProgramPicker({
  programs,
  selected,
  programBatches,
  activeBatches,
  programAudioAccess,
  onToggle,
  onPickBatch,
  onToggleAudioAccess,
}: {
  programs: any[];
  selected: string[];
  programBatches: Record<string, string>;
  activeBatches: any[];
  programAudioAccess: Record<string, boolean>;
  onToggle: (id: string) => void;
  onPickBatch: (program: { id: string; name: string }) => void;
  onToggleAudioAccess: (id: string) => void;
}) {
  return (
    <div className="mb-4">
      <label className="text-sm font-medium text-gray-700 mb-2 block">Program(s)*</label>
      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
        {programs.map((p: any) => {
          const isChecked = selected.includes(p._id);
          const isBizBox = p.category === "business_in_a_box";
          const batchId = programBatches[p._id];
          const batch = activeBatches.find((b: any) => b._id === batchId);
          const audioAccess = programAudioAccess[p._id] ?? true;

          return (
            <div key={p._id} className="flex items-center justify-between px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer flex-1">
                <input type="checkbox" checked={isChecked} onChange={() => onToggle(p._id)} />
                {p.name}
              </label>

              {isChecked && !isBizBox && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPickBatch({ id: p._id, name: p.name })}
                    className={`px-2 py-1 text-[10px] rounded ${batch ? "bg-indigo-100 text-indigo-600" : "bg-yellow-100 text-yellow-700"
                      }`}
                  >
                    {batch ? batch.name : "Select Batch"}
                  </button>
                  <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={audioAccess}
                      onChange={() => onToggleAudioAccess(p._id)}
                      className="accent-green-500"
                    />
                    Audio
                  </label>
                </div>
              )}

              {isChecked && isBizBox && (
                <span className="text-[10px] text-gray-400 shrink-0">No batch needed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Content ──────────────────────────────────────────────────────────────

function EnrollmentsContent() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAppSelector((state) => state.auth);
  const isAdmin = ["admin", "super_admin"].includes(authUser?.role);
  const isSalesManager = authUser?.role === "sales_manager";
  const isFinanceManager = authUser?.role === "finance_manager";
  const canAdd = isAdmin || isSalesManager || isFinanceManager;
  const canAction = isAdmin || isSalesManager || isFinanceManager;
  const [filters, setFilters] = useState<Record<string, string | boolean>>({
    status: "",
    accessStatus: "",
    search: "",
    page: "1",
    limit: "10",
    QboLense: false,
  });

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<any>(null);
  const [deletingEnrollment, setDeletingEnrollment] = useState<any>(null);
  const [graduatingEnrollment, setGraduatingEnrollment] = useState<any>(null);
  const [suspendingEnrollment, setSuspendingEnrollment] = useState<any>(null);
  const [reactivatingEnrollment, setReactivatingEnrollment] = useState<any>(null);
  const [actionsRow, setActionsRow] = useState<any>(null);
  const [assigningEnrollment, setAssigningEnrollment] = useState<any>(null);
  const [addBookUserId, setAddBookUserId] = useState<string | null>(null);
  // EnrollmentsContent ke andar, existing states ke sath add karo
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [programBatches, setProgramBatches] = useState<Record<string, string>>({});
  const [batchPickerProgram, setBatchPickerProgram] = useState<{ id: string; name: string } | null>(null);
  const [programAudioAccess, setProgramAudioAccess] = useState<Record<string, boolean>>({});

  const toggleProgram = (id: string) => {
    setSelectedPrograms((prev) => {
      if (prev.includes(id)) {
        setProgramBatches((pb) => {
          const next = { ...pb };
          delete next[id];
          return next;
        });
        setProgramAudioAccess((paa) => {
          const next = { ...paa };
          delete next[id];
          return next;
        });
        return prev.filter((p) => p !== id);
      }
      setProgramAudioAccess((paa) => ({ ...paa, [id]: true })); // ← default true
      return [...prev, id];
    });
  };

  // const toggleProgram = (id: string) => {
  //   setSelectedPrograms((prev) =>
  //     prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
  //   );
  // };

  const router = useRouter();
  // ── Dropdown data ────────────────────────────────────────────────────────
  // getNamesPrograms returns Program[] directly (already .then(r => r.data.data))
  const fallbackPrograms = [
    {
      _id: "6a8bf7b8a5ce6eddb90fb12e",
      name: "Business In The Box"
    },
    { _id: "69e8c025afaf0d3fb90233d4", name: "NLP Master Trainer Program" },
    {
      _id: "69e8bfb7afaf0d3fb90233a8",
      name: "Hypnosis Trainer's Training Certification and Evaluation Program",
    },
    {
      _id: "69e8bf8cafaf0d3fb90233a0",
      name: "NLP Trainers' Training And Evaluation Certification Program",
    },
    {
      _id: "69e8bf48afaf0d3fb9023398",
      name: "Advanced Hypnotherapy & Interventionist Training Program",
    },
    {
      _id: "69d8a8ed06f01d73ae725722",
      name: "NLP Master Practitioner Program",
    },
    {
      _id: "69d88bcd3b3f401bb2e711bc",
      name: "NLP Practitioner Program",
    }
  ];

  const { data: programs = fallbackPrograms } = useQuery({
    queryKey: ["program-names"],
    queryFn: async () => {
      try {
        return await getNamesPrograms();
      } catch (error) {
        console.error("Failed to load programs, using fallback.", error);
        return fallbackPrograms;
      }
    },
  });

  // ← YE LINE ADD KARO
  const programCategoryMap = new Map(programs.map((p: any) => [p._id, p.category]));

  // getAllUsersForRole returns { data: User[] }
  const { data: usersRes } = useQuery({
    queryKey: ["all-users-role"],
    queryFn: () => adminGetAllUsers({ limit: 10000 }).then((r) => r.data),
  });
  // const users = (usersRes?.users ?? []).filter((u: any) => u.role === "user");
  const users = (usersRes?.users ?? [])
    .filter((u: any) => u.role === "user")
    .filter((u: any, idx: number, arr: any[]) =>
      arr.findIndex((x) => x._id === u._id) === idx  // dedupe by _id
    );

  console.log("Users for dropdown:", users);

  // adminGetBatches — only active batches for dropdown
  const { data: activeBatchesRes } = useQuery({
    queryKey: ["batches-active"],
    queryFn: () => adminGetBatches({ status: "active" }).then((r) => r.data),
  });

  const { data: upcomingBatchesRes } = useQuery({
    queryKey: ["batches-upcoming"],
    queryFn: () => adminGetBatches({ status: "upcoming" }).then((r) => r.data),
  });

  const { data: qboInvoicesData } = useQuery({
    queryKey: ["qbo-compare-invoices"],
    queryFn: () => compareQboInvoices().then((r) => r.data),
    enabled: !!filters.QboLense,
  });

  const { data: qboPaymentsData } = useQuery({
    queryKey: ["qbo-compare-payments"],
    queryFn: () => compareQboPayments().then((r) => r.data),
    enabled: !!filters.QboLense,
  });

  // ── lookup maps by invoiceNumber ──
  const invoiceByNumber = new Map(
    (qboInvoicesData?.data ?? []).map((r: any) => [String(r.invoiceNumber), r])
  );

  const paymentsByInvoiceNumber = new Map<string, any[]>();
  (qboPaymentsData?.data ?? []).forEach((r: any) => {
    const key = String(r.invoiceNumber);
    if (!paymentsByInvoiceNumber.has(key)) paymentsByInvoiceNumber.set(key, []);
    paymentsByInvoiceNumber.get(key)!.push(r);
  });

  const activeBatches = [
    ...(activeBatchesRes?.data ?? []),
    ...(upcomingBatchesRes?.data ?? []),
  ];

  // const activeBatches = batchesRes?.data ?? [];

  // ── Dynamic create fields with dropdowns ─────────────────────────────────
  const createFields: ModalField[] = [
    {
      name: "user",
      label: "Student*",
      type: "searchable-select",
      required: true,
      options: users.map((u: any) => ({
        label: `${u.name} (${u.email || u.phone || "—"})`,
        value: u._id,
      })),
    },
    // {
    //   name: "programs",
    //   label: "Program(s)*",
    //   type: "multi-select",
    //   required: true,
    //   options: programs.map((p: any) => ({
    //     label: p.name,
    //     value: p._id,
    //   })),
    // },
    // {
    //   name: "batch",
    //   label: "Batch*",
    //   required: true,
    //   type: "select",
    //   options: [
    //     { label: "— None —", value: "" },
    //     ...activeBatches.map((b: any) => ({ label: b.name, value: b._id })),
    //   ],
    // },
  ];

  const editFields: ModalField[] = [
    {
      name: "progress",
      label: "Progress (%)",
      type: "input",
      inputType: "number",
      placeholder: "0-100",
    },
    // {
    //   name: "status",
    //   label: "Status",
    //   type: "select",
    //   options: [
    //     { label: "Active", value: "active" },
    //     { label: "Pending", value: "pending" },
    //     { label: "Completed", value: "completed" },
    //     { label: "Suspended", value: "suspended" },
    //     { label: "Cancelled", value: "cancelled" },
    //     { label: "Blocked", value: "blocked" },
    //   ],
    // },
    // {
    //   name: "accessStatus",
    //   label: "Access Status",
    //   type: "select",
    //   options: [
    //     { label: "Active", value: "ACTIVE" },
    //     { label: "Grace", value: "GRACE" },
    //     { label: "Extended", value: "EXTENDED" },
    //     { label: "Restricted", value: "RESTRICTED" },
    //     { label: "Blocked", value: "BLOCKED" },
    //   ],
    // },
    {
      name: "program_id",
      label: "Program",
      type: "select",
      options: programs.map((p: any) => ({
        label: p.name,
        value: p._id,
      })),
    },
    {
      name: "batch_id",
      label: "Batch",
      type: "select",
      options: [
        { label: "— None —", value: "" },
        ...activeBatches
          .filter((b: any) => {
            const batchProgramId = b.program_id?._id || b.program_id;
            const currentProgramId =
              editingEnrollment?.program?._id || editingEnrollment?.program;
            return batchProgramId === currentProgramId;
          })
          .map((b: any) => ({
            label: b.name,
            value: b._id,
          })),
      ],
    },
  ];

  // ── Filter fields ─────────────────────────────────────────────────────────
  const filterFields: FilterField[] = [
    { type: "input", name: "search", placeholder: "Search..." },
    {
      type: "select",
      name: "status",
      options: [
        { label: "Active", value: "active" },
        { label: "Completed", value: "completed" },
        { label: "Suspended", value: "suspended" },
      ],
    },
    {
      type: "select",
      name: "accessStatus",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Grace", value: "GRACE" },
        { label: "Extended", value: "EXTENDED" },
        { label: "Restricted", value: "RESTRICTED" },
        { label: "Blocked", value: "BLOCKED" },
      ],
    },
  ];

  // ── Main query ────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ["enrollments", filters],
    queryFn: () =>
      getAllEnrollments({
        ...filters,
        page: Number(filters.page),
        limit: Number(filters.limit),
      }).then((r) => r.data),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const { mutate: addEnrollment, isPending: isAdding } = useMutation({
    mutationFn: createEnrollmentDirect,
    onSuccess: () => {
      toast.success("Enrollment created! ✅");
      setIsAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Failed!"),
  });

  const { mutate: editEnrollment, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateEnrollment(id, data),
    onSuccess: () => {
      toast.success("Updated! ✅");
      setEditingEnrollment(null);
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: () => toast.error("Failed to update!"),
  });

  const { mutate: deleteEnroll, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteEnrollment(id),
    onSuccess: () => {
      toast.success("Deleted! 🗑️");
      setDeletingEnrollment(null);
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: () => toast.error("Failed to delete!"),
  });

  const { mutate: graduate, isPending: isGraduating } = useMutation({
    mutationFn: (id: string) => graduateEnrollment(id),
    onSuccess: () => {
      toast.success("Student graduated! 🎓");
      setGraduatingEnrollment(null);
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: () => toast.error("Failed!"),
  });

  const { mutate: suspend, isPending: isSuspending } = useMutation({
    mutationFn: (id: string) => suspendEnrollment(id),
    onSuccess: () => {
      toast.success("Enrollment suspended!");
      setSuspendingEnrollment(null);
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: () => toast.error("Failed!"),
  });

  const { mutate: reactivate, isPending: isReactivating } = useMutation({
    mutationFn: (id: string) => reactivateEnrollment(id),
    onSuccess: () => {
      toast.success("Enrollment reactivated! ✅");
      setReactivatingEnrollment(null);
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: () => toast.error("Failed!"),
  });

  const { mutate: assignEnrollmentMutate, isPending: isAssigning } =
    useMutation({
      mutationFn: ({
        id,
        assigned_to,
      }: {
        id: string;
        assigned_to: string;
      }) => assignEnrollment(id, assigned_to),

      onSuccess: () => {
        toast.success("Enrollment assigned successfully");
        setAssigningEnrollment(null);

        queryClient.invalidateQueries({
          queryKey: ["enrollments"],
        });
      },

      onError: (err: any) => {
        toast.error(
          err?.response?.data?.message || "Failed to assign enrollment"
        );
      },
    });



  const { mutate: addBundleEnrollment, isPending: isAddingBundle } = useMutation({
    mutationFn: createEnrollmentDirectBundle, // naya API function
    onSuccess: () => {
      toast.success("Bundle enrollment created! ✅");
      setIsAddOpen(false);
      setSelectedPrograms([]);
      setProgramBatches({});
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed!"),
  });

  const currentPage = Number(filters.page);
  const limit = Number(filters.limit);

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: String(newPage) }));
  };

  const enrolledCombinations = new Set(
    (data?.data ?? []).flatMap((row: any) =>
      row.enrollments.map((e: any) => `${row.user?._id}_${e.program?._id}`)
    )
  );

  const handleAddEnrollment = (formData: any) => {
    const programs: string[] = formData.programs || [];
    const batches: Record<string, string> = formData.programBatches || {};
    const audioAccessMap: Record<string, boolean> = formData.programAudioAccess || {};

    if (programs.length === 0) {
      toast.error("Select at least one program!");
      return;
    }

    const isBizBox = (pid: string) => programCategoryMap.get(pid) === "business_in_a_box";

    const missing = programs.find((pid) => !isBizBox(pid) && !batches[pid]);
    if (missing) {
      toast.error("Please select a batch for every selected program!");
      return;
    }

    if (programs.length === 1) {
      const pid = programs[0];
      if (enrolledCombinations.has(`${formData.user}_${pid}`)) {
        toast.error("User is already enrolled in this program!");
        return;
      }
      addEnrollment({
        user: formData.user,
        program: pid,
        batch: batches[pid] || undefined,
        audioAccess: audioAccessMap[pid] ?? true,
      });
    } else {
      const alreadyEnrolled = programs.some((pid) =>
        enrolledCombinations.has(`${formData.user}_${pid}`)
      );
      if (alreadyEnrolled) {
        toast.error("User already enrolled in one of the selected programs!");
        return;
      }
      const programBatchPairs = programs.map((pid) => ({
        program: pid,
        batch: batches[pid] || undefined,
        audioAccess: audioAccessMap[pid] ?? true,
      }));
      addBundleEnrollment({ user: formData.user, programBatches: programBatchPairs });
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Enrollments"
        subtitle="Manage all student enrollments"
        titleIcon={<BookOpen size={24} />}
        totalCount={data?.meta?.total ?? 0}
        onAdd={canAdd ? () => setIsAddOpen(true) : undefined}
        filters={filters}
        setFilters={setFilters}
        filterFields={filterFields}
        exportBtn={
          <div className="flex gap-2">
            {isFinanceManager && (
              <ImportButton />
            )}
            <ExportButton
              filename="enrollments-all"
              label="Export Excel"
              fetchData={async () => {
                const res = await getAllEnrollments({ limit: 10000 });
                const rows = res.data.data ?? [];

                // grouped rows ko flatten karo -> ek row per enrollment
                return rows.flatMap((row: any) =>
                  (row.enrollments || []).map((e: any) => ({
                    user: row.user,
                    program: e.program,
                    batch: e.batch,
                    status: e.status,
                    accessStatus: e.accessStatus,
                    enrolledAt: e.enrolledAt,
                  }))
                );
              }}
              columns={[
                { header: "Student", key: "user.name" },
                { header: "Email", key: "user.email" },
                { header: "Phone", key: "user.phone" },
                { header: "Program", key: "program.name" },
                { header: "Batch", key: "batch.name" },
                { header: "Batch Start", key: "batch.start_date", format: (v) => v ? new Date(v).toLocaleDateString("en-PK") : "—" },
                { header: "Status", key: "status" },
                { header: "Access Status", key: "accessStatus" },
                { header: "Enrolled At", key: "enrolledAt", format: (v) => v ? new Date(v).toLocaleDateString("en-PK") : "—" }, // ← key fix
              ]}
            />
            <button
              onClick={() => setFilters((f) => ({ ...f, QboLense: !f.QboLense }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${filters.QboLense
                ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                : "border-gray-200 text-gray-600 hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-200"
                }`}
            >
              {filters.QboLense && <CheckIcon size={13} />}
              QBO Lense
            </button>
          </div>
        }
      />

      <DynamicTable
        data={data?.data || []}
        currentPage={currentPage}
        pageSize={limit}
        isLoading={isLoading}
        isError={isError}
        hideToggle={false}
        totalPages={data?.meta?.totalPages}
        // onRowClick={(item) => router.push(`/enrollments/${item.enrollments[0]?._id}`)}
        // onRowClick={(item) => router.push(`/dashboard/enrollments/${item.enrollments[0]?._id}`)}
        onPageChange={handlePageChange}
        // columns={[
        //   {
        //     key: "user",
        //     label: "Student",
        //     render: (e) => (
        //       <div className="flex items-center gap-2">
        //         <div>
        //           <p className="font-medium text-gray-800">
        //             {e.user?.name || "—"}
        //           </p>
        //           <p className="text-xs text-gray-400">{e.user?.email}</p>
        //         </div>
        //       </div>
        //     ),
        //   },
        //   {
        //     key: "role",
        //     label: "Role",
        //     render: (e) => (
        //       <span
        //         className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColor(e.user?.role)}`}
        //       >
        //         {e.user?.role || "—"}
        //       </span>
        //     ),
        //   },
        //   {
        //     key: "program",
        //     label: "Program",
        //     render: (e) => (
        //       <span className="text-gray-700">{e.program?.name || "—"}</span>
        //     ),
        //   },
        //   {
        //     key: "batch",
        //     label: "Batch",
        //     render: (e) => (
        //       <span className="text-gray-500 text-sm">
        //         {e.batch?.name || "—"}
        //       </span>
        //     ),
        //   },
        //   {
        //     key: "status",
        //     label: "Status",
        //     render: (e) => (
        //       <span
        //         className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(e.status)}`}
        //       >
        //         {e.status}
        //       </span>
        //     ),
        //   },
        //   {
        //     key: "accessStatus",
        //     label: "Access",
        //     render: (e) => (
        //       <span
        //         className={`px-2.5 py-1 rounded-full text-xs font-medium ${accessColor(e.accessStatus)}`}
        //       >
        //         {e.accessStatus || "—"}
        //       </span>
        //     ),
        //   },
        //   {
        //     key: "progress",
        //     label: "Progress",
        //     render: (e) => (
        //       <div className="flex items-center gap-2">
        //         <div className="w-16 bg-gray-100 rounded-full h-1.5">
        //           <div
        //             className="h-1.5 rounded-full bg-yellow-400"
        //             style={{ width: `${e.progress || 0}%` }}
        //           />
        //         </div>
        //         <span className="text-xs text-gray-500">
        //           {e.progress || 0}%
        //         </span>
        //       </div>
        //     ),
        //   },
        //   {
        //     key: "enrolledAt",
        //     label: "Enrolled",
        //     render: (e) => (
        //       <span className="text-gray-400 text-sm">
        //         {e.enrolledAt
        //           ? new Date(e.enrolledAt).toLocaleDateString()
        //           : "—"}
        //       </span>
        //     ),
        //   },
        // ]}
        columns={[
          {
            key: "user",
            label: "Student",
            render: (row) => (   // row = { user, enrollments[] }
              <div>
                <p className="font-medium text-gray-800">{row.user?.name || "—"}</p>
                <p className="text-xs text-gray-400">{row.user?.email}</p>
                {filters.QboLense && (<p className="text-xs text-green-500">{row.user?._id}</p>)}
              </div>
            ),
          },
          {
            key: "role",
            label: "Role",
            render: (row) => (
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColor(row.user?.role)}`}>
                {row.user?.role || "—"}
              </span>
            ),
          },
          {
            key: "books",
            label: "Books",
            render: (row) => <UserBooksCell

              userId={row.user?._id}

              minWidth="w-[200px]"
              tooltipWidth="w-64"
            />,
          },
          {
            key: "enrollments",
            label: "Programs",
            minWidth: "350px",
            render: (row) => (
              <CollapsedCell
                items={row.enrollments.map((e: any) => (
                  <div
                    key={e._id}
                    onClick={(ev) => {
                      ev.stopPropagation();              // row-click ko fire hone se roko
                      router.push(`/dashboard/enrollments/${e._id}`); // sirf isi program ki detail
                    }}
                    className="relative cursor-pointer hover:bg-indigo-50 rounded-lg p-1.5 -m-1.5 transition"
                  >
                    <p className="text-sm font-medium text-gray-700 leading-tight">
                      {e.program?.name || "—"}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {e.batch?.name || "No Batch"}
                    </p>
                    {/* <p className="text-[11px] text-gray-400 mt-0.5">
                      {e._id}
                    </p> */}
                    {e.assigned_to ? (
                      <div className="flex gap-2 ">
                        <p className="py-1 text-[10px] text-gray-500">Assigned To</p>
                        <button
                          className="px-2 py-1 text-[10px] rounded bg-indigo-100 text-indigo-600"
                          onClick={(ev) => {
                            ev.stopPropagation();         // assign popup ko alag rakho
                            setAssigningEnrollment(e);
                          }}
                        >
                          {e.assigned_to.name}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setAssigningEnrollment(e);
                        }}
                        className="px-2 py-1 text-[10px] rounded bg-yellow-100 text-yellow-700"
                      >
                        not assigned
                      </button>
                    )}
                    <div className="flex gap-2">
                      <div
                        className={`px-2.5 py-0.5 rounded text-[10px] font-medium w-fit ${statusColor(e.status)} mt-0.5`}
                      >
                        {e.status}
                      </div>
                      {e.invoice?.isBundle && (
                        <div className="px-2.5 py-0.5 rounded text-[10px] font-medium w-fit bg-purple-100 text-purple-600  mt-0.5">
                          Bundle
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                minWidth="w-[300px]"
                tooltipWidth="w-64"
              />
            ),
          },
          // {
          //   key: "status",
          //   label: "Status",
          //   render: (row) => (
          //     <div className="flex flex-col gap-1">
          //       {row.enrollments.map((e: any) => (
          //         <span
          //           key={e._id}
          //           className={`px-2.5 py-1 rounded-full text-xs font-medium w-fit ${statusColor(e.status)}`}
          //         >
          //           {e.status}
          //         </span>
          //       ))}
          //     </div>
          //   ),
          // },
          {
            key: "enrolledAt",
            label: "Enrolled",
            render: (row) => (
              <span className="text-gray-400 text-sm">
                {row.enrollments[0]?.enrolledAt
                  ? new Date(row.enrollments[0].enrolledAt).toLocaleDateString()
                  : "—"}
              </span>
            ),
          },
          ...(filters.QboLense
            ? [{
              key: "qboStatus",
              label: "QBO Invoice / Payments",
              minWidth: "260px",
              render: (row: any) => (
                <div className="flex flex-col gap-2">
                  {row.enrollments.map((e: any) => {
                    const invNum = e.invoice?.invoiceNumber ? String(e.invoice.invoiceNumber) : null;
                    if (!invNum) {
                      return (
                        <div key={e._id} className="text-[11px] text-gray-300">
                          No invoice
                        </div>
                      );
                    }
                    const invRow = invoiceByNumber.get(invNum);
                    const payRows = paymentsByInvoiceNumber.get(invNum) || [];
                    const qboPaid = payRows
                      .filter((p: any) => p.qbo?.exists)
                      .reduce((s: number, p: any) => s + Number(p.qbo?.totalAmt || 0), 0);
                    const crmPaid = payRows
                      .filter((p: any) => p.crm?.exists)
                      .reduce((s: number, p: any) => s + Number(p.crm?.amount || 0), 0);

                    return (
                      <div key={e._id} className="border border-gray-100 rounded-md p-1.5">
                        <div className="flex items-center gap-1 text-[11px]">
                          {invRow?.qbo?.exists ? (
                            <CheckIcon size={12} className="text-green-600" />
                          ) : (
                            <XIcon size={12} className="text-rose-500" />
                          )}
                          <span className="text-gray-500">
                            Inv #{invNum} {invRow?.qbo?.exists ? "in QBO" : "not in QBO"}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          CRM Rs {crmPaid.toLocaleString()} vs QBO Rs {qboPaid.toLocaleString()}
                          {crmPaid !== qboPaid && (
                            <span className="text-rose-500 font-medium ml-1">⚠ mismatch</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ),
            }]
            : []),
        ]}

        // actions={canAction ? [
        //   {
        //     icon: <Pencil size={14} />,
        //     label: "Edit",
        //     onClick: (e) => setEditingEnrollment(e),
        //     className: "hover:bg-yellow-50 hover:text-yellow-600",
        //   },
        //   {
        //     icon: <GraduationCap size={14} />,
        //     label: "Graduate",
        //     onClick: (e) => setGraduatingEnrollment(e),
        //     className: "hover:bg-teal-50 hover:text-teal-600",
        //     hidden: (e) => e.isGraduated || e.status !== "active",
        //   },
        //   {
        //     icon: <PauseCircle size={14} />,
        //     label: "Suspend",
        //     onClick: (e) => setSuspendingEnrollment(e),
        //     className: "hover:bg-yellow-50 hover:text-yellow-600",
        //     hidden: (e) => e.status !== "active",
        //   },
        //   {
        //     icon: <PlayCircle size={14} />,
        //     label: "Reactivate",
        //     onClick: (e) => setReactivatingEnrollment(e),
        //     className: "hover:bg-green-50 hover:text-green-600",
        //     hidden: (e) => e.status !== "suspended",
        //   },
        //   {
        //     icon: <Trash2 size={14} />,
        //     label: "Delete",
        //     onClick: (e) => setDeletingEnrollment(e),
        //     className: "hover:bg-rose-50 hover:text-rose-500",
        //     hidden: () => !isAdmin, // sirf admin delete kar sakta
        //   },
        // ] : []}
        actions={canAction ? [
          {
            icon: <BookOpen size={14} />,
            label: "Actions",
            onClick: (row) => setActionsRow(row), // sirf popup kholo
            className: "hover:bg-blue-50 hover:text-blue-600",
          },
        ] : []}
      />

      {/* Add Modal — dropdowns for user, program, batch */}
      {/* <Modal
        key={isAddOpen ? "open" : "closed"}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Create Enrollment"
        fields={createFields}
        // onSubmit={addEnrollment}
        // onSubmit={handleAddEnrollment}
        onSubmit={(data) => handleAddEnrollment({ ...data, assigned_to: authUser?._id })}
        isLoading={isAdding}
        mode="add"
      /> */}

      {/* Edit Modal */}
      {editingEnrollment && (
        <Modal
          isOpen={!!editingEnrollment}
          onClose={() => setEditingEnrollment(null)}
          title="Edit Enrollment"
          subtitle={editingEnrollment.user?.name}
          fields={editFields}
          // initialValues={{
          //   progress: editingEnrollment.progress || 0,
          //   // status: editingEnrollment.status,
          //   batch_id: editingEnrollment.batch_id?._id || editingEnrollment.batch_id || "",
          //   program_id: editingEnrollment.program_id?._id || editingEnrollment.program_id || "",
          //   // accessStatus: editingEnrollment.accessStatus || "",
          // }}
          initialValues={{
            progress: editingEnrollment.progress || 0,
            batch_id: editingEnrollment.batch?._id || editingEnrollment.batch || "",
            program_id: editingEnrollment.program?._id || editingEnrollment.program || "",
          }}
          onSubmit={(data) =>
            editEnrollment({ id: editingEnrollment._id, data })
          }
          isLoading={isUpdating}
          mode="edit"
        />
      )}

      {/* Graduate Popup */}
      {graduatingEnrollment && (
        <Popup
          isOpen={!!graduatingEnrollment}
          onClose={() => setGraduatingEnrollment(null)}
          onConfirm={() => graduate(graduatingEnrollment._id)}
          variant="info"
          title="Graduate Student"
          description={
            <>
              Mark{" "}
              <span className="font-bold text-teal-600">
                {graduatingEnrollment.user?.name}
              </span>{" "}
              as graduated?
            </>
          }
          confirmText="Yes, Graduate 🎓"
          isLoading={isGraduating}
          loadingText="Processing..."
        />
      )}

      {/* Suspend Popup */}
      {suspendingEnrollment && (
        <Popup
          isOpen={!!suspendingEnrollment}
          onClose={() => setSuspendingEnrollment(null)}
          onConfirm={() => suspend(suspendingEnrollment._id)}
          variant="danger"
          title="Suspend Enrollment"
          description={
            <>
              Suspend enrollment of{" "}
              <span className="font-bold text-yellow-600">
                {suspendingEnrollment.user?.name}
              </span>
              ?
            </>
          }
          confirmText="Yes, Suspend"
          isLoading={isSuspending}
          loadingText="Suspending..."
        />
      )}

      {/* Reactivate Popup */}
      {reactivatingEnrollment && (
        <Popup
          isOpen={!!reactivatingEnrollment}
          onClose={() => setReactivatingEnrollment(null)}
          onConfirm={() => reactivate(reactivatingEnrollment._id)}
          variant="info"
          title="Reactivate Enrollment"
          description={
            <>
              Reactivate enrollment of{" "}
              <span className="font-bold text-green-600">
                {reactivatingEnrollment.user?.name}
              </span>
              ?
            </>
          }
          confirmText="Yes, Reactivate"
          isLoading={isReactivating}
          loadingText="Reactivating..."
        />
      )}

      {/* Delete Popup */}
      {deletingEnrollment && (
        <Popup
          isOpen={!!deletingEnrollment}
          onClose={() => setDeletingEnrollment(null)}
          onConfirm={() => deleteEnroll(deletingEnrollment._id)}
          variant="danger"
          title="Delete Enrollment"
          description={
            <>
              Delete enrollment of{" "}
              <span className="font-bold text-rose-500">
                {deletingEnrollment.user?.name}
              </span>
              ? This cannot be undone.
            </>
          }
          confirmText="Yes, Delete"
          isLoading={isDeleting}
          loadingText="Deleting..."
        />
      )}

      {actionsRow && (
        <EnrollmentActionsPopup
          row={actionsRow}
          isAdmin={isAdmin}
          onGraduate={(e) => setGraduatingEnrollment(e)}
          onSuspend={(e) => setSuspendingEnrollment(e)}
          onReactivate={(e) => setReactivatingEnrollment(e)}
          onDelete={(e) => setDeletingEnrollment(e)}
          onClose={() => setActionsRow(null)}
          onEdit={(e) => setEditingEnrollment(e)}
          onAddBook={(userId) => setAddBookUserId(userId)}
        />
      )}

      {/* Add Book Popup */}
      {addBookUserId && (
        <AddBookPopup
          userId={addBookUserId}
          onClose={() => setAddBookUserId(null)}
        />
      )}

      {assigningEnrollment && (
        <AssignLeadModal
          lead={{
            assigned_to: assigningEnrollment.assigned_to,
            first_name: assigningEnrollment.user?.name,
            email: assigningEnrollment.user?.email,
          }}
          currentUserRole={authUser.role}
          isLoading={isAssigning}
          onClose={() => setAssigningEnrollment(null)}
          onAssign={(userId) =>
            assignEnrollmentMutate({
              id: assigningEnrollment._id,
              assigned_to: userId,
            })
          }
        />
      )}

      {/* <Modal
        key={isAddOpen ? "open" : "closed"}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Create Enrollment"
        fields={createFields}
        onSubmit={(data) =>
          handleAddEnrollment({ ...data, assigned_to: authUser?._id, programs: selectedPrograms })
        }
        isLoading={isAdding}
        mode="add"
      >
        <ProgramMultiSelect
          programs={programs}
          selected={selectedPrograms}
          onToggle={toggleProgram}
        />
      </Modal> */}
      {/* <Modal
        key={isAddOpen ? "open" : "closed"}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Create Enrollment"
        fields={createFields}
        onSubmit={(data) => handleAddEnrollment({ ...data, assigned_to: authUser?._id })}
        isLoading={isAdding}
        mode="add"
      /> */}
      <Modal
        key={isAddOpen ? "open" : "closed"}
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setSelectedPrograms([]);
          setProgramBatches({});
        }}
        title="Create Enrollment"
        fields={createFields}
        onSubmit={(data) =>
          handleAddEnrollment({
            user: data.user,
            programs: selectedPrograms,
            programBatches,
            programAudioAccess,   // ← NAYA
          })
        }
        isLoading={isAdding || isAddingBundle}
        mode="add"
      >
        <ProgramPicker
          programs={programs}
          selected={selectedPrograms}
          programBatches={programBatches}
          activeBatches={activeBatches}
          programAudioAccess={programAudioAccess}
          onToggle={toggleProgram}
          onPickBatch={(program) => setBatchPickerProgram(program)}
          onToggleAudioAccess={(id) =>
            setProgramAudioAccess((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))
          }
        />
      </Modal>

      {batchPickerProgram && (
        <BatchPickerModal
          program={batchPickerProgram}
          batches={activeBatches.filter((b: any) => {
            const batchProgramId = b.program_id?._id || b.program_id;
            return batchProgramId === batchPickerProgram.id;
          })}
          currentBatch={programBatches[batchPickerProgram.id]}
          onConfirm={(batchId) =>
            setProgramBatches((prev) => ({ ...prev, [batchPickerProgram.id]: batchId }))
          }
          onClose={() => setBatchPickerProgram(null)}
        />
      )}
    </>
  );
}

export default function EnrollmentsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin", "finance_manager", "sales_manager", "sales_rep"]}>
      <EnrollmentsContent />
    </ProtectedRoute>
  );
}