import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { 
  Search, 
  UserRound, 
  Mail, 
  Copy, 
  BookMarked, 
  CircleDot, 
  Loader2 
} from "lucide-react";
import InstructorAssignmentManagerModal from "./InstructorManagement/InstructorAssignmentManagerModal";

const API_URL = "http://127.0.0.1:8080";

const InstructorAssignmentComponent = () => {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchInstructors = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/admin/instructors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInstructors(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load instructors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstructors();
  }, [fetchInstructors]);

  const handleOpenModal = (instructor) => {
    setSelectedInstructor(instructor);
    setIsModalOpen(true);
  };

  const filteredInstructors = instructors.filter(
    (inst) =>
      inst.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] p-6 lg:p-12 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
          <div className="space-y-2">
            <h2 className="text-4xl font-black bg-gradient-to-br from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent tracking-tighter">
              Instructor <span className="text-emerald-500">Assignment</span>
            </h2>
            <p className="text-neutral-500 text-sm font-medium tracking-wide uppercase">
              Manage Faculty Loads & Verification Status
            </p>
          </div>

          {/* Premium Search Bar */}
          <div className="relative group w-full md:w-96">
            <div className="absolute -inset-0.5 bg-emerald-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <div className="relative flex items-center bg-neutral-900/50 border border-white/5 rounded-2xl px-5 py-3.5 backdrop-blur-xl">
              <Search className="text-neutral-500 mr-3" size={18} />
              <input
                type="text"
                placeholder="Search database..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent outline-none text-sm text-neutral-200 w-full placeholder-neutral-600 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Modern Data Display */}
        <div className="bg-neutral-900/20 rounded-[2rem] border border-white/5 overflow-hidden backdrop-blur-sm shadow-2xl">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="text-neutral-500 text-[11px] uppercase tracking-[0.2em] font-bold">
                <th className="px-8 py-6 border-b border-white/5">Instructor Info</th>
                <th className="px-8 py-6 border-b border-white/5">Contact</th>
                <th className="px-8 py-6 border-b border-white/5 text-center">Face Status</th>
                <th className="px-8 py-6 border-b border-white/5 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="text-emerald-500 animate-spin" size={32} />
                      <span className="text-neutral-500 font-mono text-xs uppercase tracking-widest">Accessing Secure Records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredInstructors.length > 0 ? (
                filteredInstructors.map((inst) => (
                  <tr
                    key={inst.instructor_id}
                    className="group hover:bg-white/[0.02] transition-all duration-300"
                  >
                    {/* Name & ID Column */}
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center border border-white/5 group-hover:border-emerald-500/50 transition-colors">
                            <UserRound size={20} className="text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#050505] ${
                            inst.registered ? "bg-emerald-500" : "bg-red-500"
                          }`} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-neutral-200 font-bold tracking-tight text-sm group-hover:text-white transition-colors">
                            {inst.first_name} {inst.last_name}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-600 uppercase mt-0.5">
                            UID: {inst.instructor_id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email Column */}
                    <td className="px-8 py-5">
                      <div className="flex items-center group/email max-w-fit">
                        <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 border border-white/5 mr-3 group-hover/email:border-emerald-500/30 group-hover/email:bg-emerald-500/5 transition-all duration-300">
                          <Mail size={14} className="text-neutral-500 group-hover/email:text-emerald-400 transition-colors" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-neutral-400 text-sm font-medium tracking-tight group-hover/email:text-neutral-200 transition-colors cursor-pointer">
                            {inst.email}
                          </span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(inst.email);
                              toast.info("Copied to clipboard", { icon: <Copy size={14}/> });
                            }}
                            className="flex items-center gap-1 text-[10px] text-emerald-500/0 group-hover/email:text-emerald-500/60 transition-all text-left uppercase font-bold tracking-widest mt-0.5"
                          >
                            <Copy size={10} /> Click to copy
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-8 py-5">
                      <div className="flex justify-center items-center">
                        <div 
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all duration-500 ${
                            inst.registered 
                              ? "bg-emerald-500/[0.03] border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]" 
                              : "bg-red-500/[0.03] border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]"
                          }`}
                        >
                          <div className="relative flex h-2 w-2">
                            {inst.registered && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${
                              inst.registered ? "bg-emerald-400" : "bg-red-500"
                            }`}></span>
                          </div>
                          <span className={`text-[10px] font-mono font-bold tracking-[0.15em] uppercase ${
                            inst.registered ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {inst.registered ? "Registered" : "Not Registered"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="px-8 py-5 text-right">
                      <button
                        onClick={() => handleOpenModal(inst)}
                        className="group relative inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-300 hover:text-white hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all duration-300 shadow-sm overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/[0.05] to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        <BookMarked className="text-emerald-500/80 group-hover:text-emerald-400 group-hover:scale-110 transition-all duration-300" size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                          Manage Loads
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-8 py-24 text-center">
                    <CircleDot className="mx-auto text-neutral-800 mb-3" size={40} />
                    <p className="text-neutral-600 font-medium text-sm">No matching records found in database.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <InstructorAssignmentManagerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          instructor={selectedInstructor}
          onRefresh={fetchInstructors}
        />
      )}
    </div>
  );
}

export default InstructorAssignmentComponent;