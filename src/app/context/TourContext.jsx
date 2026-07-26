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
    return () => clearTimeout(timer);
  }, []);

  // Cancel & stop all pending readiness observers
  const cancelReadinessObserver = useCallback(() => {
    cancelledRef.current = true;
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  // Page Data & Target Readiness Observer
  const waitForPageAndTargetReady = useCallback((stepIndex, onReady) => {
    cancelReadinessObserver();
    cancelledRef.current = false;

    const targetStep = ADMIN_TOUR_STEPS[stepIndex] || ADMIN_TOUR_STEPS[0];
    const targetSelector = targetStep?.targetSelector;

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

      const isPageDataLoading = !!document.querySelector(".animate-bounce, .animate-spin:not(.connected-tour-spinner), [data-loading='true']");

      let el = document.querySelector(targetSelector);
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
      if (attempts < 60 && !cancelledRef.current) {
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

    requestAnimationFrame(() => setTimeout(checkStabilityAndActivate, 50));
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

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx < ADMIN_TOUR_STEPS.length) {
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

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const prevIdx = Math.max(0, prev - 1);
      waitForPageAndTargetReady(prevIdx);
      return prevIdx;
    });
  }, [waitForPageAndTargetReady]);

  const skipTour = useCallback(() => {
    cancelReadinessObserver();
    setIsTourActive(false);
    setIsPreparingTour(false);
    localStorage.setItem(TOUR_SKIPPED_KEY, "true");
  }, [cancelReadinessObserver]);

  const finishTour = useCallback(() => {
    cancelReadinessObserver();
    setIsTourActive(false);
    setIsPreparingTour(false);
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
