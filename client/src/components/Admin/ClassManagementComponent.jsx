// src/components/Admin/ClassManagement/ClassManagementComponent.jsx
import { useEffect, useState, useMemo } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import {
  FaChalkboardTeacher,
  FaEye,
  FaEdit,
  FaTrash,
  FaPlus,
} from "react-icons/fa";

import StudentsModal from "./ClassManagement/StudentsModal";
import EditClassModal from "./ClassManagement/EditClassModal";
import DeleteClassModal from "./ClassManagement/DeleteClassModal";
import AddClassModal from "./ClassManagement/AddClassModal";

const API_URL = "http://127.0.0.1:8080";

const ClassManagementComponent = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState(null);
  const [editClass, setEditClass] = useState(null);
  const [deleteClass, setDeleteClass] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState(""); // 🔍 SEARCH BAR


  // ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/admin/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setClasses(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to load classes");
    } finally {
      setLoading(false);
    }
  };


  // ─────────────────────────────────────────────────────
  // FORMATTERS
  const formatDays = (blocks) => {
    if (!blocks?.length) return "No schedule";
    return blocks[0].days.join(" • ");
  };

  const formatTime = (blocks) => {
    if (!blocks?.length) return "";

    const b = blocks[0];

    const toAMPM = (t) => {
      if (!t) return "";
      let [h, m] = t.split(":");
      h = parseInt(h);
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    };

    return `${toAMPM(b.start)} – ${toAMPM(b.end)}`;
  };


  // ─────────────────────────────────────────────────────
  // CURRENT SEM & YEAR
  const currentSemester = classes[0]?.semester || "No Semester";
  const currentSchoolYear = classes[0]?.school_year || "No School Year";


  // ─────────────────────────────────────────────────────
  // FILTERED LIST (SEARCH)
  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return classes;

    const q = searchQuery.toLowerCase();

    return classes.filter((cls) => {
      return (
        cls.subject_code?.toLowerCase().includes(q) ||
        cls.subject_title?.toLowerCase().includes(q) ||
        `${cls.instructor_first_name} ${cls.instructor_last_name}`
          .toLowerCase()
          .includes(q) ||
        cls.section?.toLowerCase().includes(q)
      );
    });
  }, [classes, searchQuery]);


  // ─────────────────────────────────────────────────────
  // GROUP BY YEAR (WITH SEARCH APPLIED)
  const groupedByYear = useMemo(() => {
    const groups = {
      "1st Year": [],
      "2nd Year": [],
      "3rd Year": [],
      "4th Year": [],
    };

    filteredClasses.forEach((cls) => {
      if (groups[cls.year_level]) {
        groups[cls.year_level].push(cls);
      }
    });

    // Sort alphabetically by section
    Object.keys(groups).forEach((year) => {
      groups[year].sort((a, b) => (a.section > b.section ? 1 : -1));
    });

    return groups;
  }, [filteredClasses]);

  const formatSemester = (sem) => {
    if (!sem) return "No Semester";

    const clean = sem.toLowerCase().trim();

    if (clean.includes("summer")) return "Mid Year";

    return sem
      .replace(/1st\s*Sem/i, "1st Semester")
      .replace(/2nd\s*Sem/i, "2nd Semester");
  };

  // ─────────────────────────────────────────────────────
  // HANDLERS
  const handleDelete = async () => {
    try {
      const token = localStorage.getItem("token");

      await axios.delete(`${API_URL}/api/admin/delete-class/${deleteClass._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("✅ Class deleted");
      setDeleteClass(null);
      fetchClasses();
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to delete class");
    }
  };


  const handleEdit = async () => {
    try {
      const token = localStorage.getItem("token");

      const cleanedScheduleBlocks = (editClass.schedule_blocks || [])
        .map((block) => ({
          ...block,
          days: (block.days || []).filter((d) => d && d.trim() !== ""),
        }))
        .filter((block) => block.days?.length || block.start || block.end);

      await axios.put(
        `${API_URL}/api/admin/update-class/${editClass._id}`,
        {
          section: editClass.section,
          semester: editClass.semester,
          schedule_blocks: cleanedScheduleBlocks,
          instructor_id: editClass.instructor_id || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("✅ Class updated");
      setEditClass(null);
      fetchClasses();
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to update class");
    }
  };


  // ─────────────────────────────────────────────────────
  return (
    <div className="bg-neutral-950 p-8 rounded-2xl shadow-xl text-white mx-auto">

      {/* HEADER + SEARCH + ADD CLASS BUTTON */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 mt-4 w-full">

        {/* LEFT: Class Management Title */}
        <h2 className="text-3xl font-extrabold text-transparent bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text flex items-center gap-2">
          <FaChalkboardTeacher className="text-emerald-400" />
          Class Management
        </h2>

        {/* RIGHT: Search + Add Button */}
        <div className="flex items-center gap-3 w-full md:w-auto">

          {/* SEARCH BAR */}
          <input
            type="text"
            placeholder="Search subject, instructor, or section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 bg-neutral-900 border border-neutral-700 text-neutral-200 
                      rounded-lg placeholder-neutral-500 focus:outline-none 
                      focus:ring-2 focus:ring-emerald-500 shadow w-full md:w-72"
          />

          {/* ADD CLASS BUTTON */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 
                      rounded-lg text-white font-semibold shadow-md transition-transform 
                      hover:scale-105 whitespace-nowrap"
          >
            <FaPlus /> Add Class
          </button>

        </div>
      </div>

      {/* SEMESTER BADGE */}
      <div className="mb-6">
        <span className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-emerald-300 text-sm font-semibold shadow">
          {formatSemester(currentSemester)} • S.Y. {currentSchoolYear}
        </span>
      </div>

      {/* MULTIPLE TABLES PER YEAR */}
      {Object.entries(groupedByYear).map(([year, list]) => {
        if (!loading && list.length === 0) return null;

        return (
          <div key={year} className="mb-12">

            {/* YEAR HEADER */}
            <h3 className="text-xl font-bold text-emerald-400 mb-3">
              {year}
            </h3>

            {/* TABLE */}
            <div className="overflow-x-auto rounded-2xl border border-neutral-800 shadow-lg shadow-black/30">

              <table className="w-full table-fixed text-sm">

                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[30%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                  <col className="w-[20%]" />
                  <col className="w-[14%]" />
                </colgroup>

                <thead className="bg-neutral-900/80 backdrop-blur border-b border-neutral-800/60 text-emerald-300 uppercase text-xs tracking-wider">
                  <tr className="h-12">
                    <th className="px-4 text-left">Code</th>
                    <th className="px-4 text-left">Title</th>
                    <th className="px-4 text-left">Instructor</th>
                    <th className="px-4 text-left">Section</th>
                    <th className="px-4 text-left">Schedule</th>
                    <th className="px-4 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="text-neutral-300">

                  {loading && (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-neutral-500">
                        Loading classes...
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    list.map((cls, idx) => (
                      <tr
                        key={idx}
                        className="h-14 align-middle odd:bg-neutral-950 even:bg-neutral-900/20 hover:bg-neutral-800/40 transition border-b border-neutral-800/70"
                      >
                        <td className="px-4 font-mono text-emerald-400">{cls.subject_code}</td>
                        <td className="px-4 font-medium truncate max-w-[250px]">{cls.subject_title}</td>
                        <td className="px-4">{cls.instructor_first_name} {cls.instructor_last_name}</td>
                        <td className="px-4 font-semibold">{cls.section}</td>

                        {/* SCHEDULE CELL */}
                        <td className="px-4 py-3 text-neutral-300">
                          {(!cls.schedule_blocks || cls.schedule_blocks.length === 0) ? (
                            <div className="inline-block px-3 py-1.5 text-xs font-medium 
                                            bg-neutral-800 text-neutral-400 rounded-lg 
                                            border border-neutral-700 w-fit">
                              No schedule set
                            </div>
                          ) : (
                            <div className="inline-flex flex-col gap-1 px-3 py-2 
                                            bg-neutral-900/60 rounded-lg border border-neutral-700/40 
                                            shadow-sm w-fit">

                              <span className="inline-block px-2 py-0.5 text-[11px] font-semibold 
                                              bg-emerald-600/20 text-emerald-300 rounded-full 
                                              border border-emerald-500/20 w-fit">
                                {formatDays(cls.schedule_blocks)}
                              </span>

                              <span className="inline-block px-2 py-0.5 text-[11px] font-medium 
                                              bg-neutral-700/30 text-neutral-200 rounded-full 
                                              border border-neutral-600/20 w-fit">
                                {formatTime(cls.schedule_blocks)}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* ACTION BUTTONS */}
                        <td className="px-4">
                          <div className="flex items-center justify-center gap-4 px-2">

                            <button
                              onClick={() => setSelectedClass(cls)}
                              className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white shadow"
                            >
                              <FaEye size={14} />
                            </button>

                            <button
                              onClick={() => setEditClass(cls)}
                              className="p-2 bg-yellow-500 hover:bg-yellow-400 rounded-lg text-white shadow"
                            >
                              <FaEdit size={14} />
                            </button>

                            <button
                              onClick={() => setDeleteClass(cls)}
                              className="p-2 bg-red-600 hover:bg-red-500 rounded-lg text-white shadow"
                            >
                              <FaTrash size={14} />
                            </button>

                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* MODALS */}
      {selectedClass && (
        <StudentsModal
          isOpen={!!selectedClass}
          onClose={() => setSelectedClass(null)}
          selectedClass={selectedClass}
        />
      )}

      {editClass && (
        <EditClassModal
          isOpen={!!editClass}
          editClass={editClass}
          setEditClass={setEditClass}
          onClose={() => setEditClass(null)}
          onSave={handleEdit}
        />
      )}

      <DeleteClassModal
        isOpen={!!deleteClass}
        deleteClass={deleteClass}
        onClose={() => setDeleteClass(null)}
        onConfirm={handleDelete}
      />

      {showAddModal && (
        <AddClassModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdded={fetchClasses}
        />
      )}

    </div>
  );
};

export default ClassManagementComponent;
