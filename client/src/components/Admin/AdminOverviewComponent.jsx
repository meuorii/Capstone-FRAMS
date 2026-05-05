import { useEffect, useState } from "react";
import axios from "axios";
import {
  FaUserGraduate,
  FaChalkboardTeacher,
  FaBook,
  FaCalendarCheck,
  FaListAlt,
  FaUserCircle,
} from "react-icons/fa";

/* ==============================
   API SETUP WITH TOKEN
============================== */
const API = axios.create({
  baseURL: "http://127.0.0.1:8080",
});
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function AdminOverviewComponent({ setActiveTab }) {
  const [program, setProgram] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [stats, setStats] = useState({
    total_students: 0,
    total_instructors: 0,
    total_classes: 0,
    attendance_today: 0,
  });

  const [recentLogs, setRecentLogs] = useState([]);
  const [lastStudent, setLastStudent] = useState(null);

  /* Load Admin Program from Token */
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found");

      const payload = JSON.parse(atob(token.split(".")[1]));
      const adminProgram = payload?.sub?.program || payload?.program;
      if (!adminProgram) throw new Error("Program not found in token");

      setProgram(adminProgram);
    } catch (e) {
      console.error("Token error:", e);
      setErr("Session invalid. Please re-login.");
      setLoading(false);
    }
  }, []);

  /* Fetch Dashboard Data */
  useEffect(() => {
    if (!program) return;

    (async () => {
      setLoading(true);
      try {
        const [statsRes, recentRes, lastStudRes] = await Promise.allSettled([
          API.get("/api/admin/overview/stats", { params: { program } }),
          API.get("/api/admin/overview/recent-logs", {
            params: { limit: 5, program },
          }),
          API.get("/api/admin/overview/last-student", { params: { program } }),
        ]);

        if (statsRes.status === "fulfilled")
          setStats(normalizeStats(statsRes.value.data));

        if (recentRes.status === "fulfilled")
          setRecentLogs(Array.isArray(recentRes.value.data) ? recentRes.value.data : []);

        if (lastStudRes.status === "fulfilled")
          setLastStudent(lastStudRes.value.data || null);
      } catch (e) {
        console.error("Overview error:", e);
        setErr("Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, [program]);

  return (
    <div className="p-8 bg-neutral-950 min-h-screen rounded-xl text-white space-y-10 relative overflow-hidden">

      <h2 className="text-3xl font-extrabold mb-2 bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text text-transparent">
        {program ? `${program} Admin Dashboard Overview` : "Loading Admin Info..."}
      </h2>

      {loading ? (
        <p className="text-neutral-400">Loading...</p>
      ) : err ? (
        <p className="text-red-400">{err}</p>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatCard
              icon={<FaUserGraduate />}
              label="Total Students"
              value={stats.total_students}
              gradient="from-emerald-500/50 to-green-700/30"
              onClick={() => setActiveTab("students")}
            />
            <StatCard
              icon={<FaChalkboardTeacher />}
              label="Instructors"
              value={stats.total_instructors}
              gradient="from-blue-500/50 to-indigo-700/30"
              onClick={() => setActiveTab("instructors")}
            />
            <StatCard
              icon={<FaBook />}
              label="Classes"
              value={stats.total_classes}
              gradient="from-purple-500/50 to-pink-700/30"
              onClick={() => setActiveTab("classes")}
            />
            <StatCard
              icon={<FaCalendarCheck />}
              label="Attendance Today"
              value={stats.attendance_today}
              gradient="from-amber-500/50 to-orange-700/30"
              onClick={() => setActiveTab("attendance")}
            />
          </div>

          {/* Recent Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4 text-emerald-400 flex items-center gap-2">
                <FaListAlt /> Recent Attendance Logs
              </h3>

              <Table
                columns={["Student", "Subject", "Status", "Timestamp"]}
                rows={recentLogs.map((log) => ({
                  Student: formatName(log?.student),
                  Subject: log?.subject || "-",
                  Status: badge(log?.status),
                  Timestamp: formatDateTime(log?.timestamp),
                }))}
              />
            </Card>

            {/* Last Student Registered */}
            <Card>
              <h3 className="text-lg font-semibold mb-4 text-emerald-400 flex items-center gap-2">
                <FaUserCircle /> Last Student Registered
              </h3>

              {lastStudent ? (
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md">
                  <p className="text-xl font-bold text-emerald-400">{formatName(lastStudent)}</p>
                  <p className="text-sm text-gray-400">ID: {lastStudent.student_id}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Registered: {formatDateTime(lastStudent.created_at)}
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 italic">No recent registration.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* =============================================  */
/* Helper Components                              */
/* ============================================= */

function normalizeStats(s = {}) {
  return {
    total_students: s.total_students ?? 0,
    total_instructors: s.total_instructors ?? 0,
    total_classes: s.total_classes ?? 0,
    attendance_today: s.attendance_today ?? 0,
  };
}

function StatCard({ icon, label, value, gradient, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer flex flex-col items-center justify-center text-center p-6 rounded-xl border border-white/10 
      bg-gradient-to-br ${gradient} backdrop-blur-md shadow-lg 
      transform transition-all duration-300 hover:scale-105 hover:shadow-emerald-400/40`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm text-gray-300">{label}</p>
      <p className="text-2xl font-extrabold text-white">{value ?? 0}</p>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl bg-white/5 border border-white/10 p-6 shadow-lg ${className}`}>
      {children}
    </div>
  );
}

function Table({ columns = [], rows = [] }) {
  return (
    <table className="min-w-full text-sm text-left text-gray-300">
      <thead className="bg-emerald-600 text-white uppercase text-xs tracking-wide">
        <tr>
          {columns.map((c) => (
            <th key={c} className="px-4 py-3">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="px-4 py-6 text-center text-gray-500 italic">
              No data
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr
              key={i}
              className={`${i % 2 ? "bg-neutral-900" : "bg-neutral-950"} hover:bg-emerald-500/20`}
            >
              {columns.map((c) => (
                <td key={c} className="px-4 py-3">{r[c]}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function badge(status) {
  const s = String(status || "").toLowerCase();
  const colors = {
    present: "bg-emerald-500/40 text-emerald-300",
    late: "bg-yellow-500/40 text-yellow-300",
    absent: "bg-red-500/40 text-red-300",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors[s] ?? "bg-neutral-700/40 text-gray-300"}`}>
      {status}
    </span>
  );
}

function formatName(obj) {
  if (!obj) return "-";
  return `${obj.first_name || ""} ${obj.last_name || ""}`.trim() || "-";
}

function formatDateTime(dt) {
  return dt ? new Date(dt).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "-";
}
