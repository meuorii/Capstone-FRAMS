// src/components/Instructor/InstructorOverview.jsx
import { useEffect, useState } from "react";
import {
  FaChalkboardTeacher,
  FaUsers,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
} from "react-icons/fa";
import { toast } from "react-toastify";
import axios from "axios";

const InstructorOverview = ({ setActiveTab }) => {   // ✅ RECEIVE setActiveTab
  const [overviewData, setOverviewData] = useState(null);
  const [classSummary, setClassSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  const instructor = JSON.parse(localStorage.getItem("userData"));
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!instructor?.instructor_id || !token) {
      toast.error("Instructor not logged in.");
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [overviewRes, classRes] = await Promise.all([
          axios.get(
            `http://127.0.0.1:8080/api/instructor/${instructor.instructor_id}/overview`,
            { headers }
          ),
          axios.get(
            `http://127.0.0.1:8080/api/instructor/${instructor.instructor_id}/overview/classes`,
            { headers }
          ),
        ]);

        setOverviewData(overviewRes.data);
        setClassSummary(classRes.data);
      } catch (err) {
        console.error("❌ Failed to load overview:", err.response?.data || err.message);
        toast.error("Failed to load overview data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Loading instructor overview...</div>;
  }

  if (!overviewData) {
    return <div className="p-6 text-center text-red-400">Failed to load overview data.</div>;
  }

  // ---------------------------------------------------------
  // ⭐ STAT → SIDEBAR ROUTE MAPPING
  // ---------------------------------------------------------
  const statToTab = {
    totalClasses: "subject",
    totalStudents: "assigned",
    activeSessions: "attendance",
    present: "attendance",
    late: "attendance",
  };

  const statCards = [
    {
      key: "totalClasses",
      icon: <FaChalkboardTeacher />,
      label: "Total Classes",
      value: overviewData.totalClasses,
      gradient: "from-emerald-500/70 to-green-600/20",
      glow: "hover:shadow-emerald-500/40",
      iconColor: "text-emerald-300",
    },
    {
      key: "totalStudents",
      icon: <FaUsers />,
      label: "Total Students",
      value: overviewData.totalStudents,
      gradient: "from-blue-500/70 to-cyan-600/20",
      glow: "hover:shadow-blue-500/40",
      iconColor: "text-blue-300",
    },
    {
      key: "activeSessions",
      icon: <FaCalendarAlt />,
      label: "Active Sessions",
      value: overviewData.activeSessions,
      gradient: "from-purple-500/70 to-pink-600/20",
      glow: "hover:shadow-purple-500/40",
      iconColor: "text-purple-300",
    },
    {
      key: "present",
      icon: <FaCheckCircle />,
      label: "Present",
      value: overviewData.present || 0,
      gradient: "from-green-500/70 to-emerald-600/20",
      glow: "hover:shadow-green-500/40",
      iconColor: "text-green-300",
    },
    {
      key: "late",
      icon: <FaClock />,
      label: "Late",
      value: overviewData.late || 0,
      gradient: "from-amber-500/70 to-yellow-600/20",
      glow: "hover:shadow-amber-500/40",
      iconColor: "text-amber-300",
    },
  ];

  return (
    <div className="p-8 bg-neutral-950 min-h-screen rounded-xl text-white relative overflow-hidden">

      {/* Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/20 blur-[160px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-600/20 blur-[160px] rounded-full"></div>

      {/* Header */}
      <h2 className="relative z-10 text-2xl font-bold mb-6 flex items-center gap-2 
        text-transparent bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text">
        <FaChalkboardTeacher className="text-emerald-400 text-2xl" />
        Instructor Overview
      </h2>

      {/* Stat Cards */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            onClick={() => {
              const tab = statToTab[stat.key];
              if (tab) setActiveTab(tab);   // ⭐ DIRECT NAVIGATION
            }}
            className={`cursor-pointer bg-gradient-to-br ${stat.gradient}
              backdrop-blur-lg p-5 rounded-xl border border-white/10 
              shadow-md transition-all duration-500 transform
              hover:scale-[1.05] hover:shadow-2xl ${stat.glow}
              flex items-center gap-4`}
          >
            <div className={`text-3xl ${stat.iconColor}`}>{stat.icon}</div>
            <div>
              <p className="text-gray-300 text-sm">{stat.label}</p>
              <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Classes Table */}
      <div className="relative z-10 bg-neutral-950 backdrop-blur-lg p-6 rounded-xl shadow-lg border border-white/10">

        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-emerald-400">
          <FaChalkboardTeacher /> My Classes
        </h3>

        <div className="hidden md:block overflow-x-hidden">
          <table className="min-w-full text-sm text-left text-gray-300">
            <thead className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 text-green-300 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th>Title</th>
                <th>Section</th>
                <th>Schedule</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {classSummary.map((c, idx) => (
                <tr
                  key={idx}
                  className="border-b border-neutral-700 hover:bg-emerald-500/10 transition cursor-pointer"
                  onClick={() => setActiveTab("subject")}  // ⭐ Clicking row → "My Classes"
                >
                  <td className="px-4 py-3 text-white">{c.subject_code}</td>
                  <td>{c.subject_title}</td>
                  <td>{c.section}</td>
                  <td>
                    {c.schedule_blocks?.map((b) =>
                      `${b.days.join(", ")} • ${b.start}–${b.end}`
                    ).join(" | ")}
                  </td>
                  <td className={c.is_attendance_active ? "text-emerald-400" : "text-red-400"}>
                    {c.is_attendance_active ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default InstructorOverview;
