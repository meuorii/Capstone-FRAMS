// src/components/Instructor/StudentsInClass.jsx
import { useEffect, useMemo, useState } from "react";
import { getClassesByInstructor, getAssignedStudents } from "../../services/api";
import { toast } from "react-toastify";
import { FaUserGraduate, FaSearch } from "react-icons/fa";

// Convert "1st_sem" → "1st Semester"
const formatSemester = (sem) => {
  if (!sem) return "Not set";

  const t = sem.toLowerCase().replace("_", " ");

  if (t.includes("1st")) return "1st Semester";
  if (t.includes("2nd")) return "2nd Semester";

  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Format any name string into "Proper Case"
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

const StudentsInClass = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [query, setQuery] = useState("");

  const instructor = JSON.parse(localStorage.getItem("userData") || "{}");

  useEffect(() => {
    if (instructor?.instructor_id) fetchClasses();
  }, []);

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const data = await getClassesByInstructor(instructor.instructor_id);
      setClasses(data || []);

      if (data?.length && !selectedClass) {
        setSelectedClass(data[0]._id);
        fetchStudents(data[0]._id);
      }
    } catch (err) {
      console.error("Failed to load classes:", err);
      toast.error("⚠ Failed to load classes.");
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchStudents = async (classId) => {
    if (!classId) return;

    setLoadingStudents(true);

    try {
      const data = await getAssignedStudents(classId);

      const sorted = Array.isArray(data)
        ? [...data].sort((a, b) => {
            const lastA = a.last_name?.toLowerCase() || "";
            const lastB = b.last_name?.toLowerCase() || "";
            if (lastA < lastB) return -1;
            if (lastA > lastB) return 1;

            const firstA = a.first_name?.toLowerCase() || "";
            const firstB = b.first_name?.toLowerCase() || "";
            return firstA.localeCompare(firstB);
          })
        : [];

      setStudents(sorted);
    } catch (err) {
      console.error("Failed to fetch students:", err);
      toast.error("⚠ Failed to fetch students.");
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSelectClass = (classId) => {
    setSelectedClass(classId);
    setQuery("");
    setStudents([]);

    if (classId) fetchStudents(classId);
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return students;
    const q = query.toLowerCase();

    return students.filter((s) => {
      const id = (s.student_id || "").toLowerCase();
      const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const course = (s.course || "").toLowerCase();
      const section = (s.section || "").toLowerCase();
      return (
        id.includes(q) ||
        name.includes(q) ||
        course.includes(q) ||
        section.includes(q)
      );
    });
  }, [students, query]);

  const selectedClassObj = classes.find((c) => c._id === selectedClass);

  return (
    <div className="p-8 relative z-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
        <div className="flex items-center gap-3">
          <FaUserGraduate className="text-green-400 text-2xl sm:text-3xl" />
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text text-transparent">
            Students in Class
          </h2>
        </div>

        <span className="hidden sm:inline-block text-xs sm:text-sm px-4 py-1.5 rounded-full 
          bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg">
          {filtered.length} {filtered.length === 1 ? "Student" : "Students"}
        </span>
      </div>

      {/* Class Controls */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-row gap-3">

          {/* Select Class */}
          <div className="flex-1">
            <label className="block text-xs sm:text-sm text-gray-300 mb-2">Select Class</label>

            <select
              className="w-full bg-neutral-900/60 border border-white/10 text-white 
                px-3 sm:px-4 py-2 sm:py-3 rounded-lg focus:outline-none 
                focus:ring-2 focus:ring-emerald-400 transition-all duration-300 
                text-sm sm:text-base"
              onChange={(e) => handleSelectClass(e.target.value)}
              value={selectedClass}
              disabled={loadingClasses}
            >
              <option value="" className="bg-neutral-900 text-white">— Choose a Class —</option>

              {classes.map((c) => (
                <option key={c._id} value={c._id} className="bg-neutral-900 text-white">
                  {c.subject_code} — {c.subject_title} — {c.section}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1">
            <label className="block text-xs sm:text-sm text-gray-300 mb-2">Search</label>
            <div className="flex items-center gap-2 bg-neutral-900/60 border border-white/10 rounded-lg px-3 
              focus-within:ring-2 focus-within:ring-emerald-400 transition-all duration-300">
              <FaSearch className="text-neutral-400 text-sm sm:text-base" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ID or Name"
                className="w-full bg-transparent outline-none text-white h-11 
                  placeholder:text-neutral-500 text-sm sm:text-base"
              />
            </div>
          </div>
        </div>

        {selectedClassObj && (
          <div className="mt-4 text-sm sm:text-base text-gray-300">
            <span className="font-semibold text-emerald-400">School Year:</span>{" "}
            {selectedClassObj.school_year || "Not set"}

            <span className="mx-2 text-gray-500">•</span>

            <span className="font-semibold text-emerald-400">Semester:</span>{" "}
            {formatSemester(selectedClassObj.semester)}
          </div>
        )}
      </div>

      {/* Mobile Count */}
      <div className="sm:hidden flex justify-end mb-4">
        <span className="text-xs px-3 py-1.5 rounded-full 
          bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg">
          {filtered.length} {filtered.length === 1 ? "Student" : "Students"}
        </span>
      </div>

      {/* Student List */}
      {loadingStudents ? (
        <div className="px-6 py-10 text-center text-emerald-400 animate-pulse">
          Loading students…
        </div>
      ) : selectedClass && filtered.length > 0 ? (
        <>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-hidden rounded-xl border border-white/10 shadow-lg backdrop-blur-sm">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 text-emerald-300 z-10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Student ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Full Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Course</th>
                  <th className="px-4 py-3 text-left font-semibold">Section</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((s, i) => {
                  const fullName = `${formatName(s.first_name)} ${formatName(s.last_name)}`.trim();
                  return (
                    <tr
                      key={`${s.student_id}-${i}`}
                      className={`group transition-all duration-300 
                        ${i % 2 ? "bg-neutral-900/40" : "bg-neutral-800/40"}
                        hover:bg-emerald-500/10 hover:scale-[1.01] hover:shadow-md hover:shadow-emerald-500/20`}
                    >
                      <td className="px-4 py-3 text-gray-200 group-hover:text-emerald-300">
                        {s.student_id}
                      </td>
                      <td className="px-4 py-3 text-white font-medium group-hover:text-emerald-200">
                        {fullName}
                      </td>
                      <td className="px-4 py-3 text-gray-200 group-hover:text-emerald-200">
                        {s.course}
                      </td>
                      <td className="px-4 py-3 text-gray-200 group-hover:text-emerald-200">
                        {s.section}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {filtered.map((s, i) => {
              const fullName = `${formatName(s.first_name)} ${formatName(s.last_name)}`.trim();
              return (
                <div
                  key={`${s.student_id}-mobile-${i}`}
                  className="bg-neutral-900/60 border border-white/10 rounded-lg p-4 shadow-md
                    transition-all duration-300 hover:-translate-y-1 
                    hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/20"
                >
                  <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span className="font-semibold text-emerald-400">Student ID:</span>
                    <span className="text-white font-medium">{s.student_id}</span>
                  </div>

                  <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span className="font-semibold text-emerald-400">Full Name:</span>
                    <span className="text-white font-medium text-right truncate">
                      {fullName}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm text-gray-300">
                    <span>
                      <span className="font-semibold text-emerald-400">Course:</span>{" "}
                      {s.course}
                    </span>
                    <span>
                      <span className="font-semibold text-emerald-400">Section:</span>{" "}
                      {s.section}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : selectedClass ? (
        <div className="px-6 py-12 text-center text-gray-300">
          <div className="text-4xl mb-3">🗂️</div>
          No students in this class yet.
        </div>
      ) : (
        <div className="px-6 py-12 text-center text-gray-400">
          Select a class to view the roster.
        </div>
      )}
    </div>
  );
};

export default StudentsInClass;
