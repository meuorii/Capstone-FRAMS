// src/components/Instructor/Subjects.jsx
import { useEffect, useState } from "react";
import {
  getClassesByInstructor,
  activateAttendance,
  stopAttendance,
  getInstructorById,
} from "../../services/api";
import { toast } from "react-toastify";

import {
  BookOpen,
  Clock,
  Users,
  PlayCircle,
  StopCircle,
  LayoutGrid,
  Table2,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
} from "lucide-react";

const Subjects = ({ onActivateSession }) => {
  const SHOW_DEBUG = false;

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // "card" | "table"

  const [instructorData, setInstructorData] = useState(
    JSON.parse(localStorage.getItem("userData"))
  );

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (instructorData?.instructor_id && token) fetchClasses();
  }, []);

  // ---------------------------------------------------------
  // FETCH CLASSES
  // ---------------------------------------------------------
  const fetchClasses = async () => {
    try {
      const data = await getClassesByInstructor(
        instructorData.instructor_id,
        token
      );
      setClasses(data || []);
    } catch (err) {
      console.error("❌ Failed to load classes:", err.response?.data || err);
      toast.error("Failed to load classes.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // SCHEDULE VALIDATION
  // ---------------------------------------------------------
  const isWithinSchedule = (schedule_blocks = []) => {
    if (!Array.isArray(schedule_blocks) || schedule_blocks.length === 0)
      return false;

    const nowPH = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
    );

    const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDay = dayMap[nowPH.getDay()];
    const currentTime = nowPH.toTimeString().slice(0, 5);

    return schedule_blocks.some((b) => {
      if (!b.days || !b.start || !b.end) return false;
      const dayMatch = b.days.includes(currentDay);
      const timeMatch = currentTime >= b.start && currentTime <= b.end;
      return dayMatch && timeMatch;
    });
  };

  // ---------------------------------------------------------
  // ACTIVATE SESSION
  // ---------------------------------------------------------
  const handleActivate = async (classId) => {
    try {
      setLoadingId(classId);

      const fresh = await getInstructorById(instructorData.instructor_id);
      localStorage.setItem("userData", JSON.stringify(fresh));
      setInstructorData(fresh);

      if (!fresh?.registered || !fresh.embeddings) {
        toast.error("❌ You must register your face first!");
        setLoadingId(null);
        return;
      }

      const emb = fresh.embeddings || {};
      const hasAnyAngle =
        emb.front?.length === 512 ||
        emb.left?.length === 512 ||
        emb.right?.length === 512 ||
        emb.up?.length === 512 ||
        emb.down?.length === 512;

      if (!hasAnyAngle) {
        toast.error("⚠ At least ONE face angle must be registered.");
        setLoadingId(null);
        return;
      }

      const classInfo = classes.find((c) => c._id === classId);

      if (!classInfo.schedule_blocks || classInfo.schedule_blocks.length === 0) {
        toast.error("⚠ This class has no schedule. Please ask admin to set one.");
        setLoadingId(null);
        return;
      }

      if (!isWithinSchedule(classInfo.schedule_blocks)) {
        toast.error("⚠ You can only activate attendance during scheduled time.");
        setLoadingId(null);
        return;
      }

      await activateAttendance(classId);
      toast.success("✅ Attendance session activated!");

      fetchClasses();
      onActivateSession?.(classInfo);
    } catch (err) {
      console.error("❌ Activation error:", err.response?.data || err);
      toast.error(err.response?.data?.error || "Failed to activate session.");
    } finally {
      setLoadingId(null);
    }
  };

  // ---------------------------------------------------------
  // STOP SESSION
  // ---------------------------------------------------------
  const handleStop = async (classId) => {
    try {
      setLoadingId(classId);
      await stopAttendance(classId);
      toast.info("🛑 Attendance session stopped.");
      fetchClasses();
    } catch (err) {
      console.error("❌ Stop failed:", err.response?.data || err);
      toast.error("Failed to stop session.");
    } finally {
      setLoadingId(null);
    }
  };

  const formatScheduleBlocks = (blocks) => {
    if (!Array.isArray(blocks) || blocks.length === 0) return "No schedule";

    const days = new Set();
    const times = [];

    blocks.forEach((b) => {
      if (Array.isArray(b.days)) b.days.forEach((d) => days.add(d));
      if (b.start && b.end) times.push(`${b.start}–${b.end}`);
    });

    return `${Array.from(days).join(", ")} • ${times.join(", ")}`;
  };

  // ---------------------------------------------------------
  // SHARED ACTION BUTTON RENDERER
  // ---------------------------------------------------------
  const ActionButton = ({ c, withinSchedule, hasSchedule }) => {
    if (c.is_attendance_active) {
      return (
        <button
          onClick={() => handleStop(c._id)}
          disabled={loadingId === c._id}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium
            bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800
            disabled:opacity-50 transition-all duration-200 whitespace-nowrap"
        >
          <StopCircle size={14} />
          {loadingId === c._id ? "Stopping..." : "Stop"}
        </button>
      );
    }

    return (
      <button
        onClick={() => handleActivate(c._id)}
        disabled={loadingId === c._id || !hasSchedule || !withinSchedule}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium
          transition-all duration-200 whitespace-nowrap
          ${
            hasSchedule && withinSchedule
              ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-green-600 hover:to-emerald-700"
              : "bg-neutral-700 cursor-not-allowed opacity-50"
          }`}
      >
        <PlayCircle size={14} />
        {loadingId === c._id ? "Activating..." : "Activate"}
      </button>
    );
  };

  // ---------------------------------------------------------
  // CARD VIEW
  // ---------------------------------------------------------
  const CardView = () => (
    <div className="grid sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      {classes.map((c) => {
        const withinSchedule = isWithinSchedule(c.schedule_blocks);
        const hasSchedule =
          Array.isArray(c.schedule_blocks) && c.schedule_blocks.length > 0;

        return (
          <div
            key={c._id}
            className="bg-neutral-900 backdrop-blur-md rounded-2xl p-6 border border-white/10
              hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/30
              transition-all duration-300 hover:-translate-y-1 flex flex-col"
          >
            <h3 className="text-xl font-bold text-white">{c.subject_title}</h3>
            <p className="text-sm text-gray-400 mb-4">{c.subject_code}</p>

            <div className="text-sm text-gray-300 space-y-3 flex-1">
              <p className="flex items-center gap-2">
                <Clock size={15} className="text-emerald-400 shrink-0" />
                {hasSchedule
                  ? formatScheduleBlocks(c.schedule_blocks)
                  : "No schedule set"}
              </p>

              <p className="flex items-center gap-2">
                <Users size={15} className="text-emerald-400 shrink-0" />
                {c.course} – {c.section}
              </p>

              <p className="flex items-center gap-2">
                {c.is_attendance_active ? (
                  <>
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-400 font-semibold">Active</span>
                  </>
                ) : (
                  <>
                    <MinusCircle size={15} className="text-gray-500 shrink-0" />
                    <span className="text-gray-400">Inactive</span>
                  </>
                )}
              </p>

              {!hasSchedule && !c.is_attendance_active && (
                <p className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                  <AlertTriangle size={13} />
                  This class has no schedule.
                </p>
              )}

              {hasSchedule && !withinSchedule && !c.is_attendance_active && (
                <p className="flex items-center gap-1.5 text-yellow-400 text-xs mt-2">
                  <AlertTriangle size={13} />
                  Not within scheduled time.
                </p>
              )}
            </div>

            <div className="mt-6">
              <ActionButton
                c={c}
                withinSchedule={withinSchedule}
                hasSchedule={hasSchedule}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------
  // TABLE VIEW
  // ---------------------------------------------------------
  const TableView = () => (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-neutral-800/80 text-gray-400 uppercase text-xs tracking-wider">
            <th className="px-5 py-4">Subject</th>
            <th className="px-5 py-4">Code</th>
            <th className="px-5 py-4">Schedule</th>
            <th className="px-5 py-4">Course & Section</th>
            <th className="px-5 py-4">Status</th>
            <th className="px-5 py-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {classes.map((c) => {
            const withinSchedule = isWithinSchedule(c.schedule_blocks);
            const hasSchedule =
              Array.isArray(c.schedule_blocks) && c.schedule_blocks.length > 0;

            return (
              <tr
                key={c._id}
                className="bg-neutral-900 hover:bg-neutral-800/60 transition-colors duration-150"
              >
                {/* Subject */}
                <td className="px-5 py-4 font-semibold text-white whitespace-nowrap">
                  {c.subject_title}
                </td>

                {/* Code */}
                <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                  {c.subject_code}
                </td>

                {/* Schedule */}
                <td className="px-5 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <Clock size={13} className="text-emerald-400 shrink-0" />
                      {hasSchedule
                        ? formatScheduleBlocks(c.schedule_blocks)
                        : <span className="text-gray-500 italic">No schedule set</span>}
                    </span>
                    {!hasSchedule && !c.is_attendance_active && (
                      <span className="flex items-center gap-1 text-red-400 text-xs">
                        <AlertTriangle size={11} /> No schedule assigned
                      </span>
                    )}
                    {hasSchedule && !withinSchedule && !c.is_attendance_active && (
                      <span className="flex items-center gap-1 text-yellow-400 text-xs">
                        <AlertTriangle size={11} /> Outside scheduled time
                      </span>
                    )}
                  </div>
                </td>

                {/* Course & Section */}
                <td className="px-5 py-4">
                  <span className="flex items-center gap-1.5 text-gray-300">
                    <Users size={13} className="text-emerald-400 shrink-0" />
                    {c.course} – {c.section}
                  </span>
                </td>

                {/* Status */}
                <td className="px-5 py-4">
                  {c.is_attendance_active ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                      <CheckCircle2 size={12} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      bg-neutral-700/50 text-gray-400 text-xs font-semibold border border-white/10">
                      <MinusCircle size={12} /> Inactive
                    </span>
                  )}
                </td>

                {/* Action */}
                <td className="px-5 py-4 text-right">
                  <ActionButton
                    c={c}
                    withinSchedule={withinSchedule}
                    hasSchedule={hasSchedule}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <div className="relative z-10 bg-neutral-950 min-h-screen p-8 rounded-2xl overflow-hidden">

      {/* Background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/20 blur-[160px] rounded-full" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-600/20 blur-[160px] rounded-full" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-10">
        <h2 className="text-3xl font-extrabold flex items-center gap-3 text-transparent bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text">
          <BookOpen className="text-emerald-400" /> Your Classes
        </h2>

        {/* View Toggle */}
        {!loading && classes.length > 0 && (
          <div className="flex items-center gap-1 bg-neutral-800 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setViewMode("card")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${
                  viewMode === "card"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-gray-400 hover:text-gray-200"
                }`}
            >
              <LayoutGrid size={16} />
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${
                  viewMode === "table"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-gray-400 hover:text-gray-200"
                }`}
            >
              <Table2 size={16} />
              Table
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10">
        {loading ? (
          <p className="text-neutral-400">Loading classes...</p>
        ) : classes.length > 0 ? (
          viewMode === "card" ? <CardView /> : <TableView />
        ) : (
          <p className="text-neutral-400 mt-4 text-center">
            No classes found. Please contact admin.
          </p>
        )}
      </div>
    </div>
  );
};

export default Subjects;