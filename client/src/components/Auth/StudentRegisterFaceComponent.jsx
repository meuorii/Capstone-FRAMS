import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { FaSave, FaPlay, FaCheckCircle } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { registerFaceAuto } from "../../services/api";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import axios from "axios";

const REQUIRED_ANGLES = ["front", "left", "right", "up", "down"];
const API_URL = "https://frams-server-production.up.railway.app";

function StudentRegisterFaceComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const reRegData = location.state || null;
  const IS_REREGISTER = reRegData !== null;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceMeshRef = useRef(null);

  const lastCapturedAngleRef = useRef(null);
  const isCapturingRef = useRef(false);
  const targetAngleRef = useRef(REQUIRED_ANGLES[0]);
  const stableAngleRef = useRef(null);
  const stableCountRef = useRef(0);
  const captureLockRef = useRef(false);
  const lostFaceFramesRef = useRef(0);
  const faceDetectedRef = useRef(false);

  const [angleStatus, setAngleStatus] = useState({});
  const [faceDetected, setFaceDetected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(null);
  const [croppedPreview, setCroppedPreview] = useState(null);
  const [targetAngle, setTargetAngle] = useState(REQUIRED_ANGLES[0]);
  const [adminCourse, setAdminCourse] = useState(""); 

  const [formData, setFormData] = useState({
  Student_ID: "",
  First_Name: "",
  Middle_Name: "",
  Last_Name: "",
  Suffix: "",
  Course: "",
});

  const formDataRef = useRef(formData);
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { isCapturingRef.current = isCapturing; }, [isCapturing]);
  useEffect(() => { targetAngleRef.current = targetAngle; }, [targetAngle]);

   useEffect(() => {
  if (IS_REREGISTER) {
    setFormData({
      Student_ID: reRegData.student_id || "",
      First_Name: reRegData.first_name || "",
      Middle_Name: reRegData.middle_name || "",
      Last_Name: reRegData.last_name || "",
      Suffix: reRegData.suffix || "",
      Course: reRegData.course || "", 
    });

    toast.info("Re-register mode: Student details loaded.");
  }
}, []);

  useEffect(() => {
    let isMounted = true;
    let stream = null;
    let animationId = null;

    const setup = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        faceMeshRef.current = faceLandmarker;

        const video = videoRef.current;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 320 },
        });
        video.srcObject = stream;
        await video.play();

        await new Promise((resolve) => {
          const checkReady = setInterval(() => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              clearInterval(checkReady);
              resolve();
            }
          }, 100);
        });

        let lastVideoTime = -1;
        let frameCount = 0;

        const detectFrame = async () => {
          if (!isMounted || !faceMeshRef.current) return;

          frameCount++;
          // Process every 2nd frame for better FPS
          if (frameCount % 2 !== 0) {
            animationId = requestAnimationFrame(detectFrame);
            return;
          }

          // Avoid running before frame dimensions exist
          if (!video.videoWidth || !video.videoHeight) {
            animationId = requestAnimationFrame(detectFrame);
            return;
          }

          // Skip duplicate frames
          if (video.currentTime === lastVideoTime) {
            animationId = requestAnimationFrame(detectFrame);
            return;
          }
          lastVideoTime = video.currentTime;

          try {
            const results = await faceMeshRef.current.detectForVideo(
              video,
              performance.now()
            );
            if (results.faceLandmarks?.length > 0) {
              onResults({ multiFaceLandmarks: results.faceLandmarks });
            } else {
              onResults({ multiFaceLandmarks: [] });
            }
          } catch (err) {
            console.warn("⚠️ Skipped frame:", err.message);
          }

          animationId = requestAnimationFrame(detectFrame);
        };

        animationId = requestAnimationFrame(detectFrame);
      } catch (err) {
        console.error("Webcam/FaceLandmarker error:", err);
        toast.error("Unable to access webcam or load model.");
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (animationId) cancelAnimationFrame(animationId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (Object.keys(angleStatus).length === REQUIRED_ANGLES.length) {
      setIsCapturing(false);
      isCapturingRef.current = false;
      toast.success("🎉 All angles captured successfully!");
    }
  }, [angleStatus]);

  useEffect(() => {
    const fetchAdminProgram = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return toast.error("No admin token found.");

        const res = await axios.get(`${API_URL}/api/admin/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const program = res.data.program || "Unknown Program";
        setAdminCourse(program);
        setFormData((prev) => ({ ...prev, Course: program })); 
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch admin program.");
      }
    };
    fetchAdminProgram();
  }, []);

  useEffect(() => { faceDetectedRef.current = faceDetected; }, [faceDetected]);

  const onResults = async (results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) return;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -w, 0, w, h);
    ctx.restore();

    if (results.multiFaceLandmarks?.length) {
      setFaceDetected(true);
      lostFaceFramesRef.current = 0;
      const lm = results.multiFaceLandmarks[0];
      const xs = lm.map((p) => p.x * w);
      const ys = lm.map((p) => p.y * h);
      const xMin = Math.min(...xs);
      const yMin = Math.min(...ys);
      const xMax = Math.max(...xs);
      const yMax = Math.max(...ys);
      const boxWidth = xMax - xMin;
      const boxHeight = yMax - yMin;

      if (boxWidth < 40 || boxHeight < 40) {
        console.log("⛔ Face box too small — skipping frame");
        return;
      }

      ctx.beginPath();
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 2;
      const mirroredX = w - xMax;
      ctx.rect(mirroredX, yMin, boxWidth, boxHeight);
      ctx.stroke();

      const detectedAngle = predictAngle(lm, w, h);
      setCurrentAngle(detectedAngle);

      if (detectedAngle === stableAngleRef.current) {
        stableCountRef.current++;
      } else {
        stableAngleRef.current = detectedAngle;
        stableCountRef.current = 1;

        if (detectedAngle !== targetAngleRef.current) {
          lastCapturedAngleRef.current = null;
        }
      }

      const requiredStable = detectedAngle === "down" ? 18 : 12;

      if (stableCountRef.current >= requiredStable) {
        if (
          results.multiFaceLandmarks?.length > 0 &&
          faceDetectedRef.current &&
          lastCapturedAngleRef.current !== detectedAngle &&
          !captureLockRef.current &&
          isCapturingRef.current
        ) {
          lastCapturedAngleRef.current = detectedAngle;
          handleAutoCapture(detectedAngle);
        }
        stableCountRef.current = 0;
      }
    } else {
      lostFaceFramesRef.current++;
      if (lostFaceFramesRef.current < 25) return;
      setFaceDetected(false);
      stableAngleRef.current = null;
      stableCountRef.current = 0;
    }
  };

  const handleAutoCapture = async (detectedAngle) => {
    
   if (!faceDetectedRef.current) {
      return;
    }

    if (stableCountRef.current < 3) {
      return;
    }

    if (Object.keys(angleStatus).length === REQUIRED_ANGLES.length) return;
    if (detectedAngle !== targetAngleRef.current) return;
    if (angleStatus[detectedAngle]) return;
    if (captureLockRef.current) {
      return;
    }

    // 🔒 Lock capture globally for 1.2 seconds
    captureLockRef.current = true;
    setTimeout(() => {
      captureLockRef.current = false;
    }, 1200);


    const formReady = ["Student_ID", "First_Name", "Last_Name"].every(
      (key) => String(formDataRef.current[key]).trim() !== ""
    );

    if (!formReady) {
      toast.warn("⚠️ Please complete Student ID, First Name, and Last Name before capturing.");
      return;
    }
    if (!isCapturingRef.current) return;

    const image = captureImage();
    if (!image) return;

    setCroppedPreview(image);

    const courseToSend = (formDataRef.current.Course || adminCourse || "").trim().toUpperCase();

    if (!courseToSend) {
      toast.error("Course not loaded. Please wait a moment.");
      return;
}


    const toastId = toast.loading(`📸 Capturing ${detectedAngle.toUpperCase()}...`);
    try {
      const payload = {
        student_id: formDataRef.current.Student_ID,
        First_Name: formDataRef.current.First_Name,
        Middle_Name: formDataRef.current.Middle_Name || null,  
        Last_Name: formDataRef.current.Last_Name,
        Suffix: formDataRef.current.Suffix || null,
        Course: courseToSend,
        image,
        angle: detectedAngle,
      };
      const res = await registerFaceAuto(payload);

      if (res.status === 200) {
        toast.update(toastId, {
          render: `Captured ${detectedAngle.toUpperCase()} successfully!`,
          type: "success",
          isLoading: false,
          autoClose: 2000,
        });

        setAngleStatus((prev) => {
          const updated = { ...prev, [detectedAngle]: true };
          const idx = REQUIRED_ANGLES.indexOf(detectedAngle);
          if (idx < REQUIRED_ANGLES.length - 1) {
            const next = REQUIRED_ANGLES[idx + 1];
            targetAngleRef.current = next;
            setTargetAngle(next);
            toast.info(`Next: Turn ${next.toUpperCase()}`, { autoClose: 2500 });
          } else {
            setIsCapturing(false);
            isCapturingRef.current = false;
            toast.success("🎉 Student face successfully registered!");
            setTimeout(() => {
              navigate("/admin/dashboard");
            }, 2000);
          }
          return updated;
        });
      } else {
        toast.update(toastId, {
          render: `Unexpected server response — try again.`,
          type: "warning",
          isLoading: false,
          autoClose: 2500,
        });
      }
    } catch (err) {
      console.error(`Capture error for ${detectedAngle}:`, err);
      toast.update(toastId, {
        render: "Failed to save image.",
        type: "error",
        isLoading: false,
        autoClose: 2500,
      });
    }
  };

  // ✅ Predict angles (unchanged)
  const predictAngle = (lm, w, h) => {
    const nose = lm[1];
    const leftEye = lm[33];
    const rightEye = lm[263];
    const mouth = lm[13];
    const noseY = nose.y * h;
    const eyeMidY = ((leftEye.y + rightEye.y) / 2) * h;
    const mouthY = mouth.y * h;
    const eyeDist = rightEye.x - leftEye.x;
    const nosePos = (nose.x - leftEye.x) / (eyeDist + 1e-6);
    const upDownRatio = (noseY - eyeMidY) / (mouthY - noseY + 1e-6);
    if (nosePos < 0.35) return "right";
    if (nosePos > 0.75) return "left";
    if (upDownRatio > 1.4) return "down";
    if (upDownRatio < 0.55) return "up";
    return "front";
  };

  const captureImage = () => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  const handleStartCapture = () => {

    if (!adminCourse || adminCourse === "Unknown Program" || adminCourse.trim() === "") {
      toast.warn("Program not loaded yet. Please wait a moment.");
      return;
    }

    const ready = ["Student_ID", "First_Name", "Last_Name"].every(
      (key) => String(formData[key]).trim() !== ""
    );

    if (!ready) {
      toast.warning("Please complete all required fields (Student ID, First Name, Last Name).");
      return;
    }

    setIsCapturing(true);
    isCapturingRef.current = true;
    toast.info("📸 Auto capture started. Hold each angle steadily...");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    const forceCaps = ["Student_ID", "First_Name", "Middle_Name", "Last_Name", "Suffix"];

    const newValue = forceCaps.includes(name)
      ? value.toUpperCase()
      : value;

    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };
      formDataRef.current = updated;  
      return updated;
    });
  };


  const progressPercent =
    (Object.keys(angleStatus).length / REQUIRED_ANGLES.length) * 100;

  return (
    <div
      className="min-h-screen relative bg-neutral-950 text-white px-6 md:px-12 py-12 
                flex flex-col overflow-hidden"
    >
      {/* Background Glow Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/10 via-neutral-900 to-black"></div>
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 blur-[160px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-600/20 blur-[160px] rounded-full"></div>
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <h1
          className="text-4xl md:text-5xl font-extrabold 
            bg-gradient-to-r from-emerald-400 to-green-600 
            bg-clip-text text-transparent 
            drop-shadow-lg text-center mb-4"
        >
          Student Face Registration
        </h1>
        <p
          className="text-center text-gray-300 text-lg md:text-xl 
            max-w-xl mx-auto leading-relaxed mb-10"
        >
          Fill in your details and register your face across multiple angles 
          to ensure high accuracy during attendance sessions.
        </p>

        {/* --- Layout --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* LEFT: CAMERA + STATUS */}
          <div className="flex flex-col items-center">
            <div className="relative w-[450px] h-[450px] rounded-2xl overflow-hidden 
              border border-emerald-400/50 backdrop-blur-md 
              shadow-[0_0_40px_rgba(16,185,129,0.3)]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
              {croppedPreview && (
              <div className="mt-4 flex flex-col items-center">
                <p className="text-sm text-gray-400 mb-2">🧠 Debug: Cropped Face Preview</p>
                <img
                  src={croppedPreview}
                  alt="Cropped Face Debug"
                  className="w-40 h-40 rounded-xl border border-emerald-500 shadow-md object-cover"
                />
              </div>
            )}
            </div>

            {/* Status */}
            <div className="text-center mt-4 space-y-2">
              {faceDetected ? (
                <>
                  <p className="inline-block px-4 py-1 rounded-full text-sm font-medium 
                    bg-green-500/20 text-green-400 border border-green-500/40">
                    ✅ Face Detected ({Object.keys(angleStatus).length}/{REQUIRED_ANGLES.length})
                  </p>
                  {currentAngle && (
                    <p className="inline-block px-4 py-1 rounded-full text-sm font-medium 
                      bg-blue-500/20 text-blue-400 border border-blue-500/40">
                      🎯 Current Angle: <span className="uppercase">{currentAngle}</span>
                    </p>
                  )}
                </>
              ) : (
                <p className="inline-block px-4 py-1 rounded-full text-sm font-medium 
                  bg-red-500/20 text-red-400 border border-red-500/40">
                   No Face Detected
                </p>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-sm mt-6">
              <p className="text-sm text-center mb-2 text-gray-300">
                Captured: {Object.keys(angleStatus).length} / {REQUIRED_ANGLES.length}
              </p>
              <div className="bg-gray-800 h-3 rounded-full overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-green-600 
                    transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Angle Status */}
            <div className="grid grid-cols-5 gap-4 mt-6">
              {REQUIRED_ANGLES.map((angle) => (
                <div key={angle} className="flex flex-col items-center text-center">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center border-2 text-sm font-medium transition-all duration-300
                      ${
                        angleStatus[angle]
                          ? "bg-gradient-to-br from-emerald-400 to-green-600 text-white border-green-500 shadow-lg shadow-emerald-500/40"
                          : "bg-neutral-800 text-gray-400 border-gray-600"
                      }`}
                  >
                    {angleStatus[angle] ? (
                      <FaCheckCircle className="text-white text-xl" />
                    ) : (
                      "–"
                    )}
                  </div>
                  <span className="text-xs mt-2 text-gray-300 uppercase tracking-wide">
                    {angle}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: FORM */}
          <div className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 mb-6">
              <input name="Student_ID" placeholder="Student ID" value={formData.Student_ID} onChange={handleChange} readOnly={IS_REREGISTER} className="p-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-gray-400 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
              <input name="First_Name" placeholder="First Name" value={formData.First_Name} onChange={handleChange} readOnly={IS_REREGISTER} className="p-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-gray-400 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
              <input name="Middle_Name" placeholder="Middle Name" value={formData.Middle_Name} onChange={handleChange} readOnly={IS_REREGISTER} className="p-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-gray-400 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
              <input name="Last_Name" placeholder="Last Name" value={formData.Last_Name} onChange={handleChange} readOnly={IS_REREGISTER}  className="p-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-gray-400 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
              <input
                name="Course"
                value={formData.Course || "Loading..."}
                readOnly
                className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-400/30 text-emerald-300 
                  font-semibold cursor-not-allowed md:col-span-2"
              />
              <select
                name="Suffix"
                value={formData.Suffix || ""}
                onChange={handleChange}
                disabled={IS_REREGISTER}
                className="p-3 rounded-lg bg-neutral-900 border border-white/20 text-white uppercase tracking-wider  focus:outline-none 
                  focus:ring-2 focus:ring-emerald-500 transition-all md:col-span-2"
              >
                <option value="">Select Suffix (Optional)</option>
                <option value="Jr.">Jr.</option>
                <option value="Sr.">Sr.</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
                <option value="None">None</option>
              </select>
            </div>

            <div className="flex justify-center lg:justify-start mt-6">
              {!isCapturing &&
              Object.keys(angleStatus).length < REQUIRED_ANGLES.length ? (
                <button
                  onClick={handleStartCapture}
                  className="px-8 py-4 rounded-xl font-semibold text-lg flex items-center gap-3 
                    bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg 
                    hover:scale-105 hover:shadow-emerald-500/40 transition-all duration-300"
                >
                  <FaPlay className="text-xl" />
                  Start Capture
                </button>
              ) : (
                <button
                  onClick={() => navigate("/admin/dashboard")}
                  className="px-8 py-4 rounded-xl font-semibold text-lg flex items-center gap-3 
                    bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg 
                    hover:scale-105 hover:shadow-cyan-500/40 transition-all duration-300"
                >
                  <FaSave className="text-xl" />
                  All Done – Return to Admin Dashboard
                </button>
              )}
            </div>
          </div>
        </div>

        <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      </div>
    </div>
  );
}

export default StudentRegisterFaceComponent;
