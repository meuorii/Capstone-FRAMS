import { FaUnlink, FaTimes } from "react-icons/fa";

const UnassignConfirmationModal = ({ isOpen, onClose, onConfirm, classData }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[70] p-4 transition-all">
      {/* Modal Container */}
      <div className="bg-[#0A0A0A] text-white w-full max-w-[380px] rounded-3xl shadow-2xl border border-white/[0.05] overflow-hidden relative">
        
        {/* Subtle Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-600 hover:text-white transition-colors"
        >
          <FaTimes size={14} />
        </button>

        <div className="p-8">
          {/* Minimalist Icon Header */}
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
              <FaUnlink size={20} />
            </div>
          </div>

          {/* Text Content */}
          <div className="text-center mb-8">
            <h2 className="text-lg font-semibold tracking-tight text-white mb-2">
              Unassign Instructor?
            </h2>
            <p className="text-neutral-500 text-sm leading-relaxed px-2">
              This will remove the current instructor from the following load. This action is immediate.
            </p>
          </div>

          {/* Premium Class Card - Minimalist Ticket Look */}
          <div className="bg-neutral-900/50 rounded-2xl p-5 border border-white/[0.03] mb-8">
            <div className="flex flex-col gap-1.5">
              <span className="text-emerald-500 font-mono text-[11px] font-bold tracking-[0.2em] uppercase">
                {classData?.subject_code}
              </span>
              <h3 className="text-neutral-200 text-sm font-medium leading-snug">
                {classData?.subject_title}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="h-1 w-1 rounded-full bg-neutral-700"></span>
                <span className="text-[11px] text-neutral-500 font-medium">
                  {classData?.course} {classData?.section}
                </span>
              </div>
            </div>
          </div>

          {/* Actions - Vertical Stack for Clarity */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onConfirm}
              className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-bold tracking-widest uppercase transition-all active:scale-[0.96]"
            >
              Confirm Unassign
            </button>
            
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-transparent text-neutral-500 hover:text-neutral-300 rounded-2xl text-xs font-bold tracking-widest uppercase transition-all"
            >
              Keep Assignment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnassignConfirmationModal;