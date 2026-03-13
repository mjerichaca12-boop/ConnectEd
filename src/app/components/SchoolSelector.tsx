import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, MapPin, X } from 'lucide-react';

export interface School {
  id: string;
  name: string;
  location: string;
}

interface SchoolSelectorProps {
  value: School | null;
  onChange: (school: School | null) => void;
  label?: string;
  placeholder?: string;
  schools: School[];
}

export function SchoolSelector({ 
  value, 
  onChange, 
  label, 
  placeholder = "Search for your school...",
  schools 
}: SchoolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredSchools = schools.filter(school =>
    school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    school.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (school: School) => {
    onChange(school);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleTriggerClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <div ref={dropdownRef} className="relative">
        {/* Trigger Button */}
        <div
          onClick={handleTriggerClick}
          className={`w-full flex items-center justify-between px-4 py-4 border rounded-lg bg-white transition-all duration-200 cursor-pointer
            ${isOpen 
              ? 'border-emerald-500 ring-2 ring-emerald-500 ring-opacity-50 shadow-lg' 
              : 'border-gray-300 hover:border-emerald-400 hover:shadow-sm'
            }`}
        >
          <div className="flex-1 min-w-0">
            {value ? (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-50 rounded-md flex-shrink-0">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{value.name}</div>
                  <div className="text-sm text-gray-500 truncate">{value.location}</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>No school selected</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-3">
            {value && (
              <div
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4 text-gray-500" />
              </div>
            )}
            <ChevronDown 
              className={`w-5 h-5 text-gray-500 transition-transform duration-300 flex-shrink-0 ${
                isOpen ? 'rotate-180 text-emerald-600' : ''
              }`} 
            />
          </div>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Search Input */}
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={placeholder}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Schools List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredSchools.length > 0 ? (
                filteredSchools.map((school) => {
                  const isSelected = value?.id === school.id;
                  
                  return (
                    <button
                      key={school.id}
                      type="button"
                      onClick={() => handleSelect(school)}
                      className={`w-full flex items-start gap-3 px-4 py-3 transition-all duration-150 text-left
                        ${isSelected 
                          ? 'bg-emerald-50 border-l-4 border-emerald-500' 
                          : 'hover:bg-gray-50 border-l-4 border-transparent'
                        }`}
                    >
                      <div className={`p-2 rounded-md flex-shrink-0 transition-transform duration-200 ${
                        isSelected 
                          ? 'bg-emerald-100 scale-110' 
                          : 'bg-gray-100'
                      }`}>
                        <MapPin className={`w-4 h-4 ${
                          isSelected ? 'text-emerald-600' : 'text-gray-600'
                        }`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${
                          isSelected ? 'text-emerald-700' : 'text-gray-900'
                        }`}>
                          {school.name}
                        </div>
                        <div className="text-sm text-gray-500 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {school.location}
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0 mt-2"></div>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center text-gray-500">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No schools found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}