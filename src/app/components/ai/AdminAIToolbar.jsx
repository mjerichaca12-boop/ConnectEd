import { BarChart3, Megaphone, Mail, BookOpen, Calendar, ClipboardCheck, MessageSquare, Lightbulb, GraduationCap, HelpCircle } from "lucide-react";
import { buildAdminQuickPrompt } from "@/app/lib/adminGroqClient";

export function AdminAIToolbar({ setInputText, platformData, inputRef }) {
  const actions = [
    { id: "systemSummary", label: "System Summary", icon: BarChart3 },
    { id: "draftAnnouncement", label: "Draft Announcement", icon: Megaphone },
    { id: "accessRequestTemplate", label: "Access Templates", icon: Mail },
    { id: "enrollmentReport", label: "Enrollment Report", icon: BookOpen },
    { id: "calendarEvent", label: "Calendar Event", icon: Calendar },
    { id: "teacherEvaluation", label: "Teacher Evaluation", icon: ClipboardCheck },
    { id: "parentLetter", label: "Parent Letter", icon: MessageSquare },
    { id: "dataInsights", label: "Data Insights", icon: Lightbulb },
    { id: "subjectReport", label: "Subject Report", icon: GraduationCap },
  ];

  const handleAction = (id) => {
    const prompt = buildAdminQuickPrompt(id, platformData);
    setInputText(prompt);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-200 rounded-xl text-center transition-all duration-200 cursor-pointer group shadow-sm"
          >
            <action.icon className="w-5 h-5 text-gray-500 group-hover:text-green-600 transition-colors" />
            <span className="text-gray-600 group-hover:text-green-700 text-xs font-medium transition-colors">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
