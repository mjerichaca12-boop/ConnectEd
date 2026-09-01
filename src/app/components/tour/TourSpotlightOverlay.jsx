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
import { useTour } from "../../context/TourContext";
import { useModuleTour } from "../../context/ModuleTourContext";
import { ADMIN_TOUR_STEPS } from "../../config/adminTourSteps";

export function TourSpotlightOverlay() {
  const navigate = useNavigate();
  const {
    isTourActive,
    isPreparingTour,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
    finishTour,
  } = useTour();

  const { skipTour: skipModuleTour, finishTour: finishModuleTour } = useModuleTour();

  // Unified exit handler for all active tours
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
    try { skipTour?.(); } catch {}
    try { finishTour?.(); } catch {}
    try { skipModuleTour?.(); } catch {}
    try { finishModuleTour?.(); } catch {}
    clearActiveHighlights();
    setTargetRect(null);
  }, [skipTour, finishTour, skipModuleTour, finishModuleTour, clearActiveHighlights]);

  const [targetRect, setTargetRect] = useState(null);
  const [activeDirection, setActiveDirection] = useState("right");
  const [arrowOffsetPx, setArrowOffsetPx] = useState(50);
  const cardRef = useRef(null);

  const [visibleStepIndex, setVisibleStepIndex] = useState(0);
  const [modalOpacity, setModalOpacity] = useState(0);
  const [spotlightOpacity, setSpotlightOpacity] = useState(0);
  const [isInteractionEnabled, setIsInteractionEnabled] = useState(false);
  const currentTransitionIdRef = useRef(0);

  // Synchronized step resolver that coordinates navigation, scroll, spotlight positioning, and modal fade-in
  const runStepTransition = useCallback((stepIdx) => {
    const transitionId = ++currentTransitionIdRef.current;
    setIsInteractionEnabled(false);
    setModalOpacity(0);

    const targetStep = ADMIN_TOUR_STEPS[stepIdx];
    if (!targetStep) {
      setTargetRect(null);
      setSpotlightOpacity(0);
      return;
    }

    // Wait for tooltip fade-out before rendering next spotlight/coordinates to prevent flash
    setTimeout(() => {
      if (transitionId !== currentTransitionIdRef.current) return;

      const checkReadyAndPosition = () => {
        if (transitionId !== currentTransitionIdRef.current) return;

        // Ensure page data loader screens are not overlaying
        const isPageLoading = !!document.querySelector(
          ".loading-screen, [data-loading='true'], .animate-bounce:not(.connected-tour-spinner)"
        );

        if (isPreparingTour || isPageLoading) {
          requestAnimationFrame(checkReadyAndPosition);
          return;
        }

        // Center overlay if no target is requested
        if (targetStep.targetSelector === null) {
          setVisibleStepIndex(stepIdx);
          setTargetRect(null);
          setSpotlightOpacity(0);
          
          setTimeout(() => {
            if (transitionId !== currentTransitionIdRef.current) return;
            setModalOpacity(1);
            setTimeout(() => {
              if (transitionId !== currentTransitionIdRef.current) return;
              setIsInteractionEnabled(true);
            }, 200);
          }, 100);
          return;
        }

        let el = document.querySelector(targetStep.targetSelector);
        if (!el && targetStep.fallbackTargetSelector) {
          el = document.querySelector(targetStep.fallbackTargetSelector);
        }

        if (el && el.isConnected) {
          const rect = el.getBoundingClientRect();
          const hasSize = rect.width > 0 && rect.height > 0;

          if (hasSize) {
            // Scroll target into view if outside stable viewport boundaries
            const vHeight = window.innerHeight || document.documentElement.clientHeight;
            const vWidth = window.innerWidth || document.documentElement.clientWidth;
            const isVisibleInViewport =
              rect.top >= 40 &&
              rect.bottom <= vHeight - 40 &&
              rect.left >= 40 &&
              rect.right <= vWidth - 40;

            if (!isVisibleInViewport) {
              el.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "nearest",
              });

              // Detect when smooth scrolling completes to compute stable coordinate rect
              let lastTop = null;
              let lastLeft = null;
              let stableFrames = 0;

              const checkScroll = () => {
                if (transitionId !== currentTransitionIdRef.current) return;
                const r = el.getBoundingClientRect();
                if (lastTop !== null && Math.abs(r.top - lastTop) < 0.5 && Math.abs(r.left - lastLeft) < 0.5) {
                  stableFrames++;
                  if (stableFrames >= 3) {
                    finalizePosition(el, stepIdx, transitionId);
                    return;
                  }
                } else {
                  stableFrames = 0;
                }
                lastTop = r.top;
                lastLeft = r.left;
                requestAnimationFrame(checkScroll);
              };
              requestAnimationFrame(checkScroll);
            } else {
              finalizePosition(el, stepIdx, transitionId);
            }
            return;
          }
        }

        requestAnimationFrame(checkReadyAndPosition);
      };

      requestAnimationFrame(checkReadyAndPosition);
    }, 150);
  }, [isPreparingTour, clearActiveHighlights]);

  const finalizePosition = (el, stepIdx, transitionId) => {
    if (transitionId !== currentTransitionIdRef.current) return;

    clearActiveHighlights();
    const sidebarEl = document.querySelector('[data-tour="sidebar"]');
    if (sidebarEl && (sidebarEl === el || sidebarEl.contains(el))) {
      sidebarEl.classList.add("connected-tour-sidebar-elevated");
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

    setVisibleStepIndex(stepIdx);
    setSpotlightOpacity(1);

    // Wait for spotlight transition to finish before fading in modal
    setTimeout(() => {
      if (transitionId !== currentTransitionIdRef.current) return;
      setModalOpacity(1);
      
      setTimeout(() => {
        if (transitionId !== currentTransitionIdRef.current) return;
        setIsInteractionEnabled(true);
      }, 200);
    }, 300);
  };

  // Run transition coordinator whenever step index changes
  useEffect(() => {
    if (isTourActive) {
      runStepTransition(currentStepIndex);
    } else {
      setTargetRect(null);
      setModalOpacity(0);
      setSpotlightOpacity(0);
      clearActiveHighlights();
    }
  }, [isTourActive, currentStepIndex, runStepTransition, clearActiveHighlights]);

  // Live coordinate tracker for manual resize/scroll once interaction is enabled
  const updateTargetRect = useCallback(() => {
    if (!isTourActive || !isInteractionEnabled) return;

    const currentStepObj = ADMIN_TOUR_STEPS[currentStepIndex];
    if (!currentStepObj || currentStepObj.targetSelector === null) {
      setTargetRect(null);
      return;
    }

    let el = document.querySelector(currentStepObj.targetSelector);
    if (!el && currentStepObj.fallbackTargetSelector) {
      el = document.querySelector(currentStepObj.fallbackTargetSelector);
    }

    if (el) {
      const rect = el.getBoundingClientRect();
      const compStyle = window.getComputedStyle(el);
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: compStyle.borderRadius || "16px",
      });
    }
  }, [isTourActive, isInteractionEnabled, currentStepIndex]);

  // Window listener integration for manual events
  useEffect(() => {
    if (!isTourActive) return;

    const handleScrollOrResize = () => {
      updateTargetRect();
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    const mutationObserver = new MutationObserver(() => {
      updateTargetRect();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      mutationObserver.disconnect();
    };
  }, [isTourActive, updateTargetRect]);

  // Keyboard navigation listeners
  useEffect(() => {
    if (!isTourActive || !isInteractionEnabled) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        skipTour();
      } else if (e.key === "ArrowRight") {
        if (currentStepIndex < ADMIN_TOUR_STEPS.length - 1) nextStep(navigate);
      } else if (e.key === "ArrowLeft") {
        if (currentStepIndex > 0) prevStep(navigate);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTourActive, isInteractionEnabled, currentStepIndex, nextStep, prevStep, skipTour, navigate]);

  // Calculate card position without overlap using visible index
  const getCardStyle = () => {
    const currentStepObj = ADMIN_TOUR_STEPS[visibleStepIndex];
    if (!targetRect || !currentStepObj) {
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

    const preferredPos = currentStepObj.placement || "right";

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
    const currentStepObj = ADMIN_TOUR_STEPS[visibleStepIndex];
    if (!currentStepObj?.targetSelector || !targetRect) return null;

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
    const currentStepObj = ADMIN_TOUR_STEPS[visibleStepIndex];
    if (!currentStepObj?.messageText) return null;

    let bgClass = "bg-blue-50/80 border-blue-200/80 text-blue-900";
    let iconClass = "text-blue-600";
    let IconComponent = Info;

    if (currentStepObj.messageType === "tip") {
      bgClass = "bg-green-50/80 border-green-200/80 text-green-900";
      iconClass = "text-green-600";
      IconComponent = Lightbulb;
    } else if (currentStepObj.messageType === "warning") {
      bgClass = "bg-amber-50/80 border-amber-200/80 text-amber-900";
      iconClass = "text-amber-600";
      IconComponent = AlertTriangle;
    }

    return (
      <div className={`flex items-start gap-2.5 p-3 rounded-2xl border ${bgClass} mb-4 text-xs`}>
        <IconComponent className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`} />
        <div className="flex-1 min-w-0">
          {currentStepObj.messageTitle && (
            <p className="font-bold text-[11px] uppercase tracking-wider mb-0.5">{currentStepObj.messageTitle}</p>
          )}
          <p className="leading-relaxed">{currentStepObj.messageText}</p>
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

  if (!isTourActive) return null;

  const currentStep = ADMIN_TOUR_STEPS[visibleStepIndex] || ADMIN_TOUR_STEPS[0];
  const isFinalStep = visibleStepIndex === totalSteps - 1;

  const portalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={currentStep.title}
      aria-describedby="admin-tour-step-description"
      className="connected-tour-portal-root font-sans"
    >
      {/* 1. Dark Backdrop Overlay / Spotlight Cutout Box (z-index: 960) */}
      {targetRect ? (
        <div
          className="fixed pointer-events-none z-[960]"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            borderRadius: `${(parseFloat(targetRect.borderRadius) || 16) + 6}px`,
            boxShadow:
              "0 0 0 9999px rgba(0, 0, 0, 0.65), 0 0 0 3px #22c55e, 0 0 25px rgba(34, 197, 94, 0.5)",
            willChange: "top, left, width, height, opacity",
            opacity: spotlightOpacity,
            transition: "top 300ms cubic-bezier(0.16, 1, 0.3, 1), left 300ms cubic-bezier(0.16, 1, 0.3, 1), width 300ms cubic-bezier(0.16, 1, 0.3, 1), height 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-out",
          }}
        />
      ) : (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[900] transition-opacity duration-200" 
          style={{ opacity: spotlightOpacity }}
        />
      )}

      {/* 2. Tour Tooltip Popover Card (z-index: 1000) */}
      <div
        ref={cardRef}
        style={{
          ...getCardStyle(),
          willChange: "top, left, opacity",
          opacity: modalOpacity,
          transition: "top 300ms cubic-bezier(0.16, 1, 0.3, 1), left 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out",
        }}
        className={`z-[1000] w-full max-w-sm relative ${isInteractionEnabled ? "" : "pointer-events-none"}`}
      >
        {/* Pointer Arrow Tooltip Tip */}
        {renderPointerArrow()}

        {/* Card Body Container */}
        <div className="bg-white/98 backdrop-blur-xl rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3),0_0_30px_rgba(34,197,94,0.15)] border border-gray-200/80 max-h-[calc(100vh-32px)] overflow-y-auto no-scrollbar p-6">
          {/* Header Badges */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-green-50 text-green-700 border border-green-200/80 shadow-2xs">
                <Sparkles className="w-3 h-3 text-green-600" />
                Admin System Tour
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-teal-50 text-teal-700 border border-teal-200/80 shadow-2xs">
                Step {visibleStepIndex + 1} of {totalSteps}
              </span>
            </div>

            <button
              type="button"
              disabled={!isInteractionEnabled}
              onClick={(e) => {
                handleExitAllTours(e);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/50 cursor-pointer disabled:opacity-50"
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
                  i === visibleStepIndex
                    ? "w-6 bg-gradient-to-r from-green-500 to-teal-500 shadow-sm"
                    : i < visibleStepIndex
                    ? "w-2 bg-green-500/60"
                    : "w-2 bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* Step Title & Description */}
          <h3 className="text-lg font-bold text-gray-900 tracking-tight mb-2">
            {currentStep.title}
          </h3>
          <p id="admin-tour-step-description" className="text-gray-600 text-xs leading-relaxed mb-4 whitespace-pre-line">
            {currentStep.description}
          </p>

          {/* Information Panel Badge */}
          {renderMessageBadge()}

          {/* Hotkey tip */}
          <div className="flex items-center gap-1.5 mb-4 text-[10px] text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
            <Command className="w-3 h-3 text-gray-400" />
            <span>Use <kbd className="px-1 bg-white rounded border border-gray-200 text-gray-600 font-mono">←</kbd> <kbd className="px-1 bg-white rounded border border-gray-200 text-gray-600 font-mono">→</kbd> to navigate, <kbd className="px-1 bg-white rounded border border-gray-200 text-gray-600 font-mono">Esc</kbd> to exit</span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={!isInteractionEnabled}
              onClick={(e) => {
                handleExitAllTours(e);
              }}
              className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              Exit Tour
            </button>

            <div className="flex items-center gap-2">
              {visibleStepIndex > 0 && (
                <button
                  type="button"
                  disabled={!isInteractionEnabled}
                  onClick={() => prevStep(navigate)}
                  className="px-3 py-2 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}

              <button
                type="button"
                disabled={!isInteractionEnabled}
                onClick={() => (isFinalStep ? finishTour() : nextStep(navigate))}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-teal-700 active:scale-[0.98] shadow-md shadow-green-600/20 transition-all text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>{currentStep.finishButtonText || (isFinalStep ? "Finish" : "Next")}</span>
                {isFinalStep ? (
                  <CheckCircle2 className="w-4 h-4 ml-0.5" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(portalContent, document.body);
}
