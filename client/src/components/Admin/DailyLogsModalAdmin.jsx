// src/components/Admin/DailyLogsModalAdmin.jsx
import { CalendarDays, FileText, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DailyLogsModalAdmin = ({ session, onClose }) => {
  if (!session) return null;

  const students = session.students || [];

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const dateObj = new Date(`1970-01-01T${timeStr}`);
    if (isNaN(dateObj.getTime())) return timeStr;
    return dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const instructorName = `${session.instructor_first_name ?? ""} ${session.instructor_last_name ?? ""}`.trim();

  const exportToPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.addImage("/ccit-logo.png", "PNG", 15, 10, 25, 25);
    doc.addImage("/prmsu.png", "PNG", pageWidth - 40, 10, 25, 25);

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("Republic of the Philippines", pageWidth / 2, 18, { align: "center" });
    doc.text("PRESIDENT RAMON MAGSAYSAY STATE UNIVERSITY", pageWidth / 2, 25, { align: "center" });

    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.text("(Ramon Magsaysay Technological University)", pageWidth / 2, 32, { align: "center" });
    doc.text("Iba, Zambales", pageWidth / 2, 38, { align: "center" });

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("COLLEGE OF COMMUNICATION AND INFORMATION TECHNOLOGY", pageWidth / 2, 45, { align: "center" });

    doc.setFontSize(14);
    doc.setTextColor(34, 197, 94);
    doc.text("DAILY ATTENDANCE REPORT", pageWidth / 2, 55, { align: "center" });
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(12);
    doc.text(`Date: ${formatDate(session.date)}`, 20, 65);
    doc.text(`Subject: ${session.subject_code} – ${session.subject_title}`, 20, 72);
    doc.text(`Class Section: ${session.section}`, 20, 79);
    doc.text(`Instructor: ${instructorName || "N/A"}`, 20, 86);
    doc.text(`Semester: ${session.semester || "N/A"}`, 20, 93);
    doc.text(`School Year: ${session.school_year || "N/A"}`, 20, 100);

    autoTable(doc, {
      startY: 115,
      head: [["Student ID", "Name", "Status", "Time"]],
      body: students.map((s) => [
        s.student_id,
        `${s.first_name} ${s.last_name}`,
        s.status || "—",
        s.status === "Absent" || !s.time ? "—" : formatTime(s.time),
      ]),
      headStyles: { fillColor: [34, 197, 94], textColor: 255 },
      styles: { fontSize: 11, halign: "center" },
    });

    doc.save(`attendance_${session.date}.pdf`);
  };

  const statusColor = (status) => {
    if (status === "Present") return "text-emerald-400";
    if (status === "Absent") return "text-red-400";
    return "text-yellow-400";
  };

  return (
    <div className="w-full relative">

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-2 top-2 text-gray-400 hover:text-white transition"
      >
        <X size={22} />
      </button>

      {/* Header */}
      <div className="mb-5 border-b border-white/10 pb-3 flex justify-between items-center pr-8">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
            <CalendarDays size={22} className="text-emerald-300" />
            Daily Attendance Logs
          </h2>
          <p className="text-gray-300 mt-1">
            Instructor:{" "}
            <span className="text-emerald-400 font-semibold">{instructorName || "N/A"}</span>
          </p>
          <p className="text-gray-300">
            Session Date:{" "}
            <span className="text-emerald-400 font-semibold">{formatDate(session.date)}</span>
          </p>
        </div>

        <button
          onClick={exportToPDF}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow hover:scale-105 transition"
        >
          <FileText size={16} />
          Export PDF
        </button>
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden md:flex flex-col border border-white/10 rounded-xl overflow-hidden">

        {/* Sticky header — sits outside the scroll container */}
        <table className="min-w-full text-sm text-left text-gray-300">
          <thead className="bg-neutral-800 text-emerald-300">
            <tr>
              <th className="px-6 py-3 w-1/4">Student ID</th>
              <th className="px-6 py-3 w-1/3">Name</th>
              <th className="px-6 py-3 w-1/4">Status</th>
              <th className="px-6 py-3 w-1/4">Time</th>
            </tr>
          </thead>
        </table>

        {/* Scrollable body — ~10 rows tall (48px each), scrolls for more */}
        <div className="overflow-y-auto min-h-[480px] max-h-[480px]">
          <table className="min-w-full text-sm text-left text-gray-300">
            <tbody>
              {students.length > 0 ? (
                students.map((s, i) => (
                  <tr
                    key={i}
                    className={`${
                      i % 2 ? "bg-neutral-900/50" : "bg-neutral-800/50"
                    } border-b border-white/10 hover:bg-emerald-900/10 transition-colors`}
                  >
                    <td className="px-6 py-3 w-1/4">{s.student_id}</td>
                    <td className="px-6 py-3 w-1/3">{`${s.first_name} ${s.last_name}`}</td>
                    <td className={`px-6 py-3 w-1/4 font-medium ${statusColor(s.status)}`}>
                      {s.status}
                    </td>
                    <td className="px-6 py-3 w-1/4">
                      {s.status === "Absent" || !s.time ? "—" : formatTime(s.time)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-10 text-gray-500 italic">
                    No attendance records for this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="md:hidden overflow-y-auto min-h-[480px] max-h-[480px] space-y-4 pr-1">
        {students.length > 0 ? (
          students.map((s, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 shadow-lg"
            >
              <p className="text-gray-400 text-sm">Student ID:</p>
              <p className="font-semibold text-white mb-2">{s.student_id}</p>

              <p className="text-gray-400 text-sm">Name:</p>
              <p className="font-semibold text-emerald-300 mb-2">
                {`${s.first_name} ${s.last_name}`}
              </p>

              <p className="text-gray-400 text-sm">Status:</p>
              <p className={`font-semibold ${statusColor(s.status)}`}>{s.status}</p>

              <p className="text-gray-400 text-sm mt-2">Time:</p>
              <p className="font-semibold text-white">
                {s.status === "Absent" || !s.time ? "—" : formatTime(s.time)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 italic pt-10">No records found.</p>
        )}
      </div>

    </div>
  );
};

export default DailyLogsModalAdmin;