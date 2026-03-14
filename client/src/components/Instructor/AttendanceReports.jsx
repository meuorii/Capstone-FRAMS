// src/components/Instructor/AttendanceReport.jsx
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";


import {
  getAllClassesByInstructor,
  getInstructorSessions,
  getAllInstructorSessions,
} from "../../services/api";

import { toast } from "react-toastify";
import { FaClipboardList, FaListUl, FaFilePdf } from "react-icons/fa";

import { useModal } from "./ModalManager";
import DailyLogsModal from "./DailyLogsModal";

const semesterMap = {
  "1st Sem": "1st Semester",
  "2nd Sem": "2nd Semester",
  "Summer": "Mid Year",
};

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const AttendanceReport = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // WEEK FILTER
  const [weekStart, setWeekStart] = useState(null);
  const weekEnd = weekStart
    ? new Date(new Date(weekStart).setDate(new Date(weekStart).getDate() + 6))
    : null;

  const instructor = JSON.parse(localStorage.getItem("userData"));
  const { openModal } = useModal();

  // Convert ANY name to Proper Case
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

    // Format date → "November 11, 2025"
    const formatLongDate = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

  // ============================================================
  // LOAD CLASSES
  // ============================================================
  useEffect(() => {
    if (!instructor?.instructor_id) {
      toast.error("Instructor data missing.");
      return;
    }
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const data = await getAllClassesByInstructor(instructor.instructor_id);
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load classes.");
    }
  };

  // ============================================================
  // FETCH SESSIONS
  // ============================================================
  const fetchSessions = async () => {
    setLoading(true);
    try {
      let data = [];

      if (!selectedClass) {
        data = await getAllInstructorSessions(instructor.instructor_id);
      } else {
        data = await getInstructorSessions(selectedClass);
      }

      // Merge metadata
      const classMap = {};
      classes.forEach((cls) => (classMap[cls._id] = cls));

      data = data.map((s) => {
      const cls = classMap[s.class_id]; // class info if available

      return {
        ...s,
        subject_code: s.subject_code || cls?.subject_code || "Unknown",
        subject_title: s.subject_title || cls?.subject_title || "Unknown",
        course: s.course || cls?.course || "",
        section: s.section || cls?.section || "",
        semester: s.semester || cls?.semester || "",
        school_year: s.school_year || cls?.school_year || "",
      };
    });


      // Sort newest first
      const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setSessions(sorted);
    } catch {
      toast.error("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch sessions whenever class list loads or class filter changes
  useEffect(() => {
    if (classes.length > 0) {
      fetchSessions();
    }
  }, [selectedClass, classes]);

  // ============================================================
  // APPLY ALL FILTERS
  // ============================================================
  useEffect(() => {
    let filtered = [...sessions];

    // Semester filter
    if (selectedSemester) {
      filtered = filtered.filter((s) => s.semester === selectedSemester);
    }

    // School year filter
    if (selectedSchoolYear) {
      filtered = filtered.filter((s) => s.school_year === selectedSchoolYear);
    }

    // Month filter
    if (selectedMonth) {
      filtered = filtered.filter((s) => {
        const d = new Date(s.date);
        return d.getMonth() + 1 === Number(selectedMonth);
      });
    }

    // Week filter
    if (weekStart) {
      const start = new Date(weekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      filtered = filtered.filter((s) => {
        const d = new Date(s.date);
        return d >= start && d <= end;
      });
    }

    setFilteredSessions(filtered);
  }, [sessions, selectedSemester, selectedSchoolYear, selectedMonth, weekStart]);

  const groupedByClass = filteredSessions.reduce((acc, session) => {
    if (!acc[session.class_id]) {
      acc[session.class_id] = {
        meta: {
          subject_code: session.subject_code,
          subject_title: session.subject_title,
          course: session.course,
          section: session.section,
          semester: session.semester,
          school_year: session.school_year,
        },
        rows: []
      };
    }
    acc[session.class_id].rows.push(session);
    return acc;
  }, {});


  // ============================================================
  // EXPORT PDF
  // ============================================================
  const exportToPDF = () => {
    if (filteredSessions.length === 0) {
      toast.warn("No attendance to export.");
      return;
    }

    // 1) Group sessions by CLASS ID — ensures 1 class = 1 page
    const grouped = {};
    filteredSessions.forEach((s) => {
      if (!grouped[s.class_id]) grouped[s.class_id] = [];
      grouped[s.class_id].push(s);
    });

    const doc = new jsPDF("l", "mm", "a3");
    const width = doc.internal.pageSize.getWidth();
    let isFirstPage = true;

    // PROCESS EACH CLASS GROUP
    Object.keys(grouped).forEach((classId) => {
      const sessions = grouped[classId].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      // Grab subject metadata from classes[]
      const meta = classes.find((c) => c._id === classId) || {
        subject_code: sessions[0]?.subject_code || "",
        subject_title: sessions[0]?.subject_title || "",
        course: sessions[0]?.course || "",
        section: sessions[0]?.section || "",
        semester: sessions[0]?.semester || "",
        school_year: sessions[0]?.school_year || "",
      };

      // New page for next class
      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      // ============================
      // BUILD STUDENT MATRIX TABLE
      // ============================
      const studentMap = {};

      sessions.forEach((session) => {
        (session.students || []).forEach((stud) => {
          const fullName =
            stud.student_name ||
            `${formatName(stud.last_name || "")}, ${formatName(stud.first_name || "")}` ||
            "Unknown";

          const key = stud.student_id || fullName;

          if (!studentMap[key]) {
            studentMap[key] = {
              id: stud.student_id,
              name: fullName,
              logs: {},
            };
          }

          studentMap[key].logs[session.date] = stud.status;
        });
      });

      const dateColumns = sessions.map((s) => s.date);

      // Sort alphabetically by LAST NAME
      const allStudents = Object.values(studentMap).sort((a, b) => {
        const lastA = a.name.split(",")[0].trim().toLowerCase();
        const lastB = b.name.split(",")[0].trim().toLowerCase();
        return lastA.localeCompare(lastB);
      });

      const tableHead = [["Student Name", ...dateColumns]];

      const tableBody = allStudents.map((student) => {
        const row = [student.name];

        dateColumns.forEach((date) => {
          const status = student.logs[date] || "";
          row.push(
            status === "Present"
              ? "P"
              : status === "Late"
              ? "L"
              : status === "Absent"
              ? "A"
              : ""
          );
        });

        return row;
      });

      // ============================
      // HEADER + SCHOOL INFO
      // ============================
        doc.addImage("/prmsu.png", "PNG", 15, 8, 25, 25);
        doc.addImage("/ccit-logo.png", "PNG", width - 40, 8, 25, 25);

        // University Name
        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.text(
          "PRESIDENT RAMON MAGSAYSAY STATE UNIVERSITY",
          width / 2,
          20,
          { align: "center" }
        );

        // College
        doc.setFontSize(12);
        doc.text(
          "College of Communication and Information Technology",
          width / 2,
          28,
          { align: "center" }
        );

        // ===== Added Lines (Your Request) =====
        doc.setFont("times", "italic");
        doc.setFontSize(11);
        doc.text(
          "(Ramon Magsaysay Technological University)",
          width / 2,
          32,
          { align: "center" }
        );

        doc.text("Iba, Zambales", width / 2, 38, { align: "center" });
        // ======================================

        // Report Title
        doc.setFontSize(16);
        doc.setTextColor(34, 197, 94);
        doc.text("ATTENDANCE REPORT", width / 2, 48, { align: "center" });
        doc.setTextColor(0, 0, 0);

      // Metadata
      const instructorName = `${formatName(instructor.first_name)} ${formatName(instructor.last_name)}`;

      doc.setFontSize(11);
      doc.text(`Instructor: ${instructorName}`, 15, 55);
      doc.text(
        `Subject: ${meta.subject_code} — ${meta.subject_title}`,
        15,
        62
      );
      doc.text(
        `Course & Section: ${meta.course} — ${meta.section}`,
        15,
        69
      );
      doc.text(`Semester: ${meta.semester}`, 15, 76);
      doc.text(`School Year: ${meta.school_year}`, 15, 83);

      if (selectedMonth) {
        doc.text(
          `Month: ${monthNames[selectedMonth - 1]}`,
          width - 80,
          55
        );
      }

      if (weekStart) {
        doc.text(
          `Week: ${weekStart.toISOString().split("T")[0]} to ${weekEnd
            .toISOString()
            .split("T")[0]}`,
          width - 120,
          62
        );
      }

      // ============================
      // TABLE
      // ============================
      autoTable(doc, {
        startY: 95,
        head: tableHead,
        body: tableBody,
        styles: { fontSize: 9, halign: "center" },
        headStyles: { fillColor: [34, 197, 94], textColor: 255 },
        columnStyles: { 0: { halign: "left" } },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index > 0) {
            const val = data.cell.raw;
            if (val === "A") data.cell.styles.textColor = [255, 0, 0];
            if (val === "L") data.cell.styles.textColor = [255, 165, 0];
            if (val === "P") data.cell.styles.textColor = [0, 150, 0];
          }
        },
      });
    });

    doc.save("Attendance_Report.pdf");
  };

  // ============================================================
  // RENDER UI
  // ============================================================
  return (
    <div className="p-8 bg-neutral-950/80 rounded-2xl border border-white/10 shadow-xl space-y-8">

      <div className="flex items-center gap-3">
        <FaClipboardList className="text-green-400 text-3xl" />
        <h2 className="text-3xl font-bold text-emerald-400">Attendance Report</h2>
      </div>

      {/* FILTER BAR — 1 ROW, SCROLLABLE */}
      <div className="flex items-center gap-4 pb-2 no-scrollbar">
        
        {/* CLASS */}
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="min-w-[180px] px-4 py-2 bg-neutral-900/70 border border-white/10 text-white rounded-md"
        >
          <option value="">All Classes</option>
          {classes
            .filter((c) => {
              if (selectedSchoolYear && c.school_year !== selectedSchoolYear) return false;
              if (selectedSemester && c.semester !== selectedSemester) return false;
              return true;
            })
            .map((c) => (
              <option key={c._id} value={c._id}>
                {c.subject_code} • {c.course} {c.section}
              </option>
            ))}
        </select>

        {/* SEMESTER */}
        <select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          className="min-w-[150px] px-4 py-2 bg-neutral-900/70 border border-white/10 text-white rounded-md"
        >
          <option value="">All Semesters</option>
          <option value="1st Sem">1st Semester</option>
          <option value="2nd Sem">2nd Semester</option>
          <option value="Summer">Mid Year</option>
        </select>

        {/* SCHOOL YEAR */}
        <select
          value={selectedSchoolYear}
          onChange={(e) => setSelectedSchoolYear(e.target.value)}
          className="min-w-[150px] px-4 py-2 bg-neutral-900/70 border border-white/10 text-white rounded-md"
        >
          <option value="">All School Years</option>
          {[...new Set(classes.map((c) => c.school_year))].map((year) => (
            <option key={year}>{year}</option>
          ))}
        </select>

        {/* MONTH */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="min-w-[140px] px-4 py-2 bg-neutral-900/70 border border-white/10 text-white rounded-md"
        >
          <option value="">All Months</option>
          {monthNames.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* WEEK */}
        <DatePicker
          selected={weekStart}
          onChange={(d) => setWeekStart(d)}
          placeholderText="Week Start"
          className="min-w-[140px] px-4 py-2 bg-neutral-900/70 border border-white/10 text-white rounded-md"
        />

        {/* EXPORT BUTTON */}
        {filteredSessions.length > 0 && (
          <button
            onClick={exportToPDF}
            className="ml-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 whitespace-nowrap"
          >
            <FaFilePdf /> Export PDF
          </button>
        )}
      </div>

      {/* ATTENDANCE TABLE */}
     {Object.keys(groupedByClass).length > 0 ? (
      <div className="space-y-10">

        {Object.entries(groupedByClass).map(([classId, group]) => (
          <div
            key={classId}
            className="bg-neutral-900/40 border border-white/10 rounded-xl p-6 shadow-lg"
          >
            {/* HEADER — Class Info */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">
                {group.meta.subject_code} — {group.meta.subject_title}
              </h3>
              <p className="text-sm text-gray-400">
                {group.meta.course} · {group.meta.section} · {semesterMap[group.meta.semester]} · {group.meta.school_year}
              </p>
            </div>

            {/* TABLE */}
            <table className="w-full text-sm text-gray-300">
              <thead className="bg-neutral-800 text-emerald-300">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3">Present</th>
                  <th className="px-4 py-3">Late</th>
                  <th className="px-4 py-3">Absent</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {group.rows.map((session, index) => (
                  <tr
                    key={session._id}
                    className={index % 2 ? "bg-neutral-900/40" : "bg-neutral-800/40"}
                  >
                    <td className="px-4 py-3">{formatLongDate(session.date)}</td>

                    {/* BADGES */}
                    <td className="text-center">
                      <span className="px-2 py-1 rounded-full bg-emerald-900/50 text-emerald-400">
                        {session.students.filter((s) => s.status === "Present").length}
                      </span>
                    </td>

                    <td className="text-center">
                      <span className="px-2 py-1 rounded-full bg-yellow-900/50 text-yellow-400">
                        {session.students.filter((s) => s.status === "Late").length}
                      </span>
                    </td>

                    <td className="text-center">
                      <span className="px-2 py-1 rounded-full bg-red-900/50 text-red-400">
                        {session.students.filter((s) => s.status === "Absent").length}
                      </span>
                    </td>

                    {/* VIEW BUTTON */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openModal(<DailyLogsModal session={session} />)}
                        className="p-2 text-emerald-400 hover:text-white hover:bg-emerald-600/20 rounded-lg transition"
                      >
                        <FaListUl />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      </div>
    ) : (
      <p className="text-gray-400 text-center mt-6">
        {loading ? "Loading attendance..." : "No attendance found."}
      </p>
    )}
    </div>
  );
};

export default AttendanceReport;
