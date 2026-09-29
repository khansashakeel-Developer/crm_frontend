"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, Loader2, FileText, CheckCircle2, ArrowLeft, Download, Receipt, Paperclip } from "lucide-react";
import toast from "react-hot-toast";
import {
  getQboImportList, getQboImportDetail, importQboInvoice, searchCrmUsers, getUserEnrollments,
} from "@/utils/api";

const fmt = (n: number) => `Rs ${(n || 0).toLocaleString()}`;

type Props = {
  open: boolean;
  onClose: () => void;
  // if provided, skips the browse step and opens straight to detail
  // (used when triggered from the Comparison page's "Only in QBO" row)
  initialQboInvoiceId?: string;
};

type PaymentType = "advance" | "installment" | "certificate" | "manual";
type PaymentCfg = { type: PaymentType; programId?: string; label?: string };

const TYPE_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: "advance", label: "Advance Payment" },
  { value: "installment", label: "Installment" },
  { value: "certificate", label: "CPD / Certificate" },
  { value: "manual", label: "Manual" },
];

const needsProgram = (t: PaymentType) => t === "certificate" || t === "manual";

export function QboImportModal({ open, onClose, initialQboInvoiceId }: Props) {
  const [step, setStep] = useState<"browse" | "detail">(initialQboInvoiceId ? "detail" : "browse");
  const [search, setSearch] = useState("");
  const [selectedQboId, setSelectedQboId] = useState<string | null>(initialQboInvoiceId || null);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<Set<string>>(new Set());
  const [enrollmentSearch, setEnrollmentSearch] = useState("");
  const [paymentConfig, setPaymentConfig] = useState<Record<string, PaymentCfg>>({});
  const queryClient = useQueryClient();

  const listQ = useQuery({
    queryKey: ["qbo-import-list", search],
    queryFn: () => getQboImportList(search).then((r) => r.data),
    enabled: open && step === "browse",
  });

  const detailQ = useQuery({
    queryKey: ["qbo-import-detail", selectedQboId],
    queryFn: () => getQboImportDetail(selectedQboId!).then((r) => r.data.data),
    enabled: open && step === "detail" && !!selectedQboId,
  });

  const usersQ = useQuery({
    queryKey: ["crm-users-search", userSearch],
    queryFn: () => searchCrmUsers(userSearch).then((r) => r.data.data),
    enabled: open && step === "detail" && userSearch.length > 1,
  });

  const enrollmentsQ = useQuery({
    queryKey: ["user-enrollments", selectedUserId],
    queryFn: () => getUserEnrollments(selectedUserId!).then((r) => r.data.data),
    enabled: !!selectedUserId,
  });

  // ── selected enrollments ke programs = CPD / Manual ke options ──
  const programOptions: { id: string; name: string }[] = (enrollmentsQ.data || [])
    .filter((e: any) => selectedEnrollmentIds.has(e._id) && e.program?._id)
    .map((e: any) => ({ id: e.program._id as string, name: e.program.name as string }));

  const isBundle = selectedEnrollmentIds.size > 1;

  // single: program khud select; bundle: user choose karega
  const effectiveProgramId = (cfg: PaymentCfg): string =>
    programOptions.some((o) => o.id === cfg.programId)
      ? cfg.programId!
      : programOptions.length === 1 ? programOptions[0].id : "";

  const setPaymentType = (id: string, type: PaymentType) =>
    setPaymentConfig((prev) => {
      const next = { ...prev };
      // naya advance choose karne par purana advance installment ban jata hai
      if (type === "advance") {
        Object.keys(next).forEach((k) => {
          if (next[k].type === "advance") next[k] = { ...next[k], type: "installment" };
        });
      }
      next[id] = { ...next[id], type };
      return next;
    });

  const resetDetailState = () => {
    setSelectedUserId(null);
    setSelectedEnrollmentIds(new Set());
    setEnrollmentSearch("");
    setUserSearch("");
    setPaymentConfig({});
  };

  const handleClose = () => {
    setStep(initialQboInvoiceId ? "detail" : "browse");
    setSelectedQboId(initialQboInvoiceId || null);
    resetDetailState();
    onClose();
  };

  const { mutate: doImport, isPending: importing } = useMutation({
    mutationFn: () => {
      const payload: Record<string, PaymentCfg> = {};
      Object.entries(paymentConfig).forEach(([id, cfg]) => {
        payload[id] = {
          type: cfg.type,
          programId: needsProgram(cfg.type) ? effectiveProgramId(cfg) : undefined,
          label: cfg.label?.trim() || undefined,
        };
      });
      return importQboInvoice(selectedQboId!, selectedUserId!, Array.from(selectedEnrollmentIds), payload);
    },
    onSuccess: (res) => {
      toast.success(res.data.message || "Imported ✅");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["qbo-compare-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["qbo-compare-payments"] });
      handleClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Import failed ❌"),
  });

  const toggleEnrollment = (id: string) => {
    setSelectedEnrollmentIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── payments load hone par defaults: pehli = advance, baaqi = installment ──
  useEffect(() => {
    const payments = detailQ.data?.payments;
    if (!payments?.length) return;
    setPaymentConfig((prev) => {
      if (Object.keys(prev).length) return prev;
      const initial: Record<string, PaymentCfg> = {};
      payments.forEach((p: any, idx: number) => {
        initial[p.qboPaymentId] = { type: idx === 0 ? "advance" : "installment" };
      });
      return initial;
    });
  }, [detailQ.data]);

  // ── email se user match hua to user + uske matched enrollments auto-select ──
  useEffect(() => {
    const d = detailQ.data;
    if (!open || !d?.suggestedUser || selectedUserId) return;
    setSelectedUserId(d.suggestedUser.id);
    const ids = (d.lineMatches || []).map((l: any) => l.matchedEnrollment?.id).filter(Boolean);
    if (ids.length) setSelectedEnrollmentIds(new Set(ids));
  }, [open, detailQ.data, selectedUserId]);

  // "matched" badge sirf tab jab auto-matched user hi selected ho
  const suggestedEnrollmentIds: string[] =
    selectedUserId && selectedUserId === detailQ.data?.suggestedUser?.id
      ? (detailQ.data?.lineMatches || []).map((l: any) => l.matchedEnrollment?.id).filter(Boolean)
      : [];

  // installment ka number (label preview ke liye)
  const installmentNumbers: Record<string, number> = {};
  let instCount = 0;
  (detailQ.data?.payments || []).forEach((p: any) => {
    if (paymentConfig[p.qboPaymentId]?.type === "installment") {
      installmentNumbers[p.qboPaymentId] = ++instCount;
    }
  });

  // label input ka placeholder = jo auto label banega
  const autoLabel = (id: string, cfg: PaymentCfg) => {
    if (cfg.type === "advance") return "Advance Payment";
    if (cfg.type === "installment") return `Installment ${installmentNumbers[id] || ""}`.trim();
    const base = cfg.type === "certificate" ? "CPD / Certificate Fee" : "Manual Fee";
    const prog = programOptions.find((o) => o.id === effectiveProgramId(cfg));
    return isBundle && prog ? `${base} — ${prog.name}` : base;
  };

  // CPD / Manual ke liye program select hona zaroori hai
  const missingProgram = Object.values(paymentConfig).some(
    (cfg) => needsProgram(cfg.type) && !effectiveProgramId(cfg)
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            {step === "detail" && !initialQboInvoiceId && (
              <button
                onClick={() => {
                  setStep("browse");
                  setSelectedQboId(null);
                  resetDetailState();
                }}
              >
                <ArrowLeft size={18} className="text-gray-400" />
              </button>
            )}
            <p className="font-semibold text-gray-800 flex items-center gap-2">
              <Download size={16} className="text-yellow-500" />
              {step === "browse" ? "Import from QuickBooks" : "Import Invoice"}
            </p>
          </div>
          <button onClick={handleClose}><X size={18} className="text-gray-400" /></button>
        </div>

        {step === "browse" && (
          <div className="p-5">
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by invoice # or customer name..."
                className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 placeholder:text-gray-300 text-gray-400"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {listQ.isLoading ? (
                <div className="text-center py-8 text-sm text-gray-400">Loading...</div>
              ) : !listQ.data?.data?.length ? (
                <div className="text-center py-8 text-sm text-gray-400">No unmatched QBO invoices found</div>
              ) : (
                listQ.data.data.map((inv: any) => (
                  <button
                    key={inv.qboInvoiceId}
                    onClick={() => {
                      resetDetailState();
                      setSelectedQboId(inv.qboInvoiceId);
                      setStep("detail");
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-yellow-300 hover:bg-yellow-50/50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">#{inv.docNumber}</p>
                      <p className="text-xs text-gray-400">{inv.customer || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-700">{fmt(inv.totalAmt)}</p>
                      <p className="text-xs text-gray-400">Balance: {fmt(inv.balance)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {step === "detail" && (
          <div className="p-5 space-y-5">
            {detailQ.isLoading ? (
              <div className="text-center py-10 text-sm text-gray-400">Loading invoice detail...</div>
            ) : !detailQ.data ? (
              <div className="text-center py-10 text-sm text-rose-400">Failed to load invoice</div>
            ) : (
              <>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-gray-800 flex items-center gap-2">
                      <FileText size={14} className="text-yellow-500" />
                      Invoice #{detailQ.data.invoice.docNumber}
                    </p>
                    <p className="text-xs text-gray-400">{detailQ.data.invoice.customer}</p>
                  </div>
                  <div className="space-y-1">
                    {detailQ.data.invoice.lines.map((l: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-gray-500">{l.description}</span>
                        <span className={l.type === "DiscountLineDetail" ? "text-sky-500" : "text-gray-700"}>
                          {l.type === "DiscountLineDetail" ? "- " : ""}{fmt(l.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-gray-200 mt-2 pt-2 text-gray-800">
                    <span>Total</span>
                    <span>{fmt(detailQ.data.invoice.totalAmt)}</span>
                  </div>
                </div>

                {detailQ.data.payments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Receipt size={12} /> {detailQ.data.payments.length} payment(s) will also be imported
                    </p>
                    <div className="space-y-1.5">
                      {detailQ.data.payments.map((p: any) => {
                        const cfg: PaymentCfg = paymentConfig[p.qboPaymentId] || { type: "installment" };
                        const progId = effectiveProgramId(cfg);

                        return (
                          <div key={p.qboPaymentId} className="bg-green-50 rounded-lg px-3 py-2 space-y-2">
                            {/* type dropdown + date + amount */}
                            <div className="flex items-center gap-2">
                              <select
                                value={cfg.type}
                                onChange={(e) => setPaymentType(p.qboPaymentId, e.target.value as PaymentType)}
                                className="flex-1 bg-white border border-green-100 rounded-md text-xs text-gray-700 font-medium px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-300"
                              >
                                {TYPE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.value === "installment" && installmentNumbers[p.qboPaymentId]
                                      ? `Installment ${installmentNumbers[p.qboPaymentId]}`
                                      : o.label}
                                  </option>
                                ))}
                              </select>
                              {p.attachments?.length > 0 && (
                                <span className="flex items-center gap-2 shrink-0">
                                  {p.attachments.map((a: any, i: number) => (
                                    <a
                                      key={a.id}
                                      href={a.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 hover:text-gray-800 underline underline-offset-2"
                                    >
                                      <Paperclip size={11} />
                                      {p.attachments.length > 1 ? `Slip ${i + 1}` : "View Slip"}
                                    </a>
                                  ))}
                                </span>
                              )}
                              <span className="text-xs text-gray-500 shrink-0">
                                {p.txnDate ? new Date(p.txnDate).toLocaleDateString("en-PK") : "—"}
                              </span>
                              <span className="text-xs font-medium text-green-700 shrink-0">{fmt(p.amount)}</span>
                            </div>

                            {/* CPD / Manual → kaunse program ka */}
                            {
                              needsProgram(cfg.type) && (
                                <select
                                  value={progId}
                                  disabled={programOptions.length <= 1}
                                  onChange={(e) =>
                                    setPaymentConfig((prev) => ({
                                      ...prev,
                                      [p.qboPaymentId]: { ...prev[p.qboPaymentId], programId: e.target.value },
                                    }))
                                  }
                                  className="w-full bg-white border border-green-100 rounded-md text-xs text-gray-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-300 disabled:opacity-70"
                                >
                                  <option value="">
                                    {programOptions.length ? "Select program…" : "Pehle enrollment select karein"}
                                  </option>
                                  {programOptions.map((o) => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                  ))}
                                </select>
                              )
                            }

                            {/* optional custom label — khaali chhoda to auto label */}
                            <input
                              value={cfg.label ?? ""}
                              onChange={(e) =>
                                setPaymentConfig((prev) => ({
                                  ...prev,
                                  [p.qboPaymentId]: { ...prev[p.qboPaymentId], label: e.target.value },
                                }))
                              }
                              maxLength={100}
                              placeholder={autoLabel(p.qboPaymentId, cfg)}
                              className="w-full bg-white border border-green-100 rounded-md text-xs text-gray-700 px-2 py-1 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-300"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Link to CRM Student</p>
                  {detailQ.data.suggestedUser && selectedUserId === detailQ.data.suggestedUser.id && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2 mb-2 text-xs text-green-700">
                      <CheckCircle2 size={13} />
                      Auto-matched by email: {detailQ.data.suggestedUser.name}
                    </div>
                  )}
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search student name or email..."
                      className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 text-gray-500 placeholder:text-gray-300"
                    />
                  </div>
                  {userSearch.length > 1 && (
                    <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                      {usersQ.data?.map((u: any) => (
                        <button
                          key={u._id}
                          onClick={() => { setSelectedUserId(u._id); setSelectedEnrollmentIds(new Set()); }}
                          className={`w-full text-left px-3 py-2 text-sm ${selectedUserId === u._id ? "bg-yellow-50" : "hover:bg-gray-50"}`}
                        >
                          {u.name} — <span className="text-gray-400">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedUserId && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Enrollment(s) — select 2+ for a bundle invoice
                      </p>
                      {selectedEnrollmentIds.size > 0 && (
                        <span className="text-[11px] font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                          {selectedEnrollmentIds.size} selected{selectedEnrollmentIds.size > 1 ? " (bundle)" : ""}
                        </span>
                      )}
                    </div>

                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input
                        value={enrollmentSearch}
                        onChange={(e) => setEnrollmentSearch(e.target.value)}
                        placeholder="Search program..."
                        className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 text-gray-500 placeholder:text-gray-300"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                      {!enrollmentsQ.data?.length ? (
                        <div className="p-3 text-center text-xs text-gray-400">No enrollments found for this student</div>
                      ) : (
                        enrollmentsQ.data
                          .filter((e: any) =>
                            !enrollmentSearch.trim() ||
                            (e.program?.name || "").toLowerCase().includes(enrollmentSearch.trim().toLowerCase())
                          )
                          .map((e: any) => {
                            const checked = selectedEnrollmentIds.has(e._id);
                            const isSuggested = suggestedEnrollmentIds.includes(e._id);
                            return (
                              <button
                                key={e._id}
                                onClick={() => toggleEnrollment(e._id)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${checked ? "bg-yellow-50" : "hover:bg-gray-50"
                                  }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span
                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-yellow-400 border-yellow-400" : "border-gray-300"
                                      }`}
                                  >
                                    {checked && <CheckCircle2 size={11} className="text-white" />}
                                  </span>
                                  <span className="text-gray-700">{e.program?.name || "Program"}</span>
                                  {isSuggested && (
                                    <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">matched</span>
                                  )}
                                </span>
                              </button>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}

                {missingProgram && (
                  <p className="text-xs text-amber-600">
                    CPD / Manual payment ke liye upar se enrollment select karke program choose karein.
                  </p>
                )}

                <button
                  onClick={() => selectedUserId && doImport()}
                  disabled={!selectedUserId || importing || missingProgram}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {selectedEnrollmentIds.size > 1
                    ? `Import as Bundle (${selectedEnrollmentIds.size} programs)`
                    : "Import & Link"}
                  {detailQ.data.payments.length > 0 ? ` (+ ${detailQ.data.payments.length} payment(s))` : ""}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div >
  );
}