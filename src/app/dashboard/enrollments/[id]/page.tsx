// dashboard/enrollments/[id]/page.tsx
"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getEnrollmentById, toggleAudioAccess } from "@/utils/api";
import ProtectedRoute from "@/app/component/protected-route";
import {
  ArrowLeft,
  Phone,
  Mail,
  CalendarDays,
  BookOpen,
  Receipt,
  Wallet,
  PhoneCall,
  MessageSquare,
  Users,
  StickyNote,
  FileSignature,
  GraduationCap,
  Loader2,
} from "lucide-react";
import PageHeader from "@/app/component/dashboard/page-header";
import ContractPDFGenerator from "@/app/component/dashboard/contract-pdf-generator"; // path adjust
import ContractBadge from '@/app/component/dashboard/contract-badge';
import { useState } from "react";
import Modal from "@/app/component/ui/model/modal";
import ViewContractModal from "../../leads/components/view-contract-modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mic, MicOff } from "lucide-react"; // naye icons
import toast from "react-hot-toast";

// ─── Badge helpers (same palette as enrollments list) ───────────────────────
const statusColor = (status: string) => {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    completed: "bg-teal-100 text-teal-700",
    suspended: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-gray-100 text-gray-600",
    blocked: "bg-rose-100 text-rose-700",
    PAID: "bg-green-100 text-green-700",
    PARTIAL: "bg-yellow-100 text-yellow-700",
    PENDING: "bg-gray-100 text-gray-600",
    approved: "bg-green-100 text-green-700",
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

// ─── Timeline icon + accent per activity type ───────────────────────────────
const timelineMeta = (type: string) => {
  const map: Record<string, { icon: any; color: string; dot: string }> = {
    call: { icon: PhoneCall, color: "text-blue-600", dot: "bg-blue-100" },
    email: { icon: Mail, color: "text-purple-600", dot: "bg-purple-100" },
    meeting: { icon: Users, color: "text-indigo-600", dot: "bg-indigo-100" },
    note: { icon: StickyNote, color: "text-amber-600", dot: "bg-amber-100" },
    contract: { icon: FileSignature, color: "text-teal-600", dot: "bg-teal-100" },
    enrollment: { icon: GraduationCap, color: "text-green-600", dot: "bg-green-100" },
    invoice: { icon: Receipt, color: "text-orange-600", dot: "bg-orange-100" },
    payment: { icon: Wallet, color: "text-emerald-600", dot: "bg-emerald-100" },
  };
  return map[type] || { icon: MessageSquare, color: "text-gray-500", dot: "bg-gray-100" };
};

const fmtMoney = (n?: number) =>
  typeof n === "number" ? `Rs ${n.toLocaleString("en-PK")}` : "—";

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d?: string) =>
  d
    ? new Date(d).toLocaleString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "—";

function EnrollmentDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [viewContract, setViewContract] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["enrollment", id],
    queryFn: () => getEnrollmentById(id).then((r) => r.data),
    enabled: !!id,
  });

  const { mutate: toggleAudio, isPending: isTogglingAudio } = useMutation({
    mutationFn: () => toggleAudioAccess(id),
    onSuccess: (res) => {
      const newVal = res.data?.data?.audioAccess;
      toast.success(newVal ? "Audio access granted" : "Audio access revoked");
      queryClient.invalidateQueries({ queryKey: ["enrollment", id] });
    },
    onError: () => toast.error("Failed to update audio access"),
  });


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
        <p className="text-sm">Enrollment not found.</p>
        <button
          onClick={() => router.back()}
          className="mt-3 text-xs text-indigo-600 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const e = data.data;
  const invoice = e.invoices?.[0];
  const timeline: any[] = e.timeline || [];
  const bundleSiblings: any[] = e.bundleSiblings || [];

  return (
    <>
      {/* ── Top bar ───────────────────────────────────────────── */}
      {/* <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-800">{e.user?.name || "—"}</h1>
          <p className="text-xs text-gray-400">{e.program?.name} · {e.batch?.name || "No Batch"}</p>
        </div>
      </div> */}
      <PageHeader
        title={e.user?.name || "—"}
        subtitle={
          e.isBundle
            ? `${e.program?.name} · ${e.batch?.name || "No Batch"} · 📦 Bundle (${bundleSiblings.length + 1} programs)`
            : `${e.program?.name} · ${e.batch?.name || "No Batch"}`
        }
        titleIcon={<ArrowLeft size={24} onClick={() => router.back()} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Student / Program / Finance summary ─────────── */}
        <div className="lg:col-span-1 flex flex-col gap-5">
          {/* Student card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Student</h2>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${statusColor(e.status)}`}>
                {e.status}
              </span>
            </div>
            <p className="font-medium text-gray-800">{e.user?.name}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <Mail size={13} /> {e.user?.email || "—"}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <Phone size={13} /> {e.user?.phone || "—"}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">Access Status</span>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${accessColor(e.accessStatus)}`}>
                {e.accessStatus || "—"}
              </span>
            </div>

            {e.leadSnapshot?.contractDetails && (
              <ContractBadge
                contractDetails={e.leadSnapshot.contractDetails}
                onViewContract={() => setViewContract(true)}
                canEdit={false}   // 🔒 edit off — view only
              />
            )}

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">Enrolled On</span>
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <CalendarDays size={12} /> {fmtDate(e.enrolledAt)}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">Progress</span>
              <div className="flex items-center gap-2">
                <div className="w-16 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-yellow-400"
                    style={{ width: `${e.progress || 0}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{e.progress || 0}%</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">Audio Access</span>
              <button
                onClick={() => toggleAudio()}
                disabled={isTogglingAudio}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors disabled:opacity-50 ${e.audioAccess !== false
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-rose-100 text-rose-600 hover:bg-rose-200"
                  }`}
              >
                {e.audioAccess !== false ? <Mic size={11} /> : <MicOff size={11} />}
                {e.audioAccess !== false ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>

          {/* Program card */}
          {/* <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BookOpen size={15} className="text-indigo-500" /> Program
            </h2>
            <p className="font-medium text-gray-800 text-sm">{e.program?.name || "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">{e.program?.level} · {e.program?.category}</p>
            <p className="text-xs text-gray-500 mt-3">{e.batch?.name || "No Batch"}</p>
            <p className="text-[11px] text-gray-400">
              {fmtDate(e.batch?.start_date)} → {fmtDate(e.batch?.end_date)}
            </p>
            {e.assigned_to && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Assigned To</span>
                <span className="px-2 py-1 text-[11px] rounded bg-indigo-100 text-indigo-600">
                  {e.assigned_to?.name}
                </span>
              </div>
            )}
          </div> */}
          {/* Program card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <BookOpen size={15} className="text-indigo-500" /> Program
              </h2>
              {e.isBundle && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                  📦 Bundle
                </span>
              )}
            </div>

            <p className="font-medium text-gray-800 text-sm">{e.program?.name || "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">{e.program?.level} · {e.program?.category}</p>
            <p className="text-xs text-gray-500 mt-3">{e.batch?.name || "No Batch"}</p>
            <p className="text-[11px] text-gray-400">
              {fmtDate(e.batch?.start_date)} → {fmtDate(e.batch?.end_date)}
            </p>

            {e.assigned_to && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Assigned To</span>
                <span className="px-2 py-1 text-[11px] rounded bg-indigo-100 text-indigo-600">
                  {e.assigned_to?.name}
                </span>
              </div>
            )}

            {/* ✅ NAYA — Bundle ke baaki programs */}
            {e.isBundle && bundleSiblings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2">Bundled With</p>
                <div className="flex flex-col gap-2">
                  {bundleSiblings.map((sib: any) => (
                    <button
                      key={sib._id}
                      onClick={() => router.push(`/dashboard/enrollments/${sib._id}`)}
                      className="text-left px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 transition"
                    >
                      <p className="text-xs font-medium text-purple-700">{sib.program?.name}</p>
                      <p className="text-[10px] text-purple-400">{sib.batch?.name || "No Batch"}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Finance card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Receipt size={15} className="text-orange-500" /> Invoice
            </h2>
            {invoice ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{invoice.invoiceNumber}</span>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${statusColor(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-gray-400 text-xs">Total Gross</span>
                  <span className="font-medium text-gray-800">{fmtMoney(invoice.totalAmount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-gray-400 text-xs ">Discount</span>
                  <span className="font-medium  text-sky-400">- {fmtMoney(invoice.discountAmount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-gray-400 text-xs">Total Net</span>
                  <span className="font-medium text-gray-800">{fmtMoney(invoice.totalAmount - invoice.discountAmount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-gray-400 text-xs">Paid</span>
                  <span className="font-medium text-green-600">{fmtMoney(invoice.paidAmount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-gray-400 text-xs">Remaining</span>
                  <span className="font-medium text-rose-500">{fmtMoney(invoice.remainingAmount)}</span>
                </div>

                {/* ✅ NAYA — bundle items breakdown */}
                {invoice.isBundle && invoice.items?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 mb-1.5">Programs in this Invoice</p>
                    {invoice.items.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1">
                        <span className="text-gray-600">{item.programName}</span>
                        <span className="text-gray-700 font-medium">{fmtMoney(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-2">
                  {invoice.installments?.map((inst: any) => (
                    <div
                      key={inst._id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="text-xs font-medium text-gray-700">{inst.label}</p>
                        <p className="text-[11px] text-gray-400">Due {fmtDate(inst.dueDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-700">{fmtMoney(inst.amount)}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(inst.status)}`}>
                          {inst.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400">No invoice generated yet.</p>
            )}
          </div>

          {/* Certificate card — NAYA */}
          {e.certificate && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <GraduationCap size={15} className="text-purple-500" /> Certificate
                </h2>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${e.certificate.status === "issued"
                    ? "bg-green-100 text-green-700"
                    : e.certificate.status === "unlocked"
                      ? "bg-teal-100 text-teal-700"
                      : "bg-gray-100 text-gray-500"
                    }`}
                >
                  {e.certificate.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-400 text-xs">Fee</span>
                <span className="font-medium text-gray-800">{fmtMoney(e.certificate.certificateFee)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-400 text-xs">Fee Paid</span>
                <span className={`font-medium ${e.certificate.feePaid ? "text-green-600" : "text-rose-500"}`}>
                  {e.certificate.feePaid ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-400 text-xs">Course Completed</span>
                <span className={`font-medium ${e.certificate.courseCompleted ? "text-green-600" : "text-gray-500"}`}>
                  {e.certificate.courseCompleted ? "Yes" : "No"}
                </span>
              </div>

              {e.certificate.status === "locked" && (
                <p className="text-[11px] text-gray-400 mt-2">
                  {!e.certificate.feePaid
                    ? "Certificate fee pending — pay to unlock after graduation."
                    : "Course not completed yet."}
                </p>
              )}

              {e.certificate.certificateUrl && (
                <a
                  href={e.certificate.certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-xs font-semibold text-purple-600 hover:underline"
                >
                  View Certificate →
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Activity timeline ────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-5">Activity Timeline</h2>

            {timeline.length === 0 ? (
              <p className="text-xs text-gray-400">No activity recorded yet.</p>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-100" />
                <div className="flex flex-col gap-5">
                  {timeline.map((item, idx) => {
                    const { icon: Icon, color, dot } = timelineMeta(item.type);
                    return (
                      <div key={idx} className="relative">

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-3.5 h-3.5 rounded-full ${dot} flex items-center justify-center`}
                              >
                                <Icon size={9} className={color} />
                              </div>
                              <p className="text-sm font-medium text-gray-800">

                                {item.title}</p>
                            </div>
                            <div className="pl-6">
                              {item.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                              )}
                              {item.meta?.call_outcome && (
                                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                                  {item.meta.call_outcome} · {item.meta.call_duration_minutes} min
                                </span>
                              )}
                              {item.meta?.amount && (
                                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600">
                                  {fmtMoney(item.meta.amount)} via {item.meta.method}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                            {fmtDateTime(item.date)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewContract && (
        <ViewContractModal
          lead={{
            _id: e._id,
            status: "converted",          // force view-only
            first_name: e.user?.name?.split(" ")[0] || "",
            last_name: e.user?.name?.split(" ").slice(1).join(" ") || "",
            email: e.user?.email,
            phone: e.user?.phone,
            contractDetails: e.leadSnapshot?.contractDetails,
            paymentPlan: e.leadSnapshot?.paymentPlan,
            program_id: e.program,
            invoiceNumber: invoice?.invoiceNumber,
          }}
          onClose={() => setViewContract(false)}
        // onSave pass hi mat karo → canEdit automatically false ho jayega
        />
      )}
    </>
  );
}

export default function EnrollmentDetailPage() {
  return (
    <ProtectedRoute
      allowedRoles={["admin", "super_admin", "finance_manager", "sales_manager", "sales_rep"]}
    >
      <EnrollmentDetailContent />
    </ProtectedRoute>
  );
}