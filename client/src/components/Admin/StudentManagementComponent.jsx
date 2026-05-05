// ✅ src/components/Admin/StudentManagementComponent.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import ViewStudentModal from "./StudentManagement/ViewStudentModal";
import EditStudentModal from "./StudentManagement/EditStudentModal";
import DeleteConfirmationModal from "./StudentManagement/DeleteConfirmationModal";

import { FaUsers, FaPlus, FaSearch } from "react-icons/fa";

const API_URL = "http://127.0.0.1:8080";

const StudentManagementComponent = () => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);

  const navigate = useNavigate();

  // Modal states
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Secure axios
  const api = axios.create({ baseURL: API_URL });
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  const formatName = (name) => {
    if (!name) return "";
    return name
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  // Fetch Students
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await api.get("/api/admin/students");
        const data = Array.isArray(res.data) ? res.data : [];

        const formatted = data.map((s) => ({
          ...s,
          first_name: formatName(s.first_name),
          last_name: formatName(s.last_name),
        }));

        setStudents(formatted);
        setFilteredStudents(formatted);
      } catch {
        toast.error("Failed to load students.");
      }
    };

    fetchStudents();
  }, []);

  // Search filter only
  useEffect(() => {
    let filtered = students;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          (s.first_name || "").toLowerCase().includes(q) ||
          (s.last_name || "").toLowerCase().includes(q) ||
          (s.student_id || "").toLowerCase().includes(q)
      );
    }

    setFilteredStudents(filtered);
  }, [searchQuery, students]);

  // View student
  const handleView = (student) => {
    setSelectedStudent(student);
    setIsViewModalOpen(true);
  };

  const handleEdit = (student) => {
    setSelectedStudent(student);
    setIsEditModalOpen(true);
  };

  const handleDeleteRequest = (student) => {
    setSelectedStudent(student);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/api/admin/students/${selectedStudent.student_id}`);

      setStudents((p) => p.filter((s) => s.student_id !== selectedStudent.student_id));
      setFilteredStudents((p) =>
        p.filter((s) => s.student_id !== selectedStudent.student_id)
      );

      toast.success("Student deleted successfully");
    } catch {
      toast.error("Failed to delete student");
    } finally {
      setIsDeleteModalOpen(false);
      setSelectedStudent(null);
    }
  };

  const handleStudentUpdated = (updated) => {
    setStudents((prev) =>
      prev.map((s) => (s.student_id === updated.student_id ? updated : s))
    );
    setFilteredStudents((prev) =>
      prev.map((s) => (s.student_id === updated.student_id ? updated : s))
    );
  };

  // Simple Summary
  const totalStudents = filteredStudents.length;

  return (
    <div className="bg-neutral-950 p-8 rounded-2xl shadow-xl text-white space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
        <h2 className="text-3xl font-extrabold flex items-center gap-3">
          <FaUsers className="text-emerald-400" />
          <span className="bg-gradient-to-r from-emerald-400 to-green-600 text-transparent bg-clip-text">
            Student Management
          </span>
        </h2>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">

          {/* Search */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search ID or Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-900 rounded-lg text-sm border border-neutral-700 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Register Student */}
          <button
            onClick={() => navigate("/student/register")}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold shadow-md transition-transform hover:scale-105"
          >
            <FaPlus /> Register Student
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 bg-neutral-900 rounded-xl border border-neutral-800 shadow">
          <p className="text-gray-400 text-sm">Total Students</p>
          <p className="text-3xl font-bold text-emerald-400">{totalStudents}</p>
        </div>
      </div>

      {/* Student Table */}
      <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-lg">
        <div className="hidden md:grid grid-cols-5 bg-neutral-800 text-emerald-300 text-sm font-semibold uppercase tracking-wide border-b border-neutral-700">
          <div className="px-4 py-3">ID</div>
          <div className="px-4 py-3">First</div>
          <div className="px-4 py-3">Last</div>
          <div className="px-4 py-3">Course</div>
          <div className="px-4 py-3 text-center">Actions</div>
        </div>

        {filteredStudents.length > 0 ? (
          filteredStudents.map((s) => (
            <div
              key={s.student_id}
              className="border-b border-neutral-800 hover:bg-neutral-800/70 transition"
            >
              <div className="hidden md:grid grid-cols-5 text-sm text-gray-300">
                <div className="px-4 py-3 font-mono text-gray-400">{s.student_id}</div>
                <div className="px-4 py-3">{formatName(s.first_name)}</div>
                <div className="px-4 py-3">{formatName(s.last_name)}</div>
                <div className="px-4 py-3 text-emerald-300 font-medium">{s.course}</div>

                <div className="px-4 py-3 flex gap-2 justify-center">
                  <button
                    onClick={() => handleView(s)}
                    className="px-3 py-1 rounded-md bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleEdit(s)}
                    className="px-3 py-1 rounded-md bg-yellow-500/20 text-yellow-400 text-xs hover:bg-yellow-500/30"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteRequest(s)}
                    className="px-3 py-1 rounded-md bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-6">No students found.</div>
        )}
      </div>

      {/* Modals */}
      <ViewStudentModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        student={selectedStudent}
      />

      <EditStudentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        student={selectedStudent}
        onStudentUpdated={handleStudentUpdated}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        student={selectedStudent}
      />
    </div>
  );
};

export default StudentManagementComponent;
