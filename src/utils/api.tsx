// ✅ api.ts — poora updated file
import axios from "axios";
import { LoginData, RegisterData, UpdateUserData } from "@/types/apiType";

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  // withCredentials: true, // Set to true to include cookies in requests
});

// Token auto-attach
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 response and refresh token
let isRefreshing = false;
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("refresh_token");
        window.location.href = "/auth";
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refresh_token = localStorage.getItem("refresh_token");
        if (!refresh_token) throw new Error("No refresh token");

        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
          { refresh_token }
        );

        const newAccessToken = res.data.data.access_token;
        const newRefreshToken = res.data.data.refresh_token;

        localStorage.setItem("token", newAccessToken);
        localStorage.setItem("refresh_token", newRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        isRefreshing = false;
        return API(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("refresh_token");
        window.location.href = "/auth";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Define your API functions here, ensuring proper types
// loginUser replace karo
export const loginUser = (data: { identifier: string; password?: string }) =>
  API.post("/api/auth/login", data);

// yeh naya add karo
export const completeAccountSetup = (data: { email: string; password: string }) =>
  API.post("/api/auth/complete-setup", data);
export const registerUser = (data: RegisterData) => API.post("/api/auth/register", data);
export const forgotPassword = (data: { email: string }) => API.post("/api/auth/forgot-password", data);
export const resetPassword = (data: { email: string; otp: string; newPassword: string }) => API.post("/api/auth/reset-password", data);
export const getMe = () => API.get("/api/auth/me");
export const resendVerification = (data: { email: string }) => API.post("/api/auth/resend-verification", data);
export const selfVerifyEmail = () => API.post("/api/auth/verify-email-self");  // ✅ POST
// ─── Chatbot Visitors ─────────────────────────────────────────
export const getAllVisitors = (params?: any) => API.get("/api/v1/visitors", { params });
export const promoteVisitorToLead = (id: string, data?: any) => API.post(`/api/v1/visitors/${id}/promote`, data);
export const updateVisitor = (id: string, data: any) => API.patch(`/api/v1/visitors/${id}`, data);
export const assignVisitor = (id: string) => API.patch(`/api/v1/visitors/${id}/assign`);
export const unassignVisitor = (id: string) => API.patch(`/api/v1/visitors/${id}/unassign`);

// Admin APIs
export const adminGetAllUsers = (params?: any) => API.get("/api/admin/users", { params });
export const adminGetAllAssignRoles = (params?: any) => API.get("/api/admin/assign-role-users", { params });
export const adminGetUserById = (id: string) => API.get(`/api/admin/users/${id}`);
export const adminUpdateUser = (id: string, data: UpdateUserData) => API.patch(`/api/admin/users/${id}`, data);
export const adminDeleteUser = (id: string) => API.delete(`/api/admin/users/${id}`);
export const adminDeleteAllUsers = () => API.delete("/api/admin/users");
export const adminCreateUser = (data: any) => API.post("/api/admin/users", data);
export const adminAssignRole = (id: string, role: string) => API.patch(`/api/admin/users/${id}/role`, { role });
export const adminUpdateUserPassword = (id: string, password: string) => API.patch(`/api/admin/users/${id}`, { newPassword: password });
export const getAdminRecipients = () => API.get("/api/admin/users/recipients");
// User Profile APIs
export const getAllUsersForRole = () => API.get("/api/users");
export const getProfile = () => API.get("/api/users/profile");
export const updateProfile = (data: { name: string }) => API.patch("/api/users/profile", data);
export const changePassword = (data: { oldPassword: string; newPassword: string }) => API.patch("/api/users/change-password", data);
export const deleteMyAccount = () => API.delete("/api/users/delete-account");
// ── User Documents ────────────────────────────────────────────
export const uploadUserDocument = (userId: string, data: { type: string; label?: string; url: string; fileType: "image" | "pdf" }) =>
  API.post(`/api/users/${userId}/documents`, data);

export const deleteUserDocument = (userId: string, docId: string) =>
  API.delete(`/api/users/${userId}/documents/${docId}`);

// Lead APIs
export const getAllLeads = (params?: any) => API.get("/api/v1/leads", { params });
export const createLead = (data: any) => API.post("/api/v1/leads", data);
export const createLeadAdmin = (data: any) => API.post("/api/v1/leads/admin", data);
export const updateLead = (id: string, data: any) => API.put(`/api/v1/leads/${id}`, data);
export const deleteLead = (id: string) => API.delete(`/api/v1/leads/${id}`);
export const assignLead = (id: string, data: any) => API.post(`/api/v1/leads/${id}/assign`, data);
export const convertLead = (id: string, data: any) => API.post(`/api/v1/leads/${id}/convert`, data);
export const markLostLead = (id: string, data: any) => API.post(`/api/v1/leads/${id}/mark-lost`, data);
export const markNotNowLead = (id: string, data: any) =>
  API.patch(`/api/v1/leads/${id}/not-now`, data);
export const getActivitiesLead = (id: string) => API.get(`/api/v1/leads/${id}/activities`);
export const addActivityLead = (id: string, data: any) => API.post(`/api/v1/leads/${id}/activities`, data);
export const getLeadsStats = (userId?: string) => API.get("/api/v1/leads/stats", { params: userId ? { userId } : {}, });
export const markLeadInterested = (id: string, data: any) => API.patch(`/api/v1/leads/${id}/interested`, data);
export const updateLeadPaymentPlan = (id: string, data: any) => API.patch(`/api/v1/leads/${id}/payment-plan`, data);
export const submitLeadContract = (id: string, data: any) => API.patch(`/api/v1/leads/${id}/contract`, data);
export const getMyLeadContract = () => API.get(`/api/v1/leads/my-contract`);
export const sendPaymentPlanInvoice = (invoiceId: string) =>
  API.post(`/api/v1/leads/invoices/${invoiceId}/send-payment-plan-email`);
export const previewBulkLeads = (formData: FormData) =>
  API.post("/api/v1/leads/bulk-import/preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const confirmBulkLeads = (
  leads: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string | null;
    programId?: string | null;
    nationality?: string;
    profession?: string;
    source?: string;
    quality?: string;
    assignedTo?: string;
  }[]
) => API.post("/api/v1/leads/bulk-import/confirm", { leads });
// Program APIs
export const adminGetPrograms = (params?: any) => API.get("/api/v1/programs", { params });
export const adminCreateProgram = (data: any) => API.post("/api/v1/programs", data);
export const adminUpdateProgram = (id: string, data: any) => API.put(`/api/v1/programs/${id}`, data);
export const adminDeleteProgram = (id: string) => API.delete(`/api/v1/programs/${id}`);
export const adminDuplicateProgram = (id: string) => API.post(`/api/v1/programs/${id}/duplicate`);
export const adminGetProgramById = (id: string) => API.get(`/api/v1/programs/${id}`);
export const getNamesPrograms = () =>
  API.get("/api/v1/programs/name").then((r) => r.data.data);

// Course APIs
export const adminGetCourses = (programId: string) => API.get(`/api/v1/programs/${programId}/courses`);
export const adminCreateCourse = (programId: string, data: any) => API.post(`/api/v1/programs/${programId}/courses`, data);
export const adminUpdateCourse = (id: string, data: any) => API.put(`/api/v1/programs/courses/${id}`, data);
export const adminDeleteCourse = (id: string) => API.delete(`/api/v1/programs/courses/${id}`);
export const adminGetCourseById = (id: string) => API.get(`/api/v1/programs/courses/${id}`);

// Module APIs
export const adminGetModules = (courseId: string) => API.get(`/api/v1/programs/courses/${courseId}/modules`);
export const adminCreateModule = (courseId: string, data: any) => API.post(`/api/v1/programs/courses/${courseId}/modules`, data);
export const adminUpdateModule = (id: string, data: any) => API.put(`/api/v1/programs/modules/${id}`, data);
export const adminDeleteModule = (id: string) => API.delete(`/api/v1/programs/modules/${id}`);
export const adminGetModuleById = (id: string) => API.get(`/api/v1/programs/modules/${id}`);

// Lesson APIs
export const adminGetLessons = (moduleId: string) => API.get(`/api/v1/programs/modules/${moduleId}/lessons`);
export const adminCreateLesson = (moduleId: string, data: any) => API.post(`/api/v1/programs/modules/${moduleId}/lessons`, data);
export const adminUpdateLesson = (id: string, data: any) => API.put(`/api/v1/programs/lessons/${id}`, data);
export const adminDeleteLesson = (id: string) => API.delete(`/api/v1/programs/lessons/${id}`);

// Batch APIs
export const adminGetBatches = (params?: any) => API.get("/api/v1/programs/batches", { params });
export const adminGetBatchById = (id: string) => API.get(`/api/v1/programs/batches/${id}`);
export const adminCreateBatch = (data: any) => API.post("/api/v1/programs/batches", data);
export const adminUpdateBatch = (id: string, data: any) => API.put(`/api/v1/programs/batches/${id}`, data);
export const adminDeleteBatch = (id: string) => API.delete(`/api/v1/programs/batches/${id}`);

export const adminExportBatches = (id: string, format: string) =>
  API.get(`/api/v1/programs/batches/${id}/export`, { params: { format }, responseType: "blob" });

export const adminExportAllBatches = (params?: any) =>
  API.get("/api/v1/programs/batches/export-all", { params, responseType: "blob" });

export const adminAddStudentToBatch = (batchId: string, data: { studentId: string }) =>
  API.post(`/api/v1/programs/batches/${batchId}/students`, data);

export const adminRemoveStudentFromBatch = (batchId: string, studentId: string) =>
  API.delete(`/api/v1/programs/batches/${batchId}/students/${studentId}`);

export const adminSwitchStudentBatch = (batchId: string, studentId: string, data: { targetBatchId: string }) =>
  API.post(`/api/v1/programs/batches/${batchId}/switch-student`, { studentId, ...data });
//--------------------------------- website blog ------------------------
export const getBlogsPublic = () => API.get("/api/v1/blogs/public");
export const adminGetBlogs = (params?: any) => API.get("/api/v1/blogs", { params });
export const adminCreateBlog = (data: any) => API.post("/api/v1/blogs", data);
// export const adminUpdateBlog = (id: string, data: any) => API.put(`/api/v1/blogs/${id}`, data);
export const adminUpdateBlog = (slugOrId: string, data: any) =>
  API.put(`/api/v1/blogs/${slugOrId}`, data);
export const adminDeleteBlog = (slug: string) => API.delete(`/api/v1/blogs/${slug}`);
export const adminPublishBlog = (slug: string) => API.post(`/api/v1/blogs/${slug}/publish`);
export const adminGetBlogBySlug = (slug: string) =>
  API.get(`/api/v1/blogs/admin/${slug}`);

// ─── Finance — Invoices ───────────────────────────────────────
export const getAllInvoices = (params?: any) => API.get("/api/v1/finance/invoices", { params });
export const getInvoiceById = (id: string) => API.get(`/api/v1/finance/invoices/${id}`);
export const createInvoice = (data: any) => API.post("/api/v1/finance/invoices", data);
export const updateInvoice = (id: string, data: any) => API.patch(`/api/v1/finance/invoices/${id}`, data);
export const deleteInvoice = (id: string, reason?: string) =>
  API.delete(`/api/v1/finance/invoices/${id}`, { data: { reason } });
export const markInvoicePaid = (id: string) => API.patch(`/api/v1/finance/invoices/${id}/mark-paid`);
// utils/api.ts
// export const markInstallmentPaid = (
//   invoiceId: string,
//   installmentId: string,
//   body: { method: string; referenceNumber?: string; notes?: string }
// ) =>
//   API.patch(`/api/v1/finance/invoices/${invoiceId}/installments/${installmentId}/mark-paid`, body);
// api.ts mein abhi ye hai (paidDate missing):
export const markInstallmentPaid = (invoiceId: string, installmentId: string, payload: any) => {
  const formData = new FormData();
  formData.append("method", payload.method);
  if (payload.referenceNumber) formData.append("referenceNumber", payload.referenceNumber);
  if (payload.notes) formData.append("notes", payload.notes);
  if (payload.paidDate) formData.append("paidDate", payload.paidDate); // 👈 ye line add karo
  if (payload.receipt) formData.append("receipt", payload.receipt);

  return API.patch(
    `/api/v1/finance/invoices/${invoiceId}/installments/${installmentId}/mark-paid`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};
export const recordChequePayment = (
  invoiceId: string,
  data: {
    accountHolderName: string;
    cheques: { chequeNumber: string; amount: number; date?: string }[];
    notes?: string;
    paidDate?: string;
  }
) => API.post(`/api/v1/finance/invoices/${invoiceId}/cheques`, data);

export const getInvoiceCheques = (invoiceId: string) =>
  API.get(`/api/v1/finance/invoices/${invoiceId}/cheques`);

export const discardCheque = (invoiceId: string, chequeId: string, reason?: string) =>
  API.patch(`/api/v1/finance/invoices/${invoiceId}/cheques/${chequeId}/discard`, { reason });

export const returnCheque = (invoiceId: string, chequeId: string) =>
  API.patch(`/api/v1/finance/invoices/${invoiceId}/cheques/${chequeId}/return`, {});

export const updateCheque = (
  invoiceId: string,
  chequeId: string,
  data: { accountHolderName: string; chequeNumber: string; amount: number; date?: string }
) => API.patch(`/api/v1/finance/invoices/${invoiceId}/cheques/${chequeId}/edit`, data);

export const bounceCheque = (
  invoiceId: string,
  chequeId: string,
  data: { depositDate: string; bounceDate: string; reason?: string }
) => API.patch(`/api/v1/finance/invoices/${invoiceId}/cheques/${chequeId}/bounce`, data);
  
export const correctPaidInstallment = (
  invoiceId: string,
  installmentId: string,
  data: { amount?: number; paidDate?: string; method?: string; referenceNumber?: string; notes?: string; reason: string, adjustTotal?: boolean }
) => API.patch(`/api/v1/finance/invoices/${invoiceId}/installments/${installmentId}/correct`, data);

export const updateInstallment = (invoiceId: string, installmentId: string, data: any) =>
  API.patch(`/api/v1/finance/invoices/${invoiceId}/installments/${installmentId}`, data);

export const addInstallment = (invoiceId: string, data: any) =>
  API.post(`/api/v1/finance/invoices/${invoiceId}/installments`, data);

export const deleteInstallment = (invoiceId: string, installmentId: string, reason?: string) =>
  API.delete(`/api/v1/finance/invoices/${invoiceId}/installments/${installmentId}`, {
    data: { reason },
  });


export const getMyInvoices = () => API.get("/api/v1/finance/invoices/my");
export const getPendingInvoices = () => API.get("/api/v1/finance/invoices/pending");
export const getOverdueInvoices = () => API.get("/api/v1/finance/invoices/overdue");
export const getUpcomingDues = (days?: number) => API.get("/api/v1/finance/invoices/upcoming-dues", { params: { days: days || 30 } });

// ─── Finance — INVOICE RECIEVING ──────────────────────────────────────
export const sendInvoiceEmail = (id: string) =>
  API.post(`/api/v1/finance/invoices/${id}/send-invoice`);

export const sendReceivingInvoiceEmail = (id: string, body: any) =>
  API.post(`/api/v1/finance/invoices/${id}/send-receiving-invoice`, body);

export const sendReceivingReportEmail = (body: { invoiceIds?: string[]; filters?: any }) =>
  API.post("/api/v1/finance/invoices/receiving/export-email", body);

export const sendPaymentsReportEmail = (body: {
  paymentIds?: string[];
  filters?: any;
  recipientMode?: "all" | "specific";
  recipientIds?: string[];
}) => API.post("/api/v1/finance/payments/report/export-email", body);

// export const getSalesRoleInvoices = (params?: any) =>
//   axios.get("/finance/invoices/sales", { params });
export const getSalesRoleInvoices = (params?: any) =>
  API.get("/api/v1/finance/invoices/sales", { params });

// ✅ utils/api.ts — PURANA confirmBulkInvoice REPLACE karo isse

export const previewBulkInvoice = (formData: FormData) =>
  API.post("/api/v1/finance/invoices/bulk-import/preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const confirmBulkInvoice = (
  invoices: {
    user: string;
    invoiceNumber?: string;
    dueDate?: string | null;
    issueDate?: string | null;
    items: {
      enrollmentId: string;
      programId: string | null;
      programName: string;
      amount: number;
      discount: number;
    }[];
    advance?: {
      amount: number;
      dueDate?: string | null;
      description?: string;
      paidDate?: string | null;
      paid: boolean; // ✅ agar false, invoice mein PENDING rahegi, Payment record nahi banega
    } | null;
    installments?: {
      amount: number;
      dueDate?: string | null;
      description?: string;
      paidDate?: string | null;
      paid: boolean;
    }[];
  }[]
) => API.post("/api/v1/finance/invoices/bulk-import/confirm", { invoices });

// Bulk Discount Correction
export const previewBulkDiscount = (formData: FormData) =>
  API.post("/api/v1/finance/invoices/bulk-discount/preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const confirmBulkDiscount = (rows: any[]) =>
  API.post("/api/v1/finance/invoices/bulk-discount/confirm", { rows });

// ─── Finance — Payments ──────────────────────────────────────
export const getAllPayments = (params?: any) => API.get("/api/v1/finance/payments", { params });
export const getPaymentById = (id: string) => API.get(`/api/v1/finance/payments/${id}`);
export const addPayment = (data: any) => API.post("/api/v1/finance/payments", data);
export const updatePayment = (id: string, data: any) => API.patch(`/api/v1/finance/payments/${id}`, data);
export const approvePayment = (id: string) => API.patch(`/api/v1/finance/payments/${id}/approve`);
export const rejectPayment = (id: string, data: { reason: string }) => API.patch(`/api/v1/finance/payments/${id}/reject`, data);

// ─── Finance — Reports ───────────────────────────────────────
export const getRevenueReport = () => API.get("/api/v1/finance/reports/revenue");
// export const getMonthlyCollections = (year?: number) => API.get("/api/v1/finance/reports/monthly", { params: { year: year || new Date().getFullYear() } });
export const getMonthlyCollections = (year?: number) =>
  API.get("/api/v1/finance/reports/monthly", {
    params: { year: year || new Date().getFullYear() }
  });
export const getPendingReport = () => API.get("/api/v1/finance/reports/pending");
export const searchEnrollments = (q: string) =>
  API.get(`/api/v1/finance/enrollments/search?q=${encodeURIComponent(q)}`);

// ─── Finance — Extension ─────────────────────────────────────
export const addFinanceExtension = (data: { enrollmentId: string; days: number; reason: string }) => API.post("/api/v1/finance/extension", data);

// ─── Enrollments ─────────────────────────────────────────────
export const getAllEnrollments = (params?: any) => API.get("/api/v1/enrollments", { params });
export const getMyEnrollments = () => API.get("/api/v1/enrollments/my");
export const getEnrollmentById = (id: string) => API.get(`/api/v1/enrollments/${id}`);
export const createEnrollment = (data: any) => API.post("/api/v1/enrollments", data);
export const createEnrollmentDirect = (data: any) => API.post("/api/v1/enrollments/direct", data);
export const assignEnrollment = (id: string, assigned_to: string) =>
  API.patch(`/api/v1/enrollments/${id}/assign`, { assigned_to });
export const voidInstallmentPayment = (
  invoiceId: string,
  installmentId: string,
  data: any
) =>
  API.patch(
    `/api/v1/finance/invoices/${invoiceId}/installments/${installmentId}/void`,
    data
  );

export const updateEnrollment = (id: string, data: any) => API.put(`/api/v1/enrollments/${id}`, data);
export const deleteEnrollment = (id: string) => API.delete(`/api/v1/enrollments/${id}`);

export const graduateEnrollment = (id: string) => API.post(`/api/v1/enrollments/${id}/graduate`);
export const suspendEnrollment = (id: string) => API.post(`/api/v1/enrollments/${id}/suspend`);
export const reactivateEnrollment = (id: string) => API.post(`/api/v1/enrollments/${id}/reactivate`);
export const createEnrollmentDirectBundle = (data: any) =>
  API.post("/api/v1/enrollments/direct/bundle", data);

export const previewBulkEnrollment = (formData: FormData) =>
  API.post("/api/v1/enrollments/bulk-import/preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const confirmBulkEnrollment = (
  enrollments: {
    user: string;
    program: string;
    batch?: string;
    assigned_to?: string;
    audioAccess?: boolean;
  }[]
) => API.post("/api/v1/enrollments/bulk-import/confirm", { enrollments });

export const getCertificate = (enrollmentId: string) =>
  API.get(`/certificates/enrollment/${enrollmentId}`);

// ─── Access Control ───────────────────────────────────────────
// export const grantAccess = (data: { enrollmentId: string; days: number }) => API.post("/api/v1/access/grant", data);
export const grantAccess = (data: { enrollmentId: string; days: number; reason?: string; installmentIds?: string[] }) =>
  API.post("/api/v1/access/grant", data);

export const grantFinanceAccess = (data: { enrollmentId: string; days: number; reason?: string; installmentIds?: string[] }) =>
  API.post("/api/v1/access/finance-grant", data);

export const getGracePoolStatus = (enrollmentId: string) =>
  API.get(`/api/v1/access/pool-status/${enrollmentId}`);

export const checkAccess = (enrollmentId: string) => API.get(`/api/v1/access/check/${enrollmentId}`);

// ─── Audit Logs ───────────────────────────────────────────────
export const getAllAuditLogs = (params?: any) => API.get("/api/v1/audit-logs", { params });
export const getAuditLogById = (id: string) => API.get(`/api/v1/audit-logs/${id}`);

// ─── LMS — Student ───────────────────────────────────────────
export const getMyBooks = () => API.get("/api/v1/learn/my-books");
export const getLearningDashboard = (enrollmentId: string) =>
  API.get(`/api/v1/learn/${enrollmentId}`);

export const getCourseContent = (enrollmentId: string, courseId: string) =>
  API.get(`/api/v1/learn/${enrollmentId}/courses/${courseId}`);

export const getLessonContent = (enrollmentId: string, lessonId: string) =>
  API.get(`/api/v1/learn/${enrollmentId}/lessons/${lessonId}`);

export const updateLessonProgress = (enrollmentId: string, lessonId: string, data: { progress_percentage: number; last_position_seconds?: number }) =>
  API.post(`/api/v1/learn/${enrollmentId}/lessons/${lessonId}/progress`, data);

export const getLessonComments = (enrollmentId: string, lessonId: string) =>
  API.get(`/api/v1/learn/${enrollmentId}/lessons/${lessonId}/comments`);

export const addLessonComment = (enrollmentId: string, lessonId: string, data: any) =>
  API.post(`/api/v1/learn/${enrollmentId}/lessons/${lessonId}/comments`, data);

export const completeLesson = (enrollmentId: string, lessonId: string) =>
  API.post(`/api/v1/learn/${enrollmentId}/lessons/${lessonId}/complete`);

export const getAssignments = (enrollmentId: string) =>
  API.get(`/api/v1/learn/${enrollmentId}/assignments`);

export const getAssignmentById = (enrollmentId: string, id: string) =>
  API.get(`/api/v1/learn/${enrollmentId}/assignments/${id}`);

export const submitAssignment = (enrollmentId: string, id: string, data: any) =>
  API.post(`/api/v1/learn/${enrollmentId}/assignments/${id}/submit`, data);

export const getMySubmissions = (enrollmentId: string, id: string) =>
  API.get(`/api/v1/learn/${enrollmentId}/assignments/${id}/submissions`);

export const getLiveSessions = (enrollmentId: string) =>
  API.get(`/api/v1/learn/${enrollmentId}/live-sessions`);

export const getLiveSessionById = (enrollmentId: string, id: string) =>
  API.get(`/api/v1/learn/${enrollmentId}/live-sessions/${id}`);

export const registerForSession = (enrollmentId: string, id: string) =>
  API.post(`/api/v1/learn/${enrollmentId}/live-sessions/${id}/register`);

export const getLmsResources = (enrollmentId: string) =>
  API.get(`/api/v1/learn/${enrollmentId}/resources`);

export const getResourceDownload = (enrollmentId: string, id: string) =>
  API.get(`/api/v1/learn/${enrollmentId}/resources/${id}/download`);

// ─── LMS — Instructor (Admin) ─────────────────────────────────
export const instructorGetCourses = () => API.get("/admin/v1/instructor/courses");
export const instructorGetSessions = () => API.get("/admin/v1/instructor/sessions");
export const instructorGetAssignments = () => API.get("/admin/v1/instructor/assignments");
export const instructorGetSubmissions = (id: string) => API.get(`/admin/v1/instructor/assignments/${id}/submissions`);
export const gradeSubmission = (id: string, data: { points_earned: number; feedback?: string; status?: string }) =>
  API.put(`/admin/v1/instructor/submissions/${id}/grade`, data);

// ─── Admin LMS Content ────────────────────────────────────────
export const getUserBooks = (userId: string) =>
  API.get(`/api/v1/lms/user-books/${userId}`);

// Admin book manually add kare user ko
export const adminAddBookToUser = (userId: string, resourceId: string) =>
  API.post(`/api/v1/lms/resources/add-book`, { userId, resourceId });
export const adminGetLmsSessions = (params?: any) => API.get("/admin/v1/lms/live-sessions", { params });
export const adminCreateLmsSession = (data: any) => API.post("/admin/v1/lms/live-sessions", data);
export const adminUpdateLmsSession = (id: string, data: any) => API.put(`/admin/v1/lms/live-sessions/${id}`, data);
export const adminDeleteLmsSession = (id: string) => API.delete(`/admin/v1/lms/live-sessions/${id}`);
export const toggleLessonStatus = (lessonId: string) =>
  API.patch(`/admin/v1/lms/lessons/${lessonId}/toggle-status`);
export const adminGetLmsAssignments = (params?: any) => API.get("/admin/v1/lms/assignments", { params });
export const adminCreateLmsAssignment = (data: any) => API.post("/admin/v1/lms/assignments", data);
export const adminUpdateLmsAssignment = (id: string, data: any) => API.put(`/admin/v1/lms/assignments/${id}`, data);
export const adminDeleteLmsAssignment = (id: string) => API.delete(`/admin/v1/lms/assignments/${id}`);

export const adminGetLmsResources = (params?: any) => API.get("/admin/v1/lms/resources", { params });
export const adminCreateLmsResource = (data: any) => API.post("/admin/v1/lms/resources", data);
export const adminUpdateLmsResource = (id: string, data: any) => API.put(`/admin/v1/lms/resources/${id}`, data);
export const adminDeleteLmsResource = (id: string) => API.delete(`/admin/v1/lms/resources/${id}`);


export const toggleAudioAccess = (enrollmentId: string) =>
  API.patch(`/api/v1/lms/enrollments/${enrollmentId}/toggle-audio-access`);


export const adminGetResources = (params?: any) =>
  API.get("/api/v1/lms/resources", { params });

export const adminCreateResource = (formData: FormData) =>
  API.post("/api/v1/lms/resources", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const adminUpdateResource = (id: string, formData: FormData) =>
  API.put(`/api/v1/lms/resources/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const adminDeleteResource = (id: string) =>
  API.delete(`/api/v1/lms/resources/${id}`);

// ─────────────────────────────────────────────────────────────
// ACCOUNTS MODULE — api.ts mein add karo (end mein, before export default)
// ─────────────────────────────────────────────────────────────

// ─── Chart of Accounts ───────────────────────────────────────
export const seedAccounts = () =>
  API.post("/api/v1/accounts/seed");

export const getAllAccounts = (params?: { type?: string; isActive?: boolean; search?: string }) =>
  API.get("/api/v1/accounts", { params });

export const getAccountById = (id: string) =>
  API.get(`/api/v1/accounts/${id}`);

export const createAccount = (data: {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  subType?: string;
  parent?: string;
  description?: string;
  openingBalance?: number;
}) => API.post("/api/v1/accounts", data);

export const updateAccount = (id: string, data: any) =>
  API.patch(`/api/v1/accounts/${id}`, data);

export const deleteAccount = (id: string) =>
  API.delete(`/api/v1/accounts/${id}`);

// ─── Ledger ──────────────────────────────────────────────────
export const getAccountLedger = (
  id: string,
  params?: { from?: string; to?: string; page?: number; limit?: number }
) => API.get(`/api/v1/accounts/${id}/ledger`, { params });

// ─── Journal Entries ─────────────────────────────────────────
export const getAllJournalEntries = (params?: {
  search?: string;
  sourceType?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) => API.get("/api/v1/accounts/journal", { params });

export const createJournalEntry = (data: {
  description: string;
  date?: string;
  lines: { account: string; type: "debit" | "credit"; amount: number; description?: string }[];
  notes?: string;
}) => API.post("/api/v1/accounts/journal", data);

export const updateJournalEntry = (id: string, data: any) =>
  API.patch(`/api/v1/accounts/journal/${id}`, data);

export const deleteJournalEntry = (id: string) =>
  API.delete(`/api/v1/accounts/journal/${id}`);

// ─── Expenses ────────────────────────────────────────────────
export const getAllExpenseTitles = () => API.get("/api/v1/accounts/expense-titles");
export const createExpenseTitle = (data: { title: string }) => API.post("/api/v1/accounts/expense-titles", data);
export const updateExpenseTitle = ({ id, ...data }: { id: string; title: string }) => API.patch(`/api/v1/accounts/expense-titles/${id}`, data);
export const deleteExpenseTitle = (id: string) => API.delete(`/api/v1/accounts/expense-titles/${id}`);

export const getAllExpenses = (params?: {
  status?: string;
  category?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) => API.get("/api/v1/accounts/expenses", { params });

export const createExpense = (data: {
  title: string;
  description?: string;
  amount: number;
  account: string;
  category: string;
  vendor?: { name?: string; contact?: string };
  paymentMethod: string;
  referenceNumber?: string;
  date?: string;
  isRecurring?: boolean;
  recurringInterval?: string;
  notes?: string;
}) => API.post("/api/v1/accounts/expenses", data);

export const approveExpense = (id: string) =>
  API.patch(`/api/v1/accounts/expenses/${id}/approve`);

export const rejectExpense = (id: string, data: { reason: string }) =>
  API.patch(`/api/v1/accounts/expenses/${id}/reject`, data);

// ─── Accounts Dashboard ──────────────────────────────────────
export const getAccountsDashboard = () =>
  API.get("/api/v1/accounts/dashboard");

// ─── Reports ─────────────────────────────────────────────────
export const getProfitLoss = (params?: { year?: number; from?: string; to?: string }) =>
  API.get("/api/v1/reports/profit-loss", { params });

export const getBalanceSheet = (params?: { asOf?: string }) =>
  API.get("/api/v1/reports/balance-sheet", { params });

export const getARAgingReport = () =>
  API.get("/api/v1/reports/ar-aging");

export const getCashFlowReport = (params?: { year?: number; from?: string; to?: string }) =>
  API.get("/api/v1/reports/cash-flow", { params });

export const getRevenueByProgram = (params?: { year?: number; from?: string; to?: string }) =>
  API.get("/api/v1/reports/revenue-by-program", { params });

// ─── Guides ──────────────────────────────────────────────────
export const getGuideByPageKey = (pageKey: string) =>
  API.get(`/api/v1/guides/${pageKey}`);

export const getAllGuides = () =>
  API.get("/api/v1/guides/admin/all");

export const adminUpsertGuide = (data: {
  pageKey: string;
  heading: string;
  description: any[]; // Block[] from BlockEditor
  videoUrl: string;
  videoPublicId?: string;
}) => API.post("/api/v1/guides/admin", data);

export const deleteGuide = (id: string) =>
  API.delete(`/api/v1/guides/admin/${id}`);

export const getGuideUploadSignature = () =>
  API.get("/api/v1/guides/upload-signature");

export const getActiveGuides = () => API.get("/api/v1/guides");

// ─── Website SEO Pages ────────────────────────────────────────
export interface SeoFormData {
  title: string;
  description: string;
  keywords: string;
  og_title: string;
  og_description: string;
  og_image: string;
  canonical_url: string;
  no_index: boolean;
}

// Converts frontend form shape → backend model shape
export const mapToBackend = (slug: string, label: string, form: SeoFormData) => ({
  pageSlug: slug,
  pageLabel: label,
  title: form.title.trim(),
  description: form.description.trim(),
  keywords: form.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean),
  openGraph: {
    title: form.og_title.trim() || form.title.trim(),
    description: form.og_description.trim() || form.description.trim(),
    image: form.og_image.trim() || "",
    url: "",
    siteName: "AL&CO",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: form.og_title.trim() || form.title.trim(),
    description: form.og_description.trim() || form.description.trim(),
    image: form.og_image.trim() || "",
  },
  canonical: form.canonical_url.trim() || "",
  robots: {
    index: !form.no_index,
    follow: true,
  },
});

// Converts backend response → frontend form shape
export const mapFromBackend = (data: any): SeoFormData => ({
  title: data.title || "",
  description: data.description || "",
  keywords: Array.isArray(data.keywords) ? data.keywords.join(", ") : "",
  og_title: data.openGraph?.title || "",
  og_description: data.openGraph?.description || "",
  og_image: data.openGraph?.image || "",
  canonical_url: data.canonical || "",
  no_index: data.robots?.index === false,
});

// ── API calls ──

// GET all pages (admin list)
export const adminGetSeoPages = () => API.get("/api/v1/seo");

// GET single page by slug (public + admin)
export const adminGetSeoPageBySlug = (slug: string) =>
  API.get(`/api/v1/seo/page/${slug}`);

export const adminUpsertSeoPage = (slug: string, label: string, data: any) =>
  API.patch("/api/v1/seo/upsert", { pageSlug: slug, pageLabel: label, ...data });

// DELETE
export const adminDeleteSeoPage = (slug: string) =>
  API.delete(`/api/v1/seo/${slug}`);

// ─── Audio File Access ───────────────────────────────────────
export const adminEnrollAudioProgram = (id: string, data: { programId: string; batchId: string }) =>
  API.post(`/api/v1/audio-access/${id}/enroll-program`, data);

export const adminRejectAudioProgram = (id: string, data: { programId: string; reason: string }) =>
  API.patch(`/api/v1/audio-access/${id}/reject-program`, data);

export const adminGetAudioAccessRequests = (params?: { status?: string }) =>
  API.get("/api/v1/audio-access", { params });

export const adminUpdateAudioPin = (pin: string) =>
  API.put("/api/v1/audio-access/pin", { pin });

export const adminAddProgramToAudioRequest = (id: string, programId: string) =>
  API.post(`/api/v1/audio-access/${id}/add-program`, { programId });

export const adminGrantAudioAccess = (id: string, programsGranted: string[]) =>
  API.patch(`/api/v1/audio-access/${id}/grant`, { programsGranted });

export const adminRejectAudioAccess = (id: string, reason: string) =>
  API.patch(`/api/v1/audio-access/${id}/reject`, { reason });

// ─── Webinar Registration Forms ───────────────────────────────
export interface AssignRoleUser {
  _id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "rm" | "sales_manager" | "sales_rep" | "finance_manager" | "user";
}

export interface AssignRolesResponse {
  users: AssignRoleUser[];
  total?: number;
  page?: number;
  totalPages?: number;
}

export interface AssignRolesParams {
  page?: number;
  limit?: number;
}
export const getWebinars = () => API.get("/api/webinars");
export const getWebinar = (id: string) => API.get(`/api/webinars/${id}`);
export const createWebinar = (data: any) => API.post("/api/webinars", data);
export const updateWebinar = (id: string, data: any) => API.put(`/api/webinars/${id}`, data);
export const deleteWebinar = (id: string) => API.delete(`/api/webinars/${id}`);
export const getRegistrations = (id: string) => API.get(`/api/webinars/${id}/registrations`);
export const duplicateWebinar = (id: string) => API.post(`/api/webinars/${id}/duplicate`);


export default API;
