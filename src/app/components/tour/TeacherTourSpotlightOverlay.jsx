import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  CheckCircle2,
  Command,
  Loader2,
  Info,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { useTeacherTour } from "../../context/TeacherTourContext";
import { useModuleTour } from "../../context/ModuleTourContext";
import { useTour } from "../../context/TourContext";

export function TeacherTourSpotlightOverlay() {
  const navigate = useNavigate();
  const {
    isTourActive,
    isPreparingTour,
    currentStep,
    currentStepIndex,
    totalSteps,
    isFinalStep,
    nextStep,
    prevStep,
    skipTour,
    finishTour,
  } = useTeacherTour();

  // Access other tour contexts for a universal exit
  const { skipTour: skipModuleTour, finishTour: finishModuleTour } = useModuleTour();
  const { skipTour: skipAdminTour, finishTour: finishAdminTour } = useTour();

  // Unified exit handler for all active tours
  // Clear previous highlighted targets & sidebar elevation
  const clearActiveHighlights = useCallback(() => {
    document.querySelectorAll(".tour-active-target, .connected-tour-target-active").forEach((el) => {
      el.classList.remove("tour-active-target", "connected-tour-target-active");
    });
    document.querySelectorAll(".connected-tour-sidebar-elevated").forEach((el) => {
      el.classList.remove("connected-tour-sidebar-elevated");
    });
  }, []);

  const handleExitAllTours = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Gracefully exit each possible tour
    try { skipTour?.(); } catch {}
    try { finishTour?.(); } catch {}
    try { skipModuleTour?.(); } catch {}
    try { finishModuleTour?.(); } catch {}
    try { skipAdminTour?.(); } catch {}
    try { finishAdminTour?.(); } catch {}
    // Clean up any remaining highlights
    clearActiveHighlights();
    setTargetRect(null);
  }, [skipTour, finishTour, skipModuleTour, finishModuleTour, skipAdminTour, finishAdminTour, clearActiveHighlights]);

  const [targetRect, setTargetRect] = useState(null);
  const [activeDirection, setActiveDirection] = useState("right");
  const [arrowOffsetPx, setArrowOffsetPx] = useState(50);
  const cardRef = useRef(null);

  // Locate, highlight, and measure active target element
  const updateTargetRect = useCallback(() => {
    clearActiveHighlights();

    if (!isTourActive || !currentStep || currentStep.targetSelector === null) {
      setTargetRect(null);
      return;
    }

    let el = document.querySelector(currentStep.targetSelector);
    if (!el && currentStep.fallbackTargetSelector) {
      el = document.querySelector(currentStep.fallbackTargetSelector);
    }

    if (el) {
      if (
        currentStep.targetSelector === '[data-tour="teacher-sidebar"]' ||
        currentStep.targetSelector?.includes("teacher-")
      ) {
        const sidebarParent = el.closest("aside") || el;
        sidebarParent?.classList.add("connected-tour-sidebar-elevated");
      }

      el.classList.add("tour-active-target", "connected-tour-target-active");

      const compStyle = window.getComputedStyle(el);
      const computedRadius = compStyle.borderRadius || "16px";

      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: computedRadius,
      });

      if (currentStep.targetSelector !== '[data-tour="teacher-sidebar"]') {
        const vHeight = window.innerHeight || document.documentElement.clientHeight;
        const vWidth = window.innerWidth || document.documentElement.clientWidth;
        const isTable = rect.height > 150 && rect.width > vWidth * 0.5;

        const isVisibleInViewport =
          rect.top >= 20 &&
          rect.bottom <= vHeight - 20 &&
          rect.left >= 20 &&
          rect.right <= vWidth - 20;

        const prefPlacement = currentStep.placement || "bottom";
        const cardMinHeight = 260;
        const hasEnoughSpaceBelow = vHeight - rect.bottom >= cardMinHeight;
        const hasEnoughSpaceAbove = rect.top >= cardMinHeight;

        let needsScroll = !isVisibleInViewport || isTable;
        if (prefPlacement.startsWith("bottom") && !hasEnoughSpaceBelow) {
          needsScroll = true;
        } else if (prefPlacement.startsWith("top") && !hasEnoughSpaceAbove) {
          needsScroll = true;
        }

        if (needsScroll) {
          const scrollBlock = prefPlacement.startsWith("top") ? "end" : "start";
          el.scrollIntoView({
            behavior: "smooth",
            block: scrollBlock,
            inline: "nearest",
          });

          let scrollFrames = 0;
          const pollScrollRect = () => {
            const updatedRect = el.getBoundingClientRect();
            const latestCompStyle = window.getComputedStyle(el);
            setTargetRect({
              top: updatedRect.top,
              left: updatedRect.left,
              width: updatedRect.width,
              height: updatedRect.height,
              borderRadius: latestCompStyle.borderRadius || "16px",
            });
            scrollFrames++;
            if (scrollFrames < 15) {
              requestAnimationFrame(pollScrollRect);
            }
          };
          requestAnimationFrame(pollScrollRect);
        }
      }
    } else {
      setTargetRect(null);
    }
  }, [isTourActive, currentStep, clearActiveHighlights]);

  // Scroll main container & auto-switch Class Detail tabs on step change
  useEffect(() => {
    if (!isTourActive || !currentStep) return;

    const stepId = currentStep.id || "";
    if (stepId === "class-detail-students" || stepId === "class-detail-students-list") {
      window.dispatchEvent(new CustomEvent("tour-switch-tab", { detail: { tab: "students" } }));
      setTimeout(() => updateTargetRect(), 60);
      setTimeout(() => updateTargetRect(), 180);
    } else if (stepId === "class-detail-lessons") {
      window.dispatchEvent(new CustomEvent("tour-switch-tab", { detail: { tab: "lessons" } }));
      setTimeout(() => updateTargetRect(), 60);
      setTimeout(() => updateTargetRect(), 180);
    } else if (stepId === "class-detail-announcements") {
      window.dispatchEvent(new CustomEvent("tour-switch-tab", { detail: { tab: "announcements" } }));
      setTimeout(() => updateTargetRect(), 60);
      setTimeout(() => updateTargetRect(), 180);
    }

    const isTopStep = [
      "teacher-dashboard-header",
      "teacher-classes-search",
      "class-detail-banner",
      "teacher-grades-class-select",
    ].includes(stepId);

    if (isTopStep) {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      const mainEl = document.querySelector("main");
      if (mainEl) {
        mainEl.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      }
    }
  }, [isTourActive, currentStep?.id]);

  // Layout Shift Observers
  useEffect(() => {
    updateTargetRect();

    let resizeObserver = null;
    let mutationObserver = null;

    if (isTourActive && currentStep?.targetSelector) {
      let el = document.querySelector(currentStep.targetSelector);
      if (!el && currentStep.fallbackTargetSelector) {
        el = document.querySelector(currentStep.fallbackTargetSelector);
      }

      if (el) {
        try {
          resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(updateTargetRect);
          });
          resizeObserver.observe(el);
        } catch {
          // Ignore
        }
      }

      mutationObserver = new MutationObserver(() => {
        requestAnimationFrame(updateTargetRect);
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
    }

    const handleResizeOrScroll = () => {
      updateTargetRect();
    };

    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
      clearActiveHighlights();
    };
  }, [updateTargetRect, currentStepIndex, isTourActive, currentStep, clearActiveHighlights]);

  // Handle direct click on interactive view class button on page
  useEffect(() => {
    if (!isTourActive || !currentStep) return;

    if (currentStep.actionToRoute === "auto-first-class" || currentStep.id === "teacher-classes-view-btn" || currentStep.id === "classes-view-btn") {
      const handleDirectClassClick = (e) => {
        const targetBtn = e.target.closest('[data-tour="teacher-classes-view-btn"]');
        if (targetBtn) {
          const classId = targetBtn.getAttribute("data-class-id") || "1";
          e.preventDefault();
          e.stopPropagation();
          navigate(`/teacher/class/${classId}`);
          nextStep(navigate);
        }
      };

      document.addEventListener("click", handleDirectClassClick, true);
      return () => document.removeEventListener("click", handleDirectClassClick, true);
    }
  }, [isTourActive, currentStep, navigate, nextStep]);

  // Keyboard navigation listeners
  useEffect(() => {
    if (!isTourActive) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        skipTour();
      } else if (e.key === "ArrowRight") {
        if (!isFinalStep) nextStep(navigate);
      } else if (e.key === "ArrowLeft") {
        if (currentStepIndex > 0) prevStep(navigate);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTourActive, isFinalStep, currentStepIndex, nextStep, prevStep, skipTour, navigate]);

  // Calculate card position without overlap
  const getCardStyle = () => {
    if (!targetRect || !currentStep) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        position: "fixed",
      };
    }

    const cardWidth = cardRef.current?.offsetWidth || 380;
    const cardHeight = cardRef.current?.offsetHeight || 380;
    const offset = 18;

    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const vWidth = window.innerWidth || document.documentElement.clientWidth;
    const vHeight = window.innerHeight || document.documentElement.clientHeight;

    const preferredPos = currentStep.placement || "right";

    const candidatePositions = {
      right: {
        top: Math.max(16, Math.min(targetCenterY - cardHeight / 2, vHeight - cardHeight - 16)),
        left: targetRect.left + targetRect.width + offset,
        dir: "right",
      },
      left: {
        top: Math.max(16, Math.min(targetCenterY - cardHeight / 2, vHeight - cardHeight - 16)),
        left: targetRect.left - cardWidth - offset,
        dir: "left",
      },
      bottom: {
        top: Math.max(16, Math.min(targetRect.top + targetRect.height + offset, vHeight - cardHeight - 16)),
        left: Math.max(16, Math.min(targetCenterX - cardWidth / 2, vWidth - cardWidth - 16)),
        dir: "bottom",
      },
      "bottom-left": {
        top: Math.max(16, Math.min(targetRect.top + targetRect.height + offset, vHeight - cardHeight - 16)),
        left: Math.max(16, targetRect.left + 32),
        dir: "bottom",
      },
      "bottom-right": {
        top: Math.max(16, Math.min(targetRect.top + targetRect.height + offset, vHeight - cardHeight - 16)),
        left: Math.max(16, Math.min(targetRect.left + targetRect.width - cardWidth - 32, vWidth - cardWidth - 16)),
        dir: "bottom",
      },
      top: {
        top: Math.max(16, Math.min(targetRect.top - cardHeight - offset, vHeight - cardHeight - 16)),
        left: Math.max(16, Math.min(targetCenterX - cardWidth / 2, vWidth - cardWidth - 16)),
        dir: "top",
      },
      "top-left": {
        top: Math.max(16, Math.min(targetRect.top - cardHeight - offset, vHeight - cardHeight - 16)),
        left: Math.max(16, targetRect.left + 32),
        dir: "top",
      },
      "top-right": {
        top: Math.max(16, Math.min(targetRect.top - cardHeight - offset, vHeight - cardHeight - 16)),
        left: Math.max(16, Math.min(targetRect.left + targetRect.width - cardWidth - 32, vWidth - cardWidth - 16)),
        dir: "top",
      },
    };

    let chosenPos = candidatePositions[preferredPos] || candidatePositions["bottom-left"] || candidatePositions.right;

    const hasRightSpace = candidatePositions.right.left + cardWidth <= vWidth - 16;
    const hasLeftSpace = candidatePositions.left.left >= 16;
    const hasBottomSpace = candidatePositions.bottom.top + cardHeight <= vHeight - 16;
    const hasTopSpace = candidatePositions.top.top >= 16;

    if (preferredPos === "right" && !hasRightSpace) {
      if (hasLeftSpace) chosenPos = candidatePositions.left;
      else if (hasBottomSpace) chosenPos = candidatePositions.bottom;
      else if (hasTopSpace) chosenPos = candidatePositions.top;
    } else if (preferredPos === "left" && !hasLeftSpace) {
      if (hasRightSpace) chosenPos = candidatePositions.right;
      else if (hasBottomSpace) chosenPos = candidatePositions.bottom;
      else if (hasTopSpace) chosenPos = candidatePositions.top;
    } else if (preferredPos === "bottom" && !hasBottomSpace) {
      if (hasTopSpace) chosenPos = candidatePositions.top;
      else if (hasLeftSpace) chosenPos = candidatePositions.left;
      else if (hasRightSpace) chosenPos = candidatePositions.right;
    } else if (preferredPos === "top" && !hasTopSpace) {
      if (hasBottomSpace) chosenPos = candidatePositions.bottom;
      else if (hasLeftSpace) chosenPos = candidatePositions.left;
      else if (hasRightSpace) chosenPos = candidatePositions.right;
    }

    const finalTop = Math.max(16, Math.min(chosenPos.top, vHeight - cardHeight - 16));
    const finalLeft = Math.max(16, Math.min(chosenPos.left, vWidth - cardWidth - 16));

    const actualArrowDir = chosenPos.dir;

    let calculatedArrowPx = 50;
    if (actualArrowDir === "left" || actualArrowDir === "right") {
      const relY = targetCenterY - finalTop;
      calculatedArrowPx = Math.max(28, Math.min(relY, cardHeight - 28));
    } else {
      if (preferredPos === "bottom-left" || preferredPos === "top-left") {
        calculatedArrowPx = 48;
      } else if (preferredPos === "bottom-right" || preferredPos === "top-right") {
        calculatedArrowPx = Math.max(28, cardWidth - 48);
      } else {
        const relX = targetCenterX - finalLeft;
        calculatedArrowPx = Math.max(28, Math.min(relX, cardWidth - 28));
      }
    }

    if (activeDirection !== actualArrowDir) {
      setActiveDirection(actualArrowDir);
    }
    if (arrowOffsetPx !== calculatedArrowPx) {
      setArrowOffsetPx(calculatedArrowPx);
    }

    return {
      top: `${finalTop}px`,
      left: `${finalLeft}px`,
      position: "fixed",
    };
  };

  const renderPointerArrow = () => {
    if (!currentStep?.targetSelector || !targetRect) return null;

    if (activeDirection === "right") {
      return (
        <div
          style={{ top: `${arrowOffsetPx}px` }}
          className="absolute -left-2 -translate-y-1/2 w-4 h-4 bg-white border-l border-b border-gray-200/90 rotate-45 z-[1001] shadow-xs pointer-events-none transition-all duration-200"
        />
      );
    } else if (activeDirection === "left") {
      return (
        <div
          style={{ top: `${arrowOffsetPx}px` }}
          className="absolute -right-2 -translate-y-1/2 w-4 h-4 bg-white border-r border-t border-gray-200/90 rotate-45 z-[1001] shadow-xs pointer-events-none transition-all duration-200"
        />
      );
    } else if (activeDirection === "bottom") {
      return (
        <div
          style={{ left: `${arrowOffsetPx}px` }}
          className="absolute -top-2 -translate-x-1/2 w-4 h-4 bg-white border-t border-l border-gray-200/90 rotate-45 z-[1001] shadow-xs pointer-events-none transition-all duration-200"
        />
      );
    } else if (activeDirection === "top") {
      return (
        <div
          style={{ left: `${arrowOffsetPx}px` }}
          className="absolute -bottom-2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-gray-200/90 rotate-45 z-[1001] shadow-xs pointer-events-none transition-all duration-200"
        />
      );
    }
    return null;
  };

  const renderMessageBadge = () => {
    if (!currentStep.messageText) return null;

    let bgClass = "bg-blue-50/80 border-blue-200/80 text-blue-900";
    let iconClass = "text-blue-600";
    let IconComponent = Info;

    if (currentStep.messageType === "tip") {
      bgClass = "bg-green-50/80 border-green-200/80 text-green-900";
      iconClass = "text-green-600";
      IconComponent = Lightbulb;
    } else if (currentStep.messageType === "warning") {
      bgClass = "bg-amber-50/80 border-amber-200/80 text-amber-900";
      iconClass = "text-amber-600";
      IconComponent = AlertTriangle;
    }

    return (
      <div className={`flex items-start gap-2.5 p-3 rounded-2xl border ${bgClass} mb-4 text-xs`}>
        <IconComponent className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`} />
        <div className="flex-1 min-w-0">
          {currentStep.messageTitle && (
            <p className="font-bold text-[11px] uppercase tracking-wider mb-0.5">{currentStep.messageTitle}</p>
          )}
          <p className="leading-relaxed">{currentStep.messageText}</p>
        </div>
      </div>
    );
  };

  if (isPreparingTour) {
    return createPortal(
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1001] bg-gray-900/90 text-white backdrop-blur-md px-5 py-2.5 rounded-full shadow-2xl border border-white/20 flex items-center gap-3 animate-in fade-in zoom-in-95 font-sans pointer-events-none">
        <Loader2 className="w-4 h-4 text-green-400 animate-spin connected-tour-spinner" />
        <span className="text-xs font-bold tracking-wide">Preparing tour... Waiting for page data</span>
      </div>,
      document.body
    );
  }

  if (!isTourActive || !currentStep) return null;

  const portalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={currentStep.title}
      aria-describedby="teacher-tour-step-description"
      className="connected-tour-portal-root font-sans"
    >
      {/* 1. Dark Backdrop Overlay / Spotlight Cutout Box (z-index: 960) */}
      {targetRect ? (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out z-[960]"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            borderRadius: `${(parseFloat(targetRect.borderRadius) || 16) + 6}px`,
            boxShadow:
              "0 0 0 9999px rgba(0, 0, 0, 0.65), 0 0 0 3px #22c55e, 0 0 25px rgba(34, 197, 94, 0.5)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[900] transition-opacity duration-300" />
      )}

      {/* 2. Tour Tooltip Popover Card (z-index: 1000) */}
      <div
        ref={cardRef}
        style={getCardStyle()}
        className="z-[1000] w-full max-w-sm transition-all duration-300 ease-out relative"
      >
        {/* Pointer Arrow Tooltip Tip (Outside overflow container so it's NEVER clipped!) */}
        {renderPointerArrow()}

        {/* Card Body Container */}
        <div className="bg-white/98 backdrop-blur-xl rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3),0_0_30px_rgba(34,197,94,0.15)] border border-gray-200/80 max-h-[calc(100vh-32px)] overflow-y-auto no-scrollbar p-6">
          {/* Header Badges */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-green-50 text-green-700 border border-green-200/80 shadow-2xs">
                <Sparkles className="w-3 h-3 text-green-600" />
                Teacher Tour
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-teal-50 text-teal-700 border border-teal-200/80 shadow-2xs">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                handleExitAllTours(e);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/50 cursor-pointer"
              title="Exit tour (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress Dots Indicator */}
          <div className="flex items-center gap-1.5 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ease-out ${
                  i === currentStepIndex
                    ? "w-6 bg-gradient-to-r from-green-500 to-teal-500 shadow-sm"
                    : i < currentStepIndex
                    ? "w-2 bg-green-500/60"
                    : "w-2 bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* Title & Description */}
          <h3 className="text-lg font-bold text-gray-900 tracking-tight mb-2">
            {currentStep.title}
          </h3>
          <p id="teacher-tour-step-description" className="text-gray-600 text-xs leading-relaxed mb-4 whitespace-pre-line">
            {currentStep.description}
          </p>

          {/* Mini Information Panel Badge */}
          {renderMessageBadge()}

          {/* Hotkey Tip */}
          <div className="flex items-center gap-1.5 mb-5 text-[10px] text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
            <Command className="w-3 h-3 text-gray-400" />
            <span>Use <kbd className="px-1 bg-white rounded border border-gray-200 text-gray-600 font-mono">←</kbd> <kbd className="px-1 bg-white rounded border border-gray-200 text-gray-600 font-mono">→</kbd> to navigate, <kbd className="px-1 bg-white rounded border border-gray-200 text-gray-600 font-mono">Esc</kbd> to exit</span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                skipTour();
              }}
              className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors cursor-pointer"
            >
              Skip Tour
            </button>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && !isFinalStep && (
                <button
                  type="button"
                  onClick={() => prevStep(navigate)}
                  className="px-3 py-2 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}

              {isFinalStep && !currentStep.actionButtonText ? (
                <button
                  type="button"
                  onClick={finishTour}
                  className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-teal-700 active:scale-[0.98] shadow-md shadow-green-600/20 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Finish</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => nextStep(navigate)}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-teal-700 active:scale-[0.98] shadow-md shadow-green-600/20 transition-all text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>{currentStep.actionButtonText || "Next"}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(portalContent, document.body);
}
