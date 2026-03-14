import { useEffect, useState } from "react";
import axios from "axios";
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  CalendarCheck, 
  Activity, 
  UserCircle2, 
  Clock, 
  ArrowUpRight,
  TrendingUp,
  Loader2
} from "lucide-react";

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

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found");
      const payload = JSON.parse(atob(token.split(".")[1]));
      const adminProgram = payload?.sub?.program || payload?.program;
      if (!adminProgram) throw new Error("Program not found in token");
      setProgram(adminProgram);
    } catch (e) {
      console.log(e)
      setErr("Session invalid. Please re-login.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!program) return;
    (async () => {
      setLoading(true);
      try {
        const [statsRes, recentRes, lastStudRes] = await Promise.allSettled([
          API.get("/api/admin/overview/stats", { params: { program } }),
          API.get("/api/admin/overview/recent-logs", { params: { limit: 5, program } }),
          API.get("/api/admin/overview/last-student", { params: { program } }),
        ]);

        if (statsRes.status === "fulfilled") setStats(normalizeStats(statsRes.value.data));
        if (recentRes.status === "fulfilled") setRecentLogs(Array.isArray(recentRes.value.data) ? recentRes.value.data : []);
        if (lastStudRes.status === "fulfilled") setLastStudent(lastStudRes.value.data || null);
      } catch (e) {
        console.log(e)
        setErr("Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, [program]);

  return (
    <div className="p-6 lg:p-10 bg-[#050505] min-h-screen text-white space-y-10">
      
      {/* Header Area */}
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="text-4xl font-black bg-gradient-to-br from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent tracking-tighter">
            {program ? program : "System"} <span className="text-emerald-500">Overview</span>
          </h2>
          <p className="text-neutral-500 text-xs font-bold tracking-[0.3em] uppercase">
            Real-time Institutional Analytics
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-neutral-900/50 border border-white/5 rounded-full">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">System Live</span>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
          <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest">Decrypting Data...</p>
        </div>
      ) : err ? (
        <div className="p-8 bg-red-500/5 border border-red-500/20 rounded-3xl text-red-400 text-center">
          {err}
        </div>
      ) : (
        <>
          {/* Stat Cards - Refined Glass Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={<GraduationCap />}
              label="Active Students"
              value={stats.total_students}
              color="emerald"
              onClick={() => setActiveTab("students")}
            />
            <StatCard
              icon={<Users />}
              label="Faculty Staff"
              value={stats.total_instructors}
              color="blue"
              onClick={() => setActiveTab("instructors")}
            />
            <StatCard
              icon={<BookOpen />}
              label="Active Courses"
              value={stats.total_classes}
              color="purple"
              onClick={() => setActiveTab("classes")}
            />
            <StatCard
              icon={<CalendarCheck />}
              label="Daily Attendance"
              value={stats.attendance_today}
              color="amber"
              onClick={() => setActiveTab("attendance")}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Logs - Modern Minimal Table */}
            <div className="lg:col-span-2 bg-neutral-900/20 border border-white/5 rounded-[2rem] p-8 backdrop-blur-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-400 flex items-center gap-3">
                  <Activity size={18} className="text-emerald-500" /> Recent Activity
                </h3>
                <button 
                  onClick={() => setActiveTab("attendance")}
                  className="text-[10px] font-bold text-neutral-500 hover:text-emerald-400 transition-colors uppercase tracking-widest"
                >
                  View Full Report
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.15em] text-neutral-600 font-black">
                      <th className="px-4 pb-4">Student</th>
                      <th className="px-4 pb-4">Subject</th>
                      <th className="px-4 pb-4">Status</th>
                      <th className="px-4 pb-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.length > 0 ? recentLogs.map((log, i) => (
                      <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-4 border-y border-l border-white/5 rounded-l-xl bg-neutral-900/30">
                          <span className="text-xs font-bold text-neutral-200">{formatName(log?.student)}</span>
                        </td>
                        <td className="px-4 py-4 border-y border-white/5 bg-neutral-900/30">
                          <span className="text-[10px] font-mono text-neutral-500">{log?.subject || "-"}</span>
                        </td>
                        <td className="px-4 py-4 border-y border-white/5 bg-neutral-900/30">
                          {badge(log?.status)}
                        </td>
                        <td className="px-4 py-4 border-y border-r border-white/5 rounded-r-xl bg-neutral-900/30 text-right">
                          <span className="text-[10px] font-mono text-neutral-600 group-hover:text-neutral-400 transition-colors">
                            {formatDateTime(log?.timestamp)}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="4" className="text-center py-10 text-neutral-600 italic text-xs uppercase tracking-widest">Log database clear</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Last Registered - Profile Card Style */}
            <div className="bg-neutral-900/20 border border-white/5 rounded-[2rem] p-8 backdrop-blur-sm overflow-hidden relative">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-400 mb-8 flex items-center gap-3">
                <TrendingUp size={18} className="text-blue-500" /> Newest Member
              </h3>

              {lastStudent ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-neutral-900/50 rounded-2xl border border-white/5">
                    <div className="h-16 w-16 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                      <UserCircle2 size={32} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-lg font-black tracking-tight text-white">{formatName(lastStudent)}</p>
                      <p className="text-[10px] font-mono text-blue-500 uppercase font-bold tracking-widest">#{lastStudent.student_id}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 font-bold uppercase tracking-widest">Timestamp</span>
                      <div className="flex items-center gap-2 text-neutral-300">
                        <Clock size={12} className="text-neutral-600" />
                        {formatDateTime(lastStudent.created_at)}
                      </div>
                    </div>
                    <div className="h-px bg-white/5 w-full" />
                    <button 
                      onClick={() => setActiveTab("students")}
                      className="w-full py-4 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-white transition-all duration-300 shadow-lg shadow-black/20"
                    >
                      Audit Student Registry <ArrowUpRight size={14} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-neutral-600 italic text-xs uppercase tracking-widest text-center py-20">Waiting for first entry...</p>
              )}
            </div>
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

function StatCard({ icon, label, value, color, onClick }) {
  const themes = {
    emerald: "text-emerald-500 border-emerald-500/10 hover:border-emerald-500/40 bg-emerald-500/5",
    blue: "text-blue-500 border-blue-500/10 hover:border-blue-500/40 bg-blue-500/5",
    purple: "text-purple-500 border-purple-500/10 hover:border-purple-500/40 bg-purple-500/5",
    amber: "text-amber-500 border-amber-500/10 hover:border-amber-500/40 bg-amber-500/5",
  };

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer p-8 rounded-[2rem] border backdrop-blur-sm transition-all duration-500 transform hover:-translate-y-1 ${themes[color]}`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-neutral-950 rounded-xl border border-white/5 transition-colors group-hover:bg-neutral-900">
          {icon}
        </div>
        <ArrowUpRight size={18} className="opacity-0 group-hover:opacity-100 transition-all text-neutral-500" />
      </div>
      <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{label}</p>
      <p className="text-3xl font-black text-white tracking-tighter">{value ?? 0}</p>
    </div>
  );
}

function badge(status) {
  const s = String(status || "").toLowerCase();
  const themes = {
    present: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    late: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    absent: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return (
    <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${themes[s] ?? "bg-neutral-800 text-neutral-400"}`}>
      {status}
    </span>
  );
}

function formatName(obj) {
  if (!obj) return "-";
  return `${obj.first_name || ""} ${obj.last_name || ""}`.trim() || "-";
}

function formatDateTime(dt) {
  if (!dt) return "-";
  return new Date(dt).toLocaleTimeString("en-PH", { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}