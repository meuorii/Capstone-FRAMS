import React, { useState } from "react";
import axios from "axios";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { AiOutlineCloudUpload } from "react-icons/ai";

const API_URL = "http://127.0.0.1:8080";

const AddClassModal = ({ isOpen, onClose, onAdded }) => {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  const resetModal = () => {
    setSelectedFile(null);
    setPreview(null);
  };

  // ------------------------------
  // AUTO-PREVIEW WHEN FILE IS SELECTED
  // ------------------------------
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setPreview(null);
    setProgress(0);

    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(`${API_URL}/api/admin/class/preview-pdf`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (event) => {
          if (event.total) {
            const percent = Math.round((event.loaded * 100) / event.total);
            setProgress(percent);
          }
        }
      });

      setPreview(res.data);
      toast.success("📄 Preview generated!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to preview PDF");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------
  // CREATE CLASS + STUDENTS
  // ------------------------------
  const handleConfirm = async () => {
    if (!preview) return toast.error("Preview not loaded.");
    if (!selectedFile) return toast.error("PDF file missing.");
    if (!preview.instructor_id) return toast.error("Instructor not found.");

    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // 1️⃣ Create class
      const classPayload = {
        subject_code: preview.subject_code,
        subject_title: preview.subject_title,
        course: preview.course,
        year_level: preview.year_level,
        section: preview.section,
        instructor_id: preview.instructor_id,
      };

      const createRes = await axios.post(`${API_URL}/api/admin/create-class`, classPayload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Create Class Response:", createRes.data);

      const classId = createRes.data.created_class?._id;
      console.log("Extracted Class ID:", classId);
      if (!classId) {
        throw new Error("Class ID was not returned by the server.");
      }

      // 2️⃣ Upload students
      const formData = new FormData();
      formData.append("file", selectedFile);

      await axios.post(`${API_URL}/api/admin/${classId}/upload-students`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("🎉 Class created and students added!");
      onAdded();
      onClose();
      resetModal();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create class");
    } finally {
      setLoading(false);
    }
  };

  const formatName = (name) => {
    if (!name) return "";
    return name
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  // ------------------------------
  // UI
  // ------------------------------
  return createPortal(
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-neutral-900 p-6 rounded-2xl shadow-2xl w-[700px] max-h-[90vh] overflow-y-auto relative">

        <h2 className="text-xl font-bold text-emerald-400 mb-4">
          Upload Class List (PDF)
        </h2>

        {/* STEP 1 — SELECT PDF */}
        {!preview && (
          <div className="space-y-4">

            <div className="text-center">
              <p className="text-gray-300 text-sm">
                Upload your class list PDF. Preview will load automatically.
              </p>
            </div>

            {/* Dropzone */}
            <label
              className="
                flex flex-col items-center justify-center 
                w-full h-44 
                border-2 border-dashed border-neutral-600 
                hover:border-emerald-500 transition 
                rounded-xl cursor-pointer
                bg-neutral-800 hover:bg-neutral-700/50
                text-gray-300
              "
            >
              <div className="flex flex-col items-center justify-center space-y-2">
                
                {/* React Icon */}
                <AiOutlineCloudUpload className="text-emerald-400" size={48} />

                <p className="font-medium text-gray-200">
                  Drag & drop PDF here
                </p>
                <p className="text-xs text-gray-400">
                  or click to browse files
                </p>
              </div>

              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Loading Indicator */}
            {loading && (
              <div className="w-full mt-2">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-300">Reading PDF…</span>
                  <span className="text-xs text-gray-400">{progress}%</span>
                </div>

                <div className="w-full bg-neutral-700 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}


        {/* STEP 2 — PREVIEW */}
        {preview && (
        <div className="bg-neutral-900 p-5 rounded-xl text-gray-200 space-y-5">
          
          {/* CLASS INFORMATION */}
          <div className="bg-neutral-900 border border-neutral-700 p-5 rounded-xl shadow-sm space-y-4">

            <h3 className="text-xl font-semibold text-emerald-400">
              Extracted Class Information
            </h3>

            {/* GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">

              {/* Left Column */}
              <div className="space-y-3">

                <div>
                  <p className="font-semibold text-gray-200">Subject Code:</p>
                  <p className="text-xs text-gray-400">{preview.subject_code}</p>
                </div>

                <div>
                  <p className="font-semibold text-gray-200">Course & Section:</p>
                  <p className="text-xs text-gray-400">
                    {preview.course} {preview.section}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-gray-200">Semester:</p>
                  <p className="text-xs text-gray-400">{preview.semester}</p>
                </div>

                <div>
                  <p className="font-semibold text-gray-200">Instructor:</p>
                  <p className="text-xs text-gray-400">
                    {preview.instructor_first_name} {preview.instructor_last_name}
                  </p>
                </div>

              </div>

              {/* Right Column */}
              <div className="space-y-3">

                <div>
                  <p className="font-semibold text-gray-200">Subject Title:</p>
                  <p className="text-xs text-gray-400">{preview.subject_title}</p>
                </div>

                <div>
                  <p className="font-semibold text-gray-200">Year Level:</p>
                  <p className="text-xs text-gray-400">{preview.year_level}</p>
                </div>

                <div>
                  <p className="font-semibold text-gray-200">School Year:</p>
                  <p className="text-xs text-gray-400">{preview.school_year}</p>
                </div>

                <div>
                  <p className="font-semibold text-gray-200">Instructor ID:</p>
                  <p className="text-xs text-gray-400">{preview.instructor_id}</p>
                </div>

              </div>

            </div>
          </div>

          {/* Valid Students */}
          <div>
            <p className="text-lg font-semibold text-emerald-400 mb-2">
              Valid Students ({preview.valid_students?.length || 0})
            </p>

            <div
              className="max-h-52 overflow-y-auto bg-neutral-900 p-3 rounded-lg text-sm 
                        border border-emerald-600/40 shadow-inner 
                        custom-scrollbar"
            >
              {preview.valid_students?.map((stu, i) => (
                <div key={i} className="text-emerald-300 py-1">
                  {stu.student_id} — {formatName(stu.first_name)}{" "}
                  {formatName(stu.last_name)}
                </div>
              ))}
            </div>
          </div>

          {/* Button */}
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full mt-4 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 
                      rounded-lg text-white font-medium tracking-wide 
                      transition-all duration-200"
          >
            {loading ? "Saving..." : "Confirm & Create Class"}
          </button>
        </div>
      )}

        {/* CLOSE BUTTON */}
        <button
          onClick={() => { onClose(); resetModal(); }}
          className="absolute top-3 right-4 text-gray-400 hover:text-white text-lg"
        >
          ✕
        </button>

      </div>
    </div>,
    document.body
  );
};

export default AddClassModal;
