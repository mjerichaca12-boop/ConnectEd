const TEACHER_ACTIONS = [
  {
    icon: "📝",
    label: "Quiz",
    prompt: (s) =>
      `Create a ${s.difficulty} ${s.itemCount}-item quiz for Grade ${s.gradeLevel} ${s.subject} in ${s.language}.`,
  },
  {
    icon: "📋",
    label: "DLL Lesson Plan",
    prompt: (s) =>
      `Create a detailed Daily Lesson Log (DLL) for Grade ${s.gradeLevel} ${s.subject} following the DepEd format in ${s.language}.`,
  },
  {
    icon: "📊",
    label: "Rubric",
    prompt: (s) =>
      `Create an assessment rubric for Grade ${s.gradeLevel} ${s.subject} in ${s.language}.`,
  },
  {
    icon: "📖",
    label: "Summarize",
    prompt: () =>
      `Please summarize the uploaded materials in a clear and concise way suitable for the specified grade level.`,
  },
  {
    icon: "✉️",
    label: "Parent Letter",
    prompt: (s) =>
      `Write a professional parent communication letter in ${s.language} for Grade ${s.gradeLevel} ${s.subject}.`,
  },
  {
    icon: "🌐",
    label: "Translate",
    prompt: (s) =>
      `Translate the uploaded content to ${s.language === "English" ? "Filipino" : "English"}.`,
  },
];

const STUDENT_ACTIONS = [
  {
    icon: "💡",
    label: "Explain",
    prompt: (s) =>
      `Explain the key concepts from the uploaded materials for Grade ${s.gradeLevel} in ${s.language}. Use simple terms.`,
  },
  {
    icon: "📝",
    label: "Practice Quiz",
    prompt: (s) =>
      `Generate a ${s.itemCount}-item practice quiz based on my materials to help me study.`,
  },
  {
    icon: "📖",
    label: "Summarize",
    prompt: () =>
      `Summarize my class materials into the most important points I need to remember.`,
  },
  {
    icon: "📋",
    label: "Study Guide",
    prompt: (s) =>
      `Create a step-by-step study guide for Grade ${s.gradeLevel} ${s.subject} based on my materials.`,
  },
  {
    icon: "❓",
    label: "Ask Question",
    prompt: () =>
      `I have a question about the lesson: `,
  },
  {
    icon: "🌐",
    label: "Translate",
    prompt: (s) =>
      `Translate my notes/materials to ${s.language === "English" ? "Filipino" : "English"}.`,
  },
];

export function AIToolbar({ setInputText, settings, inputRef, role = "teacher" }) {
  const actions = role === "student" ? STUDENT_ACTIONS : TEACHER_ACTIONS;
  
  const handleAction = (action) => {
    setInputText(action.prompt(settings));
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div>
      <h3 className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">⚡ Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleAction(action)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-green-50 hover:border-green-300 rounded-xl text-left transition-colors group"
          >
            <span className="text-base">{action.icon}</span>
            <span className="text-xs text-gray-700 group-hover:text-green-700 font-medium">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
