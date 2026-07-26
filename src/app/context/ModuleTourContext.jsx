import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { MODULE_TOURS } from "../config/tours";

const ModuleTourContext = createContext(null);

const PROGRESS_STORAGE_KEY = "connected_module_tours_progress";

export function ModuleTourProvider({ children }) {
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isPreparingTour, setIsPreparingTour] = useState(false);
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [pendingModuleId, setPendingModuleId] = useState(null);

  const observerRef = useRef(null);
  const cancelledRef = useRef(false);

  // Load progress data from localStorage
  const [progressData, setProgressData] = useState(() => {
    try {
      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Save progress data to localStorage helper
  const updateModuleProgress = useCallback((moduleId, updates) => {
    setProgressData((prev) => {
      const next = {
        ...prev,
        [moduleId]: {
          ...(prev[moduleId] || { status: "not_started", lastStepIndex: 0 }),
          ...updates,
        },
      };
      try {
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.error("Failed to save module tour progress:", err);
      }
      return next;
    });
  }, []);

  // Helper to retrieve progress for a module
  const getModuleProgress = useCallback(
    (moduleId) => {
      const moduleConfig = MODULE_TOURS[moduleId];
      const data = progressData[moduleId] || { status: "not_started", lastStepIndex: 0 };
      return {
        status: data.status || "not_started",
        lastStepIndex: data.lastStepIndex || 0,
        totalSteps: moduleConfig ? moduleConfig.steps.length : 0,
      };
    },
    [progressData]
  );

  // Cancel & stop all pending readiness observers
  const cancelReadinessObserver = useCallback(() => {
    cancelledRef.current = true;
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  // Robust Page & DOM Target Readiness Observer Engine
  const waitForPageAndTargetReady = useCallback((stepIndex, moduleId, onReady) => {
    const config = MODULE_TOURS[moduleId];
    if (!config) return;

    cancelReadinessObserver();
    cancelledRef.current = false;

    const targetStep = config.steps[stepIndex] || config.steps[0];
    const targetSelector = targetStep?.targetSelector;
    const fallbackSelector = targetStep?.fallbackTargetSelector;

    let attempts = 0;
    let lastRectStr = "";
    let stableCount = 0;

    const checkStabilityAndActivate = () => {
      // If user skipped or exited, abort observer completely
      if (cancelledRef.current) return;

      // 1. If step has no target, activate immediately
      if (!targetSelector) {
        if (cancelledRef.current) return;
        setIsPreparingTour(false);
        setCurrentStepIndex(stepIndex);
        setIsTourActive(true);
        if (onReady) onReady();
        return;
      }

      // 2. Check if page data is still loading (active spinners / bouncing loader dots)
      const isPageDataLoading = !!document.querySelector(".animate-bounce, .animate-spin:not(.connected-tour-spinner), [data-loading='true']");

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
      if (attempts < 60 && !cancelledRef.current) {
        requestAnimationFrame(() => setTimeout(checkStabilityAndActivate, 60));
      } else if (!cancelledRef.current) {
        // Safe timeout fallback
        setIsPreparingTour(false);
        setCurrentStepIndex(stepIndex);
        setIsTourActive(true);
        if (onReady) onReady();
      }
    };

    setIsPreparingTour(true);
    setIsTourActive(false);

    // Use MutationObserver for instant DOM addition detection
    const observer = new MutationObserver(() => {
      if (!cancelledRef.current) {
        checkStabilityAndActivate();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;

    requestAnimationFrame(() => setTimeout(checkStabilityAndActivate, 50));
  }, [cancelReadinessObserver]);

  // Start tour from Step 1
  const startModuleTour = useCallback(
    (moduleId, navigate) => {
      const config = MODULE_TOURS[moduleId];
      if (!config) return;

      setIsFinishOpen(false);
      setIsResumeOpen(false);
      setActiveModuleId(moduleId);

      updateModuleProgress(moduleId, { status: "in_progress", lastStepIndex: 0 });

      if (navigate && window.location.pathname !== config.route) {
        navigate(config.route);
      }

      waitForPageAndTargetReady(0, moduleId);
    },
    [updateModuleProgress, waitForPageAndTargetReady]
  );

  // Handle clicking card in Help Center
  const handleModuleCardClick = useCallback(
    (moduleId, navigate) => {
      const progress = getModuleProgress(moduleId);
      const config = MODULE_TOURS[moduleId];
      if (!config) return;

      if (progress.status === "in_progress" && progress.lastStepIndex > 0) {
        setPendingModuleId(moduleId);
        if (navigate && window.location.pathname !== config.route) {
          navigate(config.route);
        }
        setIsResumeOpen(true);
      } else {
        startModuleTour(moduleId, navigate);
      }
    },
    [getModuleProgress, startModuleTour]
  );

  // Resume tour at saved step
  const resumeTour = useCallback(
    (navigate) => {
      const targetId = pendingModuleId || activeModuleId;
      if (!targetId) return;

      const progress = getModuleProgress(targetId);
      const targetStep = progress.lastStepIndex || 0;

      setIsResumeOpen(false);
      setActiveModuleId(targetId);

      const config = MODULE_TOURS[targetId];
      if (navigate && config && window.location.pathname !== config.route) {
        navigate(config.route);
      }

      waitForPageAndTargetReady(targetStep, targetId);
    },
    [pendingModuleId, activeModuleId, getModuleProgress, waitForPageAndTargetReady]
  );

  // Next Step handler
  const nextStep = useCallback(() => {
    if (!activeModuleId) return;
    const config = MODULE_TOURS[activeModuleId];
    if (!config) return;

    setCurrentStepIndex((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx < config.steps.length) {
        updateModuleProgress(activeModuleId, {
          status: "in_progress",
          lastStepIndex: nextIdx,
        });

        waitForPageAndTargetReady(nextIdx, activeModuleId);
        return nextIdx;
      } else {
        cancelReadinessObserver();
        setIsTourActive(false);
        setIsPreparingTour(false);
        updateModuleProgress(activeModuleId, {
          status: "completed",
          lastStepIndex: config.steps.length - 1,
        });
        setIsFinishOpen(true);
        return prev;
      }
    });
  }, [activeModuleId, updateModuleProgress, waitForPageAndTargetReady, cancelReadinessObserver]);

  // Previous Step handler
  const prevStep = useCallback(() => {
    if (!activeModuleId) return;
    setCurrentStepIndex((prev) => {
      const prevIdx = Math.max(0, prev - 1);
      waitForPageAndTargetReady(prevIdx, activeModuleId);
      return prevIdx;
    });
  }, [activeModuleId, waitForPageAndTargetReady]);

  // Skip tour - 100% Guaranteed Immediate Cancellation
  const skipTour = useCallback(() => {
    cancelReadinessObserver();
    if (activeModuleId) {
      updateModuleProgress(activeModuleId, {
        status: "in_progress",
        lastStepIndex: currentStepIndex,
      });
    }
    setIsTourActive(false);
    setIsPreparingTour(false);
  }, [activeModuleId, currentStepIndex, updateModuleProgress, cancelReadinessObserver]);

  // Restart tour
  const restartModuleTour = useCallback(
    (moduleId, navigate) => {
      const targetId = moduleId || pendingModuleId || activeModuleId;
      if (!targetId) return;

      cancelReadinessObserver();
      setIsResumeOpen(false);
      setIsFinishOpen(false);
      setIsTourActive(false);
      setCurrentStepIndex(0);

      startModuleTour(targetId, navigate);
    },
    [pendingModuleId, activeModuleId, startModuleTour, cancelReadinessObserver]
  );

  // Close finish dialog
  const closeFinishModal = useCallback(() => {
    cancelReadinessObserver();
    setIsFinishOpen(false);
    setIsTourActive(false);
    setIsPreparingTour(false);
  }, [cancelReadinessObserver]);

  const activeConfig = activeModuleId ? MODULE_TOURS[activeModuleId] : null;
  const currentStep = activeConfig ? activeConfig.steps[currentStepIndex] || null : null;
  const isFinalStep = activeConfig ? currentStepIndex === activeConfig.steps.length - 1 : false;

  const value = {
    activeModuleId,
    pendingModuleId,
    activeConfig,
    currentStepIndex,
    currentStep,
    totalSteps: activeConfig ? activeConfig.steps.length : 0,
    isTourActive,
    isPreparingTour,
    isFinishOpen,
    isResumeOpen,
    isFinalStep,
    getModuleProgress,
    startModuleTour,
    restartModuleTour,
    handleModuleCardClick,
    resumeTour,
    nextStep,
    prevStep,
    skipTour,
    closeFinishModal,
  };

  return <ModuleTourContext.Provider value={value}>{children}</ModuleTourContext.Provider>;
}

export function useModuleTour() {
  const context = useContext(ModuleTourContext);
  if (!context) {
    throw new Error("useModuleTour must be used within a ModuleTourProvider");
  }
  return context;
}
