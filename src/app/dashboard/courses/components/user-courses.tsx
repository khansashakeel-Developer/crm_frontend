"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import API from "@/utils/api";
import PageHeader from "@/app/component/dashboard/page-header";
import { FileVolume, BookOpen, Play, Clock, CheckCircle, Lock, ChevronRight, Award, Users, Calendar } from "lucide-react";
import LessonModal from "./lesson-modal";
import { useAppSelector } from "@/store/hooks";
import formatDuration from "@/utils/func";

// ── API calls ─────────────────────────────────────────────────
const getMyEnrollmentsWithProgress = () =>
  API.get("/api/v1/enrollments/my").then((r) => r.data.data);

// ── API call fix ──────────────────────────────────────────────
// const getMyEnrollmentsWithProgress = () =>
//   API.get("/api/v1/enrollments/my").then((r) => {
//     console.log("API response:", r.data); // ← structure dekho
//     const data = r.data.data ?? r.data ?? [];
//     return Array.isArray(data) ? data : [];
//   });

const getLearningDashboard = (enrollmentId: string) =>
  API.get(`/api/v1/learn/${enrollmentId}`).then((r) => {
    console.log("Learn dashboard response for enrollment", enrollmentId, ":", r.data);
    return r.data.data;
  });
// const getLearningDashboard = (enrollmentId: string) =>
//   API.get(`/api/v1/learn/${enrollmentId}`).then((r) => r.data.data);

// ── Progress Ring ─────────────────────────────────────────────
function ProgressRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FBBF24" strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" style={{ transition: "stroke-dasharray .5s ease" }} />
    </svg>
  );
}

// ── Enrollment Card ───────────────────────────────────────────
function EnrollmentCard({ enrollment }: { enrollment: any }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: authUser } = useAppSelector((state) => state.auth); // ← add karo
  const role = authUser?.role;
  const isUserForResponsive = role === "user";
  const [open, setOpen] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["learn-dashboard", enrollment._id],
    queryFn: () => getLearningDashboard(enrollment._id),
    enabled: open,
  });



  const pct = enrollment.progress || 0;
  const isComplete = enrollment.status === "completed" || pct >= 100;
  const isRestricted = enrollment.accessStatus === "RESTRICTED";
  const isSuspended = enrollment?.status === "suspended";
  const audioLocked = enrollment.audioAccess === false;


  const hasContent = ["level 1", "level 2"].includes(enrollment.program?.level);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ── Card Header ── */}
      <div className="p-5">
        <div className={isUserForResponsive ? "flex flex-col sm:flex-row items-start gap-4" : "flex items-start gap-4"}>
          {/* Progress Ring */}
          <div className="relative shrink-0">
            <ProgressRing pct={pct} size={52} />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
              {pct}%
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className={isUserForResponsive ? "flex flex-col sm:flex-row items-start justify-between gap-2" : "flex items-start justify-between gap-2"}>
              <div>
                <h3 className="font-semibold text-gray-900 text-base leading-tight">
                  {enrollment.program?.name || "Program"}
                </h3>
                {/* <p className="text-xs text-gray-400 mt-1">
                  {enrollment.batch?.name ? `Batch: ${enrollment.batch.name}` : "No batch assigned"}
                </p> */}
                {/* Batch Info */}
                {enrollment.batch &&  (
                  <div className="flex items-center gap-3 mt-3 p-3 bg-indigo-50 rounded-xl">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Calendar size={13} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-indigo-700">{enrollment.batch.name}</p>
                      {enrollment.batch.date_required !== false && (
                      <p className="text-xs text-indigo-400 mt-0.5">
                        {enrollment.batch.start_date
                          ? new Date(enrollment.batch.start_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                        {enrollment.batch.end_date && (
                          <> → {new Date(enrollment.batch.end_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</>
                        )}
                      </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${enrollment.batch.status === "active" ? "bg-emerald-100 text-emerald-700" :
                      enrollment.batch.status === "upcoming" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                      {enrollment.batch.status}
                    </span>
                  </div>
                )}
              </div>
              {isComplete ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full shrink-0">
                  <CheckCircle size={11} /> Completed
                </span>
              ) : (
                <span className="text-xs font-medium text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full shrink-0">
                  In Progress
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>
                  {dashboard?.completed_lessons || 0} of {dashboard?.total_lessons || "—"} lessons
                </span>
                <span>{pct}% complete</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-yellow-400 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {/* <div className="flex gap-2 mt-4">
          <button
            onClick={() => router.push(`/dashboard/courses/${enrollment._id}`)}
            className="flex-1 flex items-center justify-center gap-2 bg-yellow-400 text-gray-900 font-semibold text-sm py-2.5 rounded-xl hover:bg-yellow-500 transition-colors"
          >
            <Play size={14} className="fill-gray-900" />
            {pct === 0 ? "Start Learning" : "Continue Learning"}
          </button>
          <button
            onClick={() => setOpen(!open)}
            className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${open
                ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
          >
            {open ? "Hide" : "Quick View"}
          </button>
        </div> */}
        {/* Action Buttons */}
        <div className={isUserForResponsive ? "flex flex-col sm:flex-row gap-2 mt-4 relative" : "flex gap-2 mt-4 relative"}>
          <button
            onClick={() => !isRestricted && !isSuspended && hasContent && !audioLocked && router.push(`/dashboard/courses/${enrollment._id}`)}
            disabled={isRestricted || isSuspended || !hasContent || audioLocked}
            className={`flex-1 flex items-center justify-center gap-2 font-semibold text-sm py-2.5 rounded-xl transition-colors
    ${isSuspended ? "bg-rose-100 text-rose-400 cursor-not-allowed"
                : isRestricted ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : !hasContent ? "bg-gray-100 text-gray-400 cursor-not-allowed"  // ← NEW
                    : "bg-yellow-400 text-gray-900 hover:bg-yellow-500"
              }`}
          >
            <Play size={14} className={
              isSuspended ? "fill-rose-400"
                : (isRestricted || !hasContent) ? "fill-gray-400"
                  : "fill-gray-900"
            } />
            {isSuspended ? "Suspended"
              // : isRestricted ? "Access Restricted"
              : !hasContent ? "Coming Soon"
                : audioLocked ? "Audio Locked"
                  : pct === 0 ? "Start Learning"
                    : "Continue Learning"}
          </button>
          {/* {(!isRestricted && !isSuspended && !audioLocked && hasContent) && ( */}
          {(!isSuspended && !audioLocked && hasContent) && (
            <button
              onClick={() => setOpen(!open)}
              className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${open
                ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
            >
              {open ? "Hide" : "Quick View"}
            </button>
          )}
        </div>

        {/* ── Restricted Overlay Banner ── */}
        {/* {isRestricted && (
          <div className="mt-3 flex items-start gap-3 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
            <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
              <Lock size={13} className="text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-700">Access Restricted</p>
              <p className="text-xs text-rose-400 mt-0.5">
                Your enrollment is on hold due to pending payment. Please clear your dues to unlock access.
              </p>
            </div>
          </div>
        )} */}

        {/* ── Suspended Overlay Banner ── */}
        {isSuspended && (
          <div className="mt-3 flex items-start gap-3 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
            <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
              <Lock size={13} className="text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-700">Enrollment Suspended</p>
              <p className="text-xs text-rose-400 mt-0.5">
                Your enrollment has been suspended. Please contact support for more information.
              </p>
            </div>
          </div>
        )}

        {audioLocked && (
          <div className="mt-3 flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
              <Lock size={13} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Audio Access Restricted</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Your batch hasn't started yet — audio lessons will unlock once it begins.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ── Course List (expandable) ── */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50">
          {isLoading ? (
            <div className="py-6 text-center text-sm text-gray-400">Loading courses...</div>
          ) : !dashboard?.courses?.length ? (
            <div className="py-6 text-center text-sm text-gray-400">No courses found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {dashboard.courses.map((course: any, idx: number) => (
                <div key={course._id}>
                  {/* ── Course Row ── */}
                  <div
                    onClick={() =>
                      setExpandedCourse(expandedCourse === course._id ? null : course._id)
                    }
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-white cursor-pointer transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 text-xs font-bold text-gray-500 group-hover:bg-yellow-100 group-hover:text-yellow-700 transition-colors">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{course.title}</p>
                      <p className="text-xs text-gray-400">{course.total_lessons || 0} lessons</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {course.progress_percentage >= 100 ? (
                        <CheckCircle size={14} className="text-green-500" />
                      ) : course.progress_percentage > 0 ? (
                        <span className="text-xs text-yellow-600 font-medium">
                          {course.progress_percentage}%
                        </span>
                      ) : null}
                      <ChevronRight
                        size={14}
                        className={`text-gray-300 transition-all duration-200 ${expandedCourse === course._id ? "rotate-90 text-yellow-500" : "group-hover:text-gray-500"
                          }`}
                      />
                    </div>
                  </div>

                  {/* ── Modules + Lessons (expanded) ── */}
                  {expandedCourse === course._id && (
                    <div className="bg-white border-t border-gray-100">
                      {!course.modules?.length ? (
                        <div className="px-6 py-4 text-xs text-gray-400">No modules found</div>
                      ) : (
                        course.modules.map((mod: any) => (
                          <div key={mod._id}>
                            {/* Module Header */}
                            <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {mod.title}
                              </span>
                              {mod.progress_percentage > 0 && (
                                <span className="text-xs text-yellow-600 font-medium">
                                  {mod.progress_percentage}%
                                </span>
                              )}
                            </div>

                            {/* Lessons */}
                            {!mod.lessons?.length ? (
                              <div className="px-8 py-3 text-xs text-gray-400">No lessons</div>
                            ) : (
                              mod.lessons.map((lesson: any) => (
                                <div
                                  key={lesson._id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveLessonId(lesson._id);
                                  }}
                                  className="flex items-center gap-3 px-6 py-3 hover:bg-yellow-50 cursor-pointer border-t border-gray-50 group/lesson transition-colors"
                                >
                                  {/* Complete / Play icon */}
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${lesson.is_completed
                                      ? "bg-green-100"
                                      : "bg-gray-100 group-hover/lesson:bg-yellow-100"
                                      }`}
                                  >
                                    {lesson.is_completed ? (
                                      <CheckCircle size={12} className="text-green-500" />
                                    ) : (
                                      <Play size={9} className="text-gray-400 group-hover/lesson:text-yellow-600" />
                                    )}
                                  </div>

                                  <span className="text-sm text-gray-700 flex-1 truncate">
                                    {lesson.title}
                                  </span>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {lesson.duration_minutes > 0 && (
                                      <span className="text-xs text-gray-400">
                                        {formatDuration(lesson.duration_minutes)}m
                                      </span>
                                    )}
                                    {lesson.progress_percentage > 0 && !lesson.is_completed && (
                                      <span className="text-xs text-yellow-600 font-medium">
                                        {lesson.progress_percentage}%
                                      </span>
                                    )}
                                    <ChevronRight
                                      size={13}
                                      className="text-gray-300 group-hover/lesson:text-gray-500 transition-colors"
                                    />
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Lesson Modal ── */}
      {activeLessonId && (
        <LessonModal
          enrollmentId={enrollment._id}
          lessonId={activeLessonId}
          onClose={() => setActiveLessonId(null)}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["learn-dashboard", enrollment._id] });
          }}
        />
      )}
    </div>
  );
}

// ── Main User Courses Component ───────────────────────────────
export default function UserCourses() {
  const { user: authUser } = useAppSelector((state) => state.auth); // ← add karo

  const { data: enrollments, isLoading, isError } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: getMyEnrollmentsWithProgress,
    enabled: !!authUser,  // ← auth ready hone tak wait karo
    staleTime: 0,         // ← hamesha fresh data fetch karo
  });

  // safe array
  const list = Array.isArray(enrollments) ? enrollments
    : Array.isArray((enrollments as any)?.data) ? (enrollments as any).data
      : [];

  const active = list.filter((e: any) => e.status === "active");
  const suspended = list.filter((e: any) => e.status === "suspended");
  const completed = list.filter((e: any) => e.status === "completed" || e.isGraduated)
  return (
    <>
      <PageHeader
        title="My Courses"
        subtitle="Continue learning from where you left off"
        titleIcon={<FileVolume size={24} />}
        totalCount={list.length}
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading your courses...</p>
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-rose-500 text-sm">Failed to load courses</div>
      ) : !list.length ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-yellow-50 flex items-center justify-center">
            <BookOpen size={28} className="text-yellow-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-700">No courses yet</p>
            <p className="text-sm text-gray-400 mt-1">Contact admin to enroll in a program</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Enrollments */}
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BookOpen size={14} />
                Active ({active.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {active.map((e: any) => <EnrollmentCard key={e._id} enrollment={e} />)}
              </div>
            </div>
          )}

          {/* Suspended Enrollments */}
          {suspended.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Lock size={14} />
                Suspended ({suspended.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {suspended.map((e: any) => <EnrollmentCard key={e._id} enrollment={e} />)}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Award size={14} />
                Completed ({completed.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {completed.map((e: any) => <EnrollmentCard key={e._id} enrollment={e} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}