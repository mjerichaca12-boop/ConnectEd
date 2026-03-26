import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
function CustomSelect({ value, onChange, options, placeholder, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find((opt) => opt.value === value);
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
  return <div className="relative" ref={dropdownRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>}
      
      {
    /* Select Button */
  }
      <button
    type="button"
    onClick={() => setIsOpen(!isOpen)}
    className={`w-full px-4 py-3 border rounded-lg flex items-center justify-between transition-all duration-200 ${isOpen ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50" : "border-gray-300 hover:border-gray-400 bg-white"}`}
  >
        <span className={selectedOption ? "text-gray-900" : "text-gray-500"}>
          {selectedOption?.label || placeholder || "Select an option"}
        </span>
        <ChevronDown
    className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-emerald-600" : ""}`}
  />
      </button>

      {
    /* Dropdown Menu */
  }
      {isOpen && <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-slideDown">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((option, index) => <button
    key={option.value}
    type="button"
    onClick={() => handleSelect(option.value)}
    className={`w-full px-4 py-3 flex items-center justify-between transition-all duration-150 ${option.value === value ? "bg-emerald-50 text-emerald-700" : "text-gray-900 hover:bg-gray-50"}`}
    style={{
      animationDelay: `${index * 30}ms`
    }}
  >
                <span className="font-medium">{option.label}</span>
                {option.value === value && <Check className="w-5 h-5 text-emerald-600 animate-scaleIn" />}
              </button>)}
          </div>
        </div>}
    </div>;
}
export {
  CustomSelect
};
