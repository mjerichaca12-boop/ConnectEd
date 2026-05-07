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
    ? "bg-red-600 hover:bg-red-700 shadow-red-600/20 text-gray-900"
    : "bg-green-600 hover:bg-green-700 shadow-green-600/20 text-gray-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-50 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${iconBg}`}>
            <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 flex-1">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-gray-600 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm shadow-sm ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmDialog };
