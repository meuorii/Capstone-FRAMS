import { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getInstructorProfile } from "../../services/api";

export default function InstructorProfile({ setActiveTab }) {
  const [loading, setLoading] = useState(true);
  const [prof, setProf] = useState(null);

  // ------------------------------------------------
  // RANDOM MASK FUNCTIONS
  // ------------------------------------------------

 const maskEmail = (email) => {
  if (!email || !email.includes("@")) return email;

  const [user, domain] = email.split("@");

  const chars = user.split("");

  // Allow only 1 or 2 random characters to be shown
  const revealCount = Math.random() < 0.5 ? 1 : 2;

  const revealPositions = [];

  // Choose random indexes to reveal, avoid dots or special chars
  while (revealPositions.length < revealCount) {
    const pos = Math.floor(Math.random() * chars.length);
    if (!revealPositions.includes(pos) && /[A-Za-z0-9]/.test(chars[pos])) {
      revealPositions.push(pos);
    }
  }

  // Mask all except the random revealed characters
  const maskedUser = chars
    .map((ch, i) => (revealPositions.includes(i) ? ch : "*"))
    .join("");

  return `${maskedUser}@${domain}`;
};


  // ⭐ Mask instructor ID → Keep last 4 digits, random stars for the rest
  const maskInstructorId = (id) => {
  if (!id) return "";

  const chars = id.split("");

  // Show 1 or 2 random characters only
  const revealCount = Math.random() < 0.5 ? 1 : 2;

  // Choose random unique positions to reveal
  const revealPositions = [];
  while (revealPositions.length < revealCount) {
    const pos = Math.floor(Math.random() * chars.length);
    if (!revealPositions.includes(pos) && chars[pos] !== "-") {
      revealPositions.push(pos);
    }
  }

  // Build masked string
  return chars
    .map((ch, i) => {
      if (ch === "-") return "-"; // keep dash visible
      return revealPositions.includes(i) ? ch : "*";
    })
    .join("");
};


  // ------------------------------------------------
  // LOAD PROFILE
  // ------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getInstructorProfile();

        const normalized = {
          instructor_id: data?.instructor_id || "",
          name: data?.name || "",
          email: data?.email || "",
          face_registered: data?.face_registered === "Yes",
        };

        setProf(normalized);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="animate-pulse h-40 rounded-2xl bg-white/5 w-3/4" />
        <ToastContainer position="top-center" theme="dark" />
      </div>
    );

  if (!prof)
    return (
      <div className="p-6 text-red-400 text-center">
        Unable to load instructor profile.
      </div>
    );

  return (
    <div className="p-6">
      <div className="rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-white">Instructor Profile</h2>

          <span
            className={`px-4 py-2 rounded-full text-xs font-medium ${
              prof.face_registered
                ? "bg-emerald-600/20 text-emerald-300 border border-emerald-600/30"
                : "bg-yellow-600/20 text-yellow-300 border border-yellow-600/30"
            }`}
          >
            {prof.face_registered ? "Face Registered" : "Face Not Registered"}
          </span>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Instructor ID */}
          <div className="rounded-xl bg-white/5 p-6">
            <div className="text-white/60 text-sm">Instructor ID</div>
            <div className="text-lg text-white font-medium">
              {maskInstructorId(prof.instructor_id)}
            </div>
          </div>

          {/* Name */}
          <div className="rounded-xl bg-white/5 p-6">
            <div className="text-white/60 text-sm">Name</div>
            <div className="text-lg text-white font-medium">{prof.name}</div>
          </div>

          {/* Email */}
          <div className="rounded-xl bg-white/5 p-6">
            <div className="text-white/60 text-sm">Email</div>
            <div className="text-lg text-white font-medium">
              {maskEmail(prof.email)}
            </div>
          </div>
        </div>

        {/* Register/Re-register Face */}
        <div className="mt-8 text-center">
          {!prof.face_registered ? (
            <button
              className="px-6 py-3 rounded-xl bg-emerald-600 text-white text-lg font-semibold hover:bg-emerald-500 transition-all duration-300"
              onClick={() => setActiveTab("register-face")}
            >
              Register Face
            </button>
          ) : (
            <button
              className="px-6 py-3 rounded-xl bg-gray-700 text-white text-lg font-semibold hover:bg-gray-600 transition-all duration-300"
              onClick={() => setActiveTab("register-face")}
            >
              Re-register Face
            </button>
          )}
        </div>
      </div>

      <ToastContainer position="top-center" theme="dark" />
    </div>
  );
}
