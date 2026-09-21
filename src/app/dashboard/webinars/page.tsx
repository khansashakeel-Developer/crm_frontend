// "use client";
// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { getWebinars, deleteWebinar } from "@/utils/api";
// import { Plus, Pencil, Trash2, Users } from "lucide-react";

// export default function WebinarsPage() {
//   const [webinars, setWebinars] = useState([]);
//   const [loading, setLoading] = useState(true);

//   const fetchWebinars = async () => {
//     setLoading(true);
//     try {
//       const res = await getWebinars();
//       setWebinars(res.data);
//     } catch (err) {
//       console.error("Failed to load webinars", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchWebinars();
//   }, []);

//   const handleDelete = async (id) => {
//     if (!confirm("Delete this webinar? This cannot be undone.")) return;
//     try {
//       await deleteWebinar(id);
//       setWebinars((prev) => prev.filter((w) => w._id !== id));
//     } catch (err) {
//       console.error("Delete failed", err);
//     }
//   };

//   const statusBadge = (status) => {
//     const styles = {
//       draft: "bg-gray-100 text-gray-700",
//       published: "bg-green-100 text-green-700",
//       closed: "bg-red-100 text-red-700",
//     };
//     return (
//       <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.draft}`}>
//         {status}
//       </span>
//     );
//   };

//   return (
//     <div className="p-6">
//       <div className="flex items-center justify-between mb-6">
//         <h1 className="text-xl font-semibold text-navy-900">Webinars</h1>
//         <Link
//           href="/dashboard/webinars/create"
//           className="flex items-center gap-2 bg-navy-900 text-gold-500 px-4 py-2 rounded-md hover:opacity-90"
//         >
//           <Plus size={16} />
//           Create Webinar
//         </Link>
//       </div>

//       {loading ? (
//         <p className="text-gray-500">Loading...</p>
//       ) : webinars.length === 0 ? (
//         <p className="text-gray-500">No webinars yet. Create your first one.</p>
//       ) : (
//         <table className="w-full border-collapse bg-white rounded-lg shadow-sm overflow-hidden">
//           <thead>
//             <tr className="bg-gray-50 text-left text-sm text-gray-600">
//               <th className="p-3">Title</th>
//               <th className="p-3">Date</th>
//               <th className="p-3">Status</th>
//               <th className="p-3">Registrations</th>
//               <th className="p-3 text-right">Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {webinars.map((w) => (
//               <tr key={w._id} className="border-t text-sm">
//                 <td className="p-3 font-medium">{w.title}</td>
//                 <td className="p-3">{new Date(w.date).toLocaleDateString()}</td>
//                 <td className="p-3">{statusBadge(w.status)}</td>
//                 <td className="p-3">
//                   <Link
//                     href={`/dashboard/webinars/${w._id}/registrations`}
//                     className="flex items-center gap-1 text-navy-700 hover:underline"
//                   >
//                     <Users size={14} />
//                     {w.registrationsCount ?? 0}
//                   </Link>
//                 </td>
//                 <td className="p-3 text-right space-x-3">
//                   <Link href={`/dashboard/webinars/${w._id}`} className="text-gray-600 hover:text-navy-900 inline-block">
//                     <Pencil size={16} />
//                   </Link>
//                   <button onClick={() => handleDelete(w._id)} className="text-red-500 hover:text-red-700">
//                     <Trash2 size={16} />
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       )}
//     </div>
//   );
// }
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWebinars, getWebinar, createWebinar, updateWebinar, deleteWebinar, adminGetAllAssignRoles, getAllUsersForRole, duplicateWebinar } from "@/utils/api";
import PageHeader, { FilterField } from "@/app/component/dashboard/page-header";
import Popup from "@/app/component/ui/popup/popup";
import { ModalField } from "@/types/ui";
import { Pencil, Trash2, Users, Video } from "lucide-react";
import toast from "react-hot-toast";
import DynamicTable from "@/app/component/dashboard/dynamic-table";
import FieldBuilder from "./components/field-builder";
import Modal from "@/app/component/ui/model/modal";
import ProtectedRoute from "@/app/component/protected-route";
import { useAppSelector } from "@/store/hooks";

type WebinarStatus = "draft" | "published" | "closed";
type FieldType = "text" | "email" | "phone" | "number" | "date" | "textarea" | "select" | "checkbox";

interface WebinarField {
  fieldKey: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  order: number;
}

interface Webinar {
  _id: string;
  title: string;
  description?: string;
  date: string;
  status: WebinarStatus;
  fields: WebinarField[];
  registrationsCount?: number;
}

const statusStyles: Record<WebinarStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-700",
  closed: "bg-red-100 text-red-700",
};

// ✅ MODAL_FIELDS ka static hissa (jo dynamic options pe depend nahi karta) bahar rakh sakte ho
// lekin behtar hai poori list function ke andar banayein taake teamMemberOptions inject ho sake

export default function WebinarsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const qrRef = useRef<HTMLDivElement>(null);

  // ✅ Ab yahan andar — component ke top pe
  const { user: authUser } = useAppSelector((state) => state.auth);

  const { data: teamMembersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users-for-assign"],
    queryFn: () =>
      (authUser?.role === "admin" || authUser?.role === "super_admin" || authUser?.role === "sales_manager" || authUser?.role === "finance_manager"
        ? adminGetAllAssignRoles({ page: 1, limit: 5000 })
        : getAllUsersForRole()
      ).then((res) => res.data),
    enabled: !!authUser,
  });

  const teamMemberOptions = (teamMembersData?.users || [])
    .filter((u: any) => ["admin", "sales_manager"].includes(u.role)) // ⚠️ apna actual RM role value confirm karlo
    .map((u: any) => ({ value: u._id, label: `${u.name} (${u.role === "admin" ? "Admin" : "Sales Manager"})` }));

  // ✅ MODAL_FIELDS bhi ab component ke andar — taake teamMemberOptions har render pe fresh mile
  const MODAL_FIELDS: ModalField[] = [
    {
      name: "title",
      label: "Title",
      type: "input",
      placeholder: "e.g. Intro to Digital Marketing",
      required: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Short summary shown on the registration page",
    },
    {
      name: "date",
      label: "Date",
      type: "input",
      inputType: "datetime-local",
      required: true,
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      defaultValue: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
        { value: "closed", label: "Closed" },
      ],
    },
    // {
    //   name: "assignedTo",
    //   label: "Assigned Team Member",
    //   type: "select",
    //   options: teamMemberOptions,
    // },
  ];

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    page: 1,
    limit: 10,
  });

  const [deletingWebinar, setDeletingWebinar] = useState<Webinar | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFields, setNewFields] = useState<WebinarField[]>([]);
  const [createFieldsError, setCreateFieldsError] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInitialValues, setEditInitialValues] = useState<Record<string, string | boolean>>({});
  const [editFields, setEditFields] = useState<WebinarField[]>([]);
  const [editFieldsError, setEditFieldsError] = useState("");
  const [isLoadingWebinar, setIsLoadingWebinar] = useState(false);
  const [sharingWebinar, setSharingWebinar] = useState<Webinar | null>(null);
  const isAdmin = authUser?.role === "admin" || authUser?.role === "super_admin";

  // ── Fetch webinars ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ["webinars", filters],
    queryFn: () => getWebinars().then((r) => r.data),
  });

  const webinars: Webinar[] = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const currentPage = data?.meta?.page ?? filters.page;

  // ── Delete webinar ──
  const { mutate: removeWebinar, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteWebinar(id),
    onSuccess: () => {
      toast.success("Webinar deleted ✅");
      queryClient.invalidateQueries({ queryKey: ["webinars"] });
      setDeletingWebinar(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to delete webinar"),
  });

  // ── Create webinar ──
  const { mutate: addWebinar, isPending: isCreating } = useMutation({
    mutationFn: (payload: Record<string, any>) => createWebinar(payload),
    onSuccess: () => {
      toast.success("Webinar created ✅");
      queryClient.invalidateQueries({ queryKey: ["webinars"] });
      closeCreateModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to create webinar"),
  });

  // ── Update webinar ──
  const { mutate: editWebinar, isPending: isUpdating } = useMutation({
    mutationFn: (payload: Record<string, any>) => updateWebinar(editingId as string, payload),
    onSuccess: () => {
      toast.success("Webinar updated ✅");
      queryClient.invalidateQueries({ queryKey: ["webinars"] });
      closeEditModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to update webinar"),
  });

  // ── Duplicate webinar mutation ──
  const { mutate: copyWebinar, isPending: isDuplicating } = useMutation({
    mutationFn: (id: string) => duplicateWebinar(id),
    onSuccess: () => {
      toast.success("Webinar duplicated ✅");
      queryClient.invalidateQueries({ queryKey: ["webinars"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to duplicate webinar"),
  });

  // ── Create modal handlers ──
  const openCreateModal = () => {
    setNewFields([]);
    setCreateFieldsError("");
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setNewFields([]);
    setCreateFieldsError("");
  };

  const getPublicLink = (id: string) =>
    `${process.env.NEXT_PUBLIC_SITE_URL}/webinars/${id}`; // apna actual public route path daal do

  const handleCopyLink = (id: string) => {
    navigator.clipboard.writeText(getPublicLink(id));
    toast.success("Link copied ✅");
  };

  const handleCreateSubmit = (form: Record<string, string | boolean>) => {
    setCreateFieldsError("");

    if (newFields.length === 0) {
      setCreateFieldsError("Add at least one form field.");
      return;
    }
    const missingLabel = newFields.some((f) => !f.label.trim());
    if (missingLabel) {
      setCreateFieldsError("Every field needs a label.");
      return;
    }

    addWebinar({ ...form, fields: newFields });
  };

  // ── Edit modal handlers ──
  const openEditModal = async (webinar: Webinar) => {
    setEditingId(webinar._id);
    setEditFieldsError("");
    setIsLoadingWebinar(true);
    setIsEditOpen(true);

    try {
      const res = await getWebinar(webinar._id);
      const w: Webinar = res.data;

      setEditInitialValues({
        title: w.title || "",
        description: w.description || "",
        // convert ISO date to what datetime-local input expects
        date: w.date ? new Date(w.date).toISOString().slice(0, 16) : "",
        status: w.status || "draft",
      });
      setEditFields(w.fields || []);
      setIsEditOpen(true);
    } catch (err) {
      toast.error("Failed to load webinar details");
      // setIsEditOpen(false);
    } finally {
      setIsLoadingWebinar(false);
    }
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingId(null);
    setEditInitialValues({});
    setEditFields([]);
    setEditFieldsError("");
  };

  const handleEditSubmit = (form: Record<string, string | boolean>) => {
    setEditFieldsError("");

    if (editFields.length === 0) {
      setEditFieldsError("Add at least one form field.");
      return;
    }
    const missingLabel = editFields.some((f) => !f.label.trim());
    if (missingLabel) {
      setEditFieldsError("Every field needs a label.");
      return;
    }

    editWebinar({ ...form, fields: editFields });
  };

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `webinar-qr-${sharingWebinar?._id}.png`;
    link.click();
  };

  const filterFields: FilterField[] = [
    { type: "input", name: "search", placeholder: "Search by title..." },
    {
      type: "select",
      name: "status",
      placeholder: "All Status",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
        { label: "Closed", value: "closed" },
      ],
    },
  ];

  const columns = [
    {
      key: "title",
      label: "Title",
      render: (w: Webinar) => <span className="font-medium text-gray-700">{w.title}</span>,
    },
    {
      key: "date",
      label: "Date",
      render: (w: Webinar) => new Date(w.date).toLocaleDateString(),
    },
    {
      key: "status",
      label: "Status",
      render: (w: Webinar) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyles[w.status] || statusStyles.draft}`}>
          {w.status}
        </span>
      ),
    },
    {
      key: "registrationsCount",
      label: "Registrations",
      render: (w: Webinar) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/webinars/${w._id}/registrations`);
          }}
          className="flex items-center gap-1 text-indigo-600 hover:underline"
        >
          <Users size={14} />
          {w.registrationsCount ?? 0}
        </button>
      ),
    },
  ];

  const actions = [
    {
      icon: <Link2 size={15} />,
      label: "Share Link",
      onClick: (w: Webinar) => setSharingWebinar(w),
    },
    ...(isAdmin
      ? [
        {
          icon: <Copy size={15} />,
          label: "Duplicate",
          onClick: (w: Webinar) => copyWebinar(w._id),
        },
        {
          icon: <Pencil size={15} />,
          label: "Edit",
          onClick: (w: Webinar) => openEditModal(w),
        },
        {
          icon: <Trash2 size={15} />,
          label: "Delete",
          className: "hover:bg-red-50 hover:text-red-500",
          onClick: (w: Webinar) => setDeletingWebinar(w),
        },
      ]
      : []),
  ];

  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin", "sales_manager"]}>
      <PageHeader
        title="Webinars"
        subtitle="Manage all your webinars and registrations"
        titleIcon={<Video size={22} className="text-indigo-500" />}
        onAdd={isAdmin ? openCreateModal : undefined}
        filters={filters}
        setFilters={setFilters}
        filterFields={filterFields}
      />

      <DynamicTable
        data={webinars}
        isLoading={isLoading}
        isError={isError}
        columns={columns}
        actions={actions}
        currentPage={currentPage}
        pageSize={filters.limit}
        totalPages={totalPages}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        onRowClick={(w: Webinar) => router.push(`/dashboard/webinars/${w._id}/registrations`)}
      />

      {deletingWebinar && (
        <Popup
          isOpen={!!deletingWebinar}
          onClose={() => setDeletingWebinar(null)}
          onConfirm={() => removeWebinar(deletingWebinar._id)}
          variant="danger"
          title="Delete Webinar"
          description={
            <>
              Are you sure you want to delete{" "}
              <span className="font-bold text-red-500">{deletingWebinar.title}</span>? This cannot be undone.
            </>
          }
          confirmText="Yes, Delete"
          isLoading={isDeleting}
          loadingText="Deleting..."
        />
      )}

      {/* ── Create Webinar Modal ── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        title="Create Webinar"
        subtitle="Fill in the webinar details and build the registration form."
        fields={MODAL_FIELDS}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
        mode="add"
      >
        {createFieldsError && (
          <div className="bg-red-50 text-red-700 text-sm rounded-md px-4 py-2 mb-2">
            {createFieldsError}
          </div>
        )}
        <FieldBuilder fields={newFields} onChange={setNewFields} />
      </Modal>

      {/* ── Edit Webinar Modal ── */}
      {isEditOpen && !isLoadingWebinar && (
        <Modal
          key={editingId}
          isOpen={isEditOpen}
          onClose={closeEditModal}
          title="Edit Webinar"
          subtitle="Update the webinar details and registration form."
          fields={MODAL_FIELDS}
          initialValues={editInitialValues}
          onSubmit={handleEditSubmit}
          isLoading={isUpdating}
          mode="edit"
        >
          {editFieldsError && (
            <div className="bg-red-50 text-red-700 text-sm rounded-md px-4 py-2 mb-2">
              {editFieldsError}
            </div>
          )}
          <FieldBuilder fields={editFields} onChange={setEditFields} />
        </Modal>
      )}

      {sharingWebinar && (
        <Popup
          isOpen={!!sharingWebinar}
          onClose={() => setSharingWebinar(null)}
          variant="info"
          title="Share Webinar"
          description={
            <div className="flex flex-col items-center gap-4 py-2 w-full">
              <div ref={qrRef} className="relative group">
                <QRCodeCanvas value={getPublicLink(sharingWebinar._id)} size={180} />
                <button
                  onClick={handleDownloadQR}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Download size={22} className="text-white" />
                </button>

                
              </div>

              <div className="flex items-center gap-2 border rounded-md px-3 py-2 w-full">
                <input
                  readOnly
                  value={getPublicLink(sharingWebinar._id)}
                  className="flex-1 text-xs text-gray-600 outline-none bg-transparent"
                />
                <button onClick={() => handleCopyLink(sharingWebinar._id)} className="text-xs font-medium text-indigo-600 hover:underline">
                  Copy
                </button>
              </div>
            </div>
          }
          confirmText="Done"
          onConfirm={() => setSharingWebinar(null)}
        />
      )}
    </ ProtectedRoute>
  );
}

// "use client";
// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { getWebinars, deleteWebinar } from "@/utils/api";
// import { Plus, Pencil, Trash2, Users } from "lucide-react";

// export default function WebinarsPage() {
//   const [webinars, setWebinars] = useState([]);
//   const [loading, setLoading] = useState(true);

//   const fetchWebinars = async () => {
//     setLoading(true);
//     try {
//       const res = await getWebinars();
//       setWebinars(res.data);
//     } catch (err) {
//       console.error("Failed to load webinars", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchWebinars();
//   }, []);

//   const handleDelete = async (id) => {
//     if (!confirm("Delete this webinar? This cannot be undone.")) return;
//     try {
//       await deleteWebinar(id);
//       setWebinars((prev) => prev.filter((w) => w._id !== id));
//     } catch (err) {
//       console.error("Delete failed", err);
//     }
//   };

//   const statusBadge = (status) => {
//     const styles = {
//       draft: "bg-gray-100 text-gray-700",
//       published: "bg-green-100 text-green-700",
//       closed: "bg-red-100 text-red-700",
//     };
//     return (
//       <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.draft}`}>
//         {status}
//       </span>
//     );
//   };

//   return (
//     <div className="p-6">
//       <div className="flex items-center justify-between mb-6">
//         <h1 className="text-xl font-semibold text-navy-900">Webinars</h1>
//         <Link
//           href="/dashboard/webinars/create"
//           className="flex items-center gap-2 bg-navy-900 text-gold-500 px-4 py-2 rounded-md hover:opacity-90"
//         >
//           <Plus size={16} />
//           Create Webinar
//         </Link>
//       </div>

//       {loading ? (
//         <p className="text-gray-500">Loading...</p>
//       ) : webinars.length === 0 ? (
//         <p className="text-gray-500">No webinars yet. Create your first one.</p>
//       ) : (
//         <table className="w-full border-collapse bg-white rounded-lg shadow-sm overflow-hidden">
//           <thead>
//             <tr className="bg-gray-50 text-left text-sm text-gray-600">
//               <th className="p-3">Title</th>
//               <th className="p-3">Date</th>
//               <th className="p-3">Status</th>
//               <th className="p-3">Registrations</th>
//               <th className="p-3 text-right">Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {webinars.map((w) => (
//               <tr key={w._id} className="border-t text-sm">
//                 <td className="p-3 font-medium">{w.title}</td>
//                 <td className="p-3">{new Date(w.date).toLocaleDateString()}</td>
//                 <td className="p-3">{statusBadge(w.status)}</td>
//                 <td className="p-3">
//                   <Link
//                     href={`/dashboard/webinars/${w._id}/registrations`}
//                     className="flex items-center gap-1 text-navy-700 hover:underline"
//                   >
//                     <Users size={14} />
//                     {w.registrationsCount ?? 0}
//                   </Link>
//                 </td>
//                 <td className="p-3 text-right space-x-3">
//                   <Link href={`/dashboard/webinars/${w._id}`} className="text-gray-600 hover:text-navy-900 inline-block">
//                     <Pencil size={16} />
//                   </Link>
//                   <button onClick={() => handleDelete(w._id)} className="text-red-500 hover:text-red-700">
//                     <Trash2 size={16} />
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       )}
//     </div>
//   );
// }
// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { Link2 } from "lucide-react";
// import { QRCodeCanvas } from "qrcode.react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { getWebinars, getWebinar, createWebinar, updateWebinar, deleteWebinar } from "@/utils/api";
// import PageHeader, { FilterField } from "@/app/component/dashboard/page-header";
// import Popup from "@/app/component/ui/popup/popup";
// import { ModalField } from "@/types/ui";
// import { Pencil, Trash2, Users, Video } from "lucide-react";
// import toast from "react-hot-toast";
// import DynamicTable from "@/app/component/dashboard/dynamic-table";
// import FieldBuilder from "./components/field-builder";
// import Modal from "@/app/component/ui/model/modal";
// import ProtectedRoute from "@/app/component/protected-route";

// type WebinarStatus = "draft" | "published" | "closed";
// type FieldType = "text" | "email" | "phone" | "number" | "date" | "textarea" | "select" | "checkbox";

// interface WebinarField {
//   fieldKey: string;
//   label: string;
//   type: FieldType;
//   required: boolean;
//   options: string[];
//   order: number;
// }

// interface Webinar {
//   _id: string;
//   title: string;
//   description?: string;
//   date: string;
//   status: WebinarStatus;
//   fields: WebinarField[];
//   registrationsCount?: number;
// }

// const statusStyles: Record<WebinarStatus, string> = {
//   draft: "bg-gray-100 text-gray-700",
//   published: "bg-green-100 text-green-700",
//   closed: "bg-red-100 text-red-700",
// };

// const MODAL_FIELDS: ModalField[] = [
//   {
//     name: "title",
//     label: "Title",
//     type: "input",
//     placeholder: "e.g. Intro to Digital Marketing",
//     required: true,
//   },
//   {
//     name: "description",
//     label: "Description",
//     type: "textarea",
//     placeholder: "Short summary shown on the registration page",
//   },
//   {
//     name: "date",
//     label: "Date",
//     type: "input",
//     inputType: "datetime-local",
//     required: true,
//   },
//   {
//     name: "status",
//     label: "Status",
//     type: "select",
//     defaultValue: "draft",
//     options: [
//       { value: "draft", label: "Draft" },
//       { value: "published", label: "Published" },
//       { value: "closed", label: "Closed" },
//     ],
//   },
// ];

// export default function WebinarsPage() {
//   const router = useRouter();
//   const queryClient = useQueryClient();

//   const [filters, setFilters] = useState({
//     search: "",
//     status: "",
//     page: 1,
//     limit: 10,
//   });

//   const [deletingWebinar, setDeletingWebinar] = useState<Webinar | null>(null);

//   // ── Create modal state ──
//   const [isCreateOpen, setIsCreateOpen] = useState(false);
//   const [newFields, setNewFields] = useState<WebinarField[]>([]);
//   const [createFieldsError, setCreateFieldsError] = useState("");
//   const [refName, setRefName] = useState("");

//   // ── Edit modal state ──
//   const [isEditOpen, setIsEditOpen] = useState(false);
//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [editInitialValues, setEditInitialValues] = useState<Record<string, string | boolean>>({});
//   const [editFields, setEditFields] = useState<WebinarField[]>([]);
//   const [editFieldsError, setEditFieldsError] = useState("");
//   const [isLoadingWebinar, setIsLoadingWebinar] = useState(false);
//   const [sharingWebinar, setSharingWebinar] = useState<Webinar | null>(null);
//   const [customTitle, setCustomTitle] = useState("");

//   // ── Fetch webinars ──
//   const { data, isLoading, isError } = useQuery({
//     queryKey: ["webinars", filters],
//     queryFn: () => getWebinars().then((r) => r.data),
//   });

//   const webinars: Webinar[] = data?.data ?? [];
//   const totalPages = data?.meta?.totalPages ?? 1;
//   const currentPage = data?.meta?.page ?? filters.page;

//   // ── Delete webinar ──
//   const { mutate: removeWebinar, isPending: isDeleting } = useMutation({
//     mutationFn: (id: string) => deleteWebinar(id),
//     onSuccess: () => {
//       toast.success("Webinar deleted ✅");
//       queryClient.invalidateQueries({ queryKey: ["webinars"] });
//       setDeletingWebinar(null);
//     },
//     onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to delete webinar"),
//   });

//   // ── Create webinar ──
//   const { mutate: addWebinar, isPending: isCreating } = useMutation({
//     mutationFn: (payload: Record<string, any>) => createWebinar(payload),
//     onSuccess: () => {
//       toast.success("Webinar created ✅");
//       queryClient.invalidateQueries({ queryKey: ["webinars"] });
//       closeCreateModal();
//     },
//     onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to create webinar"),
//   });

//   // ── Update webinar ──
//   const { mutate: editWebinar, isPending: isUpdating } = useMutation({
//     mutationFn: (payload: Record<string, any>) => updateWebinar(editingId as string, payload),
//     onSuccess: () => {
//       toast.success("Webinar updated ✅");
//       queryClient.invalidateQueries({ queryKey: ["webinars"] });
//       closeEditModal();
//     },
//     onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to update webinar"),
//   });

//   // ── Create modal handlers ──
//   const openCreateModal = () => {
//     setNewFields([]);
//     setCreateFieldsError("");
//     setIsCreateOpen(true);
//   };

//   const closeCreateModal = () => {
//     setIsCreateOpen(false);
//     setNewFields([]);
//     setCreateFieldsError("");
//   };

//   // const getPublicLink = (id: string, ref?: string) => {
//   //   const base = `${process.env.NEXT_PUBLIC_SITE_URL}/webinars/register/${id}`;
//   //   return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base;
//   // };

//   // const handleCopyLink = (id: string, ref?: string) => {
//   //   navigator.clipboard.writeText(getPublicLink(id, ref));
//   //   toast.success("Link copied ✅");
//   // };

//   const getPublicLink = (id: string, ref?: string, title?: string) => {
//     const base = `${process.env.NEXT_PUBLIC_SITE_URL}/webinars/${id}`;
//     const params = new URLSearchParams();
//     if (ref) params.set("ref", ref);
//     if (title) params.set("title", title);
//     const query = params.toString();
//     return query ? `${base}?${query}` : base;
//   };

//   const handleCopyLink = (id: string, ref?: string, title?: string) => {
//     navigator.clipboard.writeText(getPublicLink(id, ref, title));
//     toast.success("Link copied ✅");
//   };

//   const handleCreateSubmit = (form: Record<string, string | boolean>) => {
//     setCreateFieldsError("");

//     if (newFields.length === 0) {
//       setCreateFieldsError("Add at least one form field.");
//       return;
//     }
//     const missingLabel = newFields.some((f) => !f.label.trim());
//     if (missingLabel) {
//       setCreateFieldsError("Every field needs a label.");
//       return;
//     }

//     addWebinar({ ...form, fields: newFields });
//   };

//   // ── Edit modal handlers ──
//   const openEditModal = async (webinar: Webinar) => {
//     setEditingId(webinar._id);
//     setEditFieldsError("");
//     setIsLoadingWebinar(true);
//     setIsEditOpen(true);

//     try {
//       const res = await getWebinar(webinar._id);
//       const w: Webinar = res.data;

//       setEditInitialValues({
//         title: w.title || "",
//         description: w.description || "",
//         // convert ISO date to what datetime-local input expects
//         date: w.date ? new Date(w.date).toISOString().slice(0, 16) : "",
//         status: w.status || "draft",
//       });
//       setEditFields(w.fields || []);
//       setIsEditOpen(true);
//     } catch (err) {
//       toast.error("Failed to load webinar details");
//       // setIsEditOpen(false);
//     } finally {
//       setIsLoadingWebinar(false);
//     }
//   };

//   const closeEditModal = () => {
//     setIsEditOpen(false);
//     setEditingId(null);
//     setEditInitialValues({});
//     setEditFields([]);
//     setEditFieldsError("");
//   };

//   const handleEditSubmit = (form: Record<string, string | boolean>) => {
//     setEditFieldsError("");

//     if (editFields.length === 0) {
//       setEditFieldsError("Add at least one form field.");
//       return;
//     }
//     const missingLabel = editFields.some((f) => !f.label.trim());
//     if (missingLabel) {
//       setEditFieldsError("Every field needs a label.");
//       return;
//     }

//     editWebinar({ ...form, fields: editFields });
//   };

//   const filterFields: FilterField[] = [
//     { type: "input", name: "search", placeholder: "Search by title..." },
//     {
//       type: "select",
//       name: "status",
//       placeholder: "All Status",
//       options: [
//         { label: "Draft", value: "draft" },
//         { label: "Published", value: "published" },
//         { label: "Closed", value: "closed" },
//       ],
//     },
//   ];

//   const columns = [
//     {
//       key: "title",
//       label: "Title",
//       render: (w: Webinar) => <span className="font-medium text-gray-700">{w.title}</span>,
//     },
//     {
//       key: "date",
//       label: "Date",
//       render: (w: Webinar) => new Date(w.date).toLocaleDateString(),
//     },
//     {
//       key: "status",
//       label: "Status",
//       render: (w: Webinar) => (
//         <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyles[w.status] || statusStyles.draft}`}>
//           {w.status}
//         </span>
//       ),
//     },
//     {
//       key: "registrationsCount",
//       label: "Registrations",
//       render: (w: Webinar) => (
//         <button
//           onClick={(e) => {
//             e.stopPropagation();
//             router.push(`/dashboard/webinars/${w._id}/registrations`);
//           }}
//           className="flex items-center gap-1 text-indigo-600 hover:underline"
//         >
//           <Users size={14} />
//           {w.registrationsCount ?? 0}
//         </button>
//       ),
//     },
//   ];

//   const actions = [
//     {
//       icon: <Link2 size={15} />,
//       label: "Share Link",
//       onClick: (w: Webinar) => setSharingWebinar(w),
//     },
//     {
//       icon: <Pencil size={15} />,
//       label: "Edit",
//       onClick: (w: Webinar) => openEditModal(w),
//     },
//     {
//       icon: <Trash2 size={15} />,
//       label: "Delete",
//       className: "hover:bg-red-50 hover:text-red-500",
//       onClick: (w: Webinar) => setDeletingWebinar(w),
//     },
//   ];

//   return (
//     <ProtectedRoute allowedRoles={["admin", "super_admin",]}>
//       <PageHeader
//         title="Webinars"
//         subtitle="Manage all your webinars and registrations"
//         titleIcon={<Video size={22} className="text-indigo-500" />}
//         onAdd={openCreateModal}
//         filters={filters}
//         setFilters={setFilters}
//         filterFields={filterFields}
//       />

//       <DynamicTable
//         data={webinars}
//         isLoading={isLoading}
//         isError={isError}
//         columns={columns}
//         actions={actions}
//         currentPage={currentPage}
//         pageSize={filters.limit}
//         totalPages={totalPages}
//         onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
//         onRowClick={(w: Webinar) => router.push(`/dashboard/webinars/${w._id}/registrations`)}
//       />

//       {deletingWebinar && (
//         <Popup
//           isOpen={!!deletingWebinar}
//           onClose={() => setDeletingWebinar(null)}
//           onConfirm={() => removeWebinar(deletingWebinar._id)}
//           variant="danger"
//           title="Delete Webinar"
//           description={
//             <>
//               Are you sure you want to delete{" "}
//               <span className="font-bold text-red-500">{deletingWebinar.title}</span>? This cannot be undone.
//             </>
//           }
//           confirmText="Yes, Delete"
//           isLoading={isDeleting}
//           loadingText="Deleting..."
//         />
//       )}

//       {/* ── Create Webinar Modal ── */}
//       <Modal
//         isOpen={isCreateOpen}
//         onClose={closeCreateModal}
//         title="Create Webinar"
//         subtitle="Fill in the webinar details and build the registration form."
//         fields={MODAL_FIELDS}
//         onSubmit={handleCreateSubmit}
//         isLoading={isCreating}
//         mode="add"
//       >
//         {createFieldsError && (
//           <div className="bg-red-50 text-red-700 text-sm rounded-md px-4 py-2 mb-2">
//             {createFieldsError}
//           </div>
//         )}
//         <FieldBuilder fields={newFields} onChange={setNewFields} />
//       </Modal>

//       {/* ── Edit Webinar Modal ── */}
//       {isEditOpen && !isLoadingWebinar && (
//         <Modal
//           key={editingId}
//           isOpen={isEditOpen}
//           onClose={closeEditModal}
//           title="Edit Webinar"
//           subtitle="Update the webinar details and registration form."
//           fields={MODAL_FIELDS}
//           initialValues={editInitialValues}
//           onSubmit={handleEditSubmit}
//           isLoading={isUpdating}
//           mode="edit"
//         >
//           {editFieldsError && (
//             <div className="bg-red-50 text-red-700 text-sm rounded-md px-4 py-2 mb-2">
//               {editFieldsError}
//             </div>
//           )}
//           <FieldBuilder fields={editFields} onChange={setEditFields} />
//         </Modal>
//       )}

//       {sharingWebinar && (
//         <Popup
//           isOpen={!!sharingWebinar}
//           onClose={() => { setSharingWebinar(null); setRefName(""); setCustomTitle(""); }}
//           variant="info"
//           title="Share Webinar"
//           description={
//             <div className="flex flex-col items-center gap-4 py-2 w-full">

//               <QRCodeCanvas value={getPublicLink(sharingWebinar._id, refName, customTitle)} size={180} />
//               <input
//                 type="text"
//                 placeholder="Title"
//                 value={customTitle}
//                 onChange={(e) => setCustomTitle(e.target.value)}
//                 className="w-full border rounded-md px-3 py-2 text-sm"
//               />

//               <input
//                 type="text"
//                 placeholder="Your Name"
//                 value={refName}
//                 onChange={(e) => setRefName(e.target.value)}
//                 className="w-full border rounded-md px-3 py-2 text-sm"
//               />

//               <div className="flex items-center gap-2 border rounded-md px-3 py-2 w-full">
//                 <input
//                   readOnly
//                   value={getPublicLink(sharingWebinar._id, refName, customTitle)}
//                   className="flex-1 text-xs text-gray-600 outline-none bg-transparent"
//                 />
//                 <button onClick={() => handleCopyLink(sharingWebinar._id, refName, customTitle)} className="text-xs font-medium text-indigo-600 hover:underline">
//                   Copy
//                 </button>
//               </div>
//             </div>
//           }
//           confirmText="Done"
//           onConfirm={() => { setSharingWebinar(null); setRefName(""); setCustomTitle(""); }}
//         />
//       )}
//     </ ProtectedRoute>
//   );
// }