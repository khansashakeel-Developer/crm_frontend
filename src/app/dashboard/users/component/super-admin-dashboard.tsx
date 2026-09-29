"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminGetAllUsers,
  adminUpdateUser,
  adminDeleteUser,
  adminDeleteAllUsers,
  adminCreateUser,
  adminAssignRole,
  adminUpdateUserPassword,
} from "@/utils/api";
import { User, UsersResponse } from "@/types/apiType";
import ProtectedRoute from "@/app/component/protected-route";
import toast from "react-hot-toast";
import { Pencil, Trash2, UserCog, ChevronLeft, ChevronRight, CheckCircle as CheckIcon } from "lucide-react";
import Modal from "@/app/component/ui/model/modal";
import { ModalField } from "@/types/ui";
import Popup from "@/app/component/ui/popup/popup";
import PageHeader from "@/app/component/dashboard/page-header";
import DynamicTable from "@/app/component/dashboard/dynamic-table";
import ExportButton from "@/app/component/ui/export-button";

// ── Add User Fields ──
const addUserFields: ModalField[] = [
  { name: "name", label: "Name", type: "input", inputType: "text", placeholder: "Enter name" },
  { name: "email", label: "Email", type: "input", inputType: "email", placeholder: "Enter email" },
  { name: "phone", label: "Phone", type: "input", inputType: "text", placeholder: "Enter phone" },
  { name: "password", label: "Password", type: "input", inputType: "password", placeholder: "Enter password" },
  {
    name: "role", label: "Role", type: "select",
    options: [
      { label: "User", value: "user" },
      { label: "Super Admin", value: "super_admin" },
      { label: "Admin", value: "admin" },
      { label: "Sales Manager", value: "sales_manager" },
      { label: "Sales Rep", value: "sales_rep" },
      { label: "Support", value: "support" },
      { label: "Instructor", value: "instructor" },
      { label: "Finance Manager", value: "finance_manager" },
      { label: "SEO", value: "seo" },
    ],
  },
];

// ── Role color helper ──
const roleColor = (role: string) => {
  switch (role) {
    case "super_admin": return "bg-yellow-100 text-yellow-700";
    case "admin": return "bg-blue-100 text-blue-700";
    case "sales_manager": return "bg-indigo-100 text-indigo-700";
    case "sales_rep": return "bg-teal-100 text-teal-700";
    case "support": return "bg-pink-100 text-pink-700";
    case "instructor": return "bg-purple-100 text-purple-700";
    case "finance_manager": return "bg-green-100 text-green-700";
    case "seo": return "bg-orange-100 text-orange-700";
    default: return "bg-gray-100 text-gray-600";
  }
};

export default function UsersPage() {
  const queryClient = useQueryClient();

  const [editingUser, setEditingUser] = useState<User | null>(null);
  // const [deletingId, setDeletingId] = useState<string | null>(null);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  // ── Filters ──
  const [filters, setFilters] = useState({ search: "", role: "", QboLense: false });

  // ── Fetch Users ──
  const { data, isLoading, isError } = useQuery<UsersResponse>({
    queryKey: ["admin-users", page, filters.search, filters.role],
    queryFn: () =>
      adminGetAllUsers({
        page,
        limit,
        search: filters.search || undefined,
        role: filters.role || undefined,
      }).then((res) => res.data),
  });

  // ── Add User ──
  const { mutate: addUser, isPending: isAdding } = useMutation({
    mutationFn: (data: any) => adminCreateUser(data),
    onSuccess: () => {
      toast.success("User created successfully!");
      setIsAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || "Failed to create user!"),
  });

  // ── Update User ──
  const { mutate: updateUser, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminUpdateUser(id, data),
    onSuccess: () => {
      toast.success("User updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingUser(null);
    },
    onError: () => toast.error("Failed to update user!"),
  });

  // ── Change Password ──
  const { mutate: changePassword } = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      adminUpdateUserPassword(id, password),
    onSuccess: () => {
      toast.success("Password updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingUser(null);
    },
    onError: () => toast.error("Failed to update password!"),
  });

  // ── Assign Role ──
  const { mutate: assignRole, isPending: isAssigningRole } = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => adminAssignRole(id, role),
    onSuccess: () => {
      toast.success("Role updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingUser(null);
    },
    onError: () => toast.error("Failed to update role!"),
  });

  // ── Delete User ──
  const { mutate: deleteUser, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => adminDeleteUser(id),
    onSuccess: () => {
      toast.success("User deleted!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeletingUser(null);  // ← setDeletingId(null) se replace karo
    },
    onError: () => toast.error("Failed to delete user!"),
  });

  // ── Delete All ──
  const { mutate: deleteAll, isPending: isDeletingAll } = useMutation({
    mutationFn: () => adminDeleteAllUsers(),
    onSuccess: () => {
      toast.success("All users deleted!");
      setShowDeleteAll(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Failed to delete all users!"),
  });

  // ── Reset page on filter change ──
  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  return (
    <ProtectedRoute>
      {/* Header */}
      <PageHeader
        title="Users"
        subtitle="Manage all users and their roles"
        titleIcon={<UserCog size={24} />}
        totalCount={data?.total ?? 0}
        onAdd={() => setIsAddOpen(true)}
        // onDeleteAll={() => setShowDeleteAll(true)}
        filters={filters}
        setFilters={setFilters}
        filterFields={[
          {
            type: "input",
            name: "search",
            placeholder: "Search by name or email...",
          },
          // {
          //   type: "select",
          //   name: "role",
          //   placeholder: "All Roles",
          //   options: [
          //     { label: "Admin", value: "admin" },
          //     { label: "Sales Manager", value: "sales_manager" },
          //     { label: "Sales Rep", value: "sales_rep" },
          //     { label: "Support", value: "support" },
          //     { label: "Instructor", value: "instructor" },
          //     { label: "Finance Manager", value: "finance_manager" },
          //     { label: "SEO", value: "seo" },
          //     { label: "User", value: "user" },
          //   ],
          // },
        ]}
        exportBtn={
          <div className="flex items-center gap-2">
            <ExportButton
              filename="users"
              label="Export Excel"
              fetchData={async () => {
                const res = await adminGetAllUsers({ limit: 10000 });
                return res.data.users;
              }}
              columns={[
                { header: "User Id", key: "_id" },
                { header: "Name", key: "name" },
                { header: "Email", key: "email" },
                { header: "Phone", key: "phone" },
                { header: "Role", key: "role" },
                { header: "Source", key: "source" },
                { header: "Verified", key: "isVerified", format: (v) => v ? "Yes" : "No" },
                { header: "Active", key: "isActive", format: (v) => v ? "Yes" : "No" },
                { header: "Paid", key: "isPaid", format: (v) => v ? "Yes" : "No" },
                { header: "Last Login", key: "lastLogin", format: (v) => v ? new Date(v).toLocaleDateString("en-PK") : "—" },
                { header: "Created At", key: "createdAt", format: (v) => v ? new Date(v).toLocaleDateString("en-PK") : "—" },
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

      {/* Table */}
        <DynamicTable
        data={data?.users || []}
        isLoading={isLoading}
        isError={isError}
        currentPage={page}
        pageSize={limit}
        totalPages={data?.totalPages}
        onPageChange={(newPage) => setPage(newPage)}
        columns={
          filters.QboLense
            ? [
              {
                key: "name",
                label: "Name",
                render: (user: User) => (
                  <div>
                    <p className="font-medium text-gray-800">{user.name}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                ),
              },
              {
                key: "qboCustomerId",
                label: "QBO Customer Id",
                render: (user: any) => (
                  <span className="font-mono text-xs text-gray-600">{user.qboCustomerId || "—"}</span>
                ),
              },
              {
                key: "qboSyncStatus",
                label: "Sync Status",
                render: (user: any) => {
                  const status = user.qboSyncStatus || "pending";
                  const map: Record<string, string> = {
                    synced: "bg-green-100 text-green-700",
                    failed: "bg-rose-100 text-rose-700",
                    pending: "bg-yellow-100 text-yellow-700",
                    skipped: "bg-gray-100 text-gray-600",
                  };
                  return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${map[status] || map.pending}`}>
                      {status}
                    </span>
                  );
                },
              },
              {
                key: "qboLastSyncedAt",
                label: "Last Synced",
                render: (user: any) => (
                  <span className="text-gray-400 text-sm">
                    {user.qboLastSyncedAt ? new Date(user.qboLastSyncedAt).toLocaleString("en-PK") : "—"}
                  </span>
                ),
              },
              {
                key: "qboSyncError",
                label: "Sync Error",
                render: (user: any) => (
                  <span className="text-rose-500 text-xs max-w-[220px] truncate block" title={user.qboSyncError || ""}>
                    {user.qboSyncError || "—"}
                  </span>
                ),
              },
            ]
            : [
              {
                key: "name",
                label: "Name",
                render: (user) => (
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-xs flex-shrink-0"
                      style={{ background: user?.avatarColor, opacity: 0.85 }}
                    >
                      {user.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800">{user.name}</span>
                    <span className="font-medium text-green-500">{user._id}</span>
                  </div>
                ),
              },
              {
                key: "email",
                label: "Email",
                render: (user) => <span className="text-gray-500">{user.email}</span>,
              },
              {
                key: "phone",
                label: "Phone",
                render: (user) => <span className="text-gray-500">{user.phone}</span>,
              },
              {
                key: "role",
                label: "Role",
                render: (user) => (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColor(user?.role)}`}>
                    {user.role}
                  </span>
                ),
              },
              {
                key: "createdAt",
                label: "Joined",
                render: (user) => (
                  <span className="text-gray-400 text-sm">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                ),
              },
            ]}
        actions={[
          {
            icon: <Pencil size={14} />,
            label: "Edit",
            onClick: (user) => setEditingUser(user),
            disabled: (user: User) => user.role === "super_admin",
            className: "hover:bg-blue-50 hover:text-blue-500",
          },
          {
            icon: <Trash2 size={14} />,
            label: "Delete",
            onClick: (user) => setDeletingUser(user),
            disabled: (user: User) => user.role === "super_admin",
            className: "hover:bg-red-50 hover:text-red-500",
          },
        ]}
      />

      {/* Pagination */}
      {/* {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-between mt-8">
          <p className="text-xs text-gray-400">
            Page <span className="font-semibold text-gray-700">{page}</span> of{" "}
            <span className="font-semibold text-gray-700">{data?.totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data?.totalPages || 1, p + 1))}
              disabled={page === data?.totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )} */}

      {/* Add User Modal */}
      <Modal
        key={isAddOpen ? "open" : "closed"}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New User"
        fields={addUserFields}
        onSubmit={(data) => addUser(data)}
        isLoading={isAdding}
        mode="add"
      />

      {/* Edit Modal — 3 tabs */}
      {editingUser && (
        <Modal

          key={editingUser._id}
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          title="Edit User"
          subtitle={editingUser.name}
          fields={[]}
          onSubmit={() => { }}
          isLoading={isUpdating || isAssigningRole}
          mode="edit"
          initialValues={{
            name: editingUser.name,
            email: editingUser.email,
            phone: editingUser.phone || "",
            role: editingUser.role,
            newPassword: "",
          }}
          tabs={[
            {
              key: "general",
              label: "General",
              fields: [
                { name: "name", label: "Name", type: "input", inputType: "text" },
                { name: "email", label: "Email", type: "input", inputType: "email" },
                { name: "phone", label: "Phone", type: "input", inputType: "text", placeholder: "Enter phone" },
              ],
              onSubmit: (data) => updateUser({
                id: editingUser._id, data: {
                  name: data.name as string,
                  phone: data.phone as string,
                  email: data.email as string,
                },
              }),
            },
            {
              key: "role",
              label: "Role",
              fields: [
                { name: "name", label: "Name", type: "input", inputType: "text", disabled: true },
                { name: "email", label: "Email", type: "input", inputType: "email", disabled: true },
                {
                  name: "role", label: "Role", type: "select",
                  options: [
                    { label: "Admin", value: "admin" },
                    { label: "Sales Manager", value: "sales_manager" },
                    { label: "Sales Rep", value: "sales_rep" },
                    { label: "Support", value: "support" },
                    { label: "Instructor", value: "instructor" },
                    { label: "Finance Manager", value: "finance_manager" },
                    { label: "SEO", value: "seo" },
                    { label: "User", value: "user" },
                  ],
                },
              ],
              onSubmit: (data) => assignRole({ id: editingUser._id, role: data.role as string }),
            },
            {
              key: "security",
              label: "Security",
              fields: [
                {
                  name: "newPassword",
                  label: "New Password",
                  type: "input",
                  inputType: "password",
                  placeholder: "Enter new password",
                  autoComplete: "new-password",
                },
              ],
              onSubmit: (data) => changePassword({ id: editingUser._id, password: data.newPassword as string }),
            },
          ]}
        />
      )}

      {/* Delete All Popup */}
      {showDeleteAll && (
        <Popup
          isOpen={showDeleteAll}
          onClose={() => setShowDeleteAll(false)}
          onConfirm={() => deleteAll()}
          variant="danger"
          title="Delete All Users"
          description={
            <>
              Are you sure you want to delete{" "}
              <span className="font-bold text-red-500">all users</span>? This cannot be undone.
            </>
          }
          confirmText="Yes, Delete All"
          isLoading={isDeletingAll}
          loadingText="Deleting..."
        />
      )}

      {deletingUser && (
        <Popup
          isOpen={!!deletingUser}
          onClose={() => setDeletingUser(null)}
          onConfirm={() => {
            deleteUser(deletingUser._id);
            setDeletingUser(null);
          }}
          variant="danger"
          title="Delete User"
          description={
            <>
              Delete{" "}
              <span className="font-bold text-red-500">
                {deletingUser.name}
              </span>
              ? This cannot be undone.
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