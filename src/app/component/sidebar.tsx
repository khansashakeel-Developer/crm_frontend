"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  LogOut,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  FileText,
  Receipt,
  TrendingUp,
  ClipboardList,
  ShieldCheck,
  ScrollText,
  Wallet,
  Globe,
  Monitor,
  FileVolume,
  SearchCheck,
  Landmark,
  BarChart3,
  BadgeDollarSign,
  UserPen,
  Video
} from "lucide-react";
import Image from "next/image";
import MiniLogo from "@/assets/mini-logo-white.webp";
import Popup from "@/app/component/ui/popup/popup";
import { useState } from "react";
import { useAppSelector } from "@/store/hooks";
import IconTooltip from "./ui/tooltip";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChildItem {
  label: string;
  href: string;
}

interface ChildGroup {
  header: string;
  subChildren: ChildItem[];
}

interface MenuItem {
  label: string;
  href?: string;
  icon: any;
  roles: string[];
  children?: (ChildItem | ChildGroup)[];
}

interface MenuSection {
  title?: string;
  roles: string[];
  mode: "crm" | "website" | "all";
  items: MenuItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isChildGroup(item: ChildItem | ChildGroup): item is ChildGroup {
  return "subChildren" in item;
}

// ── Menu data ──────────────────────────────────────────────────────────────────

const menuSections: MenuSection[] = [
  {
    roles: [
      "super_admin", "admin", "sales_manager", "sales_rep", "user", "finance_manager", "seo"
    ],
    mode: "crm",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "sales_manager", "sales_rep", "user", "finance_manager", "seo"] },
      { label: "Accounts", href: "/dashboard/accounts", icon: Landmark, roles: ["super_admin", "admin", "finance_manager"] },
      { label: "Users", href: "/dashboard/users", icon: UserPen, roles: ["finance_manager"] },
      { label: "Chatbot", href: "/dashboard/chatbot", icon: Users, roles: ["super_admin", "admin"] },
      { label: "Leads", href: "/dashboard/leads", icon: Users, roles: ["super_admin", "admin", "sales_manager", "sales_rep", "finance_manager"] },
      { label: "Programs", href: "/dashboard/programs", icon: GraduationCap, roles: ["super_admin", "admin", "finance_manager", "sales_manager", "sales_rep"] },
      { label: "Courses", href: "/dashboard/courses", icon: FileVolume, roles: ["user"] },
      { label: "Books", href: "/dashboard/my-books", icon: BookOpen, roles: ["user"] },
      { label: "Batches", href: "/dashboard/batches", icon: ClipboardList, roles: ["super_admin", "admin", "sales_manager", "sales_rep", "finance_manager"] },
      { label: "Audit Logs", href: "/dashboard/audit-logs", icon: ScrollText, roles: ["super_admin", "admin"] },
      { label: "Payments", href: "/dashboard/payments", icon: Receipt, roles: ["user"] },
      { label: "Contract", href: "/dashboard/contract", icon: FileText, roles: ["user"] },
      { label: "Setting", href: "/dashboard/settings", icon: Settings, roles: ["user"] },
    ],
  },
   {
    title: "Quick Book",
    roles: ["super_admin", "admin", "finance_manager"],
    mode: "crm",
    items: [
      {
        label: "Overall",
        icon: ClipboardList,
        roles: ["super_admin", "admin", "finance_manager"],
        children: [
          { label: "all", href: "/dashboard/quickbooks" },
          { label: "Compare", href: "/dashboard/quickbooks/compare" },
          { label: "Monitor", href: "/dashboard/quickbooks/monitor" },
        ],
      },
      {
        label: "setting",
        href: "/dashboard/quickbooks/settings",
        icon: ShieldCheck,
        roles: ["super_admin", "admin", "finance_manager"],
      },
    ],
  },
  {
    title: "Enrollments",
    roles: ["super_admin", "admin", "finance_manager", "sales_manager", "sales_rep"],
    mode: "crm",
    items: [
      {
        label: "Enrollments",
        icon: ClipboardList,
        roles: ["super_admin", "admin", "finance_manager", "sales_manager", "sales_rep"],
        children: [
          { label: "All Enrollments", href: "/dashboard/enrollments" },
          { label: "Active", href: "/dashboard/enrollments/active" },
          { label: "Completed", href: "/dashboard/enrollments/completed" },
          { label: "Suspended", href: "/dashboard/enrollments/suspended" },
        ],
      },
      {
        label: "Access Control",
        href: "/dashboard/access",
        icon: ShieldCheck,
        roles: ["super_admin", "admin", "finance_manager"],
      },
    ],
  },
  {
    title: "Finance",
    roles: ["super_admin", "admin", "finance_manager", "sales_manager", "user"],
    mode: "crm",
    items: [
      { label: "Overview", href: "/dashboard/finance", icon: Wallet, roles: ["super_admin", "admin"] },
      {
        label: "Invoices",
        icon: FileText,
        roles: ["super_admin", "admin", "finance_manager", "sales_manager"],
        children: [
          { label: "All Invoices", href: "/dashboard/finance/invoices" },
          { label: "Pending", href: "/dashboard/finance/invoices/pending" },
          { label: "Overdue", href: "/dashboard/finance/invoices/overdue" },
          { label: "Upcoming Dues", href: "/dashboard/finance/invoices/upcoming" },
        ],
      },
      { label: "Payments", href: "/dashboard/finance/payments", icon: BadgeDollarSign, roles: ["super_admin", "admin", "finance_manager"] },
      // { label: "Accounts", href: "/dashboard/finance/accounts", icon: Landmark, roles: ["super_admin", "admin", "finance_manager"] },
      { label: "Reports", href: "/dashboard/finance/reports", icon: BarChart3, roles: ["super_admin", "admin", "finance_manager"] },
    ],
  },
  {
    roles: ["super_admin", "admin", "seo"],
    mode: "website",
    items: [
      {
        label: "Blogs",
        icon: BookOpen,
        roles: ["super_admin", "admin", "seo"],
        children: [
          { label: "All Blogs", href: "/dashboard/blogs" },
          { label: "Create Blog", href: "/dashboard/blogs/create" },
        ],
      },
      {
        label: "Resources",
        href: "/dashboard/resources",
        icon: GraduationCap,
        roles: ["super_admin", "admin", "seo"],
      },
      { label: "Leads", href: "/dashboard/leads", icon: Users, roles: ["seo"] },

      {
        label: "SEO",
        icon: SearchCheck,
        roles: ["super_admin", "admin", "seo"],
        children: [
          { label: "All Pages", href: "/dashboard/seo" },
          { label: "Home", href: "/dashboard/seo/home" },
          { label: "One On One Coaching Sessions", href: "/dashboard/seo/one-on-one-coaching-sessions" },
          { label: "Contact", href: "/dashboard/seo/contact" },
          {
            header: "Blog",
            subChildren: [
              { label: "Main", href: "/dashboard/seo/blogs" },
            ],
          },
          {
            header: "Programs",
            subChildren: [
              { label: "NLP Practitioner", href: "/dashboard/seo/nlp-practitioner" },
              { label: "NLP Master Practitioner", href: "/dashboard/seo/nlp-master-practitioner" },
              { label: "Advanced Hypnotherapy", href: "/dashboard/seo/advanced-hypnotherapy-training" },
              { label: "NLP Trainer's Program", href: "/dashboard/seo/nlp-trainers-training-program" },
              { label: "Hypnosis Trainer's Program", href: "/dashboard/seo/hypnosis-trainers-training-program" },
              { label: "NLP Master Trainer", href: "/dashboard/seo/nlp-master-trainer-program" },
            ],
          },
          {
            header: "About Us",
            subChildren: [
              { label: "Who is Arslan Larik", href: "/dashboard/seo/who-is-arslan-larik" },
              { label: "Who is Bismillah Pervez", href: "/dashboard/seo/who-is-bismillah-pervez" },
              { label: "Why Train With AL&CO", href: "/dashboard/seo/why-train-with-alco" },
            ],
          },
          {
            header: "Services",
            subChildren: [
              { label: "Four Clouds Model", href: "/dashboard/seo/four-clouds-model" },
              { label: "Resource", href: "/dashboard/seo/resource" },
            ],
          },
        ],
      },
      {
        label: "Webinars",
        href: "/dashboard/webinars",
        icon: Video,
        roles: ["super_admin", "admin", "seo"],
      },
    ],
  },
];

// ── Tooltip wrapper (only for user role collapsed state) ───────────────────────



// ── Component ──────────────────────────────────────────────────────────────────

type SidebarMode = "crm" | "website";

function SidebarScrollStyles() {
  return (
    <style jsx global>{`
      .sidebar-scroll {
        scrollbar-width: thin;
        scrollbar-color: #ffffff #1f2937;
      }
      .sidebar-scroll::-webkit-scrollbar {
        width: 6px;
      }
      .sidebar-scroll::-webkit-scrollbar-track {
        background: #1f2937;
      }
      .sidebar-scroll::-webkit-scrollbar-thumb {
        background-color: #ffffff;
        border-radius: 9999px;
      }
      .sidebar-scroll::-webkit-scrollbar-thumb:hover {
        background-color: #e5e7eb;
      }
      .sidebar-scroll::-webkit-scrollbar-button {
        display: none;
        width: 0;
        height: 0;
      }
    `}</style>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user: authUser } = useAppSelector((state) => state.auth);
  const role = authUser?.role;

  const [showLogout, setShowLogout] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("crm");

  const isAdmin = role === "super_admin" || role === "admin";
  const isUserForResponsive = role === "user";

  const toggleMenu = (label: string) =>
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleModeSwitch = (mode: SidebarMode) => {
    setSidebarMode(mode);
    setOpenMenus({});
    setOpenGroups({});
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/auth";
  };

  const filteredSections = menuSections.filter((section) => {
    if (!section.roles.includes(role)) return false;
    if (isAdmin) {
      if (section.mode === "crm") return sidebarMode === "crm";
      if (section.mode === "website") return sidebarMode === "website";
      return true;
    }
    return true;
  });

  // ── User role: collapsed icon sidebar on small screens ──────────────────────
  if (isUserForResponsive) {
    return (
      <>
        <SidebarScrollStyles />
        {/* ── Small screen: icon-only collapsed sidebar ── */}
        <div className="
          lg:hidden
          w-16 h-screen bg-gray-900 text-white flex flex-col overflow-hidden
        ">
          {/* Logo icon */}
          <div className="p-3 border-b border-gray-700 flex justify-center shrink-0">
            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center shrink-0">
              <Image src={MiniLogo} alt="ALCO CRM Logo" width={28} height={28} className="object-contain" />
            </div>
          </div>

          {/* Nav icons */}
          <nav className={`flex-1 flex flex-col items-center gap-1 py-4 overflow-y-auto min-h-0 sidebar-scroll`}>
            {filteredSections.map((section) => {
              const visibleItems = section.items.filter((item) => item.roles.includes(role));
              if (visibleItems.length === 0) return null;

              return visibleItems.map((item) => {
                if (!item.href || item.children) return null;
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <IconTooltip key={item.href} label={item.label}>
                    <Link
                      href={item.href}
                      className={`
                        flex items-center justify-center w-10 h-10 rounded-lg transition-all
                        ${isActive
                          ? "bg-yellow-400 text-gray-900"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"
                        }
                      `}
                    >
                      <Icon size={20} />
                    </Link>
                  </IconTooltip>
                );
              });
            })}
          </nav>

          {/* Logout icon - sticky at bottom */}
          <div className="p-3 border-t border-gray-700 flex justify-center shrink-0">
            <IconTooltip label="Logout">
              <button
                onClick={() => setShowLogout(true)}
                className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
              >
                <LogOut size={20} />
              </button>
            </IconTooltip>
          </div>
        </div>

        {/* ── Large screen: full sidebar (original behaviour) ── */}
        <div className="hidden lg:flex w-64 h-screen bg-gray-900 text-white flex-col overflow-hidden">
          {/* Logo */}
          <div className="p-5 border-b border-gray-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center shrink-0">
                <Image src={MiniLogo} alt="ALCO CRM Logo" width={28} height={28} className="object-contain" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-white font-semibold text-sm truncate">Arslan Larik & Company</span>
                <span className="text-gray-400 text-xs">CRM of the company</span>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-6 overflow-y-auto min-h-0 sidebar-scroll">
            {filteredSections.map((section) => {
              const visibleItems = section.items.filter((item) => item.roles.includes(role));
              if (visibleItems.length === 0) return null;

              return (
                <div key={section.title ?? section.mode}>
                  {section.title && (
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-2">
                      {section.title}
                    </p>
                  )}
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      if (!item.href) return null;
                      const Icon = item.icon;
                      const isActive = pathname === item.href;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive
                            ? "bg-yellow-400 text-gray-900 font-semibold"
                            : "text-gray-400 hover:bg-gray-800 hover:text-white"
                            }`}
                        >
                          <Icon size={18} />
                          <span className="text-sm">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Logout - sticky at bottom */}
          <div className="p-4 border-t border-gray-700 shrink-0">
            <button
              onClick={() => setShowLogout(true)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-all w-full"
            >
              <LogOut size={18} />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>

        <Popup
          isOpen={showLogout}
          onClose={() => setShowLogout(false)}
          onConfirm={handleLogout}
          variant="info"
          title="Log Out"
          description="Are you sure you want to log out? You will need to sign in again to access your dashboard."
          confirmText="Yes, Log Out"
          cancelText="Stay"
        />
      </>
    );
  }

  // ── Admin / other roles: original full sidebar (unchanged) ─────────────────
  return (
    <>
      <SidebarScrollStyles />
      <div className="w-64 h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
        {/* Logo */}
        <div className="p-5 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center shrink-0">
              <Image src={MiniLogo} alt="ALCO CRM Logo" width={28} height={28} className="object-contain" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-white font-semibold text-sm truncate">Arslan Larik & Company</span>
              <span className="text-gray-400 text-xs">CRM of the company</span>
            </div>
          </div>
        </div>

        {/* Mode toggle */}
        {isAdmin && (
          <div className="px-3 pt-4 pb-1 shrink-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-1">Mode</p>
            <div className="space-y-0.5">
              {(["crm", "website"] as SidebarMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeSwitch(m)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${sidebarMode === m
                    ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-300"
                    : "border-transparent text-gray-400 hover:bg-gray-800 hover:text-white"
                    }`}
                >
                  {m === "crm"
                    ? <Monitor size={16} className={sidebarMode === m ? "text-yellow-400" : ""} />
                    : <Globe size={16} className={sidebarMode === m ? "text-yellow-400" : ""} />}
                  <span className="capitalize">{m}</span>
                  {sidebarMode === m && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {isAdmin && <div className="mx-4 mt-3 border-t border-gray-700/60 shrink-0" />}

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto min-h-0 sidebar-scroll">
          {filteredSections.map((section) => {
            const visibleItems = section.items.filter((item) => item.roles.includes(role));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title ?? section.mode}>
                {section.title && (
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-2">
                    {section.title}
                  </p>
                )}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;

                    if (item.children) {
                      const isOpen = !!openMenus[item.label];

                      const isChildActive = item.children.some((c) => {
                        if (isChildGroup(c)) {
                          return c.subChildren.some(
                            (sc) => pathname === sc.href || pathname.startsWith(sc.href)
                          );
                        }
                        return pathname === c.href || pathname.startsWith(c.href);
                      });

                      return (
                        <div key={item.label}>
                          <button
                            onClick={() => toggleMenu(item.label)}
                            className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all ${isChildActive
                              ? "text-yellow-400"
                              : "text-gray-400 hover:bg-gray-800 hover:text-white"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon size={18} />
                              <span className="text-sm">{item.label}</span>
                            </div>
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>

                          {isOpen && (
                            <div className="ml-7 mt-1 space-y-1 border-l border-gray-700 pl-3">
                              {item.children.map((child) => {
                                if (isChildGroup(child)) {
                                  const groupKey = `${item.label}::${child.header}`;
                                  const isGroupOpen = !!openGroups[groupKey];
                                  const isGroupActive = child.subChildren.some(
                                    (sc) => pathname === sc.href || pathname.startsWith(sc.href)
                                  );

                                  return (
                                    <div key={child.header}>
                                      <button
                                        onClick={() => toggleGroup(groupKey)}
                                        className={`flex items-center justify-between w-full px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${isGroupActive
                                          ? "text-yellow-400"
                                          : "text-gray-500 hover:text-gray-300"
                                          }`}
                                      >
                                        <span>{child.header}</span>
                                        {isGroupOpen
                                          ? <ChevronDown size={11} />
                                          : <ChevronRight size={11} />}
                                      </button>

                                      {isGroupOpen && (
                                        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-gray-700/60 pl-2">
                                          {child.subChildren.map((sc) => {
                                            const isActive = pathname === sc.href;
                                            return (
                                              <Link
                                                key={sc.href}
                                                href={sc.href}
                                                className={`block px-3 py-1.5 rounded-md text-sm transition-all ${isActive
                                                  ? "bg-yellow-400 text-gray-900 font-semibold"
                                                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                                  }`}
                                              >
                                                {sc.label}
                                              </Link>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                const isActive = pathname === child.href;
                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    className={`block px-3 py-2 rounded-md text-sm transition-all ${isActive
                                      ? "bg-yellow-400 text-gray-900 font-semibold"
                                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                      }`}
                                  >
                                    {child.label}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (!item.href) return null;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive
                          ? "bg-yellow-400 text-gray-900 font-semibold"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"
                          }`}
                      >
                        <Icon size={18} />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Logout - sticky at bottom */}
        <div className="px-4 py-2 border-t border-gray-700 shrink-0">
          <button
            onClick={() => setShowLogout(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-all w-full"
          >
            <LogOut size={18} />
            <span className="text-sm">Logout</span>
          </button>
        </div>

        <Popup
          isOpen={showLogout}
          onClose={() => setShowLogout(false)}
          onConfirm={handleLogout}
          variant="info"
          title="Log Out"
          description="Are you sure you want to log out? You will need to sign in again to access your dashboard."
          confirmText="Yes, Log Out"
          cancelText="Stay"
        />
      </div>
    </>
  );
}