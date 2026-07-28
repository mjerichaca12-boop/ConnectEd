import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { ADMIN_TOUR_STEPS } from "../config/adminTourSteps";

const TourContext = createContext(null);

const TOUR_COMPLETED_KEY = "connected_admin_tour_completed";
const TOUR_SKIPPED_KEY = "connected_admin_tour_skipped";

export function TourProvider({ children }) {
  const [tourSteps] = useState(ADMIN_TOUR_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isPreparingTour, setIsPreparingTour] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(TOUR_COMPLETED_KEY) === "true";
  });

  const observerRef = useRef(null);
  const cancelledRef = useRef(false);

  // Automatically check on mount if admin needs first-time login welcome screen
  useEffect(() => {
    const checkWelcomeEligibility = () => {
      const pathname = window.location.pathname;
      if (
        pathname.includes("/change-password") ||
        pathname.includes("/login") ||
        pathname.includes("/reset-password")
      ) {
        setIsWelcomeOpen(false);
        return;
      }

      const rawUser = localStorage.getItem("currentUser");
      if (!rawUser) return;
      try {
        const user = JSON.parse(rawUser);
        if (user?.role === "admin" || user?.role === "administrator") {
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

    const targetStep = ADMIN_TOUR_STEPS[stepIndex] || ADMIN_TOUR_STEPS[0];
    const targetSelector = targetStep?.targetSelector;
    const fallbackSelector = targetStep?.fallbackTargetSelector;

    // Synchronously update step index and active state immediately for 0ms frame response
    setCurrentStepIndex(stepIndex);
    setIsTourActive(true);

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
      const currentStepObj = ADMIN_TOUR_STEPS[prev];
      if (currentStepObj?.actionToRoute && navigate) {
        navigate(currentStepObj.actionToRoute);
      }
      if (nextIdx < ADMIN_TOUR_STEPS.length) {
        const nextStepObj = ADMIN_TOUR_STEPS[nextIdx];
        if (nextStepObj?.actionToRoute && navigate && !currentStepObj?.actionToRoute) {
          navigate(nextStepObj.actionToRoute);
        }
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
      const targetStepObj = ADMIN_TOUR_STEPS[prevIdx];
      if (targetStepObj?.actionToRoute && navigate) {
        navigate(targetStepObj.actionToRoute);
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
        navigate("/admin/dashboard");
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

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
