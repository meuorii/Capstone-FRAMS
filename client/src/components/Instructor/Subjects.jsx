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
  FaBookOpen,
  FaClock,
  FaUsers,
  FaPlayCircle,
  FaStopCircle,
} from "react-icons/fa";

const Subjects = ({ onActivateSession }) => {
  const SHOW_DEBUG = false;

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);

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
    const currentTime = nowPH.toTimeString().slice(0, 5); // "HH:MM"

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

      // FACE CHECKS
      if (!fresh?.registered || !fresh.embeddings) {
        toast.error("❌ You must register your face first!");
        setLoadingId(null);
        return;
      }

      const emb = fresh.embeddings || {};

      const hasAnyAngle =
        (emb.front?.length === 512) ||
        (emb.left?.length === 512) ||
        (emb.right?.length === 512) ||
        (emb.up?.length === 512) ||
        (emb.down?.length === 512);

      if (!hasAnyAngle) {
        toast.error("⚠ At least ONE face angle must be registered.");
        setLoadingId(null);
        return;
      }

      // CLASS CHECK
      const classInfo = classes.find((c) => c._id === classId);

      // ❗ NEW: Check if NO schedule
      if (!classInfo.schedule_blocks || classInfo.schedule_blocks.length === 0) {
        toast.error("⚠ This class has no schedule. Please ask admin to set one.");
        setLoadingId(null);
        return;
      }

      // ❗ Check schedule time
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
  // UI
  // ---------------------------------------------------------
  return (
    <div className="relative z-10 bg-neutral-950 min-h-screen p-8 rounded-2xl overflow-hidden">

      {/* Background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/20 blur-[160px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-600/20 blur-[160px] rounded-full"></div>

      <div className="relative z-10 flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-10">
        <h2 className="text-3xl font-extrabold flex items-center gap-3 text-transparent bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text">
          <FaBookOpen className="text-emerald-400" /> Your Classes
        </h2>
      </div>

      {loading ? (
        <p className="text-neutral-400">Loading classes...</p>
      ) : classes.length > 0 ? (
        <div className="grid sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 relative z-10">

          {classes.map((c) => {
            const withinSchedule = isWithinSchedule(c.schedule_blocks);
            const hasSchedule = Array.isArray(c.schedule_blocks) && c.schedule_blocks.length > 0;

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
                  
                  {/* Schedule */}
                  <p className="flex items-center gap-2">
                    <FaClock className="text-emerald-400" />
                    {hasSchedule ? formatScheduleBlocks(c.schedule_blocks) : "No schedule set"}
                  </p>

                  {/* Course & Section */}
                  <p className="flex items-center gap-2">
                    <FaUsers className="text-emerald-400" />
                    {c.course} – {c.section}
                  </p>

                  {/* Status */}
                  <p>
                    <span className="font-medium text-gray-200">Status:</span>{" "}
                    {c.is_attendance_active ? (
                      <span className="text-emerald-400 font-semibold">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </p>

                  {/* NEW WARNINGS */}
                  {!hasSchedule && !c.is_attendance_active && (
                    <p className="text-red-400 text-xs mt-2">
                      ⚠ This class has no schedule.
                    </p>
                  )}

                  {hasSchedule && !withinSchedule && !c.is_attendance_active && (
                    <p className="text-red-400 text-xs mt-2">
                      ⚠ Not within scheduled time.
                    </p>
                  )}
                </div>

                {/* BUTTONS */}
                {c.is_attendance_active ? (
                  <button
                    onClick={() => handleStop(c._id)}
                    disabled={loadingId === c._id}
                    className="mt-6 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white
                    bg-gradient-to-r from-red-500 to-red-700 disabled:opacity-50"
                  >
                    <FaStopCircle />
                    {loadingId === c._id ? "Stopping..." : "Stop Attendance"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleActivate(c._id)}
                    disabled={
                      loadingId === c._id || !hasSchedule || !withinSchedule
                    }
                    className={`mt-6 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white text-sm
                      ${
                        hasSchedule && withinSchedule
                          ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-green-600 hover:to-emerald-700"
                          : "bg-gray-700 cursor-not-allowed opacity-50"
                      }`}
                  >
                    <FaPlayCircle />
                    {loadingId === c._id ? "Activating..." : "Activate Attendance"}
                  </button>
                )}
              </div>
            );
          })}

        </div>
      ) : (
        <p className="text-neutral-400 mt-4 text-center">
          No classes found. Please contact admin.
        </p>
      )}
    </div>
  );
};

export default Subjects;
