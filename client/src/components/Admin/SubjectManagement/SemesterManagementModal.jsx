import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { createPortal } from "react-dom";

export default function SemesterManagementModal({ isOpen, onClose, onRefresh }) {
  const [semester, setSemester] = useState(null);

  const [semesterName, setSemesterName] = useState("");
  const [schoolYear, setSchoolYear] = useState(""); // auto-filled
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const API_BASE = "http://127.0.0.1:8080/api/admin";

  // =====================================================
  // 🔥 Auto-generate School Year when startDate changes
  // =====================================================
  const computeSchoolYear = (dateStr) => {
    if (!dateStr) return "";

    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1–12

    // PH Academic Year: June–May
    if (month >= 6) {
      return `${year}–${year + 1}`;
    } else {
      return `${year - 1}–${year}`;
    }
  };

  useEffect(() => {
    if (startDate) {
      setSchoolYear(computeSchoolYear(startDate));
    }
  }, [startDate]);

  // =====================================================
  // 🔥 Fetch Single Semester
  // =====================================================
  const fetchSemester = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/semester/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const sem = res.data;
      setSemester(sem);
      setSemesterName(sem.semester_name || "");
      setStartDate(sem.start_date || "");
      setEndDate(sem.end_date || "");
      setSchoolYear(sem.school_year || computeSchoolYear(sem.start_date));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load semester.");
    }
  };

  // =====================================================
  // 🔥 Save semester
  // =====================================================
  const handleSave = async (e) => {
    e.preventDefault();

    if (!semesterName || !schoolYear || !startDate || !endDate)
      return toast.error("Please fill all fields");

    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_BASE}/semester`,
        {
          semester_name: semesterName,
          school_year: schoolYear,
          start_date: startDate,
          end_date: endDate,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Semester updated successfully!");
      fetchSemester();
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update semester.");
    }
  };

  // =====================================================
  // 🔥 Activate semester
  // =====================================================
  const handleActivate = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_BASE}/semester/activate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Semester activated!");
      fetchSemester();
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to activate semester.");
    }
  };

  useEffect(() => {
    if (isOpen) fetchSemester();
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-lg p-6 relative shadow-lg">

        <h2 className="text-2xl font-bold text-emerald-400 mb-4 text-center">
          Semester Management
        </h2>

        {/* FORM */}
        <form onSubmit={handleSave} className="flex flex-col gap-3 mb-6">
        <select
          value={semesterName}
          onChange={(e) => setSemesterName(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 text-white text-sm px-3 py-2 rounded-lg"
        >
          <option className="text-white bg-neutral-800" value="">Select Semester</option>
          <option className="text-white bg-neutral-800" value="1st Semester">1st Semester</option>
          <option className="text-white bg-neutral-800" value="2nd Semester">2nd Semester</option>
          <option className="text-white bg-neutral-800" value="Summer">Summer</option>
        </select>

        {/* Auto-generated School Year */}
        <input
          type="text"
          placeholder="School Year"
          value={schoolYear}
          disabled
          className="bg-neutral-700 border border-neutral-600 text-sm px-3 py-2 rounded-lg text-gray-300 italic"
        />

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 text-white text-sm px-3 py-2 rounded-lg"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 text-white text-sm px-3 py-2 rounded-lg"
        />

        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          Save Changes
        </button>

      </form>

        {/* STATUS */}
        {semester && (
          <div
            className={`p-3 rounded-lg border ${
              semester.is_active
                ? "border-emerald-500/30 bg-emerald-900/20"
                : "border-neutral-700 bg-neutral-800/50"
            }`}
          >
            <p className="font-medium text-emerald-300">
              {semester.semester_name} — {semester.school_year}
            </p>

            <p className="text-xs text-gray-400 mt-1">
              {semester.start_date} to {semester.end_date}
            </p>

            {semester.is_active ? (
              <p className="text-xs text-emerald-400 font-semibold mt-1">
                🟢 Active Semester
              </p>
            ) : (
              <button
                onClick={handleActivate}
                className="mt-2 bg-emerald-500 hover:bg-emerald-600 px-3 py-1 text-sm rounded text-white"
              >
                Activate
              </button>
            )}
          </div>
        )}

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>
      </div>
    </div>,
    document.body
  );
}
