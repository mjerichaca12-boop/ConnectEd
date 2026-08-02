import React from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { GraduationCap, ArrowRight, CheckCircle2, BookOpen } from "lucide-react";
import { useTeacherTour } from "../../context/TeacherTourContext";

export function TeacherWelcomeModal() {
  const navigate = useNavigate();
  const { isWelcomeOpen, completeOnboarding } = useTeacherTour();

  const currentPath = window.location.pathname;
  if (!isWelcomeOpen || !currentPath.includes("/teacher/dashboard")) {
    return null;
  }

  const handleContinue = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    completeOnboarding(navigate);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100/80 overflow-hidden">
        {/* DepEd tri-color top accent bar */}
        <div className="flex h-1.5 flex-shrink-0">
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-blue-500" />
          <div className="flex-1 bg-red-500" />
        </div>

        <div className="p-8">
          {/* Header Badge */}
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
              <BookOpen className="w-4 h-4 text-green-600" />
              <span>Official Teacher Portal Onboarding</span>
            </div>
          </div>

          {/* Icon Badge / Official Logo */}
          <div className="mx-auto w-16 h-16 bg-white rounded-2xl border border-gray-100/90 flex items-center justify-center shadow-lg shadow-green-500/15 mb-6 transform hover:scale-105 transition-transform duration-200 p-2.5">
            <img src="/connected_logo.png" alt="ConnectED Official Logo" className="w-12 h-12 object-contain" />
          </div>

          {/* Title */}
          <div className="text-center mb-3">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Welcome to Connect<span className="text-green-600">ED</span>!
            </h2>
          </div>

          {/* Description */}
          <p className="text-gray-600 text-xs leading-relaxed text-center mb-6 max-w-md mx-auto">
            ConnectED provides tools for managing classes, students, grades, attendance, announcements, and learning materials. Take a guided tour from the Help Center whenever you wish to explore system features.
          </p>

          {/* Highlights */}
          <div className="space-y-2.5 bg-gray-50/80 rounded-2xl p-4 border border-gray-100 mb-8">
            <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>Manage assigned classes, section rosters, and student records</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>Encode raw scores with automatic DepEd grade transmutation</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>Access Help Center anytime to start interactive guided tours</span>
            </div>
          </div>

          {/* Single Primary Action Button */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleContinue}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-green-600 via-teal-600 to-emerald-600 text-white font-semibold rounded-2xl hover:from-green-700 hover:to-emerald-700 active:scale-[0.98] shadow-lg shadow-green-600/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
