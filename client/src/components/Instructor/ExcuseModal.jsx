import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const ExcuseModal = ({
  isOpen,
  onClose,
  student,
  classId,
  instructorId,
  onExcuseMarked,
}) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !student) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a valid reason.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        student_id: student.student_id,
        class_id: classId,
        date: new Date().toISOString().split("T")[0],
        reason,
        instructor_id: instructorId,
      };

      const res = await axios.post(
        "https://127.0.0.1:8080/api/attendance/mark-excused",
        payload
      );

      if (res.data.success) {
        toast.success(`${student.first_name} marked as Excused`);
        onExcuseMarked(student.student_id, reason);
        onClose();
      } else {
        toast.error(res.data.error || "Failed to mark as excused.");
      }
    } catch (err) {
      console.error("❌ Error marking as excused:", err);
      toast.error("Server error while marking as excused.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-neutral-900 rounded-2xl p-6 w-[400px] shadow-lg border border-white/10">
        <h2 className="text-xl font-semibold text-white mb-2">
          Mark as Excused
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Student:{" "}
          <span className="font-semibold text-white">
            {student.first_name} {student.last_name}
          </span>
        </p>

        <textarea
          className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Enter reason (e.g. Medical leave, approved absence)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {loading ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExcuseModal;
