import React from "react";
import { Sparkles, Compass, X, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useTour } from "../../context/TourContext";

export function WelcomeTourModal() {
  const { isWelcomeOpen, startTour, skipWelcome } = useTour();

  if (!isWelcomeOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100/80 overflow-hidden">
        {/* DepEd tri-color top accent bar */}
        <div className="flex h-1.5 flex-shrink-0">
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-blue-500" />
          <div className="flex-1 bg-red-500" />
        </div>

        {/* Close icon (skips welcome) */}
        <button
          onClick={skipWelcome}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          {/* Header Badge */}
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span>Official Admin Onboarding</span>
            </div>
          </div>

          {/* Icon Badge */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 via-teal-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20 mb-6 transform hover:scale-105 transition-transform duration-200">
            <Compass className="w-8 h-8 text-white" />
          </div>

          {/* Title */}
          <div className="text-center mb-3">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Welcome to Connect<span className="text-green-600">ED</span>!
            </h2>
            <p className="text-gray-500 text-xs font-medium mt-1">
              ConnectED Academic Administrator Portal
            </p>
          </div>

          {/* Description */}
          <p className="text-gray-600 text-xs leading-relaxed text-center mb-6 max-w-md mx-auto">
            Welcome to the ConnectED Academic Portal. This short guided tour will help you understand the main features available to administrators.
          </p>

          {/* Highlights */}
          <div className="space-y-2.5 bg-gray-50/80 rounded-2xl p-4 border border-gray-100 mb-8">
            <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>Explore every sidebar module step-by-step</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>Learn user, subject, and report administration in under 2 minutes</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>Restart the tour anytime from the Help Center</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={skipWelcome}
              className="w-full sm:w-auto px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-xs"
            >
              Skip
            </button>
            <button
              onClick={startTour}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-blue-700 active:scale-[0.98] shadow-md shadow-green-600/20 transition-all text-xs flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Tour</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
