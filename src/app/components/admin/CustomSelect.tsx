import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function CustomSelect({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Select option',
  icon,
  className = ''
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-3 px-4 py-3 
          bg-white border rounded-lg transition-all duration-200
          ${isOpen 
            ? 'border-emerald-500 ring-2 ring-emerald-500 ring-opacity-20 shadow-md' 
            : 'border-gray-300 hover:border-emerald-400 hover:shadow-sm'
          }
        `}
      >
        <div className="flex items-center gap-3 flex-1">
          {icon && (
            <div className={`transition-colors ${isOpen ? 'text-emerald-600' : 'text-gray-500'}`}>
              {icon}
            </div>
          )}
          {selectedOption ? (
            <div className="flex items-center gap-2">
              {selectedOption.icon && (
                <span className="flex-shrink-0">{selectedOption.icon}</span>
              )}
              <span className="text-gray-900 font-medium">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        
        <ChevronDown 
          className={`w-5 h-5 transition-all duration-300 flex-shrink-0 ${
            isOpen 
              ? 'rotate-180 text-emerald-600' 
              : 'rotate-0 text-gray-400'
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {options.map((option, index) => {
              const isSelected = option.value === value;
              
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full flex items-center justify-between gap-3 px-4 py-3 
                    transition-all duration-150
                    ${isSelected 
                      ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600' 
                      : 'hover:bg-gray-50 border-l-4 border-transparent text-gray-700 hover:text-gray-900'
                    }
                    ${index !== 0 ? 'border-t border-gray-100' : ''}
                  `}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {option.icon && (
                      <span className={`flex-shrink-0 transition-transform ${
                        isSelected ? 'scale-110' : 'scale-100'
                      }`}>
                        {option.icon}
                      </span>
                    )}
                    <span className={`font-medium ${isSelected ? 'text-emerald-700' : ''}`}>
                      {option.label}
                    </span>
                    {option.badge && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        isSelected 
                          ? 'bg-emerald-200 text-emerald-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {option.badge}
                      </span>
                    )}
                  </div>
                  
                  {isSelected && (
                    <Check className="w-5 h-5 text-emerald-600 animate-in zoom-in duration-200" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
