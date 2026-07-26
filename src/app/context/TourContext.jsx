import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ADMIN_TOUR_STEPS } from "../config/adminTourSteps";

const TourContext = createContext(null);

const TOUR_COMPLETED_KEY = "connected_admin_tour_completed";
const TOUR_SKIPPED_KEY = "connected_admin_tour_skipped";

export function TourProvider({ children }) {
  const [tourSteps] = useState(ADMIN_TOUR_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(TOUR_COMPLETED_KEY) === "true";
  });

  // Automatically check on mount if admin needs first-time login welcome screen
  useEffect(() => {
    const checkWelcomeEligibility = () => {
      const rawUser = localStorage.getItem("currentUser");
      if (!rawUser) return;
      try {
        const user = JSON.parse(rawUser);
        if (user?.role === "admin" || user?.role === "administrator") {
          const completed = localStorage.getItem(TOUR_COMPLETED_KEY) === "true";
          const skipped = localStorage.getItem(TOUR_SKIPPED_KEY) === "true";

          // Show welcome screen ONLY on first login when tour has never been completed or skipped
          if (!completed && !skipped) {
            setIsWelcomeOpen(true);
          }
        }
      } catch {
        // Ignore parse error
      }
    };

    const timer = setTimeout(checkWelcomeEligibility, 300);
    return () => clearTimeout(timer);
  }, []);

  const resetWelcomeState = useCallback(() => {
    localStorage.removeItem(TOUR_SKIPPED_KEY);
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    setHasCompleted(false);
    setIsWelcomeOpen(true);
  }, []);

  const startTour = useCallback(() => {
    setIsWelcomeOpen(false);
    setCurrentStepIndex(0);
    setIsTourActive(true);
  }, []);

  const skipWelcome = useCallback(() => {
    setIsWelcomeOpen(false);
    localStorage.setItem(TOUR_SKIPPED_KEY, "true");
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      if (prev < tourSteps.length - 1) {
        return prev + 1;
      }
      setIsTourActive(false);
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
      setHasCompleted(true);
      return prev;
    });
  }, [tourSteps.length]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const skipTour = useCallback(() => {
    setIsTourActive(false);
    localStorage.setItem(TOUR_SKIPPED_KEY, "true");
  }, []);

  const finishTour = useCallback(() => {
    setIsTourActive(false);
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    setHasCompleted(true);
  }, []);

  // Restart Tour: Jumps directly into Step 1 (Sidebar Navigation), skipping welcome screen
  const restartTour = useCallback((navigate) => {
    // 1. Never show welcome screen on restart
    setIsWelcomeOpen(false);

    // 2. Reset completion/skip flags
    localStorage.removeItem(TOUR_SKIPPED_KEY);
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    setHasCompleted(false);

    // 3. Navigate to dashboard if navigate helper is passed
    if (navigate) {
      navigate("/admin/dashboard");
    }

    // 4. Wait until the sidebar DOM element is rendered and ready before activating Step 1
    const checkAndStart = (attempts = 0) => {
      const sidebarEl = document.querySelector('[data-tour="sidebar"]');
      if (sidebarEl && sidebarEl.getBoundingClientRect().width > 0) {
        setCurrentStepIndex(0);
        setIsTourActive(true);
      } else if (attempts < 20) {
        setTimeout(() => checkAndStart(attempts + 1), 50);
      } else {
        setCurrentStepIndex(0);
        setIsTourActive(true);
      }
    };

    setTimeout(() => {
      checkAndStart();
    }, 50);
  }, []);

  const currentStep = tourSteps[currentStepIndex] || null;
  const isFinalStep = currentStepIndex === tourSteps.length - 1;

  const value = {
    tourSteps,
    currentStepIndex,
    currentStep,
    totalSteps: tourSteps.length,
    isTourActive,
    isWelcomeOpen,
    isFinalStep,
    hasCompleted,
    startTour,
    skipWelcome,
    resetWelcomeState,
    nextStep,
    prevStep,
    skipTour,
    finishTour,
    restartTour,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
