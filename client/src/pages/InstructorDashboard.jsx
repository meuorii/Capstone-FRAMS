// src/pages/InstructorDashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AOS from "aos";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "aos/dist/aos.css";

import Navbar from "../components/Instructor/Navbar";
import Sidebar from "../components/Instructor/Sidebar";
import Subjects from "../components/Instructor/Subjects";
import InstructorOverview from "../components/Instructor/InstructorOverview";
import StudentsInClass from "../components/Instructor/StudentsInClass";
import AttendanceReports from "../components/Instructor/AttendanceReports";
import AttendanceSession from "../components/Instructor/AttendanceSession";
import ModalManager from "../components/Instructor/ModalManager";
import AttendanceLiveSession from "../components/Instructor/AttendanceLiveSession";
import InstructorRegisterFace from "../components/Instructor/InstructorRegisterFace";
import InstructorProfile from "../components/Instructor/InstructorProfile";

const InstructorDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [instructor, setInstructor] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeClassId, setActiveClassId] = useState(null);
  const [activeClass, setActiveClass] = useState(null);

  // 👉 Hide all layout elements when in attendance live session
  const hideLayout = activeTab === "session";

  useEffect(() => {
    AOS.init({ duration: 600 });

    const token = localStorage.getItem("token");
    const userType = localStorage.getItem("userType");
    const storedData = JSON.parse(localStorage.getItem("userData"));

    if (!token || userType !== "instructor" || !storedData) {
      navigate("/instructor/login", { replace: true });
    } else {
      setInstructor(storedData);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("userData");
    localStorage.removeItem("token");
    localStorage.removeItem("userType");
    navigate("/login");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return <InstructorOverview setActiveTab={setActiveTab} />;
      case "subject":
        return (
          <Subjects
            onActivateSession={(classObj) => {
              setActiveClassId(classObj._id);
              setActiveClass(classObj);
              setActiveTab("session");
            }}
          />
        );
      case "assigned":
        return <StudentsInClass />;
      case "attendance":
        return <AttendanceReports />;
      case "session":
        return (
          <AttendanceLiveSession
            classId={activeClassId}
            subjectCode={activeClass.subject_code}
            subjectTitle={activeClass.subject_title}
            course={activeClass.course}
            section={activeClass.section}
            semester={activeClass.semester}
            schoolYear={activeClass.school_year}
            onStopSession={() => setActiveTab("summary")}
          />
        );
      case "summary":
        return <AttendanceSession refetchTrigger={activeClassId} />;
      case "profile":
        return <InstructorProfile setActiveTab={setActiveTab} />;
      case "register-face":
        return <InstructorRegisterFace />;
      default:
        return <InstructorOverview />;
    }
  };

  return (
    <ModalManager>
      <div className="bg-neutral-950 min-h-screen rounded-xl text-white relative overflow-hidden">

        {/* Background Glow */}
        {!hideLayout && (
          <>
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/20 blur-[160px] rounded-full"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-600/20 blur-[160px] rounded-full"></div>
          </>
        )}

        {/* ===========================
            SIDEBAR (Hidden in Live Session)
        =========================== */}
        {!hideLayout && (
          <>
            {/* Desktop Sidebar */}
            <div className="hidden md:block fixed top-0 left-0 h-full w-64 bg-neutral-900 border-r border-green-500">
              <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                handleLogout={handleLogout}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
              />
            </div>

            {/* Mobile Sidebar */}
            <div className="md:hidden">
              <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                handleLogout={handleLogout}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
              />
            </div>
          </>
        )}

        {/* ===========================
            NAVBAR (Hidden in Live Session)
        =========================== */}
        {!hideLayout && (
          <div className="fixed top-0 left-0 right-0 md:left-64 z-10">
            <Navbar
              instructor={instructor}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />
          </div>
        )}

        {/* ===========================
            MAIN CONTENT AREA
        =========================== */}
        <div className={`flex-1 flex flex-col ${!hideLayout ? "md:ml-64" : ""}`}>

          <main
            className={`flex-1 overflow-y-auto ${
              hideLayout ? "mt-0" : "mt-16"
            }`}
          >
            <div data-aos="fade-up">{renderContent()}</div>
          </main>
        </div>
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
        newestOnTop={true}
        pauseOnHover={true}
      />
    </ModalManager>
  );
};

export default InstructorDashboard;
