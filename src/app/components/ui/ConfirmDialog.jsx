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
  const iconColor = type === "danger" ? "text-red-500" : type === "warning" ? "text-red-500" : "text-emerald-500";
  const confirmButtonClass = type === "danger" || type === "warning" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700";
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full transform animate-scaleIn border border-white/10 overflow-hidden">
        {
    /* Header */
  }
        <div className="flex items-start justify-between p-6 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${type === "danger" || type === "warning" ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
              <AlertTriangle className={`w-6 h-6 ${iconColor}`} />
            </div>
            <h3 className="text-xl font-semibold text-white">{title}</h3>
          </div>
          <button
    onClick={onClose}
    className="text-gray-400 hover:text-white transition-colors"
  >
            <X className="w-5 h-5" />
          </button>
        </div>

        {
    /* Body */
  }
        <div className="p-6">
          <p className="text-gray-300 leading-relaxed">{message}</p>
        </div>

        {
    /* Footer */
  }
        <div className="flex items-center justify-end gap-3 p-6 bg-black/40 rounded-b-2xl border-t border-white/5">
          <button
    onClick={onClose}
    className="px-6 py-2.5 text-gray-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all duration-200 font-medium"
  >
            {cancelText}
          </button>
          <button
    onClick={handleConfirm}
    className={`px-6 py-2.5 text-white rounded-xl transition-all duration-200 font-medium shadow-lg ${confirmButtonClass}`}
  >
            {confirmText}
          </button>
        </div>
      </div>
    </div>;
}
export {
  ConfirmDialog
};
