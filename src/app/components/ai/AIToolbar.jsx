import { useState } from "react";
import {
  FileQuestion,
  FileSignature,
  TableProperties,
  Layers,
  CalendarRange,
  BookOpenCheck,
  Target,
  MessagesSquare,
  HelpCircle,
  ClipboardCheck,
  Languages,
  Volume2,
  MailOpen
} from "lucide-react";

const CATEGORIES = [
  { id: "assessments", label: "Assessments" },
  { id: "lesson_prep", label: "Lesson Prep" },
  { id: "student_help", label: "Student Help" },
  { id: "parent_admin", label: "Parent & Admin" }
];

const TEACHER_ACTIONS = [
  // Assessments
  {
    category: "assessments",
    icon: FileQuestion,
    iconColor: "text-emerald-500 bg-emerald-50 border-emerald-100",
    label: "Generate Quiz",
    action: "generateQuiz",
    description: "Generate quizzes (MC, TF, Essay)",
    prompt: (s) =>
      `Generate a ${s.difficulty} ${s.itemCount}-item quiz for Grade ${s.gradeLevel} ${s.subject}${s.section ? ` – Section ${s.section}` : ""} using the uploaded learning materials. Include: ${(s.quizTypes && s.quizTypes.length > 0 ? s.quizTypes : ["Multiple Choice"]).join(", ")}.`,
  },
  {
    category: "assessments",
    icon: FileSignature,
    iconColor: "text-teal-500 bg-teal-50 border-teal-100",
    label: "Generate Assignment",
    action: "generateAssignment",
    description: "Create lesson-based assignments",
    prompt: (s) =>
      `Create a detailed assignment for Grade ${s.gradeLevel} ${s.subject}${s.section ? ` – Section ${s.section}` : ""} based on the uploaded learning materials. Include learning objectives, instructions, and a grading rubric.`,
  },
  {
    category: "assessments",
    icon: TableProperties,
    iconColor: "text-indigo-500 bg-indigo-50 border-indigo-100",
    label: "Grading Rubric",
    action: "rubric",
    description: "Build criteria matrix tables",
    prompt: (s) =>
      `Create a seatwork rubric for Grade ${s.gradeLevel} ${s.subject} in ${s.language}.`,
  },
  {
    category: "assessments",
    icon: Layers,
    iconColor: "text-purple-500 bg-purple-50 border-purple-100",
    label: "Create Flashcards",
    action: "createFlashcards",
    description: "Build interactive flashcard Q&As",
    prompt: (s) =>
      `Create flashcard Q&A pairs for Grade ${s.gradeLevel} ${s.subject} based on the uploaded learning materials.`,
  },

  // Lesson Prep
  {
    category: "lesson_prep",
    icon: CalendarRange,
    iconColor: "text-amber-500 bg-amber-50 border-amber-100",
    label: "DLL Lesson Plan",
    action: "lessonPlan",
    description: "DepEd DLL format logs",
    prompt: (s) =>
      `Create a complete Daily Lesson Log (DLL) for Grade ${s.gradeLevel} ${s.subject}${s.section ? ` – Section ${s.section}` : ""} following the official DepEd DLL format in ${s.language}.`,
  },
  {
    category: "lesson_prep",
    icon: BookOpenCheck,
    iconColor: "text-green-500 bg-green-50 border-green-100",
    label: "Summarize Lesson",
    action: "summarizeLesson",
    description: "Summarize core details",
    prompt: (s) =>
      `Summarize the uploaded learning materials for Grade ${s.gradeLevel} ${s.subject}. Provide a concise summary, key takeaways, important terms, and review questions.`,
  },
  {
    category: "lesson_prep",
    icon: Target,
    iconColor: "text-cyan-500 bg-cyan-50 border-cyan-100",
    label: "Learning Objectives",
    action: "generateObjectives",
    description: "Generate SMART objectives",
    prompt: (s) =>
      `Generate 5–7 SMART learning objectives for Grade ${s.gradeLevel} ${s.subject} based on the uploaded learning materials, aligned with DepEd K-12 competencies.`,
  },
  {
    category: "lesson_prep",
    icon: MessagesSquare,
    iconColor: "text-sky-500 bg-sky-50 border-sky-100",
    label: "Discussion Prompts",
    action: "createDiscussion",
    description: "Build discussion guides",
    prompt: (s) =>
      `Generate discussion questions for Grade ${s.gradeLevel} ${s.subject}${s.section ? ` – Section ${s.section}` : ""} based on the uploaded learning materials.`,
  },

  // Student Help
  {
    category: "student_help",
    icon: HelpCircle,
    iconColor: "text-blue-500 bg-blue-50 border-blue-100",
    label: "Explain Topic",
    action: "explainTopic",
    description: "Simplify concept meanings",
    prompt: (s) =>
      `Explain the main topics in the uploaded materials for Grade ${s.gradeLevel} ${s.subject} students using simple, age-appropriate language.`,
  },
  {
    category: "student_help",
    icon: ClipboardCheck,
    iconColor: "text-violet-500 bg-violet-50 border-violet-100",
    label: "Study Reviewer",
    action: "generateReviewer",
    description: "Build comprehensive guides",
    prompt: (s) =>
      `Create a study reviewer for Grade ${s.gradeLevel} ${s.subject} from the uploaded materials. Include key concepts, review questions, and flashcards.`,
  },
  {
    category: "student_help",
    icon: Languages,
    iconColor: "text-pink-500 bg-pink-50 border-pink-100",
    label: "Translate content",
    action: "translate",
    description: "English / Tagalog translations",
    prompt: (s) =>
      `Translate the uploaded content to ${s.language === "English" ? "Filipino" : "English"}.`,
  },

  // Parent & Admin
  {
    category: "parent_admin",
    icon: Volume2,
    iconColor: "text-orange-500 bg-orange-50 border-orange-100",
    label: "Draft Announcement",
    action: "generateAnnouncement",
    description: "Draft friendly announcements",
    prompt: (s) =>
      `Draft a class announcement for Grade ${s.gradeLevel} ${s.subject}${s.section ? ` – Section ${s.section}` : ""}${s.teacherName ? ` from ${s.teacherName}` : ""}.`,
  },
  {
    category: "parent_admin",
    icon: MailOpen,
    iconColor: "text-rose-500 bg-rose-50 border-rose-100",
    label: "Parent Letter",
    action: "parentLetter",
    description: "Write formal school emails",
    prompt: (s) =>
      `Write a professional parent communication letter in ${s.language} for Grade ${s.gradeLevel} ${s.subject}.`,
  }
];

const STUDENT_ACTIONS = [
  {
    category: "assessments",
    icon: HelpCircle,
    label: "Explain notes",
    action: "explainTopic",
    prompt: (s) =>
      `Explain the key concepts from the uploaded materials for Grade ${s.gradeLevel} in ${s.language}. Use simple terms.`,
  },
  {
    category: "assessments",
    icon: FileQuestion,
    label: "Practice Quiz",
    action: "generateQuiz",
    prompt: (s) =>
      `Generate a ${s.itemCount}-item practice quiz based on my class materials to help me study.`,
  },
  {
    category: "lesson_prep",
    icon: BookOpenCheck,
    label: "Summarize Notes",
    action: "summarizeLesson",
    prompt: () =>
      `Summarize my class materials into the most important points I need to remember.`,
  },
  {
    category: "student_help",
    icon: ClipboardCheck,
    label: "Study Guide",
    action: "generateReviewer",
    prompt: (s) =>
      `Create a step-by-step study guide for Grade ${s.gradeLevel} ${s.subject} based on my materials.`,
  },
  {
    category: "student_help",
    icon: Languages,
    label: "Translate notes",
    action: "translate",
    prompt: (s) =>
      `Translate my notes/materials to ${s.language === "English" ? "Filipino" : "English"}.`,
  },
];

export function AIToolbar({ onActionClick, settings, inputRef, role = "teacher" }) {
  const [activeCategory, setActiveCategory] = useState("assessments");
  const actions = role === "student" ? STUDENT_ACTIONS : TEACHER_ACTIONS;

  const filteredActions = actions.filter((act) => act.category === activeCategory || role === "student");

  const handleAction = (action) => {
    if (onActionClick) {
      onActionClick(action);
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
          <span>⚡</span> Quick Actions
        </h3>
      </div>

      {/* Tabs */}
      {role === "teacher" && (
        <div className="flex gap-1 overflow-x-auto pb-1.5 select-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? "bg-green-600 text-white border-green-600 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Actions Grid */}
      <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-0.5 select-scrollbar">
        {filteredActions.map((action) => {
          const Icon = action.icon || HelpCircle;
          return (
            <button
              key={action.label}
              onClick={() => handleAction(action)}
              className="flex items-start gap-3 p-2.5 bg-white border border-gray-150 hover:bg-green-50/40 hover:border-green-300 rounded-xl text-left transition-all group active:scale-[0.98]"
            >
              <div className={`p-1.5 rounded-lg border flex-shrink-0 flex items-center justify-center ${action.iconColor || "text-green-600 bg-green-50 border-green-100"}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] text-gray-800 font-bold group-hover:text-green-700 leading-tight">
                  {action.label}
                </span>
                {action.description && (
                  <span className="block text-[9px] text-gray-400 font-medium leading-none mt-0.5 truncate">
                    {action.description}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
