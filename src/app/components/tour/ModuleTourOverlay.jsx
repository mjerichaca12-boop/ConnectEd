import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Info,
  Lightbulb,
  Bell,
  AlertTriangle,
  Award,
  Command,
  Loader2,
} from "lucide-react";
import { useModuleTour } from "../../context/ModuleTourContext";

export function ModuleTourOverlay() {
  const {
    isTourActive,
    isPreparingTour,
    activeConfig,
    currentStep,
    currentStepIndex,
    totalSteps,
    isFinalStep,
    nextStep,
    prevStep,
    skipTour,
  } = useModuleTour();

  const [targetRect, setTargetRect] = useState(null);
  const [activeDirection, setActiveDirection] = useState("bottom");
  const [arrowOffsetPx, setArrowOffsetPx] = useState(50);
  const [, setForceUpdate] = useState(0);
  const cardRef = useRef(null);

  // Clear previous highlighted targets & sidebar elevation
  const clearActiveHighlights = useCallback(() => {
    document.querySelectorAll(".tour-active-target, .connected-tour-target-active").forEach((el) => {
      el.classList.remove("tour-active-target", "connected-tour-target-active");
    });
    document.querySelectorAll(".connected-tour-sidebar-elevated").forEach((el) => {
      el.classList.remove("connected-tour-sidebar-elevated");
    });
  }, []);

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
      // Elevate sidebar parent if active target is sidebar itself or inside sidebar
      const sidebarEl = document.querySelector('[data-tour="sidebar"]');
      if (sidebarEl && (sidebarEl === el || sidebarEl.contains(el))) {
        sidebarEl.classList.add("connected-tour-sidebar-elevated");
      }

      // Elevate active target element to z-index: 950
      el.classList.add("tour-active-target", "connected-tour-target-active");

      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });

      // Scroll target into view if outside viewport, if table, or if insufficient popover clearance
      if (currentStep.targetSelector !== '[data-tour="sidebar"]') {
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
        if (prefPlacement === "bottom" && !hasEnoughSpaceBelow) {
          needsScroll = true;
        } else if (prefPlacement === "top" && !hasEnoughSpaceAbove) {
          needsScroll = true;
        }

        if (needsScroll) {
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });

          let scrollFrames = 0;
          const pollScrollRect = () => {
            const updatedRect = el.getBoundingClientRect();
            setTargetRect({
              top: updatedRect.top,
              left: updatedRect.left,
              width: updatedRect.width,
              height: updatedRect.height,
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

  // Handle step changes, window resize, scroll, and DOM readiness retries
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

  // Clean up highlights when tour deactivates
  useEffect(() => {
    if (!isTourActive) {
      clearActiveHighlights();
    }
  }, [isTourActive, clearActiveHighlights]);

  // Keyboard navigation & accessibility focus trap
  useEffect(() => {
    if (!isTourActive) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTourActive, nextStep, prevStep, skipTour]);

  if (!isTourActive || !currentStep) return null;

  // Render contextual message box badge
  const renderMessageBadge = () => {
    const type = currentStep.messageType || "info";
    const title = currentStep.messageTitle;
    const text = currentStep.messageText;

    if (!text) return null;

    const badgeConfigs = {
      info: {
        bg: "bg-blue-50/90 border-blue-200 text-blue-800",
        icon: <Info className="w-4 h-4 text-blue-600 shrink-0" />,
        label: title || "Information",
      },
      tip: {
        bg: "bg-amber-50/90 border-amber-200 text-amber-900",
        icon: <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />,
        label: title || "Pro Tip",
      },
      reminder: {
        bg: "bg-purple-50/90 border-purple-200 text-purple-900",
        icon: <Bell className="w-4 h-4 text-purple-600 shrink-0" />,
        label: title || "Reminder",
      },
      warning: {
        bg: "bg-red-50/90 border-red-200 text-red-900",
        icon: <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />,
        label: title || "Warning",
      },
      best_practice: {
        bg: "bg-emerald-50/90 border-emerald-200 text-emerald-900",
        icon: <Award className="w-4 h-4 text-emerald-600 shrink-0" />,
        label: title || "Best Practice",
      },
    };

    const cfg = badgeConfigs[type] || badgeConfigs.info;

    return (
      <div className={`p-3 rounded-2xl border ${cfg.bg} mb-4 transition-all duration-200`}>
        <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
          {cfg.icon}
          <span>{cfg.label}</span>
        </div>
        <p className="text-[11px] leading-relaxed opacity-90">{text}</p>
      </div>
    );
  };

  // Calculate strict non-overlapping card placement style & dynamic arrow alignment
  const getCardStyle = () => {
    if (!currentStep.targetSelector) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        position: "fixed",
      };
    }

    if (!targetRect) {
      return {
        top: "80px",
        left: "280px",
        position: "fixed",
      };
    }

    const gap = 18;
    const cardWidth = 380;
    const cardHeight = cardRef.current ? Math.max(220, cardRef.current.offsetHeight) : 260;
    const vWidth = window.innerWidth;
    const vHeight = window.innerHeight;

    // Target center coordinates
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    // Wide Table Target detection
    const isWideTableTarget = targetRect.height > 150 && targetRect.width > vWidth * 0.5;

    let preferred = currentStep.placement;

    // Intelligent auto-detection of optimal non-overlapping direction
    if (!preferred || isWideTableTarget) {
      if (isWideTableTarget) {
        preferred = "top";
      } else if (targetCenterY > vHeight * 0.6) {
        preferred = "top";
      } else {
        preferred = "bottom";
      }
    }

    // Target bounding box with safety clearance
    const tTop = targetRect.top - gap;
    const tBottom = targetRect.top + targetRect.height + gap;
    const tLeft = targetRect.left - gap;
    const tRight = targetRect.left + targetRect.width + gap;

    // Center alignment offsets
    const centeredTopForSide = Math.max(16, Math.min(targetRect.top + targetRect.height / 2 - cardHeight / 2, vHeight - cardHeight - 16));
    const centeredLeftForVertical = Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - cardWidth / 2, vWidth - cardWidth - 16));

    // Mathematical overlap test function
    const checkOverlap = (l, t) => {
      const rLeft = l;
      const rRight = l + cardWidth;
      const rTop = t;
      const rBottom = t + cardHeight;
      const noOverlap = rRight <= tLeft || rLeft >= tRight || rBottom <= tTop || rTop >= tBottom;
      return !noOverlap;
    };

    // Candidate position options in all 4 directions with centered alignment
    const candidates = {
      top: {
        dir: "top",
        top: Math.max(16, tTop - cardHeight),
        left: centeredLeftForVertical,
      },
      bottom: {
        dir: "bottom",
        top: tBottom,
        left: centeredLeftForVertical,
      },
      right: {
        dir: "right",
        top: centeredTopForSide,
        left: tRight,
      },
      left: {
        dir: "left",
        top: centeredTopForSide,
        left: tLeft - cardWidth,
      },
    };

    // Direction fallback sequence
    const order = isWideTableTarget ? ["top", "bottom"] : [preferred];
    if (!isWideTableTarget) {
      if (preferred === "bottom") order.push("top", "right", "left");
      else if (preferred === "top") order.push("bottom", "right", "left");
      else if (preferred === "right") order.push("bottom", "top", "left");
      else if (preferred === "left") order.push("bottom", "top", "right");
    }

    let chosenPos = null;

    for (const dir of order) {
      if (!dir) continue;
      const pos = candidates[dir];
      const fitsViewport =
        pos.top >= 10 &&
        pos.top + cardHeight <= vHeight - 10 &&
        pos.left >= 10 &&
        pos.left + cardWidth <= vWidth - 10;

      const overlaps = checkOverlap(pos.left, pos.top);

      if (fitsViewport && !overlaps) {
        chosenPos = pos;
        break;
      }
    }

    // Strict Non-Overlapping Fallback Solver for Tables & Cards
    if (!chosenPos) {
      if (isWideTableTarget) {
        const spaceAbove = tTop;
        const spaceBelow = vHeight - tBottom;

        if (spaceAbove >= cardHeight || spaceAbove >= spaceBelow) {
          chosenPos = {
            dir: "top",
            top: Math.max(16, tTop - cardHeight),
            left: centeredLeftForVertical,
          };
        } else {
          chosenPos = {
            dir: "bottom",
            top: Math.min(tBottom, vHeight - cardHeight - 16),
            left: centeredLeftForVertical,
          };
        }
      } else {
        const spaceBelow = vHeight - tBottom;
        const spaceAbove = tTop;
        const spaceLeft = tLeft;
        const spaceRight = vWidth - tRight;

        if (spaceLeft >= cardWidth + 16) {
          chosenPos = {
            dir: "left",
            top: centeredTopForSide,
            left: tLeft - cardWidth,
          };
        } else if (spaceRight >= cardWidth + 16) {
          chosenPos = {
            dir: "right",
            top: centeredTopForSide,
            left: tRight,
          };
        } else if (spaceBelow >= cardHeight || spaceBelow >= spaceAbove) {
          chosenPos = {
            dir: "bottom",
            top: Math.min(tBottom, vHeight - cardHeight - 10),
            left: centeredLeftForVertical,
          };
        } else {
          chosenPos = {
            dir: "top",
            top: Math.max(10, tTop - cardHeight),
            left: centeredLeftForVertical,
          };
        }
      }
    }

    // Determine exact arrow pointing direction based on actual target vs card center position
    let actualArrowDir = chosenPos.dir;
    const cardTop = chosenPos.top;
    const cardLeft = chosenPos.left;
    const cardCenterX = cardLeft + cardWidth / 2;
    const cardCenterY = cardTop + cardHeight / 2;

    if (Math.abs(targetCenterY - cardCenterY) > Math.abs(targetCenterX - cardCenterX)) {
      // Target is vertically offset relative to card center
      if (targetCenterY < cardTop + 20) {
        actualArrowDir = "bottom"; // Target is above card -> Arrow on TOP edge of card pointing UP
      } else if (targetCenterY > cardTop + cardHeight - 20) {
        actualArrowDir = "top"; // Target is below card -> Arrow on BOTTOM edge of card pointing DOWN
      }
    } else {
      // Target is horizontally offset relative to card center
      if (targetCenterX < cardLeft + 20) {
        actualArrowDir = "right"; // Target is to left of card -> Arrow on LEFT edge of card pointing LEFT
      } else if (targetCenterX > cardLeft + cardWidth - 20) {
        actualArrowDir = "left"; // Target is to right of card -> Arrow on RIGHT edge of card pointing RIGHT
      }
    }

    // Compute dynamic pointer arrow position along card edge pointing 100% directly at target center
    let calculatedArrowPx = 50;
    if (actualArrowDir === "left" || actualArrowDir === "right") {
      const relY = targetCenterY - chosenPos.top;
      calculatedArrowPx = Math.max(28, Math.min(relY, cardHeight - 28));
    } else {
      const relX = targetCenterX - chosenPos.left;
      calculatedArrowPx = Math.max(28, Math.min(relX, cardWidth - 28));
    }

    if (activeDirection !== actualArrowDir) {
      setActiveDirection(actualArrowDir);
    }
    if (arrowOffsetPx !== calculatedArrowPx) {
      setArrowOffsetPx(calculatedArrowPx);
    }

    return {
      top: `${Math.max(10, chosenPos.top)}px`,
      left: `${Math.max(10, chosenPos.left)}px`,
      position: "fixed",
    };
  };

  const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  // Render dynamic callout arrow at z-index: 995 pointing 100% directly at target content center
  const renderPointerArrow = () => {
    if (!currentStep.targetSelector || !targetRect) return null;

    if (activeDirection === "right") {
      return (
        <div
          style={{ top: `${arrowOffsetPx}px` }}
          className="absolute -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-l border-b border-gray-200/80 rotate-45 z-[995] shadow-2xs transition-all duration-150"
        />
      );
    } else if (activeDirection === "left") {
      return (
        <div
          style={{ top: `${arrowOffsetPx}px` }}
          className="absolute -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-r border-t border-gray-200/80 rotate-45 z-[995] shadow-2xs transition-all duration-150"
        />
      );
    } else if (activeDirection === "bottom") {
      return (
        <div
          style={{ left: `${arrowOffsetPx}px` }}
          className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-gray-200/80 rotate-45 z-[995] shadow-2xs transition-all duration-150"
        />
      );
    } else if (activeDirection === "top") {
      return (
        <div
          style={{ left: `${arrowOffsetPx}px` }}
          className="absolute -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-200/80 rotate-45 z-[995] shadow-2xs transition-all duration-150"
        />
      );
    }
    return null;
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
      aria-describedby="tour-step-description"
      className="connected-tour-portal-root font-sans"
    >
      {/* 1. Dark Backdrop Overlay / Spotlight Cutout Box (z-index: 900 / 960) */}
      {targetRect ? (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out z-[960]"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            borderRadius: "12px",
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
        className="z-[1000] w-full max-w-sm bg-white backdrop-blur-md rounded-3xl shadow-2xl border border-gray-100/80 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) animate-in zoom-in-95 relative"
      >
        {/* Callout Pointer Arrow (z-index: 995) */}
        {renderPointerArrow()}

        <div className="p-6">
          {/* Top Header - Aligned Badges on Same Baseline */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-gray-100 text-gray-700 border border-gray-200/80 shadow-2xs">
                {activeConfig?.moduleTitle || "Module Tour"}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-green-50 text-green-700 border border-green-200/80 shadow-2xs">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                skipTour();
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

          {/* Step Title & Description */}
          <h3 className="text-lg font-bold text-gray-900 tracking-tight mb-2">
            {currentStep.title}
          </h3>
          <p id="tour-step-description" className="text-gray-600 text-xs leading-relaxed mb-4 whitespace-pre-line">
            {currentStep.description}
          </p>

          {/* Mini Information Panel Badge */}
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                skipTour();
              }}
              className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors cursor-pointer"
            >
              Exit Tour
            </button>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  onClick={prevStep}
                  className="px-3 py-2 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-xs flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}

              <button
                onClick={nextStep}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-teal-700 active:scale-[0.98] shadow-md shadow-green-600/20 transition-all text-xs flex items-center gap-1"
              >
                <span>{isFinalStep ? "Finish" : "Next"}</span>
                {isFinalStep ? <CheckCircle2 className="w-4 h-4 ml-0.5" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(portalContent, document.body);
}
