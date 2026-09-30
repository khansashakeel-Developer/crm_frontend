// "use client";
// import { useState } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import {
//   Upload,
//   X,
//   UploadCloud,
//   FileSpreadsheet,
//   CheckCircle2,
//   XCircle,
//   AlertTriangle,
// } from "lucide-react";
// import {
//   getNamesPrograms,
//   adminGetBatches,
//   previewBulkEnrollment,
//   confirmBulkEnrollment,
//   updateEnrollment,
// } from "@/utils/api";
// import Select from "@/app/component/ui/select";
// import toast from "react-hot-toast";
// import AssignPickerModal from "../../../component/dashboard/assign-picker-modal";

// // ── Types ────────────────────────────────────────────────────────────────
// interface PreviewRow {
//   email: string;
//   user: { _id: string; name: string; email: string; phone?: string } | null;
//   status: "eligible" | "duplicate" | "not_found";
//   enrollmentId?: string;       // sirf duplicate rows ke liye — existing enrollment ka id
//   currentAudioAccess?: boolean; // sirf duplicate rows ke liye — existing audioAccess value
// }

// interface PreviewResponse {
//   program: string;
//   batch: string | null;
//   totalRows: number;
//   eligibleCount: number;
//   duplicateCount: number;
//   notFoundCount: number;
//   preview: PreviewRow[];
// }

// // ── Badge helper ─────────────────────────────────────────────────────────
// function StatusBadge({ status }: { status: PreviewRow["status"] }) {
//   const map = {
//     eligible: { label: "Eligible", cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={12} /> },
//     duplicate: { label: "Already Enrolled", cls: "bg-yellow-100 text-yellow-700", icon: <AlertTriangle size={12} /> },
//     not_found: { label: "User Not Found", cls: "bg-rose-100 text-rose-700", icon: <XCircle size={12} /> },
//   };
//   const conf = map[status];
//   return (
//     <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${conf.cls}`}>
//       {conf.icon}
//       {conf.label}
//     </span>
//   );
// }

// export default function ImportButton({ queryKey = "enrollments" }: { queryKey?: string }) {
//   const [isOpen, setIsOpen] = useState(false);
//   const [step, setStep] = useState<"upload" | "review">("upload");

//   const [file, setFile] = useState<File | null>(null);
//   const [dragActive, setDragActive] = useState(false);
//   const [selectedProgram, setSelectedProgram] = useState("");
//   const [selectedBatch, setSelectedBatch] = useState("");

//   const [rows, setRows] = useState<PreviewRow[]>([]);
//   const [removedEmails, setRemovedEmails] = useState<Set<string>>(new Set());
//   const [assignMap, setAssignMap] = useState<Record<string, string>>({}); // email -> assigned_to userId
//   const [assignNameMap, setAssignNameMap] = useState<Record<string, string>>({}); // email -> assigned_to name (display)
//   const [assigningRowEmail, setAssigningRowEmail] = useState<string | null>(null); // jis row ke liye assign modal khula hai
//   const [audioMap, setAudioMap] = useState<Record<string, boolean>>({}); // email -> audioAccess
//   const [savedAudioEmails, setSavedAudioEmails] = useState<Set<string>>(new Set()); // duplicate rows jinka audio update ho chuka
//   const [confirmedEmails, setConfirmedEmails] = useState<Set<string>>(new Set());

//   const queryClient = useQueryClient();

//   // ── Dropdown data ────────────────────────────────────────────────────
//   const { data: programs = [] } = useQuery({
//     queryKey: ["program-names"],
//     queryFn: getNamesPrograms,
//   });

//   const { data: batchesRes } = useQuery({
//     queryKey: ["batches-active"],
//     queryFn: () => adminGetBatches({ status: "active" }).then((r) => r.data),
//   });
//   const activeBatches = batchesRes?.data ?? [];

//   // ── Reset everything on close ────────────────────────────────────────
//   const handleClose = () => {
//     setIsOpen(false);
//     setStep("upload");
//     setFile(null);
//     setSelectedProgram("");
//     setSelectedBatch("");
//     setRows([]);
//     setRemovedEmails(new Set());
//     setAssignMap({});
//     setAssignNameMap({});
//     setAssigningRowEmail(null);
//     setAudioMap({});
//     setSavedAudioEmails(new Set());
//     setConfirmedEmails(new Set());
//   };

//   const handleFileSelect = (selected: File | null) => {
//     if (!selected) return;
//     const validTypes = [
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       "application/vnd.ms-excel",
//     ];
//     if (!validTypes.includes(selected.type)) {
//       alert("Sirf Excel file (.xlsx/.xls) allow hai");
//       return;
//     }
//     setFile(selected);
//   };

//   const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
//     e.preventDefault();
//     setDragActive(false);
//     const dropped = e.dataTransfer.files?.[0];
//     if (dropped) handleFileSelect(dropped);
//   };

//   // ── Preview mutation ─────────────────────────────────────────────────
//   const previewMutation = useMutation({
//     mutationFn: async () => {
//       const formData = new FormData();
//       formData.append("file", file as File);
//       formData.append("program", selectedProgram);
//       if (selectedBatch) formData.append("batch", selectedBatch);

//       const res = await previewBulkEnrollment(formData);
//       return res.data as PreviewResponse;
//     },
//     onSuccess: (data) => {
//       setRows(data.preview);
//       // ✅ default: eligible rows par true, duplicate rows par unka existing audioAccess value
//       const defaultAudio: Record<string, boolean> = {};
//       data.preview.forEach((r) => {
//         if (r.status === "eligible") defaultAudio[r.email] = true;
//         if (r.status === "duplicate") defaultAudio[r.email] = r.currentAudioAccess ?? true;
//       });
//       setAudioMap(defaultAudio);
//       setStep("review");
//     },
//     onError: (err: any) => {
//       toast.error(err?.response?.data?.message || "Preview failed");
//     },
//   });

//   // ── Confirm mutation (single row ya bulk, same endpoint) ────────────
//   const confirmMutation = useMutation({
//     mutationFn: async (payload: { user: string; program: string; batch?: string; assigned_to?: string; audioAccess?: boolean }[]) => {
//       const res = await confirmBulkEnrollment(payload);
//       return res.data;
//     },
//     onSuccess: (data, variables) => {
//       const confirmedNow = new Set(confirmedEmails);
//       // mark rows as confirmed based on which emails were sent (match by user id back to email)
//       rows.forEach((r) => {
//         if (r.user && variables.some((v) => v.user === r.user!._id)) {
//           confirmedNow.add(r.email);
//         }
//       });
//       setConfirmedEmails(confirmedNow);
//       toast.success(`${data.createdCount} enrolled, ${data.skippedCount} skipped`);
//       queryClient.invalidateQueries({ queryKey: [queryKey] });
//     },
//     onError: (err: any) => {
//       toast.error(err?.response?.data?.message || "Enrollment failed");
//     },
//   });

//   // ✅ Duplicate (already-enrolled) row ka audioAccess update karo — naya enrollment nahi, existing wala
//   const updateAudioMutation = useMutation({
//     mutationFn: async ({ enrollmentId, audioAccess }: { enrollmentId: string; audioAccess: boolean }) =>
//       updateEnrollment(enrollmentId, { audioAccess }),
//     onSuccess: (_data, variables) => {
//       const row = rows.find((r) => r.enrollmentId === variables.enrollmentId);
//       if (row) {
//         setSavedAudioEmails((prev) => new Set(prev).add(row.email));
//       }
//       toast.success("Audio access updated");
//       queryClient.invalidateQueries({ queryKey: [queryKey] });
//     },
//     onError: (err: any) => {
//       toast.error(err?.response?.data?.message || "Failed to update audio access");
//     },
//   });


//   const visibleRows = rows.filter((r) => !removedEmails.has(r.email));
//   const eligibleUnconfirmedRows = visibleRows.filter(
//     (r) => r.status === "eligible" && !confirmedEmails.has(r.email)
//   );

//   const removeRow = (email: string) => {
//     setRemovedEmails((prev) => new Set(prev).add(email));
//   };

//   const confirmSingleRow = (row: PreviewRow) => {
//     if (!row.user) return;
//     confirmMutation.mutate([
//       {
//         user: row.user._id,
//         program: selectedProgram,
//         batch: selectedBatch || undefined,
//         assigned_to: assignMap[row.email] || undefined,
//         audioAccess: audioMap[row.email] ?? true,
//       },
//     ]);
//   };

//   const confirmAll = () => {
//     const payload = eligibleUnconfirmedRows
//       .filter((r) => r.user)
//       .map((r) => ({
//         user: r.user!._id,
//         program: selectedProgram,
//         batch: selectedBatch || undefined,
//         assigned_to: assignMap[r.email] || undefined,
//         audioAccess: audioMap[r.email] ?? true,
//       }));

//     if (payload.length === 0) {
//       toast.error("No eligible rows to confirm");
//       return;
//     }
//     confirmMutation.mutate(payload);
//   };

//   return (
//     <>
//       <button
//         onClick={() => setIsOpen(true)}
//         className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-600 text-gray-600 text-sm font-medium rounded-lg transition-colors shadow-sm"
//         title="Bulk enroll users from Excel"
//       >
//         <Upload size={13} />
//         Import Excel
//       </button>

//       {isOpen && (
//         <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
//             {/* Header */}
//             <div className="flex justify-between items-center p-6 border-b shrink-0">
//               <div>
//                 <h2 className="text-lg font-semibold text-gray-800">Bulk Enroll Users</h2>
//                 <p className="text-xs text-gray-400 mt-0.5">
//                   {step === "upload"
//                     ? "Excel se users ko ek program/batch mein enroll karein"
//                     : "Review karein aur assign/audio access set kar ke confirm karein"}
//                 </p>
//               </div>
//               <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition">
//                 <X size={20} />
//               </button>
//             </div>

//             {/* ── STEP 1: UPLOAD ─────────────────────────────────────── */}
//             {step === "upload" && (
//               <>
//                 <div className="p-6 space-y-4 overflow-y-auto">
//                   <Select
//                     label="Program*"
//                     placeholder="— Select Program —"
//                     value={selectedProgram}
//                     options={programs.map((p: any) => ({ label: p.name, value: p._id }))}
//                     onChange={(e) => setSelectedProgram(e.target.value)}
//                   />

//                   <Select
//                     label="Batch (optional)"
//                     placeholder="— None —"
//                     value={selectedBatch}
//                     options={activeBatches.map((b: any) => ({ label: b.name, value: b._id }))}
//                     onChange={(e) => setSelectedBatch(e.target.value)}
//                   />

//                   <div
//                     onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
//                     onDragLeave={() => setDragActive(false)}
//                     onDrop={handleDrop}
//                     className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${dragActive ? "border-yellow-400 bg-yellow-50" : "border-gray-200"
//                       }`}
//                     onClick={() => document.getElementById("enrollment-import-file-input")?.click()}
//                   >
//                     <input
//                       id="enrollment-import-file-input"
//                       type="file"
//                       accept=".xlsx,.xls"
//                       className="hidden"
//                       onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
//                     />
//                     {file ? (
//                       <div className="flex flex-col items-center gap-2">
//                         <FileSpreadsheet className="text-green-600" size={28} />
//                         <p className="text-sm font-medium text-gray-700">{file.name}</p>
//                         <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
//                       </div>
//                     ) : (
//                       <div className="flex flex-col items-center gap-2 text-gray-400">
//                         <UploadCloud size={28} />
//                         <p className="text-sm">Click ya drag karke file yahan drop karein</p>
//                         <p className="text-xs">.xlsx ya .xls</p>
//                       </div>
//                     )}
//                   </div>

//                   <p className="text-xs text-gray-500">
//                     Column order: <strong>A = Name</strong>, <strong>B = Email</strong>, <strong>C = Phone</strong>.
//                     Matching sirf <strong>Email</strong> se hoti hai. Pehli row header treat hogi (skip).
//                   </p>
//                 </div>

//                 <div className="flex gap-3 p-6 border-t shrink-0">
//                   <button
//                     onClick={handleClose}
//                     className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     onClick={() => previewMutation.mutate()}
//                     disabled={!file || !selectedProgram || previewMutation.isPending}
//                     className="flex-1 py-2.5 rounded-lg bg-yellow-400 text-white text-sm font-medium hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {previewMutation.isPending ? "Checking..." : "Preview"}
//                   </button>
//                 </div>
//               </>
//             )}

//             {/* ── STEP 2: REVIEW ─────────────────────────────────────── */}
//             {step === "review" && (
//               <>
//                 <div className="px-6 pt-4 flex gap-2 shrink-0">
//                   <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
//                     {eligibleUnconfirmedRows.length} eligible
//                   </span>
//                   <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
//                     {visibleRows.filter((r) => r.status === "duplicate").length} duplicate
//                   </span>
//                   <span className="text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700">
//                     {visibleRows.filter((r) => r.status === "not_found").length} not found
//                   </span>
//                 </div>

//                 <div className="p-6 overflow-y-auto flex-1 space-y-2">
//                   {visibleRows.map((row) => {
//                     const isConfirmed = confirmedEmails.has(row.email);
//                     const isEligible = row.status === "eligible";

//                     return (
//                       <div
//                         key={row.email}
//                         className={`border rounded-lg p-3 flex items-center justify-between gap-3 ${isConfirmed ? "bg-green-50 border-green-200" : "border-gray-200"
//                           }`}
//                       >
//                         <div className="min-w-0 flex-1">
//                           <div className="flex items-center gap-2">
//                             <p className="text-sm font-medium text-gray-800 truncate">
//                               {row.user?.name || row.email}
//                             </p>
//                             <StatusBadge status={isConfirmed ? "eligible" : row.status} />
//                             {isConfirmed && (
//                               <span className="text-[10px] text-green-700 font-medium">Confirmed ✓</span>
//                             )}
//                           </div>
//                           <p className="text-xs text-gray-400">{row.email}</p>
//                         </div>

//                         {isEligible && !isConfirmed && (
//                           <div className="flex items-center gap-2 shrink-0">
//                             <button
//                               onClick={() => setAssigningRowEmail(row.email)}
//                               className={`px-2.5 py-1.5 text-xs rounded font-medium transition ${assignMap[row.email]
//                                 ? "bg-indigo-100 text-indigo-600"
//                                 : "bg-gray-100 text-gray-500 hover:bg-gray-200"
//                                 }`}
//                             >
//                               {assignNameMap[row.email] || "Assign to..."}
//                             </button>

//                             <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer whitespace-nowrap">
//                               <input
//                                 type="checkbox"
//                                 checked={audioMap[row.email] ?? true}
//                                 onChange={() =>
//                                   setAudioMap((prev) => ({ ...prev, [row.email]: !(prev[row.email] ?? true) }))
//                                 }
//                                 className="accent-green-500"
//                               />
//                               Audio
//                             </label>

//                             <button
//                               onClick={() => confirmSingleRow(row)}
//                               disabled={confirmMutation.isPending}
//                               className="px-2.5 py-1.5 text-xs rounded bg-teal-100 text-teal-700 hover:bg-teal-200 transition disabled:opacity-50"
//                             >
//                               Confirm
//                             </button>
//                             <button
//                               onClick={() => removeRow(row.email)}
//                               className="px-2.5 py-1.5 text-xs rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
//                             >
//                               Remove
//                             </button>
//                           </div>
//                         )}

//                         {/* ✅ Already-enrolled (duplicate) rows — audio access toggle + save */}
//                         {row.status === "duplicate" && (
//                           <div className="flex items-center gap-2 shrink-0">
//                             <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer whitespace-nowrap">
//                               <input
//                                 type="checkbox"
//                                 checked={audioMap[row.email] ?? true}
//                                 onChange={() =>
//                                   setAudioMap((prev) => ({ ...prev, [row.email]: !(prev[row.email] ?? true) }))
//                                 }
//                                 className="accent-green-500"
//                               />
//                               Audio
//                             </label>

//                             {savedAudioEmails.has(row.email) ? (
//                               <span className="text-[10px] text-green-700 font-medium px-2">Saved ✓</span>
//                             ) : (
//                               <button
//                                 onClick={() =>
//                                   row.enrollmentId &&
//                                   updateAudioMutation.mutate({
//                                     enrollmentId: row.enrollmentId,
//                                     audioAccess: audioMap[row.email] ?? true,
//                                   })
//                                 }
//                                 disabled={updateAudioMutation.isPending}
//                                 className="px-2.5 py-1.5 text-xs rounded bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition disabled:opacity-50"
//                               >
//                                 Save
//                               </button>
//                             )}

//                             <button
//                               onClick={() => removeRow(row.email)}
//                               className="px-2.5 py-1.5 text-xs rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
//                             >
//                               Remove
//                             </button>
//                           </div>
//                         )}

//                         {row.status === "not_found" && (
//                           <button
//                             onClick={() => removeRow(row.email)}
//                             className="px-2.5 py-1.5 text-xs rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition shrink-0"
//                           >
//                             Remove
//                           </button>
//                         )}
//                       </div>
//                     );
//                   })}

//                   {visibleRows.length === 0 && (
//                     <p className="text-sm text-gray-400 text-center py-6">Koi rows nahi bachi.</p>
//                   )}
//                 </div>

//                 <div className="flex gap-3 p-6 border-t shrink-0">
//                   <button
//                     onClick={() => setStep("upload")}
//                     className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
//                   >
//                     Back
//                   </button>
//                   <button
//                     onClick={confirmAll}
//                     disabled={eligibleUnconfirmedRows.length === 0 || confirmMutation.isPending}
//                     className="flex-1 py-2.5 rounded-lg bg-yellow-400 text-white text-sm font-medium hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {confirmMutation.isPending
//                       ? "Enrolling..."
//                       : `Confirm All (${eligibleUnconfirmedRows.length})`}
//                   </button>
//                 </div>
//               </>
//             )}
//           </div>
//         </div>
//       )}

//       {assigningRowEmail && (() => {
//         const row = rows.find((r) => r.email === assigningRowEmail);
//         if (!row) return null;
//         return (
//           <AssignPickerModal
//             title={row.user?.name || row.email}
//             subtitle={row.email}
//             currentAssignedId={assignMap[row.email]}
//             currentAssignedName={assignNameMap[row.email]}
//             onClose={() => setAssigningRowEmail(null)}
//             onAssign={(userId, userName) => {
//               setAssignMap((prev) => ({ ...prev, [row.email]: userId }));
//               setAssignNameMap((prev) => ({ ...prev, [row.email]: userName }));
//               setAssigningRowEmail(null);
//             }}
//           />
//         );
//       })()}
//     </>
//   );
// }
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  getNamesPrograms,
  adminGetBatches,
  previewBulkEnrollment,
  confirmBulkEnrollment,
  updateEnrollment,
} from "@/utils/api";
import Select from "@/app/component/ui/select";
import AssignPickerModal from "../../../component/dashboard/assign-picker-modal";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────
interface PreviewRow {
  email: string;
  user: { _id: string; name: string; email: string; phone?: string } | null;
  status: "eligible" | "duplicate" | "not_found";
  enrollmentId?: string;       // sirf duplicate rows ke liye — existing enrollment ka id
  currentAudioAccess?: boolean; // sirf duplicate rows ke liye — existing audioAccess value
  currentAssignedTo?: { _id: string; name: string } | null; // sirf duplicate rows ke liye
}

interface PreviewResponse {
  program: string;
  batch: string | null;
  totalRows: number;
  eligibleCount: number;
  duplicateCount: number;
  notFoundCount: number;
  preview: PreviewRow[];
}

// ── Badge helper ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PreviewRow["status"] }) {
  const map = {
    eligible: { label: "Eligible", cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={12} /> },
    duplicate: { label: "Already Enrolled", cls: "bg-yellow-100 text-yellow-700", icon: <AlertTriangle size={12} /> },
    not_found: { label: "User Not Found", cls: "bg-rose-100 text-rose-700", icon: <XCircle size={12} /> },
  };
  const conf = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${conf.cls}`}>
      {conf.icon}
      {conf.label}
    </span>
  );
}

export default function ImportButton({ queryKey = "enrollments" }: { queryKey?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "review">("upload");

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [removedEmails, setRemovedEmails] = useState<Set<string>>(new Set());
  const [assignMap, setAssignMap] = useState<Record<string, string>>({}); // email -> assigned_to userId
  const [assignNameMap, setAssignNameMap] = useState<Record<string, string>>({}); // email -> assigned_to name (display)
  const [assigningRowEmail, setAssigningRowEmail] = useState<string | null>(null); // jis row ke liye assign modal khula hai
  const [audioMap, setAudioMap] = useState<Record<string, boolean>>({}); // email -> audioAccess
  const [savedAudioEmails, setSavedAudioEmails] = useState<Set<string>>(new Set()); // duplicate rows jinka audio update ho chuka
  const [savedAssignEmails, setSavedAssignEmails] = useState<Set<string>>(new Set()); // duplicate rows jinka assign update ho chuka
  const [confirmedEmails, setConfirmedEmails] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // ── Dropdown data ────────────────────────────────────────────────────
  const { data: programs = [] } = useQuery({
    queryKey: ["program-names"],
    queryFn: getNamesPrograms,
  });

  const { data: activeBatchesRes } = useQuery({
    queryKey: ["batches-active"],
    queryFn: () => adminGetBatches({ status: "active", mode: "all" }).then((r) => r.data),
  });

  const { data: upcomingBatchesRes } = useQuery({
    queryKey: ["batches-upcoming"],
    queryFn: () => adminGetBatches({ status: "upcoming", mode: "all" }).then((r) => r.data),
  });

  const activeBatches = [
    ...(activeBatchesRes?.data ?? []),
    ...(upcomingBatchesRes?.data ?? []),
  ];

  // ── Reset everything on close ────────────────────────────────────────
  const handleClose = () => {
    setIsOpen(false);
    setStep("upload");
    setFile(null);
    setSelectedProgram("");
    setSelectedBatch("");
    setRows([]);
    setRemovedEmails(new Set());
    setAssignMap({});
    setAssignNameMap({});
    setAssigningRowEmail(null);
    setAudioMap({});
    setSavedAudioEmails(new Set());
    setSavedAssignEmails(new Set());
    setConfirmedEmails(new Set());
  };

  const handleFileSelect = (selected: File | null) => {
    if (!selected) return;
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(selected.type)) {
      alert("Sirf Excel file (.xlsx/.xls) allow hai");
      return;
    }
    setFile(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFileSelect(dropped);
  };

  // ── Preview mutation ─────────────────────────────────────────────────
  const previewMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("file", file as File);
      formData.append("program", selectedProgram);
      if (selectedBatch) formData.append("batch", selectedBatch);

      const res = await previewBulkEnrollment(formData);
      return res.data as PreviewResponse;
    },
    onSuccess: (data) => {
      setRows(data.preview);
      // ✅ default: eligible rows par true, duplicate rows par unka existing audioAccess value
      const defaultAudio: Record<string, boolean> = {};
      const defaultAssign: Record<string, string> = {};
      const defaultAssignName: Record<string, string> = {};
      data.preview.forEach((r) => {
        if (r.status === "eligible") defaultAudio[r.email] = true;
        if (r.status === "duplicate") {
          defaultAudio[r.email] = r.currentAudioAccess ?? true;
          if (r.currentAssignedTo) {
            defaultAssign[r.email] = r.currentAssignedTo._id;
            defaultAssignName[r.email] = r.currentAssignedTo.name;
          }
        }
      });
      setAudioMap(defaultAudio);
      setAssignMap(defaultAssign);
      setAssignNameMap(defaultAssignName);
      setStep("review");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Preview failed");
    },
  });

  // ── Confirm mutation (single row ya bulk, same endpoint) ────────────
  const confirmMutation = useMutation({
    mutationFn: async (payload: { user: string; program: string; batch?: string; assigned_to?: string; audioAccess?: boolean }[]) => {
      const res = await confirmBulkEnrollment(payload);
      return res.data;
    },
    onSuccess: (data, variables) => {
      const confirmedNow = new Set(confirmedEmails);
      // mark rows as confirmed based on which emails were sent (match by user id back to email)
      rows.forEach((r) => {
        if (r.user && variables.some((v) => v.user === r.user!._id)) {
          confirmedNow.add(r.email);
        }
      });
      setConfirmedEmails(confirmedNow);
      toast.success(`${data.createdCount} enrolled, ${data.skippedCount} skipped`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Enrollment failed");
    },
  });

  // ✅ Duplicate (already-enrolled) row ka audioAccess update karo — naya enrollment nahi, existing wala
  const updateAudioMutation = useMutation({
    mutationFn: async ({ enrollmentId, audioAccess }: { enrollmentId: string; audioAccess: boolean }) =>
      updateEnrollment(enrollmentId, { audioAccess }),
    onSuccess: (_data, variables) => {
      const row = rows.find((r) => r.enrollmentId === variables.enrollmentId);
      if (row) {
        setSavedAudioEmails((prev) => new Set(prev).add(row.email));
      }
      toast.success("Audio access updated");
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update audio access");
    },
  });

  // ✅ Duplicate (already-enrolled) row ka assigned_to update karo — naya enrollment nahi, existing wala
  const updateAssignMutation = useMutation({
    mutationFn: async ({ enrollmentId, assigned_to }: { enrollmentId: string; assigned_to: string }) =>
      updateEnrollment(enrollmentId, { assigned_to }),
    onSuccess: (_data, variables) => {
      const row = rows.find((r) => r.enrollmentId === variables.enrollmentId);
      if (row) {
        setSavedAssignEmails((prev) => new Set(prev).add(row.email));
      }
      toast.success("Assigned rep updated");
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update assignment");
    },
  });


  const visibleRows = rows.filter((r) => !removedEmails.has(r.email));
  const eligibleUnconfirmedRows = visibleRows.filter(
    (r) => r.status === "eligible" && !confirmedEmails.has(r.email)
  );

  const removeRow = (email: string) => {
    setRemovedEmails((prev) => new Set(prev).add(email));
  };

  const confirmSingleRow = (row: PreviewRow) => {
    if (!row.user) return;
    confirmMutation.mutate([
      {
        user: row.user._id,
        program: selectedProgram,
        batch: selectedBatch || undefined,
        assigned_to: assignMap[row.email] || undefined,
        audioAccess: audioMap[row.email] ?? true,
      },
    ]);
  };

  const confirmAll = () => {
    const payload = eligibleUnconfirmedRows
      .filter((r) => r.user)
      .map((r) => ({
        user: r.user!._id,
        program: selectedProgram,
        batch: selectedBatch || undefined,
        assigned_to: assignMap[r.email] || undefined,
        audioAccess: audioMap[r.email] ?? true,
      }));

    if (payload.length === 0) {
      toast.error("No eligible rows to confirm");
      return;
    }
    confirmMutation.mutate(payload);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-gray-400 hover:text-gray-600 text-gray-600 text-sm font-medium rounded-lg transition-colors shadow-sm"
        title="Bulk enroll users from Excel"
      >
        <Upload size={13} />
        Import Excel
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Bulk Enroll Users</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {step === "upload"
                    ? "Excel se users ko ek program/batch mein enroll karein"
                    : "Review karein aur assign/audio access set kar ke confirm karein"}
                </p>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            {/* ── STEP 1: UPLOAD ─────────────────────────────────────── */}
            {step === "upload" && (
              <>
                <div className="p-6 space-y-4 overflow-y-auto">
                  <Select
                    label="Program*"
                    placeholder="— Select Program —"
                    value={selectedProgram}
                    options={programs.map((p: any) => ({ label: p.name, value: p._id }))}
                    onChange={(e) => { setSelectedProgram(e.target.value); setSelectedBatch(""); }}
                  />

                  <Select
                    label="Batch (optional)"
                    placeholder="— None —"
                    value={selectedBatch}
                    options={activeBatches
                      .filter((b: any) => {
                        const pid = b.program_id?._id || b.program_id;
                        return !selectedProgram || pid === selectedProgram;
                      })
                      .map((b: any) => ({
                        label: b.mode === "physical" ? `${b.name} (Physical)` : b.name,
                        value: b._id,
                      }))}
                    onChange={(e) => setSelectedBatch(e.target.value)}
                  />

                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${dragActive ? "border-yellow-400 bg-yellow-50" : "border-gray-200"
                      }`}
                    onClick={() => document.getElementById("enrollment-import-file-input")?.click()}
                  >
                    <input
                      id="enrollment-import-file-input"
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    />
                    {file ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="text-green-600" size={28} />
                        <p className="text-sm font-medium text-gray-700">{file.name}</p>
                        <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <UploadCloud size={28} />
                        <p className="text-sm">Click ya drag karke file yahan drop karein</p>
                        <p className="text-xs">.xlsx ya .xls</p>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500">
                    Column order: <strong>A = Name</strong>, <strong>B = Email</strong>, <strong>C = Phone</strong>.
                    Matching sirf <strong>Email</strong> se hoti hai. Pehli row header treat hogi (skip).
                  </p>
                </div>

                <div className="flex gap-3 p-6 border-t shrink-0">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => previewMutation.mutate()}
                    disabled={!file || !selectedProgram || previewMutation.isPending}
                    className="flex-1 py-2.5 rounded-lg bg-yellow-400 text-white text-sm font-medium hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {previewMutation.isPending ? "Checking..." : "Preview"}
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 2: REVIEW ─────────────────────────────────────── */}
            {step === "review" && (
              <>
                <div className="px-6 pt-4 flex gap-2 shrink-0">
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    {eligibleUnconfirmedRows.length} eligible
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                    {visibleRows.filter((r) => r.status === "duplicate").length} duplicate
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700">
                    {visibleRows.filter((r) => r.status === "not_found").length} not found
                  </span>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-2">
                  {visibleRows.map((row) => {
                    const isConfirmed = confirmedEmails.has(row.email);
                    const isEligible = row.status === "eligible";

                    return (
                      <div
                        key={row.email}
                        className={`border rounded-lg p-3 flex items-center justify-between gap-3 ${isConfirmed ? "bg-green-50 border-green-200" : "border-gray-200"
                          }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {row.user?.name || row.email}
                            </p>
                            <StatusBadge status={isConfirmed ? "eligible" : row.status} />
                            {isConfirmed && (
                              <span className="text-[10px] text-green-700 font-medium">Confirmed ✓</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{row.email}</p>
                        </div>

                        {isEligible && !isConfirmed && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setAssigningRowEmail(row.email)}
                              className={`px-2.5 py-1.5 text-xs rounded font-medium transition ${assignMap[row.email]
                                ? "bg-indigo-100 text-indigo-600"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                }`}
                            >
                              {assignNameMap[row.email] || "Assign to..."}
                            </button>

                            <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={audioMap[row.email] ?? true}
                                onChange={() =>
                                  setAudioMap((prev) => ({ ...prev, [row.email]: !(prev[row.email] ?? true) }))
                                }
                                className="accent-green-500"
                              />
                              Audio
                            </label>

                            <button
                              onClick={() => confirmSingleRow(row)}
                              disabled={confirmMutation.isPending}
                              className="px-2.5 py-1.5 text-xs rounded bg-teal-100 text-teal-700 hover:bg-teal-200 transition disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => removeRow(row.email)}
                              className="px-2.5 py-1.5 text-xs rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
                            >
                              Remove
                            </button>
                          </div>
                        )}

                        {/* ✅ Already-enrolled (duplicate) rows — assign update + audio access toggle */}
                        {row.status === "duplicate" && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setAssigningRowEmail(row.email)}
                              className={`px-2.5 py-1.5 text-xs rounded font-medium transition ${assignMap[row.email]
                                ? "bg-indigo-100 text-indigo-600"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                }`}
                            >
                              {assignNameMap[row.email] || "Assign to..."}
                            </button>

                            {savedAssignEmails.has(row.email) ? (
                              <span className="text-[10px] text-green-700 font-medium">Saved ✓</span>
                            ) : (
                              <button
                                onClick={() =>
                                  row.enrollmentId &&
                                  assignMap[row.email] &&
                                  updateAssignMutation.mutate({
                                    enrollmentId: row.enrollmentId,
                                    assigned_to: assignMap[row.email],
                                  })
                                }
                                disabled={!assignMap[row.email] || updateAssignMutation.isPending}
                                className="px-2.5 py-1.5 text-xs rounded bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition disabled:opacity-50"
                              >
                                Save
                              </button>
                            )}

                            <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={audioMap[row.email] ?? true}
                                onChange={() => {
                                  setAudioMap((prev) => ({ ...prev, [row.email]: !(prev[row.email] ?? true) }));
                                  setSavedAudioEmails((prev) => {
                                    const next = new Set(prev);
                                    next.delete(row.email);
                                    return next;
                                  });
                                }}
                                className="accent-green-500"
                              />
                              Audio
                            </label>

                            {savedAudioEmails.has(row.email) ? (
                              <span className="text-[10px] text-green-700 font-medium px-2">Saved ✓</span>
                            ) : (
                              <button
                                onClick={() =>
                                  row.enrollmentId &&
                                  updateAudioMutation.mutate({
                                    enrollmentId: row.enrollmentId,
                                    audioAccess: audioMap[row.email] ?? true,
                                  })
                                }
                                disabled={updateAudioMutation.isPending}
                                className="px-2.5 py-1.5 text-xs rounded bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition disabled:opacity-50"
                              >
                                Save
                              </button>
                            )}

                            <button
                              onClick={() => removeRow(row.email)}
                              className="px-2.5 py-1.5 text-xs rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
                            >
                              Remove
                            </button>
                          </div>
                        )}

                        {row.status === "not_found" && (
                          <button
                            onClick={() => removeRow(row.email)}
                            className="px-2.5 py-1.5 text-xs rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition shrink-0"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {visibleRows.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">Koi rows nahi bachi.</p>
                  )}
                </div>

                <div className="flex gap-3 p-6 border-t shrink-0">
                  <button
                    onClick={() => setStep("upload")}
                    className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={confirmAll}
                    disabled={eligibleUnconfirmedRows.length === 0 || confirmMutation.isPending}
                    className="flex-1 py-2.5 rounded-lg bg-yellow-400 text-white text-sm font-medium hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {confirmMutation.isPending
                      ? "Enrolling..."
                      : `Confirm All (${eligibleUnconfirmedRows.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {assigningRowEmail && (() => {
        const row = rows.find((r) => r.email === assigningRowEmail);
        if (!row) return null;
        return (
          <AssignPickerModal
            title={row.user?.name || row.email}
            subtitle={row.email}
            currentAssignedId={assignMap[row.email]}
            currentAssignedName={assignNameMap[row.email]}
            onClose={() => setAssigningRowEmail(null)}
            onAssign={(userId, userName) => {
              setAssignMap((prev) => ({ ...prev, [row.email]: userId }));
              setAssignNameMap((prev) => ({ ...prev, [row.email]: userName }));
              setSavedAssignEmails((prev) => {
                const next = new Set(prev);
                next.delete(row.email);
                return next;
              });
              setAssigningRowEmail(null);
            }}
          />
        );
      })()}
    </>
  );
}