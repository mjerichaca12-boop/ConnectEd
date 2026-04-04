import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
function CustomSelect({
  value,
  onChange,
  onBlur,
  options,
  placeholder = "Select option",
  icon,
  className = "",
  multiple = false,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = multiple ? null : options.find((opt) => String(opt.value) === String(value));
  const selectedValues = multiple && Array.isArray(value) ? value : [];
  const selectedOptions = multiple ? options.filter((opt) => selectedValues.some((selectedValue) => String(selectedValue) === String(opt.value))) : [];
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);
  const handleSelect = (optionValue) => {
    if (multiple) {
      const isAlreadySelected = selectedValues.some((selectedValue) => String(selectedValue) === String(optionValue));
      const nextValues = isAlreadySelected
        ? selectedValues.filter((selectedValue) => String(selectedValue) !== String(optionValue))
        : [...selectedValues, optionValue];
      onChange(nextValues);
      return;
    }

    onChange(optionValue);
    setIsOpen(false);
  };
  const triggerContent = multiple
    ? selectedOptions.length > 0
      ? <div className="flex flex-wrap items-center gap-2">
          {selectedOptions.slice(0, 2).map((option) => <span key={option.value} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20">
              {option.label}
            </span>)}
          {selectedOptions.length > 2 && <span className="px-2 py-1 bg-white/10 text-gray-300 text-xs font-medium rounded-full border border-white/10">
              +{selectedOptions.length - 2} more
            </span>}
        </div>
      : <span className="text-gray-500">{placeholder}</span>
    : selectedOption ? <div className="flex items-center gap-2">
        {selectedOption.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
        <span className="text-white font-medium">{selectedOption.label}</span>
        {selectedOption.badge && <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">
            {selectedOption.badge}
          </span>}
      </div> : <span className="text-gray-500">{placeholder}</span>;
  return <div ref={dropdownRef} className={`relative ${className}`}>
      {
    /* Trigger Button */
  }
      <button
    type="button"
    onClick={() => {
      if (!disabled) {
        setIsOpen(!isOpen);
      }
    }}
    onBlur={onBlur}
    disabled={disabled}
    className={`
          w-full flex items-center justify-between gap-3 px-4 py-3 
          bg-black/20 text-white placeholder-gray-500 border rounded-lg transition-all duration-200
          ${disabled ? "cursor-not-allowed opacity-60 border-white/10" : isOpen ? "border-emerald-500 ring-2 ring-emerald-500 ring-opacity-20 shadow-md" : "border-white/20 hover:border-emerald-400 hover:shadow-sm"}
        `}
  >
        <div className="flex items-center gap-3 flex-1">
          {icon && <div className={`transition-colors ${isOpen ? "text-emerald-500" : "text-gray-400"}`}>
              {icon}
            </div>}
          {triggerContent}
        </div>
        
        <ChevronDown
    className={`w-5 h-5 transition-all duration-300 flex-shrink-0 ${disabled ? "text-gray-600" : isOpen ? "rotate-180 text-emerald-500" : "rotate-0 text-gray-400"}`}
  />
      </button>

      {
    /* Dropdown Menu */
  }
      {isOpen && !disabled && <div className="absolute z-50 w-full mt-2 bg-gray-900 border border-white/20 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-64 overflow-y-auto scrollbar-hide">
            {options.map((option, index) => {
    const isSelected = multiple ? selectedValues.some((selectedValue) => String(selectedValue) === String(option.value)) : String(option.value) === String(value);
    return <button
      key={option.value}
      type="button"
      onClick={() => handleSelect(option.value)}
      className={`
                    w-full flex items-center justify-between gap-3 px-4 py-3 
                    transition-all duration-150
                    ${isSelected ? "bg-emerald-500/20 text-emerald-400 border-l-4 border-emerald-500" : "hover:bg-white/5 border-l-4 border-transparent text-gray-300 hover:text-white"}
                    ${index !== 0 ? "border-t border-white/10" : ""}
                  `}
    >
                  <div className="flex items-center gap-2 flex-1">
                    {option.icon && <span className={`flex-shrink-0 transition-transform ${isSelected ? "scale-110" : "scale-100"}`}>
                        {option.icon}
                      </span>}
                    <span className={`font-medium ${isSelected ? "text-emerald-400" : ""}`}>
                      {option.label}
                    </span>
                    {option.badge && <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-gray-400"}`}>
                        {option.badge}
                      </span>}
                  </div>
                  
                  {isSelected && <Check className="w-5 h-5 text-emerald-500 animate-in zoom-in duration-200" />}
                </button>;
  })}
          </div>
        </div>}
    </div>;
}
export {
  CustomSelect
};
