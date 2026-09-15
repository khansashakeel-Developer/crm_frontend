"use client";
import ProtectedRoute from "@/app/component/protected-route";
import Sidebar from "@/app/component/sidebar";
import Navbar from "@/app/component/navbar";

import { useAppSelector } from "@/store/hooks";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Loader from "../component/loader/Loader";


export default function ConditionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { user: authUser } = useAppSelector((state) => state.auth);
  const role = authUser?.role;
  const isUserForResponsive = mounted && role === "user";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000); // 👈 small delay only

    return () => clearTimeout(timer);
  }, [pathname]);

  if (pathname === "/auth" || pathname === "/auth/callback") {
    return <>{children}</>;
  }

  return (
    <>
      {/* ✅ Overlay Loader (no layout shift) */}


      <ProtectedRoute>
        <div className="flex h-screen bg-gray-100 overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            <Navbar />
            <main className={isUserForResponsive ? "flex-1 px-2 py-4 sm:p-6 relative min-w-0 overflow-x-auto overflow-y-auto" : "flex-1 p-6 relative min-w-0 overflow-x-auto overflow-y-auto"}>
              {loading ? (
                <div className="absolute inset-0 z-[999] bg-white flex items-center justify-center">
                  <Loader />
                </div>
              ) : (
                children
              )}
            </main>
          </div>
        </div>
      </ProtectedRoute>
    </>
  );
}