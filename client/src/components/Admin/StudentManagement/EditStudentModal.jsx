import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { FaUserEdit, FaTimes, FaCameraRetro } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const EditStudentModal = ({ isOpen, onClose, student, onStudentUpdated }) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    course: "",
  });

  // 🔥 Proper Case Formatter
  const formatName = (name) => {
    if (!name) return "";
    return name
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  // Load student data into form
  useEffect(() => {
    if (student) {
      setFormData({
        first_name: formatName(student.first_name || ""),
        middle_name: formatName(student.middle_name || ""),
        last_name: formatName(student.last_name || ""),
        course: student.course || "",
      });
    }
  }, [student]);

  if (!isOpen || !student) return null;

  // 🔥 UPDATED handleChange: auto-format name inputs
  const handleChange = (e) => {
    const { name, value } = e.target;

    let formattedValue = value;

    // Format name fields only
    if (["first_name", "middle_name", "last_name"].includes(name)) {
      formattedValue = formatName(value);
    }

    setFormData({
      ...formData,
      [name]: formattedValue,
    });
  };

  // Submit Update
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `http://127.0.0.1:8080/api/admin/students/${student.student_id}`,
        formData
      );

      toast.success("✅ Student updated successfully!");
      onStudentUpdated({ ...student, ...formData });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to update student.");
    }
  };

  // Navigate to Face Re-Register
  const handleReregisterFace = () => {
    navigate("/student/register", {
      state: {
        student_id: student.student_id,
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        suffix: student.suffix || "",
        course: formData.course,
      },
    });

    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn px-4">
      <div className="bg-neutral-900/95 w-full max-w-2xl rounded-2xl shadow-2xl border border-white/10 
                      flex flex-col animate-scaleIn max-h-[95vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 sticky top-0 bg-neutral-900/90 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <FaUserEdit className="text-emerald-400 text-2xl" />
            <h2 className="text-xl font-extrabold bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text text-transparent">
              Edit Student
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-neutral-800/60 hover:bg-red-500/30 text-neutral-400 hover:text-white transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="px-4 sm:px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1 overflow-y-auto"
        >
          <FormField
            label="First Name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
          />

          <FormField
            label="Middle Name"
            name="middle_name"
            value={formData.middle_name}
            onChange={handleChange}
          />

          <FormField
            label="Last Name"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            required
          />

          {/* Course */}
          <div className="flex flex-col">
            <label className="mb-2 text-xs uppercase tracking-wide bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
              Course
            </label>
            <select
              name="course"
              value={formData.course}
              onChange={handleChange}
              className="px-4 py-2.5 rounded-lg bg-neutral-800 border border-white/10 text-white 
                         focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              required
            >
              <option value="">Select Course</option>
              <option value="BSINFOTECH">BSINFOTECH</option>
              <option value="BSCS">BSCS</option>
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-neutral-900/80 flex justify-between sm:justify-end gap-3 sticky bottom-0">

          <button
            onClick={handleReregisterFace}
            className="flex items-center gap-2 px-4 py-2 rounded-lg 
                       bg-gradient-to-r from-blue-500 to-blue-600 
                       text-white text-sm font-semibold shadow-md
                       hover:from-blue-600 hover:to-blue-700 
                       hover:shadow-blue-500/40 hover:scale-105 
                       transition-all duration-300"
          >
            <FaCameraRetro className="text-white" />
            Re-Register Face
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-sm transition hover:scale-105"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 
                         text-white text-sm font-semibold shadow-md
                         hover:from-emerald-600 hover:to-green-700 
                         hover:shadow-emerald-500/40 hover:scale-105 transition"
            >
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

/* Reusable Form Field */
function FormField({ label, name, value, onChange, required }) {
  return (
    <div className="flex flex-col transition-all">
      <label className="mb-1 text-xs font-semibold uppercase tracking-wide 
                        bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
        {label}
      </label>
      <input
        type="text"
        name={name}
        required={required}
        value={value}
        onChange={onChange}
        className="px-4 py-2.5 rounded-lg bg-neutral-800/80 border border-white/10 text-white 
                   placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 
                   focus:ring-emerald-400/60 focus:scale-[1.01] transition-all shadow-sm"
        placeholder={`Enter ${label}`}
      />
    </div>
  );
}

export default EditStudentModal;
