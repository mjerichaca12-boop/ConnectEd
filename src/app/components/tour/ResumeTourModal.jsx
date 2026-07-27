import React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Play, RotateCcw, HelpCircle } from "lucide-react";
import { useModuleTour } from "../../context/ModuleTourContext";

export function ResumeTourModal() {
  const navigate = useNavigate();
  const { isResumeOpen, activeModuleId, pendingModuleId, restartModuleTour, resumeTour } = useModuleTour();

  if (!isResumeOpen) return null;

  const targetId = pendingModuleId || activeModuleId;

  const handleRestart = () => {
    if (targetId) {
      restartModuleTour(targetId, navigate);
    }
  };

  const handleContinue = () => {
    resumeTour(navigate);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100/80 overflow-hidden">
        {/* DepEd tri-color top accent bar */}
        <div className="flex h-1.5 flex-shrink-0">
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-blue-500" />
          <div className="flex-1 bg-red-500" />
        </div>

        <div className="p-8 text-center">
          <div className="mx-auto w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-200 mb-5">
            <HelpCircle className="w-7 h-7 text-amber-600" />
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Continue your previous tour?
          </h3>
          <p className="text-gray-600 text-xs leading-relaxed mb-6">
            You previously exited this module tour before finishing. Would you like to resume from where you left off or start fresh from Step 1?
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRestart}
              className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start Fresh</span>
            </button>
            <button
              type="button"
              onClick={handleContinue}
              className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 active:scale-[0.98] shadow-md shadow-amber-500/20 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Resume Tour</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
