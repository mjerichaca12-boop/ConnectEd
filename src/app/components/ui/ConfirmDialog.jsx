import { AlertTriangle, X } from "lucide-react";

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning"
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const iconColor = type === "danger" || type === "warning" ? "text-red-500" : "text-green-500";
  const iconBg = type === "danger" || type === "warning" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200";
  const confirmButtonClass = type === "danger" || type === "warning"
    ? "bg-red-600 hover:bg-red-700 text-white"
    : "bg-green-600 hover:bg-green-700 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${iconBg}`}>
              <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex-1 overflow-y-auto">
          <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors shadow-sm ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmDialog };
