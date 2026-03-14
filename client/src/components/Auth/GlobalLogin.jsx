import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { FaLock, FaUser } from "react-icons/fa";

function GlobalLogin() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef(null);  // <-- NEW: For auto-focus

  const BASE_URL = "http://127.0.0.1:8080/api";

  // -----------------------------------------------------
  // LOGIN FUNCTION
  // -----------------------------------------------------
  const handleLogin = async () => {
    if (!userId || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      // Try Admin login
      const adminRes = await axios.post(`${BASE_URL}/admin/login`, {
        user_id: userId,
        password,
      });

      if (adminRes.data?.token) {
        toast.success("Admin login successful!");
        localStorage.setItem("token", adminRes.data.token);
        localStorage.setItem("userType", "admin");
        localStorage.setItem("userData", JSON.stringify(adminRes.data.admin));
        navigate("/admin/dashboard");
        return;
      }
    } catch (err) {
      const status = err.response?.status;

      if (status === 401 || status === 404) {
        try {
          const instructorRes = await axios.post(`${BASE_URL}/instructor/login`, {
            instructor_id: userId,
            password,
          });

          if (instructorRes.data?.token) {
            toast.success("Instructor login successful!");
            localStorage.setItem("token", instructorRes.data.token);
            localStorage.setItem("userType", "instructor");
            localStorage.setItem(
              "userData",
              JSON.stringify(instructorRes.data.instructor)
            );
            navigate("/instructor/dashboard");
            return;
          }
        } catch {
          toast.error("Invalid credentials. Please check your ID or password.");
        }
      } else {
        toast.error("Server error. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------
  // HANDLE ENTER KEY
  // -----------------------------------------------------
  const handleKeyDown = (e, field) => {
    if (e.key === "Enter") {
      if (field === "userId") {
        // move to password field
        passwordRef.current.focus();
      } else if (field === "password") {
        // attempt login
        handleLogin();
      }
    }
  };

  // -----------------------------------------------------
  // UI
  // -----------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-neutral-950 text-white">
      {/* Background Glow Effects */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 blur-[160px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-600/20 blur-[160px] rounded-full"></div>

      <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-3xl font-extrabold text-center bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text text-transparent mb-2">
          System Login
        </h2>
        <p className="text-center text-gray-400 mb-8 text-sm">
          Enter your credentials to access your account.
        </p>

        <div className="space-y-5">
          {/* User ID */}
          <div className="relative">
            <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="User ID"
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/10 border border-white/20 
                text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                focus:ring-emerald-500 hover:border-emerald-400 hover:bg-white/20 
                transition-all duration-300 ease-in-out"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "userId")}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="password"
              placeholder="Password"
              ref={passwordRef}       // <-- NEW
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/10 border border-white/20 
                text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                focus:ring-emerald-500 hover:border-emerald-400 hover:bg-white/20 
                transition-all duration-300 ease-in-out"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "password")}
            />
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-white 
              bg-gradient-to-r from-emerald-500 to-green-600 shadow-lg 
              hover:from-green-500 hover:to-emerald-600 
              hover:scale-[1.03] hover:shadow-emerald-500/40 
              active:scale-95 transition-all duration-300 ease-in-out"
          >
            {loading ? "Verifying..." : "Login"}
          </button>
        </div>

        <p className="text-sm text-center text-gray-400 mt-6">
          Need an account?{" "}
          <span
            className="text-emerald-400 hover:underline cursor-pointer"
            onClick={() => navigate("/instructor/register")}
          >
            Register as Instructor
          </span>
        </p>
      </div>
    </div>
  );
}

export default GlobalLogin;
