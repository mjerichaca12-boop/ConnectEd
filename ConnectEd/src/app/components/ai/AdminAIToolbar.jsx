import {
  BarChart2,
  Megaphone,
  Mail,
  ClipboardList,
  Calendar,
  UserCheck,
  FileText,
  Lightbulb,
  BookOpen,
} from "lucide-react";

const QUICK_ACTIONS = [
  { key: "systemSummary",       label: "System Summary",      icon: BarChart2 },
  { key: "draftAnnouncement",   label: "Draft Announcement",  icon: Megaphone },
  { key: "accessRequestTemplate", label: "Access Templates", icon: Mail },
  { key: "enrollmentReport",    label: "Enrollment Report",   icon: ClipboardList },
  { key: "calendarEvent",       label: "Calendar Event",      icon: Calendar },
  { key: "teacherEvaluation",   label: "Teacher Evaluation",  icon: UserCheck },
  { key: "parentLetter",        label: "Parent Letter",       icon: FileText },
  { key: "dataInsights",        label: "Data Insights",       icon: Lightbulb },
  { key: "subjectReport",       label: "Subject Report",      icon: BookOpen },
];

export function AdminAIToolbar({ onAction, isStreaming }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-3">
        Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onAction(key)}
            disabled={isStreaming}
            className="flex flex-col items-center gap-1.5 p-3 bg-white 
                       hover:bg-green-50 border border-gray-200 
                       hover:border-green-300 rounded-xl text-center 
                       transition-all duration-200 cursor-pointer group
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon className="w-5 h-5 text-gray-400 group-hover:text-green-600 
                             transition-colors" />
            <span className="text-gray-600 group-hover:text-green-700 
                             text-xs font-medium transition-colors leading-tight">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
