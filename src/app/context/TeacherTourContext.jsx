import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { TEACHER_TOUR_STEPS } from "../config/teacherTourSteps";

const TeacherTourContext = createContext(null);

const TOUR_COMPLETED_KEY = "connected_teacher_tour_completed";
const TOUR_SKIPPED_KEY = "connected_teacher_tour_skipped";

export function TeacherTourProvider({ children }) {
  const [tourSteps] = useState(TEACHER_TOUR_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isPreparingTour, setIsPreparingTour] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(TOUR_COMPLETED_KEY) === "true";
  });

  const observerRef = useRef(null);
  const cancelledRef = useRef(false);

  // Automatically check on mount if teacher needs first-time login welcome screen
  useEffect(() => {
    const checkWelcomeEligibility = () => {
      const rawUser = localStorage.getItem("currentUser");
      if (!rawUser) return;
      try {
        const user = JSON.parse(rawUser);
        if (user?.role === "teacher") {
          const completed = localStorage.getItem(TOUR_COMPLETED_KEY) === "true";
          const skipped = localStorage.getItem(TOUR_SKIPPED_KEY) === "true";

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

  // Cancel & stop all pending readiness observers
  const cancelReadinessObserver = useCallback(() => {
    cancelledRef.current = true;
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    document.querySelectorAll(".tour-active-target, .connected-tour-target-active").forEach((el) => {
      el.classList.remove("tour-active-target", "connected-tour-target-active");
    });
    document.querySelectorAll(".connected-tour-sidebar-elevated").forEach((el) => {
      el.classList.remove("connected-tour-sidebar-elevated");
    });
  }, []);

  // Page Data & Target Readiness Observer
  const waitForPageAndTargetReady = useCallback((stepIndex, onReady) => {
    cancelReadinessObserver();
    cancelledRef.current = false;

    const targetStep = TEACHER_TOUR_STEPS[stepIndex] || TEACHER_TOUR_STEPS[0];
    const targetSelector = targetStep?.targetSelector;
    const fallbackSelector = targetStep?.fallbackTargetSelector;

    let attempts = 0;
    let lastRectStr = "";
    let stableCount = 0;

    const checkStabilityAndActivate = () => {
      if (cancelledRef.current) return;

      if (!targetSelector) {
        if (cancelledRef.current) return;
        setIsPreparingTour(false);
        setCurrentStepIndex(stepIndex);
        setIsTourActive(true);
        if (onReady) onReady();
        return;
      }

      const isPageDataLoading = !!document.querySelector(".animate-bounce:not(.connected-tour-spinner), [data-loading='true']");

      let el = document.querySelector(targetSelector);
      if (!el && fallbackSelector) {
        el = document.querySelector(fallbackSelector);
      }

      if (el && el.isConnected) {
        const rect = el.getBoundingClientRect();
        const hasSize = rect.width > 0 && rect.height > 0;
        const currentRectStr = `${Math.round(rect.top)},${Math.round(rect.left)},${Math.round(rect.width)},${Math.round(rect.height)}`;

        if (hasSize && !isPageDataLoading && currentRectStr === lastRectStr) {
          stableCount++;
        } else {
          stableCount = 0;
        }
        lastRectStr = currentRectStr;

        if (stableCount >= 2 || (hasSize && attempts > 15)) {
          if (cancelledRef.current) return;
          setIsPreparingTour(false);
          setCurrentStepIndex(stepIndex);
          setIsTourActive(true);
          if (onReady) onReady();
          return;
        }
      }

      attempts++;
      if (attempts < 200 && !cancelledRef.current) {
        requestAnimationFrame(() => setTimeout(checkStabilityAndActivate, 60));
      } else if (!cancelledRef.current) {
        setIsPreparingTour(false);
        setCurrentStepIndex(stepIndex);
        setIsTourActive(true);
        if (onReady) onReady();
      }
    };

    setIsPreparingTour(true);
    setIsTourActive(false);

    const observer = new MutationObserver(() => {
      if (!cancelledRef.current) {
        checkStabilityAndActivate();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;

    requestAnimationFrame(() => setTimeout(checkStabilityAndActivate, 100));
  }, [cancelReadinessObserver]);

  const resetWelcomeState = useCallback(() => {
    cancelReadinessObserver();
    localStorage.removeItem(TOUR_SKIPPED_KEY);
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    setHasCompleted(false);
    setIsWelcomeOpen(true);
  }, [cancelReadinessObserver]);

  const startTour = useCallback(() => {
    setIsWelcomeOpen(false);
    waitForPageAndTargetReady(0);
  }, [waitForPageAndTargetReady]);

  const skipWelcome = useCallback(() => {
    cancelReadinessObserver();
    setIsWelcomeOpen(false);
    localStorage.setItem(TOUR_SKIPPED_KEY, "true");
  }, [cancelReadinessObserver]);

  const nextStep = useCallback((navigate) => {
    setCurrentStepIndex((prev) => {
      const nextIdx = prev + 1;
      const currentStepObj = TEACHER_TOUR_STEPS[prev];

      if (currentStepObj?.actionToRoute && navigate) {
        if (currentStepObj.actionToRoute === "auto-first-class") {
          let classId = "";
          const btn = document.querySelector('[data-tour="teacher-classes-view-btn"]');
          if (btn) {
            classId = btn.getAttribute("data-class-id") || "";
          }
          if (!classId) {
            try {
              const saved = localStorage.getItem("teacher_classes");
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0 && parsed[0]?.id) {
                  classId = String(parsed[0].id);
                }
              }
            } catch {
              // Ignore parse error
            }
          }
          if (!classId) classId = "1";

          window.scrollTo(0, 0);
          const mainEl = document.querySelector("main");
          if (mainEl) mainEl.scrollTo(0, 0);
          navigate(`/teacher/class/${classId}`);
        } else if (typeof currentStepObj.actionToRoute === "string" && window.location.pathname !== currentStepObj.actionToRoute) {
          window.scrollTo(0, 0);
          const mainEl = document.querySelector("main");
          if (mainEl) mainEl.scrollTo(0, 0);
          navigate(currentStepObj.actionToRoute);
        }
      }

      if (nextIdx < TEACHER_TOUR_STEPS.length) {
        waitForPageAndTargetReady(nextIdx);
        return nextIdx;
      }
      cancelReadinessObserver();
      setIsTourActive(false);
      setIsPreparingTour(false);
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
      setHasCompleted(true);
      return prev;
    });
  }, [waitForPageAndTargetReady, cancelReadinessObserver]);

  const prevStep = useCallback((navigate) => {
    setCurrentStepIndex((prev) => {
      const prevIdx = Math.max(0, prev - 1);
      const targetStepObj = TEACHER_TOUR_STEPS[prevIdx];

      if (targetStepObj?.actionToRoute && navigate) {
        if (targetStepObj.actionToRoute === "auto-first-class") {
          let classId = "";
          const btn = document.querySelector('[data-tour="teacher-classes-view-btn"]');
          if (btn) classId = btn.getAttribute("data-class-id") || "";
          if (!classId) {
            try {
              const saved = localStorage.getItem("teacher_classes");
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0 && parsed[0]?.id) classId = String(parsed[0].id);
              }
            } catch {
              // Ignore
            }
          }
          if (!classId) classId = "1";
          window.scrollTo(0, 0);
          const mainEl = document.querySelector("main");
          if (mainEl) mainEl.scrollTo(0, 0);
          navigate(`/teacher/class/${classId}`);
        } else if (typeof targetStepObj.actionToRoute === "string" && window.location.pathname !== targetStepObj.actionToRoute) {
          window.scrollTo(0, 0);
          const mainEl = document.querySelector("main");
          if (mainEl) mainEl.scrollTo(0, 0);
          navigate(targetStepObj.actionToRoute);
        }
      } else if (targetStepObj?.id === "teacher-dashboard-header" || targetStepObj?.id === "teacher-kpis" || targetStepObj?.id === "teacher-tasks" || targetStepObj?.id === "teacher-recent-grades" || targetStepObj?.id === "teacher-announcements" || targetStepObj?.id === "teacher-calendar") {
        if (navigate && window.location.pathname !== "/teacher/dashboard") {
          window.scrollTo(0, 0);
          const mainEl = document.querySelector("main");
          if (mainEl) mainEl.scrollTo(0, 0);
          navigate("/teacher/dashboard");
        }
      } else if (targetStepObj?.id === "teacher-classes-search" || targetStepObj?.id === "teacher-classes-grid" || targetStepObj?.id === "teacher-classes-view-btn") {
        if (navigate && window.location.pathname !== "/teacher/classes") {
          window.scrollTo(0, 0);
          const mainEl = document.querySelector("main");
          if (mainEl) mainEl.scrollTo(0, 0);
          navigate("/teacher/classes");
        }
      }

      waitForPageAndTargetReady(prevIdx);
      return prevIdx;
    });
  }, [waitForPageAndTargetReady]);

  const skipTour = useCallback(() => {
    cancelReadinessObserver();
    setIsTourActive(false);
    setIsPreparingTour(false);
    setCurrentStepIndex(0);
    localStorage.setItem(TOUR_SKIPPED_KEY, "true");
  }, [cancelReadinessObserver]);

  const finishTour = useCallback(() => {
    cancelReadinessObserver();
    setIsTourActive(false);
    setIsPreparingTour(false);
    setCurrentStepIndex(0);
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    setHasCompleted(true);
  }, [cancelReadinessObserver]);

  // Restart Tour
  const restartTour = useCallback(
    (navigate) => {
      cancelReadinessObserver();
      setIsWelcomeOpen(false);
      localStorage.removeItem(TOUR_SKIPPED_KEY);
      localStorage.removeItem(TOUR_COMPLETED_KEY);
      setHasCompleted(false);

      if (navigate) {
        navigate("/teacher/dashboard");
      }

      waitForPageAndTargetReady(0);
    },
    [waitForPageAndTargetReady, cancelReadinessObserver]
  );

  const currentStep = tourSteps[currentStepIndex] || null;
  const isFinalStep = currentStepIndex === tourSteps.length - 1;

  const value = {
    tourSteps,
    currentStepIndex,
    currentStep,
    totalSteps: tourSteps.length,
    isTourActive,
    isPreparingTour,
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

  return <TeacherTourContext.Provider value={value}>{children}</TeacherTourContext.Provider>;
}

export function useTeacherTour() {
  const context = useContext(TeacherTourContext);
  if (!context) {
    throw new Error("useTeacherTour must be used within a TeacherTourProvider");
  }
  return context;
}
