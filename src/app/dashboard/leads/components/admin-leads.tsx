"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllLeads, createLeadAdmin, updateLead, deleteLead,
  assignLead, convertLead, markLostLead, addActivityLead,
  getActivitiesLead, getLeadsStats, getNamesPrograms,
  markLeadInterested,
  updateLeadPaymentPlan,
  adminGetBatches,
  getAllEnrollments,
  adminGetAllUsers,
} from "@/utils/api";
import PageHeader from "@/app/component/dashboard/page-header";
import toast from "react-hot-toast";
import {
  Users, Pencil, Trash2, LayoutGrid, List,
  Clock,
} from "lucide-react";
import DynamicTable from "@/app/component/dashboard/dynamic-table";
import LeadPipeline from "@/app/component/dashboard/lead-pipeline";
import QuickStats from "@/app/component/dashboard/quick-stats";
import LeadsModals from "../shared/leads-modals";
import { addLeadFields, editLeadFields } from "../shared/fields";
import { statusColor, leadFilterFields, defaultLeadFilters } from "../shared/constants";
import { ModalField } from "@/types/ui";
import KanbanBoard from "./kanban-board";
import PaymentPlanModal from "./payment-plan-modal";
import MarkInterestedModal from "./mark-interested-modal";
import Select from "@/app/component/ui/select";
import ViewContractModal from "./view-contract-modal";
import ViewPaymentPlanModal from "./view-payment-plan-modal";
import SelectProgramModal from "./select-program-modal";
import { useAppSelector } from "@/store/hooks";
import ExportButton from "@/app/component/ui/export-button";
import LeadImportButton from "./lead-import-button";
import { markNotNowLead } from "@/utils/api";
import DateRangeFilter from "@/app/component/dashboard/date-range-filter";

// ── Main Component ────────────────────────────────────────────
export default function AdminLeads() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAppSelector((state) => state.auth);
  const isAdmin = ["admin", "super_admin"].includes(authUser?.role);
  const [activeView, setActiveView] = useState<"opportunities" | "list">("opportunities");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [activityLead, setActivityLead] = useState<any>(null);
  const [lostLead, setLostLead] = useState<any>(null);
  const [notNowLead, setNotNowLead] = useState<any>(null);
  const [assigningLead, setAssigningLead] = useState<any>(null);
  const [deletingLead, setDeletingLead] = useState<any>(null);
  const [viewActivities, setViewActivities] = useState<any>(null);
  const [interestedLead, setInterestedLead] = useState<any>(null);
  const [filters, setFilters] = useState(defaultLeadFilters);
  const [paymentPlanLead, setPaymentPlanLead] = useState<any>(null);
  const [viewContractLead, setViewContractLead] = useState<any>(null);
  const [selectProgramLead, setSelectProgramLead] = useState<any>(null);
  const [viewingPaymentPlan, setViewingPaymentPlan] = useState<any>(null);
  const [filtersPage, setFiltersPage] = useState({
    page: "1",
    limit: "10",
  });

  const currentPage = Number(filtersPage.page);
  const limit = Number(filtersPage.limit);

  const invalidateLeads = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-leads"] });
    queryClient.invalidateQueries({ queryKey: ["admin-leads-kanban"] });
    queryClient.invalidateQueries({ queryKey: ["admin-leads-stats"] });
    queryClient.invalidateQueries({ queryKey: ["enrollments-kanban"] });
  };

  // ── Queries ──────────────────────────────────────────────────
  const { data: leadsData, isLoading, isError } = useQuery({
    // queryKey: ["admin-leads", filters],
    // queryFn: () => getAllLeads(filters).then((r) => r.data),
    queryKey: ["admin-leads", filters, filtersPage],  // 👈 filtersPage bhi add karo
    queryFn: () => getAllLeads({ ...filters, ...filtersPage }).then((r) => r.data),
  });

  const { data: allLeadsData, isLoading: isKanbanLoading } = useQuery({
    queryKey: ["admin-leads-kanban", filters],
    queryFn: () => getAllLeads({ ...filters, page: "1", limit: "1000" }).then((r) => r.data),
    enabled: activeView === "opportunities",  // sirf tab fetch karo jab kanban open ho
  });


  const { data: enrollmentsData } = useQuery({
    queryKey: ["enrollments-kanban", filters.search],
    queryFn: () =>
      getAllEnrollments({
        page: 1,
        limit: 1000,
        search: filters.search || "",
      }).then((r) => r.data),
  });

  const { data: activitiesData, isLoading: isLoadingActivities } = useQuery({
    queryKey: ["lead-activities", viewActivities?._id],
    queryFn: () => getActivitiesLead(viewActivities._id).then((r) => r.data),
    enabled: !!viewActivities,
  });

  const { data: statsData } = useQuery({
    queryKey: ["admin-leads-stats"],
    queryFn: () => getLeadsStats().then((r) => r.data.data),
  });

  console.log("Leads stats data:", statsData)

  const { data: programs } = useQuery({
    queryKey: ["program-names"],
    queryFn: getNamesPrograms,
  });

  // Inject programs into fields
  const injectPrograms = (fields: ModalField[]) =>
    fields.map((f) =>
      f.name === "program_id"
        ? { ...f, options: (programs || []).map((p: any) => ({ label: p.name, value: p._id })) }
        : f
    );

  const programMap = Object.fromEntries((programs || []).map((p: any) => [p._id, p.name]));

  // Batches fetch
  const selectedProgram =
    editingLead?.program_id?._id ||
    editingLead?.program_id ||
    "";

  const { data: batches } = useQuery({
    queryKey: ["batches", selectedProgram],
    queryFn: () =>
      adminGetBatches({
        program_id: selectedProgram,
      }).then((r) => r.data),
    enabled: !!selectedProgram,
  });

  const { data: usersRes } = useQuery({
    queryKey: ["all-users-role"],
    queryFn: () => adminGetAllUsers({ limit: 10000 }).then((r) => r.data),
    enabled: isAdmin, // sirf admin ko chahiye
  });

  const salesManagers = (usersRes?.users ?? [])
    .filter((u: any) => ["sales_manager", "sales_rep", "admin", "super_admin"].includes(u.role))
    .filter((u: any, idx: number, arr: any[]) =>
      arr.findIndex((x) => x._id === u._id) === idx
    );

  // Inject function
  const injectBatches = (fields: ModalField[]) =>
    fields.map((f) =>
      f.name === "batch_id"
        ? {
          ...f,
          options: [
            { label: "— None —", value: "" },
            ...(batches?.data || []).map((b: any) => ({
              label: `${b.name} (${b.status})`,
              value: b._id,
            })),
          ],
        }
        : f
    );

  // Apply both injections
  const injectAll = (fields: ModalField[]) => injectBatches(injectPrograms(fields));

  const pipelineData = [
    { label: "New", count: statsData?.new || 0, color: "bg-sky-500" },
    { label: "Contacted", count: statsData?.contacted || 0, color: "bg-yellow-400" },
    { label: "Qualified", count: statsData?.qualified || 0, color: "bg-indigo-500" },
    { label: "Interested", count: statsData?.interested || 0, color: "bg-orange-400" },
    { label: "Converted", count: statsData?.converted || 0, color: "bg-teal-500" },
    { label: "Lost", count: statsData?.lost || 0, color: "bg-rose-400" },
  ];

  const quickStatsData = [
    { label: "Conversion Rate", value: `${statsData?.conversionRate || 0}%`, color: "text-teal-600" },
    { label: "Hot Leads", value: `${statsData?.hot || 0}`, color: "text-red-500" },
    { label: "Assigned", value: `${statsData?.assigned || 0}`, color: "text-blue-600" },
    { label: "Lost", value: `${statsData?.lost || 0}`, color: "text-rose-500" },
  ];

  // ── Mutations ────────────────────────────────────────────────
  const { mutate: addLead, isPending: isAdding } = useMutation({
    mutationFn: createLeadAdmin,
    onSuccess: () => { toast.success("Lead created! ✅"); setIsAddOpen(false); invalidateLeads(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed!"),
  });

  const { mutateAsync: updateLeadApi, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateLead(id, data),
    onSuccess: () => { toast.success("Lead updated! ✅"); setEditingLead(null); invalidateLeads(); },
    onError: () => toast.error("Failed to update!"),
  });

  const { mutate: deleteLeadApi, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => { toast.success("Lead deleted! 🗑️"); setDeletingLead(null); invalidateLeads(); },
    onError: () => toast.error("Failed to delete!"),
  });

  const { mutate: assignLeadApi, isPending: isAssigning } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => assignLead(id, data),
    onSuccess: () => { toast.success("Lead assigned! ✅"); setAssigningLead(null); invalidateLeads(); },
    onError: () => toast.error("Failed to assign!"),
  });

  const { mutateAsync: convertLeadApi } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => convertLead(id, data),
    onSuccess: () => { toast.success("Lead converted! 🎉"); invalidateLeads(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to convert!"),
  });

  const { mutate: markLost, isPending: isMarkingLost } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => markLostLead(id, data),
    onSuccess: () => { toast.success("Marked as lost!"); setLostLead(null); invalidateLeads(); },
    onError: () => toast.error("Failed!"),
  });

  const { mutate: markNotNow, isPending: isMarkingNotNow } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => markNotNowLead(id, data),
    onSuccess: () => { toast.success("Marked as Not Now!"); setNotNowLead(null); invalidateLeads(); },
    onError: () => toast.error("Failed!"),
  });

  const { mutate: addActivity, isPending: isAddingActivity } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => addActivityLead(id, data),
    onSuccess: () => { toast.success("Activity added! ✅"); setActivityLead(null); invalidateLeads(); },
    onError: () => toast.error("Failed!"),
  });

  const { mutate: savePaymentPlan, isPending: isSavingPlan } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateLeadPaymentPlan(id, data),
    onSuccess: () => {
      toast.success(paymentPlanLead?.paymentPlan ? "Payment plan updated!" : "Payment plan saved!");
      setPaymentPlanLead(null);
      invalidateLeads();
    },
  });

  const { mutate: markInterested, isPending: isMarkingInterested } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => markLeadInterested(id, data),
    onSuccess: () => { toast.success("Lead marked as interested! ⭐"); setInterestedLead(null); invalidateLeads(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed!"),
  });


  // ── Shared Actions ───────────────────────────────────────────
  const actions = {
    onEdit: setEditingLead,
    onAssign: setAssigningLead,
    onActivity: setActivityLead,
    onViewActivities: setViewActivities,

    // ── yeh sab async karo ──
    onConvert: (lead: any) =>
      convertLeadApi({ id: lead._id, data: { program_id: lead.program_id, batch_id: lead.batch_id, payment_plan_id: lead.payment_plan_id } }),

    onMarkLost: setLostLead,
    onMarkNotNow: setNotNowLead,
    onDelete: setDeletingLead,
    onPaymentPlan: setPaymentPlanLead,
    onInterested: setInterestedLead,

    onQualified: (lead: any) =>
      updateLeadApi({ id: lead._id, data: { status: "qualified" } }),

    onContacted: (lead: any) => {
      if (!lead.program_id) {
        setSelectProgramLead(lead);
      } else {
        return updateLeadApi({ id: lead._id, data: { status: "contacted" } });
      }
    },

    onViewContract: setViewContractLead,
    viewPaymentPlan: setViewingPaymentPlan,
    currentUser: authUser,
  };

  const handlePageChange = (newPage: number) => {
    setFiltersPage((prev) => ({ ...prev, page: String(newPage) }));
  };

  return (
    <>
      <PageHeader
        title="Leads" subtitle="Manage all leads" titleIcon={<Users size={24} />}
        totalCount={leadsData?.meta?.total ?? 0} onAdd={() => setIsAddOpen(true)}
        filters={filters} setFilters={setFilters} filterFields={leadFilterFields}
        exportBtn={
          (filters as any).dateFilter === "custom" ? (
            <DateRangeFilter
              from={(filters as any).dateFrom}
              to={(filters as any).dateTo}
              onChange={(from, to) =>
                setFilters((f: any) => ({ ...f, dateFrom: from, dateTo: to }))
              }
            />
          ) : undefined
        }
      />

      {/* ── View Toggle ── */}
      <div className="flex items-center justify-between w-full gap-1 bg-gray-100 rounded-xl w-fit mb-4">
        <div className="flex items-center gap-1">
          <button onClick={() => setActiveView("opportunities")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeView === "opportunities" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <LayoutGrid size={14} /> Opportunities
          </button>
          <button
            onClick={() => setActiveView("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeView === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <List size={14} /> List View
          </button>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1">
            <LeadImportButton />
            <ExportButton
              filename="leads"
              label="Export Excel"
              fetchData={async () => {
                const res = await getAllLeads({ limit: 10000 });
                return res.data.data;
              }}
              columns={[
                { header: "First Name", key: "first_name" },
                { header: "Last Name", key: "last_name" },
                { header: "Email", key: "email" },
                { header: "Phone", key: "phone" },
                { header: "Nationality", key: "nationality" },
                { header: "Profession", key: "profession" },
                { header: "Program", key: "program_name" },
                { header: "Status", key: "status" },
                { header: "Quality", key: "quality" },
                { header: "Source", key: "source" },
                { header: "Assigned To", key: "assigned_to.name" },
                { header: "Opportunity", key: "opportunity_value", format: (v) => Number(v || 0).toLocaleString() },
                { header: "Lead Score", key: "lead_score" },
                { header: "Created At", key: "createdAt", format: (v) => v ? new Date(v).toLocaleDateString("en-PK") : "—" },
              ]}
            />
            <div className="min-w-[220px]">
              <Select
                placeholder="All Sales Managers"
                bg="bg-white"
                value={(filters as any).assigned_to || ""}
                onChange={(e) =>
                  setFilters((prev: any) => ({ ...prev, assigned_to: e.target.value }))
                }
                options={[
                  { label: "All Sales Managers", value: "" },
                  ...salesManagers.map((u: any) => ({
                    label: `${u.name} (${u.role.replace("_", " ")})`,
                    value: u._id,
                  })),
                ]}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Kanban View ── */}
      {activeView === "opportunities" && (
        isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <KanbanBoard
            leads={allLeadsData?.data || []}
            // SAHI — actual array
            enrollments={enrollmentsData?.data || []}
            programMap={programMap}
            actions={actions}
            filters={filters}
          />
        )
      )}



      {/* ── List View ── */}
      {activeView === "list" && (
        <>
          <DynamicTable
            data={leadsData?.data || []} isLoading={isLoading} isError={isError}
            currentPage={currentPage} pageSize={limit}
            totalPages={Math.ceil((leadsData?.meta?.total ?? 0) / limit)}
            onPageChange={handlePageChange}
            columns={[
              { key: "name", label: "Name", render: (lead) => <span className="font-medium text-gray-800">{lead.first_name} {lead.last_name}</span> },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "quality", label: "Quality", render: (lead) => <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(lead.quality)}`}>{lead.quality}</span> },
              { key: "status", label: "Status", render: (lead) => <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(lead.status)}`}>{lead.status}</span> },
              { key: "program_id", label: "Program", render: (lead) => <span>{programMap[lead.program_id] || "—"}</span> },
              { key: "source", label: "Source", render: (lead) => <span className="capitalize">{lead.source || "—"}</span> },
              { key: "assigned_to", label: "Assigned To", render: (lead) => <span>{lead.assigned_to?.name || "—"}</span> },
            ]}
            actions={[
              { icon: <Pencil size={14} />, label: "Edit", onClick: actions.onEdit, className: "hover:bg-yellow-50 hover:text-yellow-600" },
              // { icon: <UserPlus size={14} />, label: "Assign", onClick: actions.onAssign, className: "hover:bg-blue-50 hover:text-blue-600" },
              // { icon: <Activity size={14} />, label: "Add Activity", onClick: actions.onActivity, className: "hover:bg-indigo-50 hover:text-indigo-600" },
              // { icon: <ArrowLeftRight  size={14} />, label: "Mark Contacted", onClick: actions.onContacted, className: "hover:bg-blue-50 hover:text-blue-600", hidden: (lead) => lead.status !== "new" },
              // { icon: <MdOutlineRemoveRedEye size={14} />, label: "View Activities", onClick: actions.onViewActivities, className: "hover:bg-indigo-50 hover:text-indigo-600", hidden: (lead) => !lead.activities?.length },
              // { icon: <UserCheck size={14} />, label: "Convert", onClick: actions.onConvert, className: "hover:bg-teal-50 hover:text-teal-600", hidden: (lead) => lead.status === "converted" || lead.status === "lost" },
              // { icon: <XCircle size={14} />, label: "Mark Lost", onClick: actions.onMarkLost, className: "hover:bg-red-50 hover:text-red-500", hidden: (lead) => lead.status === "converted" || lead.status === "lost" },
              { icon: <Trash2 size={14} />, label: "Delete", onClick: actions.onDelete, className: "hover:bg-red-50 hover:text-red-500" },
              { icon: <Clock size={14} />, label: "Not Now", onClick: setNotNowLead, className: "hover:bg-gray-100 hover:text-gray-600", hidden: (lead) => ["converted", "lost", "not_now"].includes(lead.status) },
            ]}
          />
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="col-span-2"><LeadPipeline data={pipelineData} /></div>
            <QuickStats data={quickStatsData} />
          </div>
        </>
      )}

      {/* ── All Modals ── */}
      <LeadsModals
        // Add
        isAddOpen={isAddOpen} onAddClose={() => setIsAddOpen(false)}
        // onAddSubmit={addLead} 
        onAddSubmit={(data) => addLead({ ...data, assigned_to: authUser?._id })}
        isAdding={isAdding} addFields={injectAll(addLeadFields)}
        // Edit
        editingLead={editingLead} onEditClose={() => setEditingLead(null)}
        onEditSubmit={(data) => updateLeadApi({ id: editingLead._id, data })}
        isUpdating={isUpdating} editFields={injectAll(editLeadFields)}
        editInitialValues={editingLead ? {
          first_name: editingLead.first_name || "",
          last_name: editingLead.last_name || "",
          email: editingLead.email || "",
          phone: editingLead.phone || "",
          nationality: editingLead.nationality || "",
          profession: editingLead.profession || "",
          opportunity_value: editingLead.opportunity_value || "",
          batch_id: editingLead.batch_id?._id || editingLead.batch_id || "",
          program_id: editingLead.program_id?._id || editingLead.program_id || "",
          status: editingLead.status || "",
          quality: editingLead.quality || "",
          source: editingLead.source || "",
          query: editingLead.query || "",
          message: editingLead.message || "",
          notes: editingLead.notes || "",
          utm_source: editingLead.utm_source || "",
          utm_medium: editingLead.utm_medium || "",
          utm_campaign: editingLead.utm_campaign || "",
        } : undefined}
        // Activity
        activityLead={activityLead} onActivityClose={() => setActivityLead(null)}
        onActivitySubmit={(data) => addActivity({ id: activityLead._id, data })} isAddingActivity={isAddingActivity}
        // View Activities
        viewActivities={viewActivities} onViewActivitiesClose={() => setViewActivities(null)}
        activitiesData={activitiesData} isLoadingActivities={isLoadingActivities}
        // Lost
        lostLead={lostLead} onLostClose={() => setLostLead(null)}
        onLostSubmit={(data) => markLost({ id: lostLead._id, data })} isMarkingLost={isMarkingLost}
        // Not Now
        notNowLead={notNowLead} onNotNowClose={() => setNotNowLead(null)}
        onNotNowSubmit={(data) => markNotNow({ id: notNowLead._id, data })} isMarkingNotNow={isMarkingNotNow}
        // Delete
        deletingLead={deletingLead} onDeleteClose={() => setDeletingLead(null)}
        onDeleteConfirm={() => deleteLeadApi(deletingLead._id)} isDeleting={isDeleting}
        // Assign
        assigningLead={assigningLead} onAssignClose={() => setAssigningLead(null)}
        onAssign={(userId) => assignLeadApi({ id: assigningLead._id, data: { assigned_to: userId } })}
        isAssigning={isAssigning} currentUserRole="admin"
      />

      {paymentPlanLead && (
        <PaymentPlanModal
          lead={paymentPlanLead}
          onClose={() => setPaymentPlanLead(null)}
          onSubmit={(data) => savePaymentPlan({ id: paymentPlanLead._id, data })}
          isSubmitting={isSavingPlan} />
      )}

      {interestedLead && (
        <MarkInterestedModal
          lead={interestedLead}
          onClose={() => setInterestedLead(null)}
          onSubmit={(data) => markInterested({ id: interestedLead._id, data })}
          isSubmitting={isMarkingInterested}
        />
      )}

      <ViewContractModal
        lead={viewContractLead}
        onClose={() => setViewContractLead(null)}
        onSave={(leadId: string, contractDetails: any) =>
          updateLeadApi({ id: leadId, data: { contractDetails } })
            .then(() => setViewContractLead((prev: any) => prev ? { ...prev, contractDetails } : prev))
        }
        isSaving={isUpdating}
      />

      <ViewPaymentPlanModal lead={viewingPaymentPlan} onClose={() => setViewingPaymentPlan(null)} />

      <SelectProgramModal
        lead={selectProgramLead}
        programs={programs || []}
        onClose={() => setSelectProgramLead(null)}
        onConfirm={(leadId, programId) => {
          updateLeadApi({ id: leadId, data: { program_id: programId, status: "contacted" } });
          setSelectProgramLead(null);
        }}
        isLoading={isUpdating}
      />
    </>
  );
}