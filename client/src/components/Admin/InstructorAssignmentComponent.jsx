import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FaSearch, FaChalkboardTeacher } from "react-icons/fa";
import InstructorAssignmentManagerModal from "./InstructorManagement/InstructorAssignmentManagerModal";

const API_URL = "http://127.0.0.1:8080";

const InstructorAssignmentComponent = () => {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedInstructor, setSelectedInstructor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatName = (name) => {
    if (!name) return "";
    return name
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/admin/instructors`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setInstructors(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to load instructors");
    } finally {
      setLoading(false);
    }
  };

  const filteredInstructors = instructors.filter(
    (inst) =>
      inst.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenManager = (inst) => {
    setSelectedInstructor(inst);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-neutral-950 p-8 rounded-2xl shadow-xl text-white space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
        <h2 className="text-3xl font-extrabold flex items-center gap-3">
          <FaChalkboardTeacher className="text-emerald-400" />
          <span className="bg-gradient-to-r from-emerald-400 to-green-600 text-transparent bg-clip-text">
            Instructor Management
          </span>
        </h2>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          
          {/* Search */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search Name or Email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-900 rounded-lg text-sm border border-neutral-700 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-lg">
        <div className="hidden md:grid grid-cols-4 bg-neutral-800 text-emerald-300 text-sm font-semibold uppercase tracking-wide border-b border-neutral-700">
          <div className="px-4 py-3">ID</div>
          <div className="px-4 py-3">Instructor Name</div>
          <div className="px-4 py-3">Status</div>
          <div className="px-4 py-3 text-center">Actions</div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-10">Loading instructors...</div>
        ) : filteredInstructors.length > 0 ? (
          filteredInstructors.map((inst) => (
            <div
              key={inst.instructor_id}
              className="border-b border-neutral-800 hover:bg-neutral-800/70 transition"
            >
              <div className="hidden md:grid grid-cols-4 text-sm text-gray-300 items-center">
                <div className="px-4 py-3 font-mono text-gray-400">{inst.instructor_id}</div>
                <div className="px-4 py-3">
                  {formatName(inst.first_name)} {formatName(inst.last_name)}
                </div>
                
                <div className="px-4 py-3">
                  {inst.registered ? (
                    <span className="px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                      Registered
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-md bg-red-500/20 text-red-400 text-xs font-semibold">
                      Not Registered
                    </span>
                  )}
                </div>

                <div className="px-4 py-3 flex gap-2 justify-center">
                  <button
                    onClick={() => handleOpenManager(inst)}
                    className="px-4 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
                  >
                    Manage Assignments
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-6">No instructors found.</div>
        )}
      </div>

      {/* Modals */}
      {isModalOpen && selectedInstructor && (
        <InstructorAssignmentManagerModal
          instructor={selectedInstructor}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

export default InstructorAssignmentComponent;