// src/components/Instructor/AttendanceSession.jsx
import React, { useEffect, useState } from "react";
import { getAttendanceLogs } from "../../services/api";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcuseModal from "./ExcuseModal";

const AttendanceSession = () => {
  const [recognizedStudents, setRecognizedStudents] = useState([]);
  const [lastClass, setLastClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionStart, setSessionStart] = useState(null);
  const [sessionEnd, setSessionEnd] = useState(null);
  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const formatName = (value = "") => {
    return value
      .trim()
      .split(" ")
      .map((w) =>
        w.length > 0
          ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          : ""
      )
      .join(" ");
  };

  // ==========================================
  // ✅ Fetch Latest Attendance Logs (NEW LOGIC)
  // ==========================================
  useEffect(() => {
    const fetchLatestAttendance = async () => {
      try {
        const classId = localStorage.getItem("lastClassId");
        if (!classId) {
          setRecognizedStudents([]);
          setLastClass(null);
          setLoading(false);
          return;
        }

        const res = await getAttendanceLogs(classId);
        const dateGroups = res?.logs || [];

        if (dateGroups.length === 0) {
          setRecognizedStudents([]);
          setLastClass(null);
          setLoading(false);
          return;
        }

        // 1️⃣ Sort by newest date
        dateGroups.sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestDate = dateGroups[0];

        // 2️⃣ Get sessions inside this date
        const sessions = latestDate.logs || [];

        // Filter only THIS CLASS sessions
        const filteredSessions = sessions.filter(
          (s) => s.class_id === classId
        );

        if (filteredSessions.length === 0) {
          setRecognizedStudents([]);
          setLastClass(null);
          setLoading(false);
          return;
        }

        // 3️⃣ Sort sessions by time to get the latest one
        filteredSessions.sort((a, b) =>
          b.start_time.localeCompare(a.start_time)
        );

        const latestSession = filteredSessions[0];

        // 4️⃣ Save class/session info
        setLastClass(latestSession);
        setSessionStart(latestSession.start_time);
        setSessionEnd(latestSession.end_time);

        // 5️⃣ Format students
        const students = (latestSession.students || []).map((s) => ({
          ...s,
          first_name: formatName(s.first_name || ""),
          last_name: formatName(s.last_name || ""),

          time:
            s.status === "Absent"
              ? "—"
              : s.time && s.time !== ""
              ? s.time
              : s.time_logged
              ? new Date(s.time_logged).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
              : "N/A",
        }));


        // Alphabetical sorting
        students.sort((a, b) =>
          `${a.last_name} ${a.first_name}`.localeCompare(
            `${b.last_name} ${b.first_name}`
          )
        );

        setRecognizedStudents(students);
      } catch (err) {
        console.error("❌ Error in AttendanceSession:", err);
        toast.error("Failed to load attendance summary");
      } finally {
        setLoading(false);
      }
    };

    fetchLatestAttendance();
    const handleFocus = () => fetchLatestAttendance();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // ==========================================
  // Helper Formatters
  // ==========================================
  const formatDate = (dateStr) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";

  const formatTime = (dateStr) =>
    dateStr
      ? new Date(dateStr).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "";

  // ==========================================
  // Excuse Modal Logic
  // ==========================================
  const openExcuseModal = (student) => {
    setSelectedStudent(student);
    setShowExcuseModal(true);
  };

  const handleExcuseMarked = (studentId, reason) => {
    setRecognizedStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId
          ? { ...s, status: "Excused", excuse_reason: reason }
          : s
      )
    );
  };

  const formatSemester = (sem) => {
    if (!sem) return "";
    const s = sem.toLowerCase();
    if (s.includes("1st")) return "1st Semester";
    if (s.includes("2nd")) return "2nd Semester";
    if (s.includes("mid")) return "Summer";
    return sem;
  };

  const formatTime12h = (timeStr) => {
    if (!timeStr) return "Not Recorded";

    // timeStr example: "16:03:14"
    const [h, m, s] = timeStr.split(":");

    const date = new Date();
    date.setHours(Number(h), Number(m), Number(s));

    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  // ==========================================
  // Export PDF
  // ==========================================
  const exportToPDF = () => {
    if (recognizedStudents.length === 0) {
      toast.info("⚠ No attendance logs to export.");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    // Logos
    doc.addImage("/ccit-logo.png", "PNG", 15, 10, 25, 25);
    doc.addImage("/prmsu.png", "PNG", pageWidth - 40, 10, 25, 25);

    // Header
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("Republic of the Philippines", pageWidth / 2, 18, { align: "center" });
    doc.text("President Ramon Magsaysay State University", pageWidth / 2, 25, {
      align: "center",
    });

    // Subheader
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.text("(Ramon Magsaysay Technological University)", pageWidth / 2, 32, {
      align: "center",
    });
    doc.text("Iba, Zambales", pageWidth / 2, 38, { align: "center" });

    // Title
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text(
      "COLLEGE OF COMMUNICATION AND INFORMATION TECHNOLOGY",
      pageWidth / 2,
      45,
      { align: "center" }
    );

    doc.setFontSize(14);
    doc.setTextColor(34, 197, 94);
    doc.text("ATTENDANCE SUMMARY REPORT", pageWidth / 2, 55, { align: "center" });

    // Class Info
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);

    if (lastClass) {
      doc.text(
        `Subject: ${lastClass.subject_code} – ${lastClass.subject_title}`,
        20,
        65
      );
      doc.text(
        `Instructor: ${formatName(lastClass.instructor_first_name)} ${formatName(lastClass.instructor_last_name)}`,
        20,
        72
      );
      doc.text(
        `Course: ${lastClass.course} | Section: ${lastClass.section}`,
        20,
        79
      );
    }

    // Date + Time Range
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(`Date: ${formatDate(new Date().toISOString())}`, 20, 87);

    if (sessionStart && sessionEnd) {
      doc.text(
        `Time: ${formatTime(sessionStart)} - ${formatTime(sessionEnd)}`,
        20,
        94
      );
    }

    // Summary
    const presentCount = recognizedStudents.filter((s) => s.status === "Present")
      .length;
    const absentCount = recognizedStudents.filter((s) => s.status === "Absent")
      .length;
    const lateCount = recognizedStudents.filter((s) => s.status === "Late").length;

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Summary → Present: ${presentCount} | Absent: ${absentCount} | Late: ${lateCount}`,
      20,
      104
    );

    // Table
    autoTable(doc, {
      startY: 112,
      head: [["Student ID", "Name", "Status", "Time"]],
      body: recognizedStudents.map((s) => [
        s.student_id,
        `${formatName(s.first_name)} ${formatName(s.last_name)}`,
        s.status,
        s.time || (s.status === "Absent" ? "—" : "N/A"),
      ]),
    });

    doc.save("attendance_summary_report.pdf");
  };

  // ==========================================
  // UI
  // ==========================================
  return (
    <div className="relative min-h-screen bg-neutral-950 text-white p-8 overflow-hidden rounded-2xl">

      {/* Background Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/20 blur-[160px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-600/20 blur-[160px] rounded-full"></div>

      {/* Header */}
      <div className="relative z-10 mb-6 flex flex-col gap-2">
        <h2 className="text-3xl font-extrabold text-transparent bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text flex items-center gap-2">
          🧾 Attendance Summary
        </h2>

        {/* Class Info */}
        {lastClass && (
          <div className="flex flex-col gap-0.5 mt-1">

            <p className="text-lg font-semibold text-white">
              {lastClass.subject_code} — {lastClass.subject_title}
            </p>

            <p className="text-gray-400 text-xs">
              {lastClass.course} ({lastClass.section})
              {" • "}{formatSemester(lastClass.semester)}
              {" • SY "}{lastClass.school_year}
              {" • Start "}{formatTime12h(lastClass.start_time)}
              {" • End "}{formatTime12h(lastClass.end_time)}
            </p>

          </div>
        )}

        {/* Date */}
        <span className="inline-block bg-white/10 backdrop-blur-md border border-white/20 text-emerald-300 text-xs font-medium px-3 py-1 rounded-full w-fit mt-2 shadow">
          {formatDate(new Date().toISOString())}
        </span>
      </div>

      {/* STUDENTS LIST */}
      <div className="relative z-10 bg-white/10 backdrop-blur-lg rounded-2xl shadow-lg border border-white/10 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-emerald-300">Attendance Summary</h3>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Total:{" "}
              <span className="text-white font-bold">
                {recognizedStudents.length}
              </span>
            </span>

            <button
              onClick={exportToPDF}
              className="px-4 py-2 rounded-lg text-white text-sm font-semibold
                bg-gradient-to-r from-emerald-500 to-green-600 shadow-md
                hover:from-green-600 hover:to-emerald-700 hover:shadow-emerald-500/30
                transition-all duration-300"
            >
              Export PDF
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 italic animate-pulse">Loading summary...</p>
        ) : recognizedStudents.length === 0 ? (
          <div className="text-center py-6 text-gray-400 italic">
            No attendance summary available for today.
          </div>
        ) : (
          <ul className="divide-y divide-white/10 max-h-[450px] overflow-y-auto custom-scroll">
            {recognizedStudents.map((s, idx) => (
              <li
                key={`${s.student_id}-${idx}`}
                className="flex items-center justify-between py-3 px-3 hover:bg-white/5 rounded-lg transition-all duration-300"
              >
                <div>
                  <p className="font-medium text-white">
                    {formatName(s.first_name)} {formatName(s.last_name)}
                  </p>
                  <p className="text-xs text-gray-400">ID: {s.student_id}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full shadow backdrop-blur-md border border-white/20
                      ${
                        s.status === "Present"
                          ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white"
                          : s.status === "Late"
                          ? "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white"
                          : s.status === "Excused"
                          ? "bg-gradient-to-r from-blue-500 to-blue-700 text-white"
                          : "bg-gradient-to-r from-red-500 to-red-700 text-white"
                      }`}
                  >
                    {s.status}
                  </span>

                  {(s.status === "Absent" || s.status === "Late") && (
                    <button
                      onClick={() => openExcuseModal(s)}
                      className="px-2 py-1 text-xs bg-blue-500/20 border border-blue-400 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-all"
                    >
                      Mark Excused
                    </button>
                  )}

                  <span className="text-sm text-gray-300 font-mono">
                    {s.time || (s.status === "Absent" ? "—" : "N/A")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Excuse Modal */}
      <ExcuseModal
        isOpen={showExcuseModal}
        onClose={() => setShowExcuseModal(false)}
        student={selectedStudent}
        classId={lastClass?.class_id || localStorage.getItem("lastClassId")}
        instructorId={localStorage.getItem("instructorId")}
        onExcuseMarked={handleExcuseMarked}
      />
    </div>
  );
};

export default AttendanceSession;
