import { CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react";

/**
 * Reusable Progress Screen / Modal for Bulk Operations
 * Displays real progress counters, percentages, progress bars,
 * completion summaries, and error/partial failure details.
 */
export function BulkOperationProgressModal({
  isOpen,
  title = "Processing Records",
  status = "Processing your request...",
  current = 0,
  total = 0,
  isIndeterminate = false,
  currentItemName = "",
  isCompleted = false,
  completionMessage = "",
  error = null,
  partialFailure = null,
  onClose,
  onRetry,
}) {
  if (!isOpen) return null;

  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const isFailed = !!error;
  const isPartial = !!partialFailure && partialFailure.failureCount > 0;

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isCompleted
                ? "bg-green-50 text-green-600 border-green-200"
                : isFailed
                ? "bg-red-50 text-red-600 border-red-200"
                : isPartial
                ? "bg-amber-50 text-amber-600 border-amber-200"
                : "bg-green-50 text-green-600 border-green-200"
            }`}>
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isFailed ? (
                <XCircle className="w-5 h-5" />
              ) : isPartial ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">{title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {isCompleted
                  ? "Operation Completed"
                  : isFailed
                  ? "Operation Failed"
                  : isPartial
                  ? "Completed with Errors"
                  : status}
              </p>
            </div>
          </div>
          {(isCompleted || isFailed || isPartial) && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="sr-only">Close</span>
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {/* Active Processing State */}
          {!isCompleted && !isFailed && !isPartial && (
            <>
              {/* Counter & Percentage */}
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span className="text-gray-500">
                  {total > 0 ? `${current} / ${total} processed` : "Processing..."}
                </span>
                {!isIndeterminate && total > 0 && (
                  <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-md font-bold">
                    {percentage}%
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div
                className="w-full bg-gray-100 h-3 rounded-full overflow-hidden p-0.5 border border-gray-200"
                role="progressbar"
                aria-valuenow={isIndeterminate ? undefined : percentage}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                {isIndeterminate ? (
                  <div className="h-full bg-green-600 rounded-full w-full animate-pulse" />
                ) : (
                  <div
                    className="h-full bg-green-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${percentage}%` }}
                  />
                )}
              </div>

              {/* Current Item Name if provided */}
              {currentItemName && (
                <p className="text-xs text-gray-500 truncate text-center italic">
                  {currentItemName}
                </p>
              )}
            </>
          )}

          {/* Success Completed State */}
          {isCompleted && (
            <div className="text-center py-2 space-y-2">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                ✓
              </div>
              <h3 className="text-sm font-bold text-gray-800">
                {completionMessage || `${total} of ${total} records processed successfully.`}
              </h3>
              <p className="text-xs text-gray-500">All changes have been saved to database.</p>
            </div>
          )}

          {/* Partial Failure State */}
          {isPartial && (
            <div className="space-y-3 bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Operation Completed with Errors</span>
              </div>
              <div className="flex justify-between border-t border-amber-200/60 pt-2">
                <span>Successful: <strong>{partialFailure.successCount}</strong></span>
                <span>Failed: <strong>{partialFailure.failureCount}</strong></span>
              </div>
              {partialFailure.failures && partialFailure.failures.length > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-amber-200 text-[11px] text-gray-600 font-mono">
                  {partialFailure.failures.map((f, i) => (
                    <div key={i}>• {f}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Complete Failure State */}
          {isFailed && (
            <div className="text-center py-2 space-y-2">
              <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 font-medium">
                {error}
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50/60 border-t border-gray-100 flex justify-end gap-2">
          {isFailed && onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
          {(isCompleted || isFailed || isPartial) && onClose && (
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-xl transition-all cursor-pointer"
            >
              Done
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
