// ✅ src/components/Admin/StudentManagementComponent.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ViewStudentModal from "./StudentManagement/ViewStudentModal";
import EditStudentModal from "./StudentManagement/EditStudentModal";
import DeleteConfirmationModal from "./StudentManagement/DeleteConfirmationModal";
import { 
  Search, 
  UserPlus, 
  Eye, 
  Edit3, 
  Trash2, 
  GraduationCap, 
  LayoutGrid
} from "lucide-react";

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
    <div className="min-h-screen bg-[#050505] p-6 lg:p-12 text-white">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
          <div className="space-y-2">
            <h2 className="text-4xl font-black bg-gradient-to-br from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent tracking-tighter flex items-center gap-4">
              Student <span className="text-emerald-500">Registry</span>
            </h2>
            <p className="text-neutral-500 text-sm font-medium tracking-[0.2em] uppercase">
              Manage Academic Profiles & Biometric Data
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            {/* Enhanced Search */}
            <div className="relative group flex-1 sm:w-80">
              <div className="absolute -inset-0.5 bg-emerald-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
              <div className="relative flex items-center bg-neutral-900/50 border border-white/5 rounded-2xl px-5 py-3.5 backdrop-blur-xl">
                <Search className="text-neutral-500 mr-3" size={18} />
                <input
                  type="text"
                  placeholder="Search ID or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none text-sm text-neutral-200 w-full placeholder-neutral-600 font-medium"
                />
              </div>
            </div>

            {/* Register Button */}
            <button
              onClick={() => navigate("/student/register")}
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-emerald-600 text-white hover:bg-emerald-500 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all duration-300 active:scale-95"
            >
              <UserPlus size={16} strokeWidth={3} />
              Register Student
            </button>
          </div>
        </div>

        {/* Summary Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative group overflow-hidden p-8 bg-neutral-900/20 border border-white/5 rounded-[2rem] backdrop-blur-sm">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Total Enrollment</p>
                <p className="text-4xl font-black tracking-tighter text-white">{totalStudents}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                <GraduationCap size={24} />
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 text-white/[0.02] group-hover:text-emerald-500/[0.03] transition-colors">
              <GraduationCap size={120} strokeWidth={1} />
            </div>
          </div>
          {/* Add more stats cards here if needed */}
        </div>

        {/* Modern Student Table */}
        <div className="bg-neutral-900/20 rounded-[2rem] border border-white/5 overflow-hidden backdrop-blur-sm shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-8 py-6 text-neutral-500 text-[11px] uppercase tracking-[0.2em] font-bold border-b border-white/5">Identity</th>
                  <th className="px-8 py-6 text-neutral-500 text-[11px] uppercase tracking-[0.2em] font-bold border-b border-white/5">Full Name</th>
                  <th className="px-8 py-6 text-neutral-500 text-[11px] uppercase tracking-[0.2em] font-bold border-b border-white/5">Academic Program</th>
                  <th className="px-8 py-6 text-neutral-500 text-[11px] uppercase tracking-[0.2em] font-bold border-b border-white/5 text-center">Management</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.03]">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((s) => (
                    <tr key={s.student_id} className="group hover:bg-white/[0.02] transition-all duration-300">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-neutral-500 tracking-tighter">{s.student_id}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-neutral-200 group-hover:text-white transition-colors">
                            {formatName(s.last_name)}, {formatName(s.first_name)}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                          <LayoutGrid size={10} />
                          {s.course}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleView(s)}
                            className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 hover:text-white hover:border-blue-500/50 transition-all"
                            title="View Profile"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(s)}
                            className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 hover:text-white hover:border-yellow-500/50 transition-all"
                            title="Edit Details"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteRequest(s)}
                            className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 hover:text-rose-500 hover:border-rose-500/50 transition-all"
                            title="Remove Record"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-8 py-20 text-center text-neutral-600 font-medium italic text-sm">
                      No matching student records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals remain the same but will inherit the premium styles from their components */}
      <ViewStudentModal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} student={selectedStudent} />
      <EditStudentModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} student={selectedStudent} onStudentUpdated={handleStudentUpdated} />
      <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete} student={selectedStudent} />
    </div>
  );
};

export default StudentManagementComponent;
