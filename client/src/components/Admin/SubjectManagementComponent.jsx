import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FaChalkboardTeacher } from "react-icons/fa";
import SemesterManagementModal from "./SubjectManagement/SemesterManagementModal";

export default function SubjectManagementComponent() {
  const [subjects, setSubjects] = useState([]);
  const [activeSemester, setActiveSemester] = useState(null);
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [curriculums, setCurriculums] = useState([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState("");

  const API_BASE = "http://127.0.0.1:8080/api/admin";

  // ================================
  // FETCH CURRICULUM LIST
  // ================================
  const fetchCurriculums = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/curriculum`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list = res.data.curriculums || [];
      setCurriculums(list);

      if (list.length > 0) setSelectedCurriculum(list[0]);
    } catch (err) {
      console.error("Error fetching curriculum list:", err);
      toast.error("Failed to load curriculum list.");
    }
  };

  const formatSemester = (sem) => {
    if (!sem) return "No Semester";

    const clean = sem.toLowerCase().trim();

    // Special rename
    if (clean.includes("summer")) return "Mid Year";

    return sem
      .replace(/1st\s*sem/i, "1st Semester")
      .replace(/2nd\s*sem/i, "2nd Semester")
      .replace(/3rd\s*sem/i, "3rd Semester")
      .replace(/4th\s*sem/i, "4th Semester");
  };

  // ================================
  // FETCH SUBJECTS FOR ACTIVE SEMESTER
  // ================================
  const fetchActiveSemesterSubjects = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("No authorization token. Please log in again.");
        return;
      }

      const res = await axios.get(`${API_BASE}/subjects/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setActiveSemester(res.data.active_semester);
      setSubjects(res.data.subjects || []);
    } catch (err) {
      console.error("Error fetching subjects:", err);
      toast.error("Failed to fetch subjects for the active semester.");
    }
  };

  useEffect(() => {
    fetchCurriculums();
    fetchActiveSemesterSubjects();
  }, []);

  // FILTER SUBJECTS
  const filteredSubjects = subjects.filter(
    (s) =>
      s.semester === activeSemester?.semester_name &&
      (!selectedCurriculum || s.curriculum === selectedCurriculum)
  );

  const yearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

  return (
    <div className="bg-neutral-950 text-white p-8 rounded-xl shadow-lg space-y-10">

      {/* PAGE TITLE */}
      <h2 className="text-3xl font-extrabold flex items-center gap-2 bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text text-transparent">
        <FaChalkboardTeacher className="text-emerald-400" />
        Subject Management
      </h2>

      {/* ========================================= */}
      {/* OPTION B: Active Semester LEFT, Buttons RIGHT */}
      {/* ========================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-neutral-950 p-4 rounded-xl border border-neutral-950">

        {/* LEFT: ACTIVE SEMESTER */}
        {activeSemester ? (
          <div className="bg-neutral-800 px-5 py-3 rounded-lg border border-emerald-500/30 text-emerald-300 shadow">
            <p className="font-semibold text-emerald-400 text-sm">🟢 Active Semester</p>
            <p className="text-emerald-200">
              {formatSemester(activeSemester.semester_name)} — {activeSemester.school_year}
            </p>
          </div>
        ) : (
          <div className="text-gray-400 italic text-sm">
            ⚠ No active semester set.
          </div>
        )}

        {/* RIGHT: BUTTON + DROPDOWN */}
        <div className="flex flex-wrap gap-4">

          {/* MANAGE SEMESTER BUTTON */}
          <button
            onClick={() => setShowSemesterModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg text-white text-sm transition shadow-md"
          >
            Manage Semesters
          </button>

          {/* CURRICULUM DROPDOWN */}
          {curriculums.length > 0 && (
            <select
              value={selectedCurriculum}
              onChange={(e) => setSelectedCurriculum(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 px-4 py-2 rounded-lg text-emerald-300 text-sm focus:outline-none focus:border-emerald-500"
            >
              {curriculums.map((c) => (
                <option key={c} value={c}>
                  Curriculum {c}
                </option>
              ))}
            </select>
          )}

        </div>
      </div>

      {/* MODAL */}
      <SemesterManagementModal
        isOpen={showSemesterModal}
        onClose={() => setShowSemesterModal(false)}
        onRefresh={fetchActiveSemesterSubjects}
      />

      {/* ========================================= */}
      {/* SUBJECT LIST */}
      {/* ========================================= */}
      {yearLevels.map((year) => {
        const subjectsByYear = filteredSubjects.filter(
          (s) => s.year_level === year
        );

        if (subjectsByYear.length === 0) return null;

        return (
          <div key={year} className="space-y-8">

            {/* YEAR HEADER */}
            <div className="pl-4 border-l-4 border-emerald-500">
              <h2 className="text-2xl font-bold text-emerald-400">{year}</h2>
              <p className="text-sm text-gray-400">
                {subjectsByYear.length} total subject
                {subjectsByYear.length > 1 ? "s" : ""}
              </p>
            </div>

            {/* BLOCK */}
            <div className="rounded-xl bg-neutral-900/60 border border-neutral-700 backdrop-blur-sm shadow-lg overflow-hidden">

              {/* BLOCK HEADER */}
              <div className="bg-gradient-to-r from-emerald-700/20 to-green-700/20 px-6 py-4 border-b border-neutral-800">
                <h3 className="text-lg font-semibold text-emerald-300">
                  {formatSemester(activeSemester?.semester_name)} — Curriculum {selectedCurriculum}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {subjectsByYear.length} subject{subjectsByYear.length > 1 ? "s" : ""}
                </p>
              </div>

              {/* TABLE HEADER */}
              <div className="hidden md:grid grid-cols-2 bg-neutral-900/80 
                              text-emerald-300 font-semibold text-sm tracking-wide 
                              border-b border-neutral-800">
                <div className="px-4 py-3">Code</div>
                <div className="px-4 py-3">Title</div>
              </div>

              {/* SUBJECT ROWS */}
              {subjectsByYear.map((s) => (
                <div
                  key={s._id}
                  className="grid md:grid-cols-2 text-sm text-neutral-300 
                            border-b border-neutral-800 hover:bg-neutral-800/40 
                            hover:shadow-lg hover:shadow-emerald-500/10 
                            transition-all duration-300"
                >
                  {/* CODE */}
                  <div className="px-4 py-3 font-mono text-emerald-400">
                    {s.subject_code}
                  </div>

                  {/* TITLE */}
                  <div className="px-4 py-3 font-medium truncate max-w-full">
                    {s.subject_title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filteredSubjects.length === 0 && (
        <div className="text-center text-neutral-500 py-10 italic">
          No subjects found for the active semester and curriculum.
        </div>
      )}
    </div>
  );
}
