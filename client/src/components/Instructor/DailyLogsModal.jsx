// src/components/Instructor/DailyLogsModal.jsx
import { FaCalendarAlt, FaFilePdf } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DailyLogsModal = ({ session }) => {
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

  // ==============================
  // EXPORT PDF (PER SESSION)
  // ==============================
  const exportToPDF = () => {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  // Logos
  doc.addImage("/ccit-logo.png", "PNG", 10, 10, 25, 25);
  doc.addImage("/prmsu.png", "PNG", pageWidth - 35, 10, 25, 25);

  // University Header
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("Republic of the Philippines", pageWidth / 2, 18, { align: "center" });
  doc.text(
    "PRESIDENT RAMON MAGSAYSAY STATE UNIVERSITY",
    pageWidth / 2,
    25,
    { align: "center" }
  );

  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.text(
    "(Ramon Magsaysay Technological University)",
    pageWidth / 2,
    32,
    { align: "center" }
  );
  doc.text("Iba, Zambales", pageWidth / 2, 38, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text(
    "COLLEGE OF COMMUNICATION AND INFORMATION TECHNOLOGY",
    pageWidth / 2,
    45,
    { align: "center" }
  );

  // Title
  doc.setFontSize(14);
  doc.setTextColor(34, 197, 94);
  doc.text("DAILY ATTENDANCE REPORT", pageWidth / 2, 55, { align: "center" });

  // Reset color for text
  doc.setTextColor(0, 0, 0);

  // Session Info
  doc.setFontSize(12);

  doc.text(`Date: ${formatDate(session.date)}`, 20, 65);
  doc.text(`Subject: ${session.subject_code} – ${session.subject_title}`, 20, 72);
  doc.text(`Class Section: ${session.section}`, 20, 79);

  // ✅ NEW FIELDS
  doc.text(`Semester: ${session.semester || "N/A"}`, 20, 86);
  doc.text(`School Year: ${session.school_year || "N/A"}`, 20, 93);

  // Table
  autoTable(doc, {
    startY: 105,
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

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-5 border-b border-white/10 pb-3 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
            <FaCalendarAlt className="text-emerald-300" />
            Daily Attendance Logs
          </h2>
          <p className="text-gray-300 mt-1">
            Session Date:{" "}
            <span className="text-emerald-400 font-semibold">
              {formatDate(session.date)}
            </span>
          </p>
        </div>

        <button
          onClick={exportToPDF}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow hover:scale-105 transition"
        >
          <FaFilePdf className="inline mr-2" />
          Export PDF
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border border-white/10 rounded-xl overflow-hidden">
        <table className="min-w-full text-sm text-left text-gray-300">
          <thead className="bg-neutral-800 text-emerald-300">
            <tr>
              <th className="px-6 py-3">Student ID</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Time</th>
            </tr>
          </thead>

          <tbody>
            {students.length > 0 ? (
              students.map((s, i) => (
                <tr
                  key={i}
                  className={`${
                    i % 2 ? "bg-neutral-900/50" : "bg-neutral-800/50"
                  } border-b border-white/10`}
                >
                  <td className="px-6 py-3">{s.student_id}</td>
                  <td className="px-6 py-3">{`${s.first_name} ${s.last_name}`}</td>
                  <td
                    className={`px-6 py-3 ${
                      s.status === "Present"
                        ? "text-emerald-400"
                        : s.status === "Absent"
                        ? "text-red-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {s.status}
                  </td>
                  <td className="px-6 py-3">
                    {s.status === "Absent" || !s.time ? "—" : formatTime(s.time)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center py-6 text-gray-500 italic">
                  No attendance records for this session.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {students.length > 0 ? (
          students.map((s, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 shadow-lg"
            >
              <p className="text-gray-400 text-sm">Student ID:</p>
              <p className="font-semibold text-white mb-2">{s.student_id}</p>

              <p className="text-gray-400 text-sm">Name:</p>
              <p className="font-semibold text-emerald-300 mb-2">{`${s.first_name} ${s.last_name}`}</p>

              <p className="text-gray-400 text-sm">Status:</p>
              <p
                className={`font-semibold ${
                  s.status === "Present"
                    ? "text-emerald-400"
                    : s.status === "Absent"
                    ? "text-red-400"
                    : "text-yellow-400"
                }`}
              >
                {s.status}
              </p>

              <p className="text-gray-400 text-sm mt-2">Time:</p>
              <p className="font-semibold text-white">
                {s.status === "Absent" || !s.time ? "—" : formatTime(s.time)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 italic">
            No records found.
          </p>
        )}
      </div>
    </div>
  );
};

export default DailyLogsModal;
