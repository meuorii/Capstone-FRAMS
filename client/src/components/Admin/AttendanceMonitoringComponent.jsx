// src/components/Admin/AttendanceMonitoring.jsx
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import axios from "axios";

import { toast } from "react-toastify";
import { FaClipboardList, FaListUl, FaFilePdf } from "react-icons/fa";

import DailyLogsModalAdmin from "../Admin/DailyLogsModalAdmin";

const API = "http://127.0.0.1:8080";

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const semesterMap = {
  "1st Sem": "1st Semester",
  "2nd Sem": "2nd Semester",
  "Summer": "Mid Year",
};

export default function AttendanceMonitoring() {
  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // ADMIN MODAL STYLE
  const [activeSession, setActiveSession] = useState(null);

  // FILTERS
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState("");

  const [weekStart, setWeekStart] = useState(null);
  const weekEnd = weekStart
    ? new Date(new Date(weekStart).setDate(new Date(weekStart).getDate() + 6))
    : null;

  const formatName = (value = "") =>
    value
      .trim()
      .split(" ")
      .map((w) =>
        w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""
      )
      .join(" ");

  const formatLongDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // ============================================================
  // LOAD ATTENDANCE SESSIONS FOR ALL CLASSES
  // ============================================================
  const fetchSessions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/admin/attendance/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let allSessions = res.data.attendance_logs || [];
      allSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      setSessions(allSessions);

      if (res.data.message) {
        console.log(res.data.message);
      }

    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("❌ Failed to load attendance sessions.");
    } finally {
      setLoading(false);
    }
  }

// Load once (Admin does NOT depend on classes)
useEffect(() => {
  fetchSessions();
}, []);

  // ============================================================
  // FILTER LOGIC
  // ============================================================
  useEffect(() => {
    let filtered = [...sessions];

    if (selectedClass)
      filtered = filtered.filter((s) => s.class_id === selectedClass);

    if (selectedSemester)
      filtered = filtered.filter((s) => s.semester === selectedSemester);

    if (selectedInstructor)
      filtered = filtered.filter(
        (s) =>
          `${s.instructor_first_name} ${s.instructor_last_name}` === selectedInstructor
      );

    if (selectedSchoolYear)
      filtered = filtered.filter((s) => s.school_year === selectedSchoolYear);

    if (selectedMonth)
      filtered = filtered.filter(
        (s) => new Date(s.date).getMonth() + 1 === Number(selectedMonth)
      );

    if (weekStart) {
      const start = new Date(weekStart);
      const end = weekEnd;
      filtered = filtered.filter((s) => {
        const d = new Date(s.date);
        return d >= start && d <= end;
      });
    }

    setFilteredSessions(filtered);
  }, [sessions, selectedClass, selectedInstructor, selectedSemester, selectedSchoolYear, selectedMonth, weekStart]);

  // ============================================================
  // GROUP SESSIONS BY CLASS
  // ============================================================
  const groupedByClass = filteredSessions.reduce((acc, s) => {
    if (!acc[s.class_id]) {
      acc[s.class_id] = {
        meta: {
          subject_code: s.subject_code,
          subject_title: s.subject_title,
          course: s.course,
          section: s.section,
          semester: s.semester,
          school_year: s.school_year,
          instructor_first_name: s.instructor_first_name,
          instructor_last_name: s.instructor_last_name,
        },
        rows: [],
      };
    }
    acc[s.class_id].rows.push(s);
    return acc;
  }, {});

  // ============================================================
  // EXPORT PDF
  // ============================================================
  // ============================================================
// ADMIN EXPORT PDF (Updated to Match Instructor Report Design)
// ============================================================
const exportToPDF = () => {
  if (filteredSessions.length === 0) {
    toast.warn("No attendance to export.");
    return;
  }

  const doc = new jsPDF("l", "mm", "a3");
  const width = doc.internal.pageSize.getWidth();
  let isFirstPage = true;

  // Loop through each CLASS group
  Object.keys(groupedByClass).forEach((classId) => {
    const group = groupedByClass[classId];
    const sessions = group.rows.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    if (!isFirstPage) doc.addPage();
    isFirstPage = false;

    // ===================================
    // BUILD STUDENT LOG MATRIX
    // ===================================
    const studentMap = {};

    sessions.forEach((session) => {
      (session.students || []).forEach((stud) => {
        const fullName =
          stud.student_name ||
          `${formatName(stud.last_name || "")}, ${formatName(stud.first_name || "")}`;

        if (!studentMap[stud.student_id]) {
          studentMap[stud.student_id] = {
            id: stud.student_id,
            name: fullName,
            logs: {},
          };
        }

        studentMap[stud.student_id].logs[session.date] = stud.status;
      });
    });

    const dateColumns = sessions.map((s) => s.date);
    const tableHead = [["Student Name", ...dateColumns]];

    const tableBody = Object.values(studentMap).map((stud) => {
      const row = [stud.name];

      dateColumns.forEach((date) => {
        const status = stud.logs[date] || "";
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

    // ===================================
    // HEADER + UNIVERSITY INFO (NEW)
    // ===================================
    doc.addImage("/prmsu.png", "PNG", 15, 8, 20, 20);
    doc.addImage("/ccit-logo.png", "PNG", width - 35, 8, 20, 20);

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

    // Former Name
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.text(
      "(Ramon Magsaysay Technological University)",
      width / 2,
      33,
      { align: "center" }
    );

    doc.text("Iba, Zambales", width / 2, 38, { align: "center" });

    // Report Title
    doc.setFontSize(16);
    doc.setTextColor(34, 197, 94);
    doc.text("ATTENDANCE REPORT", width / 2, 48, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // ===================================
    // METADATA FROM ADMIN DATA
    // ===================================
    const meta = group.meta;

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text(
      `Instructor: ${meta.instructor_first_name} ${meta.instructor_last_name}`,
      15,
      55
    );
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

    // ===================================
    // TABLE STYLING & GENERATION
    // ===================================
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

  doc.save("Admin_Attendance_Report.pdf");
};


  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="p-8 bg-neutral-950 rounded-2xl shadow-xl space-y-8">
      <div className="flex items-center gap-3">
        <FaClipboardList className="text-green-400 text-3xl" />
        <h2 className="text-3xl font-bold text-emerald-400">Attendance Monitoring</h2>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-neutral-950 p-2 rounded-xl space-y-3">

        {/* ROW 1 */}
        <div className="flex flex-wrap gap-4">

          {/* CLASS FILTER */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="flex-1 min-w-[180px] px-4 py-2 bg-neutral-900 border border-neutral-700 
                      text-white rounded-md focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Classes</option>

            {[...new Map(
              sessions.map(s => [
                s.class_id,
                {
                  class_id: s.class_id,
                  subject_code: s.subject_code,
                  course: s.course,
                  section: s.section,
                }
              ])
            ).values()].map(cls => (
              <option key={cls.class_id} value={cls.class_id}>
                {cls.subject_code} — {cls.course} {cls.section}
              </option>
            ))}
          </select>

          {/* INSTRUCTOR FILTER */}
          <select
            value={selectedInstructor}
            onChange={(e) => setSelectedInstructor(e.target.value)}
            className="flex-1 min-w-[180px] px-4 py-2 bg-neutral-900 border border-neutral-700 
                      text-white rounded-md focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Instructors</option>

            {[...new Map(
              sessions.map((s) => [
                `${s.instructor_first_name} ${s.instructor_last_name}`,
                {
                  name: `${s.instructor_first_name} ${s.instructor_last_name}`,
                  id: s.instructor_id
                }
              ])
            ).values()].map((ins) => (
              <option key={ins.id} value={ins.name}>
                {ins.name}
              </option>
            ))}
          </select>

          {/* SEMESTER FILTER */}
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="flex-1 min-w-[150px] px-4 py-2 bg-neutral-900 border border-neutral-700 
                      text-white rounded-md focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Semesters</option>
            <option value="1st Sem">1st Semester</option>
            <option value="2nd Sem">2nd Semester</option>
            <option value="Summer">Mid Year</option>
          </select>

        </div>

        {/* ROW 2 */}
        <div className="flex flex-wrap gap-4 items-center">

          {/* SCHOOL YEAR FILTER */}
          <select
            value={selectedSchoolYear}
            onChange={(e) => setSelectedSchoolYear(e.target.value)}
            className="flex-1 min-w-[150px] px-4 py-2 bg-neutral-900 border border-neutral-700 
                      text-white rounded-md focus:outline-none focus:border-emerald-500"
          >
            <option value="">All School Years</option>
            {[...new Set(sessions.map((s) => s.school_year))].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          {/* MONTH FILTER */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex-1 min-w-[140px] px-4 py-2 bg-neutral-900 border border-neutral-700 
                      text-white rounded-md focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Months</option>
            {monthNames.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>

          {/* WEEK START PICKER */}
          <DatePicker
            selected={weekStart}
            onChange={(d) => setWeekStart(d)}
            placeholderText="Week Start"
            className="flex-1 min-w-[140px] px-4 py-2 bg-neutral-900 border border-neutral-700 
                      text-white rounded-md focus:outline-none focus:border-emerald-500"
          />

          {/* EXPORT BUTTON RIGHT SIDE */}
          {filteredSessions.length > 0 && (
            <button
              onClick={exportToPDF}
              className="ml-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-500 
                        text-white rounded-lg flex items-center gap-2 shadow-md"
            >
              <FaFilePdf /> Export PDF
            </button>
          )}
        </div>
      </div>

      {/* GROUPED TABLES */}
      {Object.keys(groupedByClass).length > 0 ? (
        <div className="space-y-10">

          {Object.entries(groupedByClass).map(([classId, group]) => (
            <div
              key={classId}
              className="bg-neutral-900/40 border border-white/10 rounded-xl p-6 shadow-lg"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {group.meta.subject_code} — {group.meta.subject_title}
                </h3>
                <p className="text-sm text-gray-400">
                  {group.meta.course} · {group.meta.section} ·{" "}
                  {semesterMap[group.meta.semester]} · {group.meta.school_year}
                </p>
                <p className="text-sm text-gray-400">
                  Instructor:{" "}
                  <span className="text-emerald-400">
                    {group.meta.instructor_first_name}{" "}
                    {group.meta.instructor_last_name}
                  </span>
                </p>
              </div>

              <table className="w-full text-sm text-gray-300">
                <thead className="bg-neutral-800 text-emerald-300">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-center">Present</th>
                    <th className="px-4 py-3 text-center">Late</th>
                    <th className="px-4 py-3 text-center">Absent</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {group.rows.map((session, i) => (
                    <tr
                      key={session._id}
                      className={i % 2 ? "bg-neutral-900/40" : "bg-neutral-800/40"}
                    >
                      <td className="px-4 py-3">{formatLongDate(session.date)}</td>

                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 rounded-full bg-emerald-900/50 text-emerald-400">
                          {session.students.filter((s) => s.status === "Present").length}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 rounded-full bg-yellow-900/50 text-yellow-400">
                          {session.students.filter((s) => s.status === "Late").length}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 rounded-full bg-red-900/50 text-red-400">
                          {session.students.filter((s) => s.status === "Absent").length}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setActiveSession(session)}
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

      {/* ADMIN MODAL */}
      {activeSession && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center">
          <div className="bg-neutral-900 p-6 rounded-xl w-full max-w-3xl shadow-lg">  
            <DailyLogsModalAdmin 
              session={activeSession} 
              onClose={() => setActiveSession(null)} 
            />
          </div>
        </div>
      )}

    </div>
  );
}
