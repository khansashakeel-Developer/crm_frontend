"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    adminGetPrograms, adminCreateProgram, adminUpdateProgram,
    adminDeleteProgram, adminDuplicateProgram
} from "@/utils/api";
import PageHeader from "@/app/component/dashboard/page-header";
import Modal from "@/app/component/ui/model/modal";
import Popup from "@/app/component/ui/popup/popup";
import { ModalField } from "@/types/ui";
import toast from "react-hot-toast";
import { GraduationCap, Pencil, Trash2, Copy, BookMarked, Users, Clock, Star } from "lucide-react";
import CoursesModal from "./courses-modal";
import BatchesModal from "./batches-modal";


const programFields: ModalField[] = [
    { name: "name", label: "Program Name", type: "input", inputType: "text", placeholder: "NLP Practitioner" },
    { name: "short_description", label: "Short Description", type: "input", inputType: "text", placeholder: "Brief description" },
    { name: "description", label: "Description", type: "textarea", placeholder: "Full description..." },
    {
        name: "level", label: "Level", type: "select",
        options: [
            { label: "Level 1", value: "level 1" },
            { label: "Level 2", value: "level 2" },
            { label: "Level 3", value: "level 3" },
            { label: "Level 4", value: "level 4" },
            { label: "Level 5", value: "level 5" },
            { label: "Level 6", value: "level 6" },
        ]
    },
    {
        name: "category", label: "Category", type: "select", defaultValue: "nlp",
        options: [
            { label: "NLP", value: "nlp" },
            { label: "ICF", value: "icf" },
            { label: "Hypnotherapy", value: "hypnotherapy" },
            { label: "Trainer", value: "trainer" },
        ]
    },
    { name: "price", label: "Price", type: "input", inputType: "text", placeholder: "2000" },
    {
        name: "currency", label: "Currency", type: "select", defaultValue: "USD",
        options: [
            { label: "USD", value: "USD" },
            { label: "AUD", value: "AUD" },
            { label: "PKR", value: "PKR" },
        ]
    },
    { name: "duration_weeks", label: "Duration (weeks)", type: "input", inputType: "text", placeholder: "12" },
    {
        name: "status", label: "Status", type: "select", defaultValue: "inactive",
        options: [
            { label: "Active", value: "active" },
            { label: "Draft", value: "draft" },
            { label: "Inactive", value: "inactive" },
        ]
    },
];

const categoryColor = (category: string) => {
    switch (category) {
        case "nlp": return "bg-blue-100 text-blue-700";
        case "icf": return "bg-green-100 text-green-700";
        case "hypnotherapy": return "bg-purple-100 text-purple-700";
        case "trainer": return "bg-orange-100 text-orange-700";
        default: return "bg-gray-100 text-gray-600";
    }
};

const statusColor = (status: string) => {
    switch (status) {
        case "active": return "bg-emerald-100 text-emerald-700";
        case "draft": return "bg-yellow-100 text-yellow-700";
        case "inactive": return "bg-red-100 text-red-700";
        default: return "bg-gray-100 text-gray-600";
    }
};

export default function AdminPrograms() {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingProgram, setEditingProgram] = useState<any>(null);
    const [deletingProgram, setDeletingProgram] = useState<any>(null);
    const [managingCourses, setManagingCourses] = useState<any>(null);
    const [managingBatches, setManagingBatches] = useState<any>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");

    const { data, isLoading, isError } = useQuery({
        queryKey: ["admin-programs", search, statusFilter, categoryFilter],
        queryFn: () => adminGetPrograms({ search, status: statusFilter, category: categoryFilter }).then(res => res.data),
    });

    const { mutate: addProgram, isPending: isAdding } = useMutation({
        mutationFn: (data: any) => adminCreateProgram(data),
        onSuccess: () => {
            toast.success("Program created! ✅");
            setIsAddOpen(false);
            queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Failed!"),
    });

    const { mutate: updateProgram, isPending: isUpdating } = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => adminUpdateProgram(id, data),
        onSuccess: () => {
            toast.success("Program updated! ✅");
            setEditingProgram(null);
            queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
        },
        onError: () => toast.error("Failed!"),
    });

    const { mutate: deleteProgram, isPending: isDeleting } = useMutation({
        mutationFn: (id: string) => adminDeleteProgram(id),
        onSuccess: () => {
            toast.success("Program deleted! 🗑️");
            setDeletingProgram(null);
            queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
        },
        onError: () => toast.error("Failed!"),
    });

    const { mutate: duplicateProgram } = useMutation({
        mutationFn: (id: string) => adminDuplicateProgram(id),
        onSuccess: () => {
            toast.success("Program duplicated! ✅");
            queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
        },
        onError: () => toast.error("Failed!"),
    });

    return (
        <>
            <PageHeader
                title="Programs"
                subtitle="Manage all training programs"
                titleIcon={<GraduationCap size={24} />}
                totalCount={data?.meta?.total ?? 0}
                onAdd={() => setIsAddOpen(true)}
            />

            {/* Filters */}
            {/* <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search programs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-300 w-56"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
        >
          <option value="">All Categories</option>
          <option value="nlp">NLP</option>
          <option value="icf">ICF</option>
          <option value="hypnotherapy">Hypnotherapy</option>
          <option value="trainer">Trainer</option>
        </select>
        {(search || statusFilter || categoryFilter) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setCategoryFilter(""); }}
            className="text-sm text-gray-400 hover:text-red-500 transition"
          >
            Reset
          </button>
        )}
      </div> */}

            {/* Programs Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : isError ? (
                <div className="text-center py-20 text-red-500">Failed to load programs.</div>
            ) : data?.data?.length === 0 ? (
                <div className="text-center py-20 text-gray-400">No programs found</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {data?.data?.map((program: any) => (
                        <div key={program._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">

                            {/* Card Header */}
                            <div className="p-5 border-b border-gray-50">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${categoryColor(program.category)}`}>
                                            {program.category?.toUpperCase()}
                                        </span>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(program.status)}`}>
                                            {program.status}
                                        </span>
                                        {program.is_featured && (
                                            <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700 flex items-center gap-1">
                                                <Star size={10} /> Featured
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <h3 className="font-semibold text-gray-800 text-base mb-1">{program.name}</h3>
                                <p className="text-xs text-gray-400 capitalize">{program.level}</p>

                                {program.short_description && (
                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{program.short_description}</p>
                                )}
                            </div>

                            {/* Card Stats */}
                            <div className="px-5 py-3 flex items-center gap-4 text-xs text-gray-500 border-b border-gray-50">
                                {program.total_courses && (
                                    <div className="flex items-center gap-1">
                                        <BookMarked size={12} />
                                        <span>{program.total_courses} courses</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1">
                                    <Users size={12} />
                                    <span>{program.total_students} students</span>
                                </div>
                                {program.duration_weeks && (
                                    <div className="flex items-center gap-1">
                                        <Clock size={12} />
                                        <span>{program.duration_weeks}w</span>
                                    </div>
                                )}
                                <div className="ml-auto font-semibold text-gray-800">
                                    {program.currency} {program.price?.toLocaleString()}
                                </div>
                            </div>

                            {/* Card Actions */}
                            <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
                                {/* Manage Courses — business_in_a_box pe mat dikhao */}
                                {program.category !== "business_in_a_box" &&  (
                                    <button
                                        onClick={() => setManagingCourses(program)}
                                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition font-medium"
                                    >
                                        <BookMarked size={12} />
                                        Courses
                                    </button>
                                )}

                                {/* Manage Batches */}
                                <button
                                    onClick={() => setManagingBatches(program)}
                                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 transition font-medium"
                                >
                                    <Users size={12} />
                                    Batches
                                </button>

                                {/* Edit */}
                                <button
                                    onClick={() => setEditingProgram(program)}
                                    className="p-1.5 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 transition ml-auto"
                                    title="Edit"
                                >
                                    <Pencil size={14} />
                                </button>

                                {/* Duplicate */}
                                <button
                                    onClick={() => duplicateProgram(program._id)}
                                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition"
                                    title="Duplicate"
                                >
                                    <Copy size={14} />
                                </button>

                                {/* Delete */}
                                <button
                                    onClick={() => setDeletingProgram(program)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Modal */}
            <Modal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                title="Add New Program"
                fields={programFields}
                onSubmit={(data) => addProgram(data)}
                isLoading={isAdding}
                mode="add"
                initialValues={{
                    level: "level 1",
                    category: "nlp",
                    status: "draft",
                    currency: "USD",
                }}
                zIndex={60}
            />

            {/* Edit Modal */}
            {editingProgram && (
                <Modal
                    isOpen={!!editingProgram}
                    onClose={() => setEditingProgram(null)}
                    title="Edit Program"
                    subtitle={editingProgram.name}
                    fields={programFields}
                    initialValues={{
                        name: editingProgram.name,
                        short_description: editingProgram.short_description || "",
                        description: editingProgram.description || "",
                        level: editingProgram.level,
                        category: editingProgram.category,
                        price: editingProgram.price?.toString(),
                        currency: editingProgram.currency,
                        duration_weeks: editingProgram.duration_weeks?.toString(),
                        status: editingProgram.status,
                    }}
                    onSubmit={(data) => updateProgram({ id: editingProgram._id, data })}
                    isLoading={isUpdating}
                    mode="edit"
                    zIndex={70}
                />
            )}

            {/* Delete Popup */}
            {deletingProgram && (
                <Popup
                    isOpen={!!deletingProgram}
                    onClose={() => setDeletingProgram(null)}
                    onConfirm={() => deleteProgram(deletingProgram._id)}
                    variant="danger"
                    title="Delete Program"
                    description={
                        <>
                            Are you sure you want to delete{" "}
                            <span className="font-bold text-red-500">{deletingProgram.name}</span>?
                            All courses, modules and lessons will be deleted too.
                        </>
                    }
                    confirmText="Yes, Delete"
                    isLoading={isDeleting}
                    loadingText="Deleting..."
                    zIndex={80}
                />
            )}

            {/* Courses Modal */}
            {managingCourses && (
                <CoursesModal
                    program={managingCourses}
                    onClose={() => setManagingCourses(null)}
                    zIndex={60}
                />
            )}

            {/* Batches Modal */}
            {managingBatches && (
                <BatchesModal
                    program={managingBatches}
                    onClose={() => setManagingBatches(null)}
                    zIndex={60}
                />
            )}
        </>
    );
}