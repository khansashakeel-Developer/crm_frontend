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
  getAllUsersForRole
} from "@/utils/api";
import { User, UsersResponse } from "@/types/apiType";
import ProtectedRoute from "@/app/component/protected-route";
import toast from "react-hot-toast";
import { Pencil, UserCog, CheckCircle as CheckIcon } from "lucide-react";
import Modal from "@/app/component/ui/model/modal";
import { ModalField } from "@/types/ui";
import Popup from "@/app/component/ui/popup/popup";
import PageHeader from "@/app/component/dashboard/page-header";
import DynamicTable from "@/app/component/dashboard/dynamic-table";
import ExportButton from "@/app/component/ui/export-button";
import ImportButton from "@/app/dashboard/users/component/import-button";

const qboSyncStyles: Record<string, string> = {
  synced: "bg-green-100 text-green-700",
  failed: "bg-rose-100 text-rose-700",
  pending: "bg-yellow-100 text-yellow-700",
  skipped: "bg-gray-100 text-gray-600",
};

const qboColumns = [
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
      return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${qboSyncStyles[status] || qboSyncStyles.pending}`}>
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
];

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
      { label: "Sales Rep", value: "sales_rep" },
    ],
  }
];

// ── Role color helper ──
const roleColor = (role: string) => {
  switch (role) {
    case "sales_rep": return "bg-teal-100 text-teal-700";
    default: return "bg-gray-100 text-gray-600";
  }
};

export default function FinanceManagerDashboard() {
  const queryClient = useQueryClient();

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  // ── Filters ──
  const [filters, setFilters] = useState({ search: "", role: "", QboLense: false });

  // ── Fetch Users ──
  const { data, isLoading, isError } = useQuery<UsersResponse>({
    queryKey: ["sales-manager-users", page, filters.search, filters.role],
    queryFn: () =>
      adminGetAllUsers({
        page,
        limit,
        search: filters.search || undefined,
        role: filters.role || undefined,
      }).then((res) => res.data),
  });
  //   const { data, isLoading, isError } = useQuery<UsersResponse>({
  //   queryKey: ["role-users"],
  //   queryFn: () => getAllUsersForRole().then((res) => res.data),
  // });

  // ── Add User ──
  const { mutate: addUser, isPending: isAdding } = useMutation({
    mutationFn: (data: any) => adminCreateUser(data),
    onSuccess: () => {
      toast.success("User created successfully!");
      setIsAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sales-manager-users"] });
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || "Failed to create user!"),
  });

  // ── Update User ──
  const { mutate: updateUser, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminUpdateUser(id, data),
    onSuccess: () => {
      toast.success("User updated!");
      queryClient.invalidateQueries({ queryKey: ["sales-manager-users"] });
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
      queryClient.invalidateQueries({ queryKey: ["sales-manager-users"] });
      setEditingUser(null);
    },
    onError: () => toast.error("Failed to update password!"),
  });

  // ── Assign Role ──
  const { mutate: assignRole, isPending: isAssigningRole } = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => adminAssignRole(id, role),
    onSuccess: () => {
      toast.success("Role updated!");
      queryClient.invalidateQueries({ queryKey: ["sales-manager-users"] });
      setEditingUser(null);
    },
    onError: () => toast.error("Failed to update role!"),
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
        subtitle="View all registered users"
        titleIcon={<UserCog size={24} />}
        totalCount={data?.total ?? 0}
        onAdd={() => setIsAddOpen(true)}
        filters={filters}
        setFilters={setFilters}
        filterFields={[
          {
            type: "input",
            name: "search",
            placeholder: "Search by name or email...",
          },
        ]}
        exportBtn={
          <div className="flex gap-2">
            <ImportButton />
            <ExportButton
              filename="users"
              label="Export Excel"
              fetchData={async () => {
                const res = await adminGetAllUsers({ limit: 10000 });
                return res.data.data;
              }}
              columns={[
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
        columns={filters.QboLense ? qboColumns : [
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
              </div>
            ),
          },
          {
            key: "email",
            label: "Email",
            render: (user) => <span className="text-gray-500">{user.email}</span>,
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
            disabled: (user: User) => user.role === "admin",
            className: "hover:bg-blue-50 hover:text-blue-500",
          },
        ]}
      />

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
            phone: editingUser.phone ?? "",
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
                id: editingUser._id,
                data: {
                  name: data.name as string,
                  email: data.email as string,
                  phone: data.phone as string,
                },
              }),
            },
          ]}
        />
      )}


    </ProtectedRoute>
  );
}