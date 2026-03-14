import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import * as faceapi from "face-api.js";
import { toast } from "react-toastify";

// ⚡ Global model loader — loads once, reused across all sessions
let modelsLoaded = false;
let modelsLoadingPromise = null;

const loadModels = () => {
  if (modelsLoaded) return Promise.resolve();
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = Promise.all([
    // SsdMobilenetv1 — best for multi-face + far distance detection
    faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
  ]).then(() => {
    modelsLoaded = true;
  });

  return modelsLoadingPromise;
};

const AttendanceLiveSession = ({
  classId,
  subjectCode,
  subjectTitle,
  course,
  section,
  semester,
  schoolYear,
  onStopSession,
}) => {
  const activeClassId = classId;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [recognized, setRecognized] = useState([]);
  const [isStarting, setIsStarting] = useState(true);
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const [isStopping, setIsStopping] = useState(false);
  const [instructorDetected, setInstructorDetected] = useState(false);
  const [instructorName, setInstructorName] = useState(null);
  const isDetectingRef = useRef(true);
  const timerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const toastedIdsRef = useRef(new Set());
  const isProcessingFrame = useRef(false);
  const lastSentRef = useRef(0);
  const rafIdRef = useRef(null);

  const formatName = (value = "") =>
    value
      .trim()
      .split(" ")
      .map((w) =>
        w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""
      )
      .join(" ");

  const startTimer = () => {
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const diff = Date.now() - start;
      const minutes = String(Math.floor(diff / 60000)).padStart(2, "0");
      const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setElapsedTime(`${minutes}:${seconds}`);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (!activeClassId) return;

    let stream;
    isDetectingRef.current = true;

    const init = async () => {
      try {
        console.log("Loading face-api.js models...");

        const [, userStream] = await Promise.all([
          loadModels(),
          navigator.mediaDevices.getUserMedia({ video: true }),
        ]);

        stream = userStream;
        videoRef.current.srcObject = userStream;

        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });

        setIsStarting(false);
        startTimer();
        await new Promise((res) => setTimeout(res, 500));
        startDetectionLoop();
      } catch (err) {
        console.error("Init failed:", err);
        alert("Camera or model initialization failed. Please reload.");
      }
    };

    init();

    return () => {
      isDetectingRef.current = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      stopTimer();
      toastedIdsRef.current.clear();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [activeClassId]);

  const startDetectionLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    let lastDetectionTime = 0;
    const DETECTION_INTERVAL = 66; // ~15fps detection

    const processFrame = async (now) => {
      if (
        !isDetectingRef.current ||
        !video ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        if (isDetectingRef.current) {
          rafIdRef.current = requestAnimationFrame(processFrame);
        }
        return;
      }

      if (now - lastDetectionTime < DETECTION_INTERVAL) {
        rafIdRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastDetectionTime = now;

      // face-api.js SSD detection
      // minConfidence: 0.3 — lower threshold catches small/distant faces
      let detections = [];
      try {
        detections = await faceapi.detectAllFaces(
          video,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })
        );
      } catch (err) {
        console.warn("Detection error:", err);
        rafIdRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      // Mirror canvas to match mirrored video display
      ctx.scale(-1, 1);
      ctx.translate(-width, 0);

      const facesToSend = [];

      if (detections.length > 0) {
        for (const detection of detections) {
          const box = detection.box;
          const padding = 20;

          const x = Math.max(0, box.x - padding);
          const y = Math.max(0, box.y - padding);
          const boxW = Math.min(width - x, box.width + padding * 2);
          const boxH = Math.min(height - y, box.height + padding * 2);

          if (boxW <= 1 || boxH <= 1) continue;

          // Draw bounding box
          ctx.strokeStyle = "lime";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, boxW, boxH);

          // Draw confidence score above box
          const score = Math.round(detection.score * 100);
          ctx.fillStyle = "lime";
          ctx.font = "12px monospace";
          ctx.fillText(`${score}%`, x, y - 5);

          const face = cropFace(video, x, y, boxW, boxH, width);
          if (face) facesToSend.push(face);
        }

        // Unified throttle: send once per 500ms, only if not already processing
        if (facesToSend.length > 0 && !isProcessingFrame.current) {
          const nowMs = Date.now();
          if (nowMs - lastSentRef.current > 500) {
            lastSentRef.current = nowMs;
            isProcessingFrame.current = true;
            sendFaces(facesToSend)
              .catch((err) => console.error("❌ Recognition error:", err))
              .finally(() => {
                isProcessingFrame.current = false;
              });
          }
        }
      }

      ctx.restore();

      if (isDetectingRef.current) {
        rafIdRef.current = requestAnimationFrame(processFrame);
      }
    };

    rafIdRef.current = requestAnimationFrame(processFrame);
  };

  const sendFaces = async (facesToSend) => {
    if (!isDetectingRef.current || isStopping) return;

    abortControllerRef.current = new AbortController();

    try {
      const res = await axios.post(
        "http://127.0.0.1:8080/api/face/multi-recognize",
        { faces: facesToSend, class_id: activeClassId },
        { signal: abortControllerRef.current.signal }
      );

      console.log("Backend responded:", res.data);

      if (typeof res.data.instructor_detected !== "undefined") {
        setInstructorDetected(res.data.instructor_detected);
        if (res.data.instructor_detected) {
          setInstructorName(
            `${formatName(res.data.instructor_first_name)} ${formatName(
              res.data.instructor_last_name
            )}`
          );
        }
      }

      if (res.data?.logged?.length > 0) {
        const enrichedData = res.data.logged.map((s) => ({
          student_id: s.student_id,
          first_name: formatName(s.first_name || ""),
          last_name: formatName(s.last_name || ""),
          status: s.status,
          time:
            s.time ||
            new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }),
          subject_code: s.subject_code || res.data.subject_code || "",
          subject_title: s.subject_title || res.data.subject_title || "",
        }));

        setRecognized((prev) => {
          const updated = [...prev];
          enrichedData.forEach((newFace) => {
            const index = updated.findIndex(
              (f) => f.student_id === newFace.student_id
            );
            if (index !== -1) {
              updated[index] = {
                ...updated[index],
                ...newFace,
                status: newFace.status || updated[index].status,
              };
            } else {
              updated.push(newFace);
            }
          });
          return updated;
        });

        res.data.logged.forEach((student) => {
          if (!toastedIdsRef.current.has(student.student_id)) {
            toastedIdsRef.current.add(student.student_id);

            const displayStatus = student.status ?? "Present";
            const color =
              displayStatus === "Late"
                ? "#facc15"
                : displayStatus === "Present"
                ? "#22c55e"
                : "#ef4444";

            if (student.spoof_status === "Spoof") {
              toast(
                `${formatName(student.first_name)} ${formatName(
                  student.last_name
                )} is a SPOOF`,
                {
                  autoClose: 1500,
                  style: { background: "#ef4444", color: "#fff", fontWeight: "600" },
                }
              );
            } else {
              toast(
                `${formatName(student.first_name)} ${formatName(
                  student.last_name
                )} marked as ${displayStatus}`,
                {
                  autoClose: 1500,
                  style: {
                    background: color,
                    color: displayStatus === "Late" ? "#000" : "#fff",
                    fontWeight: "600",
                  },
                }
              );
            }
          }
        });
      }
    } catch (err) {
      if (axios.isCancel(err) || err?.code === "ERR_CANCELED") return;
      console.error("Recognition error:", err);
    }
  };

  // Crop face with mirror correction — 224px for better distant face quality
  const cropFace = (video, x, y, boxW, boxH, videoWidth) => {
    const tmp = document.createElement("canvas");
    const ctx = tmp.getContext("2d");
    const targetSize = 224;
    tmp.width = targetSize;
    tmp.height = targetSize;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.translate(targetSize, 0);
    ctx.scale(-1, 1);

    const mirroredX = videoWidth - (x + boxW);
    ctx.drawImage(video, mirroredX, y, boxW, boxH, 0, 0, targetSize, targetSize);

    return tmp.toDataURL("image/jpeg", 0.85);
  };

  const formatSemester = (sem) => {
    if (!sem) return "";
    const lower = sem.toLowerCase();
    if (lower.includes("1st")) return "1st Semester";
    if (lower.includes("2nd")) return "2nd Semester";
    if (lower.includes("mid")) return "Summer";
    return sem;
  };

  const handleStopSession = async () => {
    try {
      setIsStopping(true);
      isDetectingRef.current = false;

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();

      stopTimer();

      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }

      const res = await axios.post(
        `http://127.0.0.1:8080/api/attendance/stop-session`,
        { class_id: activeClassId }
      );

      const resolvedClassId =
        res.data?.class?.class_id || activeClassId;
      if (resolvedClassId) {localStorage.setItem("lastClassId", resolvedClassId);}
      if (res.data?.success) {toast.success("Session stopped successfully!");}
      await new Promise((res) => setTimeout(res, 150));
      if (onStopSession) onStopSession();
    } catch {
      toast.error("Failed to stop attendance session.");
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="flex flex-row items-start bg-neutral-950 text-white p-6 shadow-lg gap-6">
      <div className="relative flex-[3] rounded-xl overflow-hidden border border-white/10">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-auto rounded-xl transform scale-x-[-1]"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />

        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-sm font-mono border border-white/20 shadow">
          ⏱ {elapsedTime}
        </div>

        <div className="absolute top-4 right-4">
          {instructorDetected ? (
            <div className="bg-emerald-600/80 px-3 py-1 rounded-lg text-xs font-semibold text-black border border-emerald-300 shadow-lg">
              Instructor Verified
              <br />
              <span className="text-[10px] opacity-80">{instructorName}</span>
            </div>
          ) : (
            <div className="bg-red-600/80 px-3 py-1 rounded-lg text-xs font-semibold text-white border border-red-300 shadow-lg">
              Instructor Not Detected
            </div>
          )}
        </div>

        <div className="absolute bottom-4 right-4">
          <button
            onClick={handleStopSession}
            disabled={isStopping}
            className={`${
              isStopping ? "opacity-50 cursor-not-allowed" : "hover:bg-red-700"
            } bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition-all duration-300`}
          >
            {isStopping ? "Stopping..." : "Stop Session"}
          </button>
        </div>

        {isStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-gray-300">
            Initializing camera...
          </div>
        )}
      </div>

      <div className="flex-[1] bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
        <h3 className="text-lg font-semibold text-emerald-300 mb-1">
          Recent Detections
        </h3>

        <p className="text-sm text-white font-bold">
          {subjectCode && subjectTitle
            ? `${subjectCode} – ${subjectTitle}`
            : "No subject info"}
        </p>
        <p className="text-xs text-gray-400 mb-1">
          {course} {section} • {formatSemester(semester)} • SY {schoolYear}
        </p>
        <span className="text-[11px] text-gray-500">
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>

        <hr className="my-3 border-white/10" />

        {recognized.length === 0 ? (
          <p className="text-gray-400 text-sm italic">
            No faces recognized yet...
          </p>
        ) : (
          <ul className="space-y-2 max-h-[500px] overflow-y-auto">
            {recognized.map((r) => (
              <li
                key={r.student_id}
                className="flex items-center justify-between bg-white/5 rounded-lg p-2 border border-white/10 hover:bg-white/10 transition"
              >
                <div>
                  <p className="font-semibold text-white text-sm">
                    {formatName(r.first_name)} {formatName(r.last_name)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {r.student_id} •{" "}
                    <span className="text-gray-300 font-mono">
                      {r.time || "—"}
                    </span>
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    r.status === "Late"
                      ? "bg-yellow-500 text-black"
                      : r.status === "Present"
                      ? "bg-emerald-500 text-black"
                      : "bg-red-500 text-white"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AttendanceLiveSession;