import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

function CustomSelect({ value, onChange, options, placeholder, label, icon, className = "", forceOpen = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const showDropdown = isOpen || forceOpen;

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

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full rounded-xl border px-4 py-3 text-left transition-all duration-200 flex items-center justify-between gap-4 shadow-sm ${
          showDropdown 
            ? "bg-white border-green-500 ring-2 ring-green-500/10 shadow-md" 
            : selectedOption
              ? "bg-green-50/80 border-green-200/80 hover:border-green-300"
              : "bg-white border-gray-200 hover:border-green-300 hover:shadow-sm"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon && (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-green-100 bg-green-50 text-green-600 transition-colors ${
              showDropdown ? "bg-green-100 text-green-700" : ""
            }`}>
              {icon}
            </span>
          )}
          <span className={`min-w-0 truncate text-base font-medium tracking-tight ${
            selectedOption ? "text-gray-900" : "text-gray-500"
          }`}>
            {selectedOption?.label || placeholder || "Select an option"}
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 flex-shrink-0 text-gray-400 transition-all duration-200 ${
            showDropdown ? "rotate-180 text-green-600" : ""
          }`}
        />
      </button>

      {showDropdown && (
        <div className="absolute z-50 w-full mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-60 overflow-y-auto scrollbar-hide">
            {options.map((option, index) => {
              const isSelected = String(option.value) === String(value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-all duration-150 ${
                    isSelected 
                      ? "bg-green-50 text-green-700 border-l-4 border-green-500" 
                      : "text-gray-700 hover:bg-green-50/50 border-l-4 border-transparent"
                  } ${index !== 0 ? "border-t border-gray-100" : ""}`}
                >
                  <span className={`text-sm font-semibold ${isSelected ? "text-green-700" : "text-gray-600"}`}>
                    {option.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 flex-shrink-0 text-green-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { CustomSelect };
