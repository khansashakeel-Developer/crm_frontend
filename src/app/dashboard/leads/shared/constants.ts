import { FilterField } from "@/app/component/dashboard/page-header";
import { Sparkles, ArrowLeftRight, ShieldCheck, Flame, BadgeCheck, Ban, LucideIcon, ClipboardList, } from "lucide-react";

// ── Status & Quality Colors ──────────────────────────────────
export const statusColor = (s: string) => {
  const m: Record<string, string> = {
    new: "bg-sky-100 text-sky-700",
    contacted: "bg-yellow-100 text-yellow-700",
    qualified: "bg-indigo-100 text-indigo-700",
    converted: "bg-teal-100 text-teal-700",
    lost: "bg-rose-100 text-rose-700",
    hot: "bg-red-100 text-red-600",
    warm: "bg-orange-100 text-orange-600",
    cold: "bg-blue-100 text-blue-600",
  };
  return m[s] || "bg-gray-100 text-gray-600";
};

export const qualityColor = (q: string) => {
  const m: Record<string, string> = {
    hot: "bg-red-100 text-red-600",
    warm: "bg-orange-100 text-orange-600",
    cold: "bg-blue-100 text-blue-600",
    converted: "bg-teal-100 text-teal-700",
  };
  return m[q] || "bg-gray-100 text-gray-500";
};

// ── Pipeline Stages (Kanban) ─────────────────────────────────
// export const PIPELINE_STAGES = [
//   { key: "new", label: "Application Received", color: "border-sky-600", bg: "bg-sky-200/60", dot: "bg-sky-600" },
//   { key: "contacted", label: "Client Contacted", color: "border-yellow-600", bg: "bg-yellow-200/60", dot: "bg-yellow-600" },
//   { key: "qualified", label: "Breakthrough Session", color: "border-indigo-600", bg: "bg-indigo-200/60", dot: "bg-indigo-600" },
//   { key: "interested", label: "Client Interested", color: "border-orange-600", bg: "bg-orange-200/60", dot: "bg-orange-600" },
//   { key: "converted", label: "Payment Received", color: "border-teal-600", bg: "bg-teal-200/60", dot: "bg-teal-600" },
//   { key: "enrolled", label: "Enrolled in Batch", color: "border-green-600", bg: "bg-green-200/60", dot: "bg-green-600" },
// ];
export const PIPELINE_STAGES: {
  key: string;
  label: string;
  color: string;
  bg: string;
  icon: LucideIcon;
}[] = [
    {
      key: "new",
      label: "New",
      color: "border-violet-400",
      bg: "bg-violet-100/80",
      icon: Sparkles,
    },
    {
      key: "contacted",
      label: "Contacted",
      color: "border-sky-400",
      bg: "bg-sky-100/80",
      icon: ArrowLeftRight,
    },
    {
      key: "qualified",
      label: "Qualified - Breakthrough Session",
      color: "border-amber-400",
      bg: "bg-amber-100/80",
      icon: ShieldCheck,
    },
    {
      key: "interested",
      label: "Interested",
      color: "border-orange-400",
      bg: "bg-orange-100/80",
      icon: Flame,
    },
    // {
    //   key: "converted",
    //   label: "Converted",
    //   color: "border-teal-400",
    //   bg: "bg-teal-100/80",
    //   icon: BadgeCheck,
    // },
    {
      key: "payment_plan",
      label: "Payment Plan",
      color: "border-green-400",
      bg: "bg-green-100/80",
      icon: Ban,
    },
    {
      key: "enrolled",
      label: "Enrolled in Batch",
      color: "border-green-600",
      bg: "bg-green-200/60",
      icon: ClipboardList
    },
  ];

// ── Status → Pipeline Stage Key ─────────────────────────────
// export function toStageKey(status: string) {
//   const m: Record<string, string> = {
//     new: "new",
//     contacted: "contacted",
//     qualified: "qualified",
//     interested: "interested",
//     converted: "converted",
//     enrolled: "enrolled",
//   };
//   return m[status] || "new";
// }
// export function toStageKey(lead: any): string {
//   if (lead.status === "converted") {
//     if (lead.user_id && lead.batch_id) return "enrolled";
//     if (lead.paymentPlan?.totalAmount) return "payment_plan";
//     return "converted";
//   }
//   return lead.status || "new";
// }
// constants.ts mein sirf yeh function replace karo

export function toStageKey(lead: any): string {
  if (lead.status === "converted") {
    if (lead.advance_paid === true) return "enrolled";
    return "payment_plan";
  }
  if (lead.status === "lost") return lead.previous_status || "new";
  return lead.status || "new";
}

// ── Shared Filter Fields ─────────────────────────────────────
export const leadFilterFields: FilterField[] = [
  { type: "input", name: "search", placeholder: "Search name, email..." },
  {
    type: "select", name: "status",
    options: [
      { label: "New", value: "new" },
      { label: "Contacted", value: "contacted" },
      { label: "Qualified", value: "qualified" },
      { label: "Converted", value: "converted" },
      { label: "Lost", value: "lost" },
    ],
  },
  {
    type: "select", name: "quality",
    options: [
      { label: "Hot", value: "hot" },
      { label: "Warm", value: "warm" },
      { label: "Cold", value: "cold" },
    ],
  },
  {
    type: "select", name: "source",
    options: [
      { label: "Facebook", value: "facebook" },
      { label: "Google", value: "google" },
      { label: "Organic", value: "organic" },
      { label: "Referral", value: "referral" },
      { label: "Enroll", value: "enroll" },
      { label: "Contact", value: "contact" },
    ],
  },
  {
    type: "select",
    name: "dateFilter",
    placeholder: "All Time",
    options: [
      { label: "All Time", value: "" },
      { label: "Today", value: "today" },
      { label: "This Week", value: "this_week" },
      { label: "This Month", value: "this_month" },
      { label: "Last 3 Months", value: "last_3_months" },
      { label: "Last 6 Months", value: "last_6_months" },
      { label: "Custom Date", value: "custom" },
    ],
  },
  {
    name: "hasInvoiceNumber",
    label: "Invoice Generated",
    type: "checkbox",
  }
];

// ── Default Filter State ─────────────────────────────────────
// ── Default Filter State ─────────────────────────────────────
export const defaultLeadFilters = {
  status: "",
  quality: "",
  source: "",
  search: "",
  hasInvoiceNumber: false,
  dateFilter: "",
  dateFrom: "",
  dateTo: "",
};
// import { FilterField } from "@/app/component/dashboard/page-header";

// // ── Status & Quality Colors ──────────────────────────────────
// export const statusColor = (s: string) => {
//   const m: Record<string, string> = {
//     new: "bg-sky-100 text-sky-700",
//     contacted: "bg-yellow-100 text-yellow-700",
//     qualified: "bg-indigo-100 text-indigo-700",
//     converted: "bg-teal-100 text-teal-700",
//     lost: "bg-rose-100 text-rose-700",
//     hot: "bg-red-100 text-red-600",
//     warm: "bg-orange-100 text-orange-600",
//     cold: "bg-blue-100 text-blue-600",
//   };
//   return m[s] || "bg-gray-100 text-gray-600";
// };

// export const qualityColor = (q: string) => {
//   const m: Record<string, string> = {
//     hot: "bg-red-100 text-red-600",
//     warm: "bg-orange-100 text-orange-600",
//     cold: "bg-blue-100 text-blue-600",
//   };
//   return m[q] || "bg-gray-100 text-gray-500";
// };

// // ── Pipeline Stages (Kanban) ─────────────────────────────────
// export const PIPELINE_STAGES = [
//   { key: "new", label: "Application Received", color: "border-sky-600", bg: "bg-sky-200/60", dot: "bg-sky-600" },
//   { key: "contacted", label: "Client Contacted", color: "border-yellow-600", bg: "bg-yellow-200/60", dot: "bg-yellow-600" },
//   { key: "qualified", label: "Breakthrough Session", color: "border-indigo-600", bg: "bg-indigo-200/60", dot: "bg-indigo-600" },
//   { key: "interested", label: "Client Interested", color: "border-orange-600", bg: "bg-orange-200/60", dot: "bg-orange-600" },
//   { key: "converted", label: "Payment Received", color: "border-teal-600", bg: "bg-teal-200/60", dot: "bg-teal-600" },
//   { key: "enrolled", label: "Enrolled in Batch", color: "border-green-600", bg: "bg-green-200/60", dot: "bg-green-600" },
// ];

// // ── Status → Pipeline Stage Key ─────────────────────────────
// export function toStageKey(status: string) {
//   const m: Record<string, string> = {
//     new: "new",
//     contacted: "contacted",
//     qualified: "qualified",
//     interested: "interested",
//     converted: "converted",
//     enrolled: "enrolled",
//   };
//   return m[status] || "new";
// }

// // ── Shared Filter Fields ─────────────────────────────────────
// export const leadFilterFields: FilterField[] = [
//   { type: "input", name: "search", placeholder: "Search name, email..." },
//   {
//     type: "select", name: "status",
//     options: [
//       { label: "New", value: "new" },
//       { label: "Contacted", value: "contacted" },
//       { label: "Qualified", value: "qualified" },
//       { label: "Converted", value: "converted" },
//       { label: "Lost", value: "lost" },
//     ],
//   },
//   {
//     type: "select", name: "quality",
//     options: [
//       { label: "Hot", value: "hot" },
//       { label: "Warm", value: "warm" },
//       { label: "Cold", value: "cold" },
//     ],
//   },
//   {
//     type: "select", name: "source",
//     options: [
//       { label: "Facebook", value: "facebook" },
//       { label: "Google", value: "google" },
//       { label: "Organic", value: "organic" },
//       { label: "Referral", value: "referral" },
//       { label: "Enroll", value: "enroll" },
//       { label: "Contact", value: "contact" },
//     ],
//   },
// ];

// // ── Default Filter State ─────────────────────────────────────
// export const defaultLeadFilters = {
//   status: "",
//   quality: "",
//   source: "",
//   search: "",
// };