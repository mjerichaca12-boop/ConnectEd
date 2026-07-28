import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { MODULE_TOURS } from "../config/tours";

const ModuleTourContext = createContext(null);

const PROGRESS_STORAGE_KEY = "connected_module_tour_progress";

export function ModuleTourProvider({ children }) {
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isPreparingTour, setIsPreparingTour] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [pendingModuleId, setPendingModuleId] = useState(null);
  const [isFinishOpen, setIsFinishOpen] = useState(false);

  // Helper to get storage key per user
  const getStorageKey = () => {
    try {
      const rawUser = localStorage.getItem("currentUser");
      if (rawUser) {
        const user = JSON.parse(rawUser);
        return `${PROGRESS_STORAGE_KEY}_${user.id || user.email || "default"}`;
      }
    } catch {
      // Ignore
    }
    return `${PROGRESS_STORAGE_KEY}_default`;
  };

  // Store learning progress for all modules
  const [progressData, setProgressData] = useState(() => {
    try {
      const saved = localStorage.getItem(getStorageKey());
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const observerRef = useRef(null);
  const cancelledRef = useRef(false);

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
        localStorage.setItem(getStorageKey(), JSON.stringify(next));
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
      let userProgress = progressData;
      try {
        const saved = localStorage.getItem(getStorageKey());
        if (saved) {
          userProgress = JSON.parse(saved);
        }
      } catch {
        // Ignore
      }
      const data = userProgress[moduleId] || { status: "not_started", lastStepIndex: 0 };
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
    document.querySelectorAll(".tour-active-target, .connected-tour-target-active").forEach((el) => {
      el.classList.remove("tour-active-target", "connected-tour-target-active");
    });
    document.querySelectorAll(".connected-tour-sidebar-elevated").forEach((el) => {
      el.classList.remove("connected-tour-sidebar-elevated");
    });
  }, []);

  // Strict 6-Step Page & Target Readiness Observer Pipeline
  const waitForPageAndTargetReady = useCallback((stepIndex, moduleId, onReady, isPageChange = false) => {
    const config = MODULE_TOURS[moduleId];
    if (!config) return;

    cancelReadinessObserver();
    cancelledRef.current = false;

    const targetStep = config.steps[stepIndex] || config.steps[0];
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

  // Handle clicking a module card in HelpCenter
  const handleModuleCardClick = useCallback(
    (moduleId, navigate) => {
      const config = MODULE_TOURS[moduleId];
      if (!config) return;

      const progress = getModuleProgress(moduleId);

      if (progress.status === "in_progress") {
        setPendingModuleId(moduleId);
        setIsResumeOpen(true);
      } else {
        restartModuleTour(moduleId, navigate);
      }
    },
    [getModuleProgress]
  );

  // Start tour from step 0
  const startModuleTour = useCallback(
    (moduleId, navigate) => {
      const config = MODULE_TOURS[moduleId];
      if (!config) return;

      setActiveModuleId(moduleId);
      setIsResumeOpen(false);
      setIsFinishOpen(false);

      updateModuleProgress(moduleId, {
        status: "in_progress",
        lastStepIndex: 0,
      });

      if (navigate && window.location.pathname !== config.route) {
        navigate(config.route);
      }

      waitForPageAndTargetReady(0, moduleId);
    },
    [updateModuleProgress, waitForPageAndTargetReady]
  );

  // Restart tour from step 0
  const restartModuleTour = useCallback(
    (moduleId, navigate) => {
      const config = MODULE_TOURS[moduleId];
      if (!config) return;

      cancelReadinessObserver();
      setActiveModuleId(moduleId);
      setIsResumeOpen(false);
      setIsFinishOpen(false);

      updateModuleProgress(moduleId, {
        status: "in_progress",
        lastStepIndex: 0,
      });

      if (navigate && window.location.pathname !== config.route) {
        navigate(config.route);
      }

      waitForPageAndTargetReady(0, moduleId);
    },
    [updateModuleProgress, waitForPageAndTargetReady, cancelReadinessObserver]
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
  const nextStep = useCallback((navigate) => {
    if (!activeModuleId) return;
    const config = MODULE_TOURS[activeModuleId];
    if (!config) return;

    setCurrentStepIndex((prev) => {
      const nextIdx = prev + 1;
      const currentStepObj = config.steps[prev];

      if (currentStepObj?.actionToRoute === "auto-first-class" && navigate) {
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

        navigate(`/teacher/class/${classId}`);
      }

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
  const prevStep = useCallback((navigate) => {
    if (!activeModuleId) return;
    const config = MODULE_TOURS[activeModuleId];
    if (!config) return;

    setCurrentStepIndex((prev) => {
      const prevIdx = Math.max(0, prev - 1);
      const targetStepObj = config.steps[prevIdx];

      if (targetStepObj?.id === "teacher-classes-view-btn" || targetStepObj?.id === "classes-view-btn" || targetStepObj?.targetSelector?.includes("teacher-classes")) {
        if (navigate && window.location.pathname.includes("/teacher/class/")) {
          navigate("/teacher/classes");
        }
      }

      waitForPageAndTargetReady(prevIdx, activeModuleId);
      return prevIdx;
    });
  }, [activeModuleId, waitForPageAndTargetReady]);

  // Exit / Skip tour handler
  const skipModuleTour = useCallback(() => {
    cancelReadinessObserver();
    if (activeModuleId) {
      updateModuleProgress(activeModuleId, {
        status: "not_started",
        lastStepIndex: 0,
      });
    }
    setIsTourActive(false);
    setIsPreparingTour(false);
    setActiveModuleId(null);
    setCurrentStepIndex(0);
  }, [cancelReadinessObserver, activeModuleId, updateModuleProgress]);

  const closeResumeModal = useCallback(() => {
    setIsResumeOpen(false);
    setPendingModuleId(null);
  }, []);

  const closeFinishModal = useCallback(() => {
    setIsFinishOpen(false);
  }, []);

  const activeConfig = activeModuleId ? MODULE_TOURS[activeModuleId] : null;
  const currentStep = activeConfig ? activeConfig.steps[currentStepIndex] || null : null;
  const isFinalStep = activeConfig ? currentStepIndex === activeConfig.steps.length - 1 : false;

  const resetModuleProgress = useCallback((moduleId) => {
    updateModuleProgress(moduleId, {
      status: "not_started",
      lastStepIndex: 0,
    });
  }, [updateModuleProgress]);

  const value = {
    activeModuleId,
    activeConfig,
    currentStepIndex,
    currentStep,
    totalSteps: activeConfig ? activeConfig.steps.length : 0,
    isTourActive,
    isPreparingTour,
    isWelcomeOpen: isResumeOpen, // backward compat alias
    isResumeOpen,
    isFinishOpen,
    pendingModuleId,
    isFinalStep,
    progressData,
    getModuleProgress,
    handleModuleCardClick,
    startModuleTour,
    restartModuleTour,
    resumeTour,
    nextStep,
    prevStep,
    skipModuleTour,
    skipTour: skipModuleTour,
    resetModuleProgress,
    closeResumeModal,
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
