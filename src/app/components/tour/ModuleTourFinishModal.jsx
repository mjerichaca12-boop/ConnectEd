import React from "react";
import { useNavigate } from "react-router-dom";
import { Award, CheckCircle2, RotateCcw, ArrowRight, X } from "lucide-react";
import { useModuleTour } from "../../context/ModuleTourContext";

export function ModuleTourFinishModal() {
  const navigate = useNavigate();
  const { isFinishOpen, activeConfig, activeModuleId, restartModuleTour, closeFinishModal } = useModuleTour();

  if (!isFinishOpen || !activeConfig) return null;

  const handleReplay = () => {
    restartModuleTour(activeModuleId, navigate);
  };

  const handleReturnToHelp = () => {
    closeFinishModal();
    navigate("/admin/help-center");
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100/80 overflow-hidden">
        {/* DepEd tri-color top accent bar */}
        <div className="flex h-1.5 flex-shrink-0">
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-blue-500" />
          <div className="flex-1 bg-red-500" />
        </div>

        <button
          onClick={closeFinishModal}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 text-center">
          {/* Trophy/Badge Icon */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30 mb-6 animate-bounce">
            <Award className="w-8 h-8 text-white" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Module Complete
          </span>

          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-2">
            Congratulations!
          </h2>
          <p className="text-gray-600 text-xs leading-relaxed mb-6">
            You have successfully completed the <span className="font-semibold text-gray-900">{activeConfig.moduleTitle} Guide</span>. You can replay this walkthrough anytime from the Help Center.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleReplay}
              className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-xs flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Replay Tour</span>
            </button>
            <button
              onClick={handleReturnToHelp}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-teal-700 active:scale-[0.98] shadow-md shadow-green-600/20 transition-all text-xs flex items-center justify-center gap-1.5"
            >
              <span>Return to Help Center</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
