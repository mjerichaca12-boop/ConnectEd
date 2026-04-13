import { useState, useRef, useEffect } from "react";
import { ChevronDown, GraduationCap, BookOpen, Shield } from "lucide-react";
const roles = [
  { value: "student", label: "Student", icon: GraduationCap, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  { value: "teacher", label: "Teacher", icon: BookOpen, color: "text-blue-600", bgColor: "bg-blue-50" },
  { value: "administrator", label: "Administrator", icon: Shield, color: "text-red-600", bgColor: "bg-red-50" }
];
function RoleSelector({
  value,
  onChange,
  label,
  required = false,
  allowedRoles,
  accentColor = "emerald"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const availableRoles = allowedRoles ? roles.filter((role) => allowedRoles.includes(role.value)) : roles;
  const selectedRole = availableRoles.find((role) => role.value === value);
  const borderColor = accentColor === "blue" ? "border-blue-500" : "border-emerald-500";
  const ringColor = accentColor === "blue" ? "ring-blue-500" : "ring-emerald-500";
  const hoverBorderColor = accentColor === "blue" ? "hover:border-blue-400" : "hover:border-emerald-400";
  const selectedBgColor = accentColor === "blue" ? "bg-blue-50 border-blue-500" : "bg-emerald-50 border-emerald-500";
  const selectedTextColor = accentColor === "blue" ? "text-blue-700" : "text-emerald-700";
  const chevronColor = accentColor === "blue" ? "text-blue-600" : "text-emerald-600";
  const indicatorBgColor = accentColor === "blue" ? "bg-blue-500" : "bg-emerald-500";
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleSelect = (roleValue) => {
    onChange(roleValue);
    setIsOpen(false);
  };
  return <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>}
      
      <div ref={dropdownRef} className="relative">
        {
    /* Trigger Button */
  }
        <button
    type="button"
    onClick={() => setIsOpen(!isOpen)}
    className={`w-full flex items-center justify-between px-4 py-3 border rounded-lg bg-white transition-all duration-200 
            ${isOpen ? `${borderColor} ring-2 ${ringColor} ring-opacity-50 shadow-md` : `border-gray-300 ${hoverBorderColor} hover:shadow-sm`}`}
  >
          <div className="flex items-center gap-3">
            {selectedRole && <>
                <div className={`p-1.5 rounded-md ${selectedRole.bgColor}`}>
                  <selectedRole.icon className={`w-4 h-4 ${selectedRole.color}`} />
                </div>
                <span className="text-gray-900 font-medium">{selectedRole.label}</span>
              </>}
          </div>
          
          <ChevronDown
    className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isOpen ? `rotate-180 ${chevronColor}` : ""}`}
  />
        </button>

        {
    /* Dropdown Menu */
  }
        {isOpen && <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {availableRoles.map((role) => {
    const Icon = role.icon;
    const isSelected = role.value === value;
    return <button
      key={role.value}
      type="button"
      onClick={() => handleSelect(role.value)}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-150
                    ${isSelected ? `${selectedBgColor} border-l-4` : "hover:bg-gray-50 border-l-4 border-transparent"}`}
    >
                  <div className={`p-2 rounded-md ${role.bgColor} transition-transform duration-200 ${isSelected ? "scale-110" : "scale-100"}`}>
                    <Icon className={`w-5 h-5 ${role.color}`} />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className={`font-medium ${isSelected ? selectedTextColor : "text-gray-900"}`}>
                      {role.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {role.value === "student" && "Access grades, assignments & resources"}
                      {role.value === "teacher" && "Manage classes, grades & curriculum"}
                      {role.value === "administrator" && "Full system access & management"}
                    </div>
                  </div>
                  
                  {isSelected && <div className={`w-2 h-2 rounded-full ${indicatorBgColor} animate-pulse`} />}
                </button>;
  })}
          </div>}
      </div>
    </div>;
}
export {
  RoleSelector
};
