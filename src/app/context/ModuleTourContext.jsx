import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { MODULE_TOURS } from "../config/tours";

const ModuleTourContext = createContext(null);

const PROGRESS_STORAGE_KEY = "connected_module_tours_progress";

export function ModuleTourProvider({ children }) {
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [pendingModuleId, setPendingModuleId] = useState(null);

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

  // Helper: Poll DOM readiness before activating tour step
  const waitForTargetAndActivate = useCallback((stepIndex, moduleId) => {
    const config = MODULE_TOURS[moduleId];
    if (!config) return;

    const targetStep = config.steps[stepIndex] || config.steps[0];
    const targetSelector = targetStep?.targetSelector;

    const check = (attempts = 0) => {
      if (!targetSelector) {
        setCurrentStepIndex(stepIndex);
        setIsTourActive(true);
        return;
      }

      let el = document.querySelector(targetSelector);
      if (!el && targetStep.fallbackTargetSelector) {
        el = document.querySelector(targetStep.fallbackTargetSelector);
      }

      if (el && el.getBoundingClientRect().width > 0) {
        setCurrentStepIndex(stepIndex);
        setIsTourActive(true);
      } else if (attempts < 20) {
        setTimeout(() => check(attempts + 1), 50);
      } else {
        // Fallback activate
        setCurrentStepIndex(stepIndex);
        setIsTourActive(true);
      }
    };

    setTimeout(() => check(), 50);
  }, []);

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

      waitForTargetAndActivate(0, moduleId);
    },
    [updateModuleProgress, waitForTargetAndActivate]
  );

  // Handle clicking card in Help Center: triggers Resume modal if in_progress, else starts from 0
  const handleModuleCardClick = useCallback(
    (moduleId, navigate) => {
      const progress = getModuleProgress(moduleId);
      const config = MODULE_TOURS[moduleId];
      if (!config) return;

      if (progress.status === "in_progress" && progress.lastStepIndex > 0) {
        // Prompt user to continue or restart
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

  // Resume tour at previous saved step
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

      waitForTargetAndActivate(targetStep, targetId);
    },
    [pendingModuleId, activeModuleId, getModuleProgress, waitForTargetAndActivate]
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
        return nextIdx;
      } else {
        // Reached final step
        setIsTourActive(false);
        updateModuleProgress(activeModuleId, {
          status: "completed",
          lastStepIndex: config.steps.length - 1,
        });
        setIsFinishOpen(true);
        return prev;
      }
    });
  }, [activeModuleId, updateModuleProgress]);

  // Previous Step handler
  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  // Skip tour
  const skipTour = useCallback(() => {
    if (activeModuleId) {
      updateModuleProgress(activeModuleId, {
        status: "in_progress",
        lastStepIndex: currentStepIndex,
      });
    }
    setIsTourActive(false);
  }, [activeModuleId, currentStepIndex, updateModuleProgress]);

  // Restart tour from step 1
  const restartModuleTour = useCallback(
    (moduleId, navigate) => {
      const targetId = moduleId || pendingModuleId || activeModuleId;
      if (!targetId) return;

      setIsResumeOpen(false);
      setIsFinishOpen(false);
      setIsTourActive(false);
      setCurrentStepIndex(0);

      startModuleTour(targetId, navigate);
    },
    [pendingModuleId, activeModuleId, startModuleTour]
  );

  // Close finish dialog
  const closeFinishModal = useCallback(() => {
    setIsFinishOpen(false);
  }, []);

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
