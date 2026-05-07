import { buildQuickPrompt } from "@/app/lib/groqClient";
import { FileEdit, CheckSquare, BookOpen, BarChart3, AlignLeft, Mail, Languages, CheckCircle } from "lucide-react";

export function AIToolbar({ setInputText, settings, inputRef }) {
  const actions = [
    { id: "activity", label: "Generate Activity", icon: FileEdit },
    { id: "quiz", label: "Generate Quiz", icon: CheckSquare },
    { id: "lessonPlan", label: "Lesson Plan", icon: BookOpen },
    { id: "rubric", label: "Make Rubric", icon: BarChart3 },
    { id: "summarize", label: "Summarize", icon: AlignLeft },
    { id: "parentLetter", label: "Parent Letter", icon: Mail },
    { id: "translate", label: "Translate", icon: Languages },
    { id: "examQuestions", label: "Exam Questions", icon: CheckCircle },
  ];

  const handleAction = (id) => {
    const prompt = buildQuickPrompt(id, settings);
    setInputText(prompt);
    // Optional: Auto-submit here, but usually better to let user review
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
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-left text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors shadow-sm"
          >
            <action.icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
