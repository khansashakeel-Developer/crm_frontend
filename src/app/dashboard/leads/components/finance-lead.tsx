"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getAllLeads, createLeadAdmin, updateLead,
    addActivityLead, getActivitiesLead,
    convertLead,
    updateLeadPaymentPlan,
} from "@/utils/api";
import PageHeader from "@/app/component/dashboard/page-header";
import toast from "react-hot-toast";
import { Users, Pencil, Activity, CheckCircle, CreditCard } from "lucide-react";
import { MdOutlineRemoveRedEye } from "react-icons/md";
import DynamicTable from "@/app/component/dashboard/dynamic-table";
import LeadsModals from "../shared/leads-modals";
import { simpleAddLeadFields, editLeadFieldsReadonly } from "../shared/fields";
import { statusColor, leadFilterFields, defaultLeadFilters } from "../shared/constants";
import ExportButton from "@/app/component/ui/export-button";
import Popup from "@/app/component/ui/popup/popup";
import PaymentPlanModal from "./payment-plan-modal";

export default function FinanceLeads() {
    const queryClient = useQueryClient();

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<any>(null);
    const [activityLead, setActivityLead] = useState<any>(null);
    const [viewActivities, setViewActivities] = useState<any>(null);
    const [convertingLead, setConvertingLead] = useState<any>(null);
    const [editingPaymentPlan, setEditingPaymentPlan] = useState<any>(null); const [filters, setFilters] = useState(defaultLeadFilters);
    const [filtersPage, setFiltersPage] = useState({ page: "1", limit: "10" });

    const currentPage = Number(filtersPage.page);
    const limit = Number(filtersPage.limit);

    // ── Query — sirf payment-plan wali leads ────────────────────
    const { data: leadsData, isLoading, isError } = useQuery({
        queryKey: ["finance-leads", filters, filtersPage],
        queryFn: () =>
            getAllLeads({
                ...filters,
                ...filtersPage,
                hasPaymentPlan: "true",
                hasInvoiceNumber: filters.hasInvoiceNumber ? "true" : "",
            }).then((r) => r.data),
    });

    const { data: activitiesData, isLoading: isLoadingActivities } = useQuery({
        queryKey: ["lead-activities", viewActivities?._id],
        queryFn: () => getActivitiesLead(viewActivities._id).then((r) => r.data),
        enabled: !!viewActivities,
    });

    // ── Mutations ────────────────────────────────────────────────
    const { mutate: addLead, isPending: isAdding } = useMutation({
        mutationFn: createLeadAdmin,
        onSuccess: () => {
            toast.success("Lead created! ✅");
            setIsAddOpen(false);
            queryClient.invalidateQueries({ queryKey: ["finance-leads"] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Failed!"),
    });

    const { mutate: updateLeadApi, isPending: isUpdating } = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateLead(id, data),
        onSuccess: () => {
            toast.success("Lead updated! ✅");
            setEditingLead(null);
            queryClient.invalidateQueries({ queryKey: ["finance-leads"] });
        },
        onError: () => toast.error("Failed to update!"),
    });

    const { mutate: addActivity, isPending: isAddingActivity } = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => addActivityLead(id, data),
        onSuccess: () => {
            toast.success("Activity added! ✅");
            setActivityLead(null);
            queryClient.invalidateQueries({ queryKey: ["finance-leads"] });
        },
        onError: () => toast.error("Failed!"),
    });

    const { mutate: convert, isPending: isConverting } = useMutation({
        mutationFn: (id: string) => convertLead(id, {}),
        onSuccess: () => {
            toast.success("Lead converted! 🎉");
            setConvertingLead(null);
            queryClient.invalidateQueries({ queryKey: ["finance-leads"] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to convert!"),
    });

    const { mutate: savePaymentPlan, isPending: isSavingPlan } = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateLeadPaymentPlan(id, data),
        onSuccess: () => {
            toast.success("Payment plan updated! ✅");
            setEditingPaymentPlan(null);
            queryClient.invalidateQueries({ queryKey: ["finance-leads"] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to update payment plan!"),
    });

    const handlePageChange = (newPage: number) => {
        setFiltersPage((prev) => ({ ...prev, page: String(newPage) }));
    };

    return (
        <>
            <PageHeader
                title="Leads" subtitle="Leads with payment plans ready for conversion" titleIcon={<Users size={24} />}
                totalCount={leadsData?.meta?.total ?? 0} onAdd={() => setIsAddOpen(true)}
                filters={filters} setFilters={setFilters} filterFields={leadFilterFields}
                exportBtn={
                    <ExportButton
                        filename="leads"
                        label="Export Excel"
                        fetchData={async () => {
                            const res = await getAllLeads({ limit: 10000, hasPaymentPlan: "true" });
                            return res.data.data;
                        }}
                        columns={[
                            { header: "First Name", key: "first_name" },
                            { header: "Last Name", key: "last_name" },
                            { header: "Email", key: "email" },
                            { header: "Phone", key: "phone" },
                            { header: "Program", key: "program_name" },
                            { header: "Status", key: "status" },
                            { header: "Opportunity", key: "opportunity_value", format: (v) => Number(v || 0).toLocaleString() },
                            { header: "Created At", key: "createdAt", format: (v) => v ? new Date(v).toLocaleDateString("en-PK") : "—" },
                        ]}
                    />
                }
            />

            <DynamicTable
                data={leadsData?.data || []} isLoading={isLoading} isError={isError}
                currentPage={currentPage} pageSize={limit}
                totalPages={Math.ceil((leadsData?.meta?.total ?? 0) / limit)}
                onPageChange={handlePageChange}
                columns={[
                    {
                        key: "name", label: "Name", render: (lead) => (   // row = { user, enrollments[] }
                            <div>
                                <p className="font-medium text-gray-800">{lead.first_name} {lead.last_name}</p>
                                <p className="text-xs text-gray-400">{lead?.email}</p>
                            </div>)
                    },
                    { key: "program", label: "Program", render: (lead) => lead.program_id?.name || "—", },
                    { key: "phone", label: "Phone" },
                    { key: "status", label: "Status", render: (lead) => <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(lead.status)}`}>{lead.status}</span> },
                    {
                        key: "paymentPlan", label: "Payment Plan",
                        render: (lead) => (
                            <button
                                onClick={(ev) => {
                                    ev.stopPropagation();
                                    setEditingPaymentPlan(lead);
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition text-xs font-medium"
                                title="Edit payment plan"
                            >
                                <CreditCard size={12} />
                                {lead.paymentPlan?.totalAmount
                                    ? `Rs ${Number(lead.paymentPlan.totalAmount).toLocaleString()}`
                                    : "Set Plan"}
                            </button>
                        ),
                    },
                    { key: "assigned_to", label: "Assigned To", render: (lead) => <span>{lead.assigned_to?.name || "—"}</span> },
                ]}
                actions={[
                    { icon: <Pencil size={14} />, label: "Edit", onClick: setEditingLead, className: "hover:bg-yellow-50 hover:text-yellow-600" },
                    { icon: <Activity size={14} />, label: "Add Activity", onClick: setActivityLead, className: "hover:bg-indigo-50 hover:text-indigo-600" },
                    { icon: <MdOutlineRemoveRedEye size={14} />, label: "View Activities", onClick: setViewActivities, className: "hover:bg-indigo-50 hover:text-indigo-600", hidden: (lead) => !lead.activities?.length },
                    // {
                    //     icon: <CheckCircle size={14} />, label: "Convert", onClick: setConvertingLead,
                    //     className: "hover:bg-green-50 hover:text-green-600",
                    //     hidden: (lead) => lead.status === "converted",
                    // },
                ]}
            />

            <LeadsModals
                isAddOpen={isAddOpen} onAddClose={() => setIsAddOpen(false)}
                onAddSubmit={addLead} isAdding={isAdding} addFields={simpleAddLeadFields}

                editingLead={editingLead} onEditClose={() => setEditingLead(null)}
                onEditSubmit={(data) => updateLeadApi({ id: editingLead._id, data })}
                isUpdating={isUpdating} editFields={editLeadFieldsReadonly}
                editInitialValues={editingLead ? {
                    first_name: editingLead.first_name || "",
                    last_name: editingLead.last_name || "",
                    email: editingLead.email || "",
                    phone: editingLead.phone || "",
                    quality: editingLead.quality || "",
                    source: editingLead.source || "",
                    status: editingLead.status || "",
                    notes: editingLead.notes || "",
                    utm_source: editingLead.utm_source || "",
                    utm_campaign: editingLead.utm_campaign || "",
                } : undefined}

                activityLead={activityLead} onActivityClose={() => setActivityLead(null)}
                onActivitySubmit={(data) => addActivity({ id: activityLead._id, data })} isAddingActivity={isAddingActivity}

                viewActivities={viewActivities} onViewActivitiesClose={() => setViewActivities(null)}
                activitiesData={activitiesData} isLoadingActivities={isLoadingActivities}
            />

            {convertingLead && (
                <Popup
                    isOpen={!!convertingLead}
                    onClose={() => setConvertingLead(null)}
                    onConfirm={() => convert(convertingLead._id)}
                    variant="info"
                    title="Convert Lead"
                    description={
                        <>
                            Convert{" "}
                            <span className="font-bold text-green-600">
                                {convertingLead.first_name} {convertingLead.last_name}
                            </span>{" "}
                            into an enrolled student? Invoice will be generated automatically.
                        </>
                    }
                    confirmText="Yes, Convert 🎉"
                    isLoading={isConverting}
                    loadingText="Converting..."
                />
            )}

            {/* 👇 NAYA — Payment Plan Edit Modal */}
            {editingPaymentPlan && (
                <PaymentPlanModal
                    lead={editingPaymentPlan}
                    onClose={() => setEditingPaymentPlan(null)}
                    onSubmit={(data) => savePaymentPlan({ id: editingPaymentPlan._id, data })}
                    isSubmitting={isSavingPlan}
                />
            )}
        </>
    );
}