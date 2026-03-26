import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
function CustomDropdown({ value, onChange, options, placeholder = "Select...", label }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find((opt) => opt.value === value);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };
  return <div ref={dropdownRef} className="relative">
      {label && <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}
      
      <button
    type="button"
    onClick={() => setIsOpen(!isOpen)}
    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 hover:bg-white transition-all duration-200 text-left cursor-pointer group relative"
  >
        <div className={`pr-10 ${selectedOption ? "text-gray-900 font-medium" : "text-gray-500"}`}>
          {selectedOption ? <div>
              <div className="font-medium text-gray-900">{selectedOption.label}</div>
              {selectedOption.sublabel && <div className="text-sm text-gray-500 mt-0.5">{selectedOption.sublabel}</div>}
            </div> : placeholder}
        </div>
        <div className={`absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
        </div>
      </button>

      {isOpen && <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden animate-slideDown">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((option) => <button
    key={option.value}
    type="button"
    onClick={() => handleSelect(option.value)}
    disabled={!option.value}
    className={`w-full px-4 py-3 text-left transition-all duration-150 flex items-center justify-between group ${!option.value ? "bg-gray-50 text-gray-400 cursor-not-allowed" : option.value === value ? "bg-emerald-50 text-emerald-700 font-medium" : "hover:bg-gray-50 text-gray-900"}`}
  >
                <div className="flex-1">
                  <div className={`${option.value === value ? "font-semibold" : "font-medium"}`}>
                    {option.label}
                  </div>
                  {option.sublabel && <div className={`text-sm mt-0.5 ${option.value === value ? "text-emerald-600" : "text-gray-500"}`}>
                      {option.sublabel}
                    </div>}
                </div>
                {option.value === value && <Check className="w-5 h-5 text-emerald-600 animate-scaleIn" />}
              </button>)}
          </div>
        </div>}
    </div>;
}
export {
  CustomDropdown
};
