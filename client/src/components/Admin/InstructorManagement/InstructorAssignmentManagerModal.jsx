import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { 
  UserSquare2, 
  X, 
  Layers, 
  Trash2, 
  BookOpen, 
  Plus, 
  ChevronDown, 
  Loader2 
} from "lucide-react";
import UnassignConfirmationModal from "./UnassignConfirmationModal";

const API_URL = "http://127.0.0.1:8080";

const InstructorAssignmentManagerModal = ({ instructor, onClose }) => {
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [freeClasses, setFreeClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [classToUnassign, setClassToUnassign] = useState(null);
  
  const fetchAssignedClasses = useCallback(async () => {
    if (!instructor?.instructor_id) return;

    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/api/admin/instructors/${instructor.instructor_id}/classes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAssignedClasses(res.data.assigned_class || []);
    } catch (err) {
      toast.error("Failed to load assigned classes.", err);
    }
  }, [instructor?.instructor_id]);

  const fetchFreeClasses = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/admin/classes/free`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setFreeClasses(res.data || []);
    } catch (err) {
      toast.error("Failed to load available classes.", err);
    }
  }, []) 

  useEffect(() => {
    if (instructor) {
      fetchAssignedClasses();
      fetchFreeClasses();
    }
  }, [instructor, fetchAssignedClasses, fetchFreeClasses])

  const assignClass = async () => {
    if (!selectedClass) return toast.warn("Please select a class first.");
    setIsActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_URL}/api/admin/classes/${selectedClass}/assign-instructor`,
        { instructor_id: instructor.instructor_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Class assigned successfully!");
      setSelectedClass("");
      fetchAssignedClasses();
      fetchFreeClasses();
    } catch (err) {
      toast.error("Assignment failed.", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleInitiateRemove = (cls) => {
    setClassToUnassign(cls);
    setIsConfirmOpen(true);
  }

  const handleFinalUnassign = async () => {
    if (!classToUnassign) return;

    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API_URL}/api/admin/classes/${classToUnassign._id}/remove-instructor`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Class unassigned successfully.");
      fetchAssignedClasses();
      fetchFreeClasses();
    } catch (err) {
      toast.error("Failed to remove class.", err);
    } finally {
      setIsConfirmOpen(false);
      setClassToUnassign(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-[#050505]/60 backdrop-blur-md flex justify-center items-center z-50 p-4 transition-all duration-300">
        <div className="bg-[#0a0a0a] text-white w-full max-w-2xl rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* Header Section */}
          <div className="p-8 border-b border-white/5 bg-gradient-to-br from-emerald-500/[0.03] to-transparent flex justify-between items-center">
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-neutral-900 flex items-center justify-center text-emerald-400 border border-white/10 shadow-inner">
                <UserSquare2 size={32} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tighter text-neutral-100 uppercase">
                  {instructor.first_name} {instructor.last_name}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 tracking-widest uppercase">
                    Faculty Lead
                  </span>
                  <span className="text-neutral-600 font-mono text-[10px] tracking-widest">
                    #{instructor.instructor_id}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 bg-neutral-900 hover:bg-neutral-800 rounded-xl text-neutral-500 hover:text-white transition-all border border-white/5"
            >
              <X size={20} strokeWidth={2} />
            </button>
          </div>

          {/* Content Section - Scrollable */}
          <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/[0.01] via-transparent to-transparent">
            
            {/* Assigned Classes List */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Layers className="text-emerald-500" size={18} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Current Workload</h3>
                </div>
                <span className="bg-neutral-900 text-neutral-500 text-[10px] font-bold px-3 py-1 rounded-full border border-white/5">
                  {assignedClasses.length} Subjects
                </span>
              </div>

              <div className="grid gap-4">
                {assignedClasses.length > 0 ? (
                  assignedClasses.map((cls) => (
                    <div
                      key={cls._id}
                      className="group relative flex justify-between items-center bg-neutral-900/40 border border-white/5 p-5 rounded-2xl hover:border-emerald-500/30 transition-all duration-300"
                    >
                      <div className="flex flex-col gap-1.5 relative z-10">
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-400 font-black text-sm tracking-widest">
                            {cls.subject_code}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-neutral-700"></span>
                          <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-tight">
                            {cls.course} {cls.year_level}{cls.section}
                          </span>
                        </div>
                        <span className="text-neutral-200 text-xs font-semibold uppercase tracking-wide">
                          {cls.subject_title}
                        </span>
                      </div>

                      <button
                        onClick={() => handleInitiateRemove(cls)}
                        className="opacity-0 group-hover:opacity-100 p-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all duration-300 transform translate-x-2 group-hover:translate-x-0"
                      >
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                      
                      {/* Hover Glow Effect */}
                      <div className="absolute inset-0 bg-emerald-500/[0.01] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-neutral-900/20 rounded-[2rem] border border-dashed border-white/5">
                    <div className="p-4 bg-neutral-900 rounded-full mb-4">
                      <BookOpen className="text-neutral-700" size={28} strokeWidth={1} />
                    </div>
                    <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">No Active Assignments</p>
                  </div>
                )}
              </div>
            </div>

            {/* New Assignment Section */}
            <div className="relative p-6 bg-neutral-900/30 rounded-[2rem] border border-white/5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-5 flex items-center gap-2">
                <Plus className="text-emerald-500" size={14} strokeWidth={3} /> Quick Assign
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full group">
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full bg-neutral-950 border border-white/10 px-5 py-4 rounded-2xl text-xs font-semibold text-neutral-300 appearance-none focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all cursor-pointer"
                  >
                    <option value="">Select an available subject...</option>
                    {freeClasses.map((cls) => (
                      <option key={cls._id} value={cls._id} className="bg-[#0a0a0a] py-4">
                        {cls.subject_code} — {cls.subject_title} ({cls.course} {cls.year_level}{cls.section})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600 group-hover:text-emerald-500 transition-colors" size={16} />
                </div>

                <button
                  disabled={!selectedClass || isActionLoading}
                  onClick={assignClass}
                  className={`w-full sm:w-auto px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-3 transition-all duration-500 ${
                    !selectedClass 
                      ? "bg-neutral-800 text-neutral-600 cursor-not-allowed border border-white/5" 
                      : "bg-white text-black hover:bg-emerald-500 hover:text-white shadow-[0_20px_40px_rgba(0,0,0,0.3)] active:scale-95"
                  }`}
                >
                  {isActionLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    "Assign Load"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UnassignConfirmationModal 
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleFinalUnassign}
          classData={classToUnassign}
      />
    </>
  );
};

export default InstructorAssignmentManagerModal;