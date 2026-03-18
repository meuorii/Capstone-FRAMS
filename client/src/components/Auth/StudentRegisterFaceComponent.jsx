import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaSave, FaPlay, FaCheckCircle } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { registerFaceAuto } from "../../services/api";
import * as faceapi from "face-api.js";
import axios from "axios";

const REQUIRED_ANGLES = ["front", "left", "right", "up", "down"];
const API_URL = "http://127.0.0.1:8080";
const MODEL_URL = "/models";
const CAPTURE_TOAST_ID = "capture-toast";

function StudentRegisterFaceComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const reRegData = location.state || null;
  const IS_REREGISTER = reRegData !== null;

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationIdRef = useRef(null);
  const modelsLoadedRef = useRef(false);

  // Capture control refs
  const isCapturingRef = useRef(false);
  const targetAngleRef = useRef(REQUIRED_ANGLES[0]);
  const stableAngleRef = useRef(null);
  const stableCountRef = useRef(0);
  const captureLockRef = useRef(false);
  const lastCapturedAngleRef = useRef(null);
  const lostFaceFramesRef = useRef(0);
  const faceDetectedRef = useRef(false);
  const angleStatusRef = useRef({});
  const formDataRef = useRef({});

  const [modelsReady, setModelsReady] = useState(false);
  const [angleStatus, setAngleStatus] = useState({});
  const [faceDetected, setFaceDetected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(null);
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

  // Keep refs in sync
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { isCapturingRef.current = isCapturing; }, [isCapturing]);
  useEffect(() => { targetAngleRef.current = targetAngle; }, [targetAngle]);
  useEffect(() => { faceDetectedRef.current = faceDetected; }, [faceDetected]);
  useEffect(() => { angleStatusRef.current = angleStatus; }, [angleStatus]);

  // Re-register prefill
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

  // Fetch admin program
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

  // Load face-api models + start webcam
  useEffect(() => {
    let isMounted = true;
    let stream = null;

    const setup = async () => {
      try {
        toast.info("Loading face detection models...", { toastId: "model-load" });

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);

        modelsLoadedRef.current = true;
        if (isMounted) setModelsReady(true);
        toast.update("model-load", {
          render: "Models loaded. Camera ready.",
          type: "success",
          isLoading: false,
          autoClose: 2000,
        });

        const video = videoRef.current;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 320, facingMode: "user" },
        });

        if (!isMounted) return;
        video.srcObject = stream;
        await video.play();

        // Wait for video dimensions
        await new Promise((resolve) => {
          const check = setInterval(() => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              clearInterval(check);
              resolve();
            }
          }, 100);
        });

        startDetectionLoop(video, isMounted);
      } catch (err) {
        console.error("Setup error:", err);
        toast.error("Unable to access webcam or load models.");
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // All angles done
  useEffect(() => {
    if (Object.keys(angleStatus).length === REQUIRED_ANGLES.length) {
      setIsCapturing(false);
      isCapturingRef.current = false;
    }
  }, [angleStatus]);

  const startDetectionLoop = (video, isMounted) => {
    let lastVideoTime = -1;
    let frameCount = 0;

    const detect = async () => {
      if (!isMounted || !modelsLoadedRef.current) return;

      frameCount++;
      // Process every 2nd frame
      if (frameCount % 2 !== 0) {
        animationIdRef.current = requestAnimationFrame(detect);
        return;
      }

      if (!video.videoWidth || !video.videoHeight || video.currentTime === lastVideoTime) {
        animationIdRef.current = requestAnimationFrame(detect);
        return;
      }
      lastVideoTime = video.currentTime;

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
          .withFaceLandmarks();

        processDetection(detection, video);
      } catch (err) {
        console.warn("Frame skipped:", err.message);
      }

      animationIdRef.current = requestAnimationFrame(detect);
    };

    animationIdRef.current = requestAnimationFrame(detect);
  };

  const processDetection = (detection, video) => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    // ✅ Correct canvas draw — video CSS handles the mirror, canvas just overlays
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    if (!detection) {
      lostFaceFramesRef.current++;
      if (lostFaceFramesRef.current >= 25) {
        setFaceDetected(false);
        stableAngleRef.current = null;
        stableCountRef.current = 0;
      }
      return;
    }

    lostFaceFramesRef.current = 0;
    setFaceDetected(true);

    const box = detection.detection.box;
    const mirroredX = w - box.x - box.width;
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2;
    ctx.strokeRect(mirroredX, box.y, box.width, box.height);

    const pts = detection.landmarks.positions;

    const noseTip  = pts[30];
    const leftEye  = pts[36];
    const rightEye = pts[45];
    const topNose  = pts[27];
    const mouthTop = pts[51];

    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeDist = Math.abs(rightEye.x - leftEye.x);

    // Yaw: unchanged, works correctly
    const yaw = ((noseTip.x - eyeMidX) / (eyeDist + 1e-6)) * 90;

    const noseToMouth = mouthTop.y - topNose.y;
    const noseOffset  = noseTip.y - topNose.y;
    const noseRatio   = noseOffset / (noseToMouth + 1e-6);
    const pitch       = (noseRatio - 0.50) * 180;

    const detectedAngle = classifyAngle(yaw, pitch);
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

    if (
      stableCountRef.current >= requiredStable &&
      faceDetectedRef.current &&
      lastCapturedAngleRef.current !== detectedAngle &&
      !captureLockRef.current &&
      isCapturingRef.current
    ) {
      lastCapturedAngleRef.current = detectedAngle;
      handleAutoCapture(detectedAngle);
      stableCountRef.current = 0;
    }
  };

  // Uses face-api's yaw/pitch in degrees — much more accurate than ratio math
  const classifyAngle = (yaw, pitch) => {
    if (yaw > 18)   return "left";   
    if (yaw < -18)  return "right";  
    if (pitch < -20) return "up";   
    if (pitch > 22)  return "down";  
    return "front";
  };

  const handleAutoCapture = async (detectedAngle) => {
    if (!faceDetectedRef.current) return;
    if (Object.keys(angleStatusRef.current).length === REQUIRED_ANGLES.length) return;
    if (detectedAngle !== targetAngleRef.current) return;
    if (angleStatusRef.current[detectedAngle]) return;
    if (captureLockRef.current) return;

    captureLockRef.current = true;
    setTimeout(() => { captureLockRef.current = false; }, 2500);

    const formReady = ["Student_ID", "First_Name", "Last_Name"].every(
      (key) => String(formDataRef.current[key]).trim() !== ""
    );
    if (!formReady) {
      toast.warn("Please complete Student ID, First Name, and Last Name before capturing.");
      return;
    }
    if (!isCapturingRef.current) return;

    const image = captureImage();
    if (!image) return;

    const courseToSend = (formDataRef.current.Course || adminCourse || "").trim().toUpperCase();
    if (!courseToSend) {
      toast.error("Course not loaded. Please wait a moment.");
      return;
    }

    // ✅ Always dismiss any previous toast first, then show loading
    toast.dismiss(CAPTURE_TOAST_ID);
    toast.loading(`📸 Capturing ${detectedAngle.toUpperCase()}...`, {
      toastId: CAPTURE_TOAST_ID,
      position: "top-right",
    });

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
        toast.dismiss(CAPTURE_TOAST_ID);
        const idx = REQUIRED_ANGLES.indexOf(detectedAngle);
        const isLast = idx === REQUIRED_ANGLES.length - 1;
        const next = !isLast ? REQUIRED_ANGLES[idx + 1] : null;

        // ✅ Update target immediately
        if (!isLast && next) {
          targetAngleRef.current = next;
          setTargetAngle(next);
        }

        // ✅ Update angle status
        setAngleStatus((prev) => {
          const updated = { ...prev, [detectedAngle]: true };
          angleStatusRef.current = updated;
          return updated;
        });

        // ✅ Update the existing toast to success — no new toast created
        setTimeout(() => {
          toast.success(`✅ ${detectedAngle.toUpperCase()} captured!`, {
            toastId: CAPTURE_TOAST_ID,
            autoClose: 1800,
            position: "top-right",
          });
        }, 150);

        if (!isLast && next) {
          setTimeout(() => {
            toast.dismiss(CAPTURE_TOAST_ID);
            toast.info(`👉 Next: Turn ${next.toUpperCase()}`, {
              toastId: CAPTURE_TOAST_ID,
              autoClose: 2000,
              position: "top-right",
            });
          }, 2100);
        } else {
          setIsCapturing(false);
          isCapturingRef.current = false;
          setTimeout(() => {
            toast.dismiss(CAPTURE_TOAST_ID);
            toast.update(CAPTURE_TOAST_ID, {
              render: "🎉 All angles registered successfully!",
              type: "success",
              isLoading: false,
              autoClose: 2500,
              position: "top-right",
            });
            setTimeout(() => navigate("/admin/dashboard"), 2500);
          }, 1900);
        }

      } else {
        toast.update(CAPTURE_TOAST_ID, {
          render: "Unexpected server response — try again.",
          type: "warning",
          isLoading: false,
          autoClose: 2500,
        });
      }
    } catch (err) {
      console.error(`Capture error for ${detectedAngle}:`, err);
      toast.update(CAPTURE_TOAST_ID, {
        render: "Failed to save image.",
        type: "error",
        isLoading: false,
        autoClose: 2500,
      });
    }
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
    if (!modelsReady) {
      toast.warn("Models still loading. Please wait.", { position: "top-right" });
      return;
    }
    if (!adminCourse || adminCourse === "Unknown Program" || adminCourse.trim() === "") {
      toast.warn("Program not loaded yet. Please wait a moment.", { position: "top-right" });
      return;
    }
    const ready = ["Student_ID", "First_Name", "Last_Name"].every(
      (key) => String(formData[key]).trim() !== ""
    );
    if (!ready) {
      toast.warning("Please complete all required fields.", { position: "top-right" });
      return;
    }
    setIsCapturing(true);
    isCapturingRef.current = true;
    toast.info("📸 Auto capture started. Hold each angle steadily...", {
      position: "top-right",
      autoClose: 2000,
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const forceCaps = ["Student_ID", "First_Name", "Middle_Name", "Last_Name", "Suffix"];
    const newValue = forceCaps.includes(name) ? value.toUpperCase() : value;
    setFormData((prev) => {
      const updated = { ...prev, [name]: newValue };
      formDataRef.current = updated;
      return updated;
    });
  };

  const progressPercent =
    (Object.keys(angleStatus).length / REQUIRED_ANGLES.length) * 100;

  return (
    <div className="min-h-screen relative bg-neutral-950 text-white px-6 md:px-12 py-12 flex flex-col overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/10 via-neutral-900 to-black"></div>
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 blur-[160px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-600/20 blur-[160px] rounded-full"></div>

      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text text-transparent drop-shadow-lg text-center mb-4">
          Student Face Registration
        </h1>
        <p className="text-center text-gray-300 text-lg md:text-xl max-w-xl mx-auto leading-relaxed mb-10">
          Fill in your details and register your face across multiple angles
          to ensure high accuracy during attendance sessions.
        </p>

        {/* Models loading indicator */}
        {!modelsReady && (
          <div className="flex justify-center mb-6">
            <p className="px-4 py-2 rounded-full text-sm bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 animate-pulse">
              ⏳ Loading face detection models...
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* LEFT: CAMERA + STATUS */}
          <div className="flex flex-col items-center">
            <div className="relative w-[450px] h-[450px] rounded-2xl overflow-hidden border border-emerald-400/50 backdrop-blur-md shadow-[0_0_40px_rgba(16,185,129,0.3)]">
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

              {/* Angle guide overlay */}
              {isCapturing && !angleStatus[targetAngle] && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <span className="px-4 py-1 rounded-full text-sm font-semibold bg-black/60 text-emerald-300 border border-emerald-500/50">
                    👉 Turn: <span className="uppercase">{targetAngle}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Status badges */}
            <div className="text-center mt-4 space-y-2">
              {faceDetected ? (
                <>
                  <p className="inline-block px-4 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/40">
                    ✅ Face Detected ({Object.keys(angleStatus).length}/{REQUIRED_ANGLES.length})
                  </p>
                  {currentAngle && (
                    <p className="inline-block px-4 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/40">
                      🎯 Current Angle: <span className="uppercase">{currentAngle}</span>
                    </p>
                  )}
                </>
              ) : (
                <p className="inline-block px-4 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/40">
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
                  className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-green-600 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Angle Status Circles */}
            <div className="grid grid-cols-5 gap-4 mt-6">
              {REQUIRED_ANGLES.map((angle) => (
                <div key={angle} className="flex flex-col items-center text-center">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center border-2 text-sm font-medium transition-all duration-300
                      ${angleStatus[angle]
                        ? "bg-gradient-to-br from-emerald-400 to-green-600 text-white border-green-500 shadow-lg shadow-emerald-500/40"
                        : angle === targetAngle && isCapturing
                        ? "bg-yellow-500/20 text-yellow-300 border-yellow-400 animate-pulse"
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
              <input name="Last_Name" placeholder="Last Name" value={formData.Last_Name} onChange={handleChange} readOnly={IS_REREGISTER} className="p-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-gray-400 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
              <input
                name="Course"
                value={formData.Course || "Loading..."}
                readOnly
                className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-400/30 text-emerald-300 font-semibold cursor-not-allowed md:col-span-2"
              />
              <select
                name="Suffix"
                value={formData.Suffix || ""}
                onChange={handleChange}
                disabled={IS_REREGISTER}
                className="p-3 rounded-lg bg-neutral-900 border border-white/20 text-white uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all md:col-span-2"
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
              {!isCapturing && Object.keys(angleStatus).length < REQUIRED_ANGLES.length ? (
                <button
                  onClick={handleStartCapture}
                  disabled={!modelsReady}
                  className="px-8 py-4 rounded-xl font-semibold text-lg flex items-center gap-3 
                    bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg 
                    hover:scale-105 hover:shadow-emerald-500/40 transition-all duration-300
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <FaPlay className="text-xl" />
                  {modelsReady ? "Start Capture" : "Loading Models..."}
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

        <ToastContainer position="top-right" autoClose={3000} theme="dark" limit={1} newestOnTop />
      </div>
    </div>
  );
}

export default StudentRegisterFaceComponent;