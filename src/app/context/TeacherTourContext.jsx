import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { TEACHER_TOUR_STEPS } from "../config/teacherTourSteps";

const TeacherTourContext = createContext(null);

const TOUR_COMPLETED_KEY = "connected_teacher_tour_completed";
const TOUR_STARTED_KEY = "connected_teacher_tour_started";
const TOUR_SKIPPED_KEY = "connected_teacher_tour_skipped";
const ONBOARDING_COMPLETED_KEY = "connected_teacher_onboarding_completed";

export function TeacherTourProvider({ children }) {
  const [tourSteps] = useState(TEACHER_TOUR_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isPreparingTour, setIsPreparingTour] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);

  const [hasCompleted, setHasCompleted] = useState(() => {
    const rawUser = localStorage.getItem("currentUser");
    if (!rawUser) return false;
    try {
      const user = JSON.parse(rawUser);
      const userKey = `${TOUR_COMPLETED_KEY}_${user.id || user.email || "default"}`;
      return localStorage.getItem(userKey) === "true";
    } catch {
      return false;
    }
  });

  const [isStarted, setIsStarted] = useState(() => {
    const rawUser = localStorage.getItem("currentUser");
    if (!rawUser) return false;
    try {
      const user = JSON.parse(rawUser);
      const userKey = `${TOUR_STARTED_KEY}_${user.id || user.email || "default"}`;
      return localStorage.getItem(userKey) === "true";
    } catch {
      return false;
    }
  });

  const observerRef = useRef(null);
  const cancelledRef = useRef(false);

  // Automatically check if teacher needs first-time login welcome screen
  useEffect(() => {
    const checkWelcomeEligibility = () => {
      const pathname = window.location.pathname;
      if (!pathname.includes("/teacher/dashboard")) {
        setIsWelcomeOpen(false);
        return;
      }

      const rawUser = localStorage.getItem("currentUser");
      if (!rawUser) return;
      try {
        const user = JSON.parse(rawUser);
        if (user?.role === "teacher") {
          const userId = user.id || user.email || "default";
          const userOnboardingKey = `${ONBOARDING_COMPLETED_KEY}_${userId}`;
          const onboardingDone = localStorage.getItem(userOnboardingKey) === "true";

          if (!onboardingDone) {
            setIsWelcomeOpen(true);
          }
        }
      } catch {
        // Ignore parse error
      }
    };

    const timer = setTimeout(checkWelcomeEligibility, 300);
    const interval = setInterval(checkWelcomeEligibility, 800);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
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

  // Strict 6-Step Page & Target Readiness Observer Pipeline
  const waitForPageAndTargetReady = useCallback((stepIndex, onReady, isPageChange = false) => {
    cancelReadinessObserver();
    cancelledRef.current = false;

    const targetStep = TEACHER_TOUR_STEPS[stepIndex] || TEACHER_TOUR_STEPS[0];
    const targetSelector = targetStep?.targetSelector;
    const fallbackSelector = targetStep?.fallbackTargetSelector;

    // Synchronously update step index and active state immediately for 0ms frame response
    setCurrentStepIndex(stepIndex);
    setIsTourActive(true);

    // Only set preparing loader status if switching pages/routes
    if (isPageChange) {
      setIsPreparingTour(true);
    } else {
      setIsPreparingTour(false);
    }

    let attempts = 0;
    let lastRectStr = "";
    let stableCount = 0;

    const checkStabilityAndActivate = () => {
      if (cancelledRef.current) return;

      if (!targetSelector) {
        setIsPreparingTour(false);
        if (onReady) onReady();
        return;
      }

      // Verify no global loading screen or fetching state is active
      const isPageLoading = !!document.querySelector(
        ".loading-screen, [data-loading='true'], .animate-bounce:not(.connected-tour-spinner)"
      );

      let el = document.querySelector(targetSelector);
      if (!el && fallbackSelector) {
        el = document.querySelector(fallbackSelector);
      }

      if (el && el.isConnected && !isPageLoading) {
        const rect = el.getBoundingClientRect();
        const hasSize = rect.width > 0 && rect.height > 0;
        const currentRectStr = `${Math.round(rect.top)},${Math.round(rect.left)},${Math.round(rect.width)},${Math.round(rect.height)}`;

        if (hasSize && currentRectStr === lastRectStr) {
          stableCount++;
        } else {
          stableCount = 0;
        }
        lastRectStr = currentRectStr;

        // Ensure target coordinates have stabilized for consecutive animation frames
        if (stableCount >= 1 || (hasSize && attempts > 10)) {
          if (cancelledRef.current) return;
          setIsPreparingTour(false);
          if (onReady) onReady();
          return;
        }
      }

      attempts++;
      if (attempts < 60 && !cancelledRef.current) {
        requestAnimationFrame(checkStabilityAndActivate);
      } else if (!cancelledRef.current) {
        setIsPreparingTour(false);
        if (onReady) onReady();
      }
    };

    const observer = new MutationObserver(() => {
      if (!cancelledRef.current) checkStabilityAndActivate();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;

    requestAnimationFrame(checkStabilityAndActivate);
  }, [cancelReadinessObserver]);

  const resetWelcomeState = useCallback(() => {
    cancelReadinessObserver();
    localStorage.removeItem(TOUR_SKIPPED_KEY);
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    setHasCompleted(false);
    setIsWelcomeOpen(true);
  }, [cancelReadinessObserver]);

  const completeOnboarding = useCallback(
    (navigate) => {
      cancelReadinessObserver();
      setIsWelcomeOpen(false);

      const rawUser = localStorage.getItem("currentUser");
      if (rawUser) {
        try {
          const user = JSON.parse(rawUser);
          const userId = user.id || user.email || "default";
          localStorage.setItem(`${ONBOARDING_COMPLETED_KEY}_${userId}`, "true");
        } catch {
          // Ignore
        }
      }
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");

      if (typeof navigate === "function") {
        navigate("/teacher/help-center?fromOnboarding=true");
      } else {
        window.location.href = "/teacher/help-center?fromOnboarding=true";
      }
    },
    [cancelReadinessObserver]
  );

  const startTour = useCallback(() => {
    setIsWelcomeOpen(false);
    setIsStarted(true);

    const rawUser = localStorage.getItem("currentUser");
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser);
        const userId = user.id || user.email || "default";
        localStorage.setItem(`${TOUR_STARTED_KEY}_${userId}`, "true");
      } catch {
        // Ignore
      }
    }
    localStorage.setItem(TOUR_STARTED_KEY, "true");

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
        const isRouteChanging = !!(currentStepObj?.actionToRoute && navigate);
        waitForPageAndTargetReady(nextIdx, null, isRouteChanging);
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

      const isRouteChanging = !!(targetStepObj?.actionToRoute && navigate);
      waitForPageAndTargetReady(prevIdx, null, isRouteChanging);
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
    setHasCompleted(true);

    const rawUser = localStorage.getItem("currentUser");
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser);
        const userId = user.id || user.email || "default";
        localStorage.setItem(`${TOUR_COMPLETED_KEY}_${userId}`, "true");
      } catch {
        // Ignore
      }
    }
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
  }, [cancelReadinessObserver]);

  // Restart Tour
  const restartTour = useCallback(
    (navigate) => {
      cancelReadinessObserver();
      setIsWelcomeOpen(false);

      const rawUser = localStorage.getItem("currentUser");
      if (rawUser) {
        try {
          const user = JSON.parse(rawUser);
          const userId = user.id || user.email || "default";
          localStorage.removeItem(`${TOUR_COMPLETED_KEY}_${userId}`);
          localStorage.removeItem(`${TOUR_STARTED_KEY}_${userId}`);
          localStorage.removeItem(`${TOUR_SKIPPED_KEY}_${userId}`);
        } catch {
          // Ignore
        }
      }
      localStorage.removeItem(TOUR_SKIPPED_KEY);
      localStorage.removeItem(TOUR_COMPLETED_KEY);
      localStorage.removeItem(TOUR_STARTED_KEY);

      setHasCompleted(false);
      setIsStarted(true);

      if (navigate) {
        navigate("/teacher/dashboard");
      }

      waitForPageAndTargetReady(0);
    },
    [waitForPageAndTargetReady, cancelReadinessObserver]
  );

  const currentStep = tourSteps[currentStepIndex] || null;
  const isFinalStep = currentStepIndex === tourSteps.length - 1;

  let tourStatus = "Not Started";
  if (hasCompleted) {
    tourStatus = "Completed";
  } else if (isTourActive || isStarted || currentStepIndex > 0) {
    tourStatus = "In Progress";
  }

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
    isStarted,
    tourStatus,
    startTour,
    skipWelcome,
    completeOnboarding,
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
