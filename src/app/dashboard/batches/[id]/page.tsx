"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminGetBatchById,
  adminAddStudentToBatch,
  adminRemoveStudentFromBatch,
  adminSwitchStudentBatch,
  adminGetBatches,
  searchEnrollments,
  toggleAudioAccess,
} from "@/utils/api";
import API from "@/utils/api";
import ProtectedRoute from "@/app/component/protected-route";
import PageHeader from "@/app/component/dashboard/page-header";
import Popup from "@/app/component/ui/popup/popup";
import {
  ArrowLeft, CalendarDays, Clock, Users, GraduationCap,
  Mail, Phone, ChevronRight, Plus, Trash2, ArrowLeftRight,
  Search, X, Loader2, Volume2, VolumeX,
  Mic,
  MicOff,
} from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";



// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColor = (status: string) => {
  switch (status) {
    case "active": return "bg-emerald-100 text-emerald-700";
    case "upcoming": return "bg-blue-100 text-blue-700";
    case "completed": return "bg-gray-100 text-gray-600";
    case "cancelled": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-600";
  }
};

const enrollmentStatusColor = (status: string) => {
  switch (status) {
    case "active": return "bg-emerald-100 text-emerald-700";
    case "completed": return "bg-gray-100 text-gray-600";
    case "suspended": return "bg-yellow-100 text-yellow-700";
    default: return "bg-gray-100 text-gray-500";
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

// ─── Search Enrollment Modal ─────────────────────────────────────────────────

function SearchEnrollmentModal({
  isOpen, onClose, onSelect, currentBatchId, currentProgramId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (enrollment: any) => void;
  currentBatchId: string;
  currentProgramId: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<any>(null); // gray item clicked
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchEnrollments(query);
        setResults(res.data?.data ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  if (!isOpen) return null;

  // Same program, different batch = gray (already enrolled elsewhere)
  const isSameProgram = (enr: any) => {
    const enrProgramId =
      typeof enr.program === "object" ? enr.program?._id : enr.program;
    return String(enrProgramId) === String(currentProgramId);
  };

  const isAlreadyInThisBatch = (enr: any) => {
    const enrBatchId =
      typeof enr.batch === "object" ? enr.batch?._id : enr.batch;
    return String(enrBatchId) === String(currentBatchId);
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); setSwitchTarget(null); } }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">

        {/* ── Switch confirm view ── */}
        {switchTarget ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">Switch Batch</h3>
              <button onClick={() => setSwitchTarget(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-gray-700">{switchTarget.user?.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{switchTarget.user?.email}</p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-red-50 text-red-500 rounded-lg font-medium">
                  Current: {switchTarget.batch?.name || "No batch"}
                </span>
                <ChevronRight size={12} className="text-gray-400" />
                <span className="px-2 py-1 bg-green-50 text-green-600 rounded-lg font-medium">
                  This batch
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              This will move the student from their current batch to this one. Their enrollment and progress will be preserved.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setSwitchTarget(null)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { onSelect({ ...switchTarget, _switchBatch: true }); setSwitchTarget(null); }}
                className="flex-1 py-2 rounded-lg bg-indigo-500 text-white text-sm hover:bg-indigo-600"
              >
                Confirm Switch
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">Add Student to Batch</h3>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={16} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 text-gray-600"
                autoFocus
              />
              {loading && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
              )}
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto space-y-1">
              {results.length === 0 && query.trim() && !loading ? (
                <p className="text-center text-sm text-gray-400 py-6">No enrollments found.</p>
              ) : (
                results.map((enr: any) => {
                  const sameProgram = isSameProgram(enr);
                  const inThisBatch = isAlreadyInThisBatch(enr);
                  const isGray = sameProgram && !inThisBatch; // same program, diff batch
                  const isDisabled = inThisBatch; // already in this batch

                  return (
                    <button
                      key={enr._id}
                      disabled={isDisabled}
                      onClick={() => {
                        if (isGray) {
                          // Same program different batch — show switch confirm
                          setSwitchTarget(enr);
                        } else {
                          onSelect(enr);
                        }
                      }}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isDisabled
                        ? "opacity-40 cursor-not-allowed bg-gray-50"
                        : isGray
                          ? "opacity-60 bg-amber-50 hover:bg-amber-100 cursor-pointer"
                          : "hover:bg-gray-50 cursor-pointer"
                        }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 shrink-0">
                        {enr.user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{enr.user?.name || "—"}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {enr.program?.name}
                          {enr.batch?.name && (
                            <span className={`ml-1 ${isGray ? "text-amber-600 font-medium" : ""}`}>
                              · {enr.batch.name}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isDisabled && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-600 font-medium">
                            In this batch
                          </span>
                        )}
                        {isGray && !isDisabled && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-medium">
                            Switch batch
                          </span>
                        )}
                        {!isGray && !isDisabled && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                            {enr.status}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Switch Batch Modal ─────────────────────────────────────────────────────

function SwitchBatchModal({
  isOpen,
  onClose,
  student,
  currentBatchId,
  programId,
  onSwitch,
}: {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  currentBatchId: string;
  programId: string;
  onSwitch: (enrollmentId: string, targetBatchId: string) => void;
}) {
  const [selectedBatch, setSelectedBatch] = useState("");
  const [error, setError] = useState("");

  const { data: batchesData } = useQuery({
    queryKey: ["admin-batches-for-switch", programId],
    queryFn: () => adminGetBatches({ program_id: programId }).then((r) => r.data),
    enabled: isOpen && !!programId,
  });

  const batches = batchesData?.data ?? [];

  // Filter out current batch
  const available = batches.filter((b: any) => b._id !== currentBatchId);

  const handleConfirm = () => {
    if (!selectedBatch) {
      setError("Please select a target batch");
      return;
    }
    onSwitch(student.enrollmentId, selectedBatch);
    setSelectedBatch("");
    setError("");
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-800">Switch Batch</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mb-4">
          Move <span className="font-medium text-gray-700">{student.name}</span> to another batch.
        </p>

        <select
          value={selectedBatch}
          onChange={(e) => { setSelectedBatch(e.target.value); setError(""); }}
          className="w-full border border-gray-200 text-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-400"
        >
          <option value="">— Select Batch —</option>
          {available.map((b: any) => (
            <option key={b._id} value={b._id}>
              {b.name} {b.start_date ? `(${formatDate(b.start_date)})` : ""} — {b.current_students}/{b.max_students}
            </option>
          ))}
        </select>
        {error && <p className="text-[11px] text-rose-500 mt-1.5">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg bg-indigo-500 text-white text-sm hover:bg-indigo-600"
          >
            Switch
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Batch Detail Content ─────────────────────────────────────────────────────

function BatchDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: authUser } = useAppSelector((state) => state.auth);
  const canManage = ["admin", "super_admin", "finance_manager"].includes(authUser?.role ?? "");
  const [switchingStudent, setSwitchingStudent] = useState<any>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [removingStudent, setRemovingStudent] = useState<any>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["batch", id],
    queryFn: () => adminGetBatchById(id).then((r) => r.data),
    enabled: !!id,
  });

  // ── Add student ──
  const { mutate: addStudent, isPending: isAdding } = useMutation({
    mutationFn: (studentId: string) => adminAddStudentToBatch(id, { studentId }),
    onSuccess: () => {
      toast.success("Student added to batch ✅");
      queryClient.invalidateQueries({ queryKey: ["batch", id] });
      setShowAddModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to add student"),
  });

  // ── Switch batch ──
  const { mutate: switchSearchStudent } = useMutation({
    mutationFn: ({
      studentId,
      sourceBatchId,
      targetBatchId,
    }: {
      studentId: string;
      sourceBatchId: string;
      targetBatchId: string;
    }) => adminSwitchStudentBatch(sourceBatchId, studentId, { targetBatchId }),
    onSuccess: () => {
      toast.success("Student switched to this batch ✅");
      queryClient.invalidateQueries({ queryKey: ["batch", id] });
      setShowAddModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to switch batch"),
  });

  const { mutate: switchStudent } = useMutation({
    mutationFn: ({ studentId, targetBatchId }: { studentId: string; targetBatchId: string }) =>
      adminSwitchStudentBatch(id, studentId, { targetBatchId }),
    onSuccess: () => {
      toast.success("Student switched to new batch ✅");
      queryClient.invalidateQueries({ queryKey: ["batch", id] });
      setSwitchingStudent(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to switch batch"),
  });

  // ── Remove student ──
  const { mutate: removeStudent, isPending: isRemoving } = useMutation({
    mutationFn: (studentId: string) => adminRemoveStudentFromBatch(id, studentId),
    onSuccess: () => {
      toast.success("Student removed ✅");
      queryClient.invalidateQueries({ queryKey: ["batch", id] });
      setRemovingStudent(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to remove student"),
  });

  // ── Audio toggle ──
  const { mutate: toggleAudio } = useMutation({
    mutationFn: ({ enrollmentId }: { enrollmentId: string }) =>
      toggleAudioAccess(enrollmentId),
    onSuccess: () => {
      toast.success("Audio access updated ✅");
      queryClient.invalidateQueries({ queryKey: ["batch", id] });
    },
    onError: () => toast.error("Failed to update audio access"),
  });

  // ── Handle search modal select ──
  const handleSearchSelect = (enrollment: any) => {
    if (enrollment._switchBatch) {
      const sourceBatchId =
        typeof enrollment.batch === "object" ? enrollment.batch?._id : enrollment.batch;

      if (sourceBatchId) {
        // Student already kisi batch me tha — us se remove (-1) aur is batch me add (+1)
        switchSearchStudent({ studentId: enrollment.user._id, sourceBatchId, targetBatchId: id });
      } else {
        // Student ka pehle koi batch hi nahi tha — sirf add karo, decrement ki zarurat nahi
        addStudent(enrollment.user?._id);
      }
    } else {
      addStudent(enrollment.user?._id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <p className="text-sm">Batch not found.</p>
        <button onClick={() => router.push("/dashboard/batches")} className="mt-3 text-xs text-indigo-600 hover:underline">
          Go back to batches
        </button>
      </div>
    );
  }

  const batch = data.data;
  const programName = typeof batch.program_id === "object" ? batch.program_id?.name ?? "—" : "—";
  const programId = typeof batch.program_id === "object" ? batch.program_id?._id ?? "" : batch.program_id ?? "";
  const enrollPct = batch.max_students > 0 ? Math.round((batch.current_students / batch.max_students) * 100) : 0;
  const students = batch.students ?? [];

  return (
    <>
      {/* ── Header ── */}
      <PageHeader
        title={batch.name}
        subtitle={`${programName} · ${batch.status}`}
        titleIcon={
          <button onClick={() => router.push("/dashboard/batches")} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft size={22} />
          </button>
        }
        actions={
          canManage ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:opacity-80 transition"
              style={{ background: "#EEEDFE" }}
              title="Add Student"
            >
              <Plus size={16} color="#534AB7" />
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Batch Info ── */}
        <div className="lg:col-span-1 flex flex-col gap-5">
          {/* Batch Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <CalendarDays size={15} className="text-indigo-500" /> Batch Info
            </h2>
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(batch.status)}`}>
                {batch.status}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-indigo-50 text-indigo-600">
                {programName}
              </span>
            </div>
            <div className="space-y-3">
              {batch.date_required !== false && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Start Date</span>
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <Clock size={11} /> {formatDate(batch.start_date)}
                    </span>
                  </div>
                  {batch.end_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">End Date</span>
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <Clock size={11} /> {formatDate(batch.end_date)}
                      </span>
                    </div>
                  )}
                  {batch.start_date && batch.end_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Duration</span>
                      <span className="text-xs text-gray-600">
                        {Math.ceil((new Date(batch.end_date).getTime() - new Date(batch.start_date).getTime()) / (1000 * 60 * 60 * 24))} days
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Enrollment */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users size={15} className="text-emerald-500" /> Enrollment
            </h2>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400">Capacity</span>
              <span className="text-sm font-medium text-gray-700">
                {batch.current_students ?? 0} / {batch.max_students ?? 0}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all ${enrollPct >= 90 ? "bg-red-400" : enrollPct >= 60 ? "bg-yellow-400" : "bg-emerald-400"}`}
                style={{ width: `${enrollPct}%` }}
              />
            </div>
            <div className="text-right text-xs text-gray-400">{enrollPct}% full</div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">Available Seats</span>
              <span className="text-sm font-semibold text-gray-700">
                {Math.max(0, (batch.max_students ?? 0) - (batch.current_students ?? 0))}
              </span>
            </div>
          </div>

          {/* ── Revenue ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Batch Revenue
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Gross Amount</span>
                <span className="text-sm font-semibold text-gray-700">
                  PKR {Number(batch.revenue?.grossAmount ?? 0).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Discount</span>
                <span className="text-sm font-semibold text-rose-500">
                  - PKR {Number(batch.revenue?.discountAmount ?? 0).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Net Amount</span>
                <span className="text-sm font-bold text-indigo-600">
                  PKR {Number(batch.revenue?.netAmount ?? 0).toLocaleString()}
                </span>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Paid</span>
                <span className="text-sm font-semibold text-emerald-600">
                  PKR {Number(batch.revenue?.paidAmount ?? 0).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Remaining</span>
                <span className="text-sm font-semibold text-amber-600">
                  PKR {Number(batch.revenue?.remainingAmount ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-indigo-50 rounded-xl px-3 py-2.5 text-center">
                <span className="text-lg font-bold text-indigo-700">{batch.current_students ?? 0}</span>
                <p className="text-[10px] text-indigo-400 font-medium mt-0.5">Enrolled</p>
              </div>
              <div className="bg-emerald-50 rounded-xl px-3 py-2.5 text-center">
                <span className="text-lg font-bold text-emerald-700">{batch.max_students ?? 0}</span>
                <p className="text-[10px] text-emerald-400 font-medium mt-0.5">Capacity</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Students List ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <GraduationCap size={15} className="text-amber-500" />
                Enrolled Students
                <span className="text-xs font-normal text-gray-400">({students.length})</span>
              </h2>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-10">
                <Users size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No students enrolled yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {students.map((student: any, idx: number) => (
                  <div key={student._id || idx} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                    {/* Avatar + Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 shrink-0">
                        {student.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{student.name || "—"}</p>
                        <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                          {student.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail size={10} /> {student.email}
                            </span>
                          )}
                          {student.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={10} /> {student.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {student.enrollmentStatus && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium hidden sm:inline ${enrollmentStatusColor(student.enrollmentStatus)}`}>
                          {student.enrollmentStatus}
                        </span>
                      )}

                      {canManage && (
                        <>
                          {/* Audio Toggle */}
                          <button
                            onClick={() => toggleAudio({ enrollmentId: student.enrollmentId })}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px]  font-medium transition-colors ${student.audioAccess
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-rose-100 text-rose-600 hover:bg-rose-200"
                              }`}
                            title={student.audioAccess ? "Disable audio" : "Enable audio"}
                          >
                            {student.audioAccess ? <Mic size={11} /> : <MicOff size={11} />}
                            {student.audioAccess ? "Enabled" : "Disabled"}
                          </button>

                          {/* Switch Batch */}
                          <button
                            onClick={() => setSwitchingStudent(student)}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-300 hover:text-indigo-500 transition"
                            title="Switch batch"
                          >
                            <ArrowLeftRight size={13} />
                          </button>

                          {/* Remove */}
                          <button
                            onClick={() => setRemovingStudent(student)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                            title="Remove from batch"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                      {/* View enrollment */}
                      <button
                        onClick={() => student.enrollmentId && router.push(`/dashboard/enrollments/${student.enrollmentId}`)}
                        className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-indigo-500 transition"
                        title="View enrollment"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Search/Add Modal ── */}
      <SearchEnrollmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSelect={handleSearchSelect}
        currentBatchId={id}
        currentProgramId={programId}
      />

      {/* ── Switch Batch Modal ── */}
      <SwitchBatchModal
        isOpen={!!switchingStudent}
        onClose={() => setSwitchingStudent(null)}
        student={switchingStudent}
        currentBatchId={id}
        programId={programId}
        onSwitch={(enrollmentId, targetBatchId) =>
          switchStudent({ studentId: switchingStudent._id, targetBatchId })}
      />

      {/* ── Remove Popup ── */}
      {removingStudent && (
        <Popup
          isOpen={!!removingStudent}
          onClose={() => setRemovingStudent(null)}
          onConfirm={() => removeStudent(removingStudent._id)}
          variant="danger"
          title="Remove Student"
          description={
            <>
              Are you sure you want to remove{" "}
              <span className="font-bold text-red-500">{removingStudent.name}</span>{" "}
              from this batch?
            </>
          }
          confirmText="Yes, Remove"
          isLoading={isRemoving}
          loadingText="Removing..."
        />
      )}
    </>
  );
}

export default function BatchDetailPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin", "sales_manager", "finance_manager", "sales_rep"]}>
      <BatchDetailContent />
    </ProtectedRoute>
  );
}