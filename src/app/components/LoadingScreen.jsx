import React from "react";

/**
 * Standardized full-page loading spinner for teacher pages
 * Uses consistent animation, colors, and text styling
 * 
 * @param {string} message - Loading message to display (default: "Loading...")
 * @returns {JSX.Element}
 */
export function LoadingScreen({ message = "Loading..." }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        {/* Animated bouncing dots spinner */}
        <div className="flex gap-1.5 justify-center mb-4">
          <div
            className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <div
            className="w-3 h-3 rounded-full bg-blue-500 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <div
            className="w-3 h-3 rounded-full bg-red-500 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
        <p className="text-gray-500 text-sm">{message}</p>
      </div>
    </div>
  );
}
