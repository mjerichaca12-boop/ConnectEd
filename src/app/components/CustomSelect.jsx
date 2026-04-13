import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
function CustomSelect({ value, onChange, options, placeholder, label, icon, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);
  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };
  return <div className={`relative ${className}`} ref={dropdownRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full rounded-2xl border-2 px-4 py-4 text-left transition-all duration-200 flex items-center justify-between gap-4 bg-slate-950/90 shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${isOpen ? "border-emerald-400/80 ring-2 ring-emerald-400/20" : "border-emerald-400/70 hover:border-emerald-300"}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon && <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-colors ${isOpen ? "text-emerald-300" : ""}`}>
              {icon}
            </span>}
          <span className={`min-w-0 truncate text-lg font-semibold tracking-tight ${selectedOption ? "text-white" : "text-gray-400"}`}>
            {selectedOption?.label || placeholder || "Select an option"}
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 flex-shrink-0 text-emerald-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && <div className="absolute z-50 w-full mt-2 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-60 overflow-y-auto scrollbar-hide">
            {options.map((option, index) => {
    const isSelected = String(option.value) === String(value);
    return <button
      key={option.value}
      type="button"
      onClick={() => handleSelect(option.value)}
      className={`w-full px-4 py-4 flex items-center justify-between gap-3 text-left transition-all duration-150 ${isSelected ? "bg-emerald-500/15 text-emerald-400 border-l-4 border-emerald-500" : "text-slate-100 hover:bg-white/5 border-l-4 border-transparent"} ${index !== 0 ? "border-t border-slate-800" : ""}`}
    >
                  <span className={`text-sm font-semibold ${isSelected ? "text-emerald-400" : "text-slate-100"}`}>
                    {option.label}
                  </span>
                  {isSelected && <Check className="w-5 h-5 flex-shrink-0 text-emerald-400" />}
                </button>;
  })}
          </div>
        </div>}
    </div>;
}
export {
  CustomSelect
};
