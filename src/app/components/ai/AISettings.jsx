import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { Settings, Sliders, CheckSquare, Sparkles, ChevronDown, BookOpen } from "lucide-react";

const GRADE_LEVELS = ["7","8","9","10"];
const DIFFICULTIES = ["Easy","Medium","Hard"];
const LANGUAGES = ["English","Filipino","Taglish"];
const QUIZ_TYPES = ["Multiple Choice","True/False","Identification","Essay"];

export function AISettings({ settings, setSettings }) {
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const toggleQuizType = (type) => {
    const current = settings.quizTypes || [];
    if (current.includes(type)) {
      if (current.length > 1) update("quizTypes", current.filter(t => t !== type));
    } else {
      update("quizTypes", [...current, type]);
    }
  };

  useEffect(() => {
    const fetchClasses = async () => {
      if (!supabase) return;
      setLoadingClasses(true);
      try {
        const storedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const email = storedUser?.email;
        if (!email) return;

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .limit(1);

        if (!profiles?.length) return;
        const teacherId = profiles[0].id;

        const { data: subjectsData } = await supabase
          .from("subjects")
          .select("id, name, grade_level, section, code")
          .eq("teacher_id", teacherId)
          .order("code", { ascending: true });

        if (subjectsData?.length) {
          const mapped = subjectsData.map(s => ({
            id: String(s.id),
            name: String(s.name || "").trim(),
            gradeLevel: String(s.grade_level || "").trim(),
            section: String(s.section || "").trim(),
            code: String(s.code || "").trim(),
          }));
          setClasses(mapped);
        }
      } catch (err) {
        console.error("AISettings: failed to load classes", err);
      } finally {
        setLoadingClasses(false);
      }
    };
    fetchClasses();
  }, []);

  const handleClassSelect = (classId) => {
    update("selectedClassId", classId);
    if (!classId) {
      update("classContext", null);
      return;
    }
    const cls = classes.find(c => c.id === classId);
    if (cls) {
      setSettings(prev => ({
        ...prev,
        selectedClassId: classId,
        subject: cls.name || prev.subject,
        gradeLevel: cls.gradeLevel || prev.gradeLevel,
        section: cls.section || prev.section,
        classContext: {
          className: cls.name,
          subject: cls.name,
          gradeLevel: cls.gradeLevel,
          section: cls.section,
          teacherName: JSON.parse(localStorage.getItem("currentUser") || "{}")?.name || "",
        },
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5" /> AI Engine Configuration
        </h3>
      </div>

      <div className="space-y-3.5">
        {/* Class Selector */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase tracking-wider">
            📚 Active Class Context
          </label>
          <div className="relative">
            <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={settings.selectedClassId || ""}
              onChange={(e) => handleClassSelect(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-xl pl-9 pr-10 py-2.5 bg-white text-gray-700 hover:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-500/10 focus:border-green-500 transition-all cursor-pointer appearance-none shadow-sm"
            >
              <option value="">— Select a class context —</option>
              {classes.map((cls) => {
                const cleanGrade = String(cls.gradeLevel || "").replace(/^(grade\s*)+/i, "").trim();
                return (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} {cleanGrade ? `(Gr. ${cleanGrade}` : ""}{cls.section ? ` – ${cls.section})` : cleanGrade ? ")" : ""}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          
          {settings.classContext && (
            <div className="mt-2 p-2 bg-emerald-50/50 border border-emerald-100/60 rounded-xl flex items-start gap-2 animate-fadeIn">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] text-emerald-800 font-bold leading-none">Context Loaded</p>
                <p className="text-[10px] text-emerald-600 font-semibold leading-tight mt-1 truncate">
                  {settings.classContext.subject} · Gr. {settings.classContext.gradeLevel} · {settings.classContext.section}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Grade Level */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase tracking-wider">Grade Level Override</label>
          <div className="grid grid-cols-6 gap-1">
            {GRADE_LEVELS.map((g) => (
              <button
                key={g}
                onClick={() => update("gradeLevel", g)}
                className={`text-[10px] font-bold py-1.5 rounded-lg border transition-all active:scale-[0.95] ${
                  settings.gradeLevel === g
                    ? "bg-green-600 text-white border-green-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-green-200 hover:bg-green-50/20"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase tracking-wider">Subject Name</label>
          <input
            type="text"
            value={settings.subject}
            onChange={(e) => update("subject", e.target.value)}
            placeholder="e.g. English, Math, Science..."
            className="w-full text-xs border border-gray-250 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all shadow-sm"
          />
        </div>

        {/* Difficulty */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase tracking-wider">Complexity / Difficulty</label>
          <div className="flex gap-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => update("difficulty", d)}
                className={`flex-1 text-[10px] font-bold py-2 rounded-xl border transition-all active:scale-[0.95] ${
                  settings.difficulty === d
                    ? "bg-green-600 text-white border-green-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-green-200 hover:bg-green-50/20"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase tracking-wider">Output Language</label>
          <div className="flex gap-1.5">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                onClick={() => update("language", l)}
                className={`flex-1 text-[10px] font-bold py-2 rounded-xl border transition-all active:scale-[0.95] ${
                  settings.language === l
                    ? "bg-green-600 text-white border-green-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-green-200 hover:bg-green-50/20"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Quiz Types */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase tracking-wider flex items-center gap-1">
            <CheckSquare className="w-3 h-3" /> Question Format Filter
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {QUIZ_TYPES.map((type) => {
              const selected = (settings.quizTypes || ["Multiple Choice"]).includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleQuizType(type)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-xl border text-left transition-all active:scale-[0.95] ${
                    selected
                      ? "bg-green-50/60 border-green-300 text-green-700 shadow-sm font-semibold"
                      : "bg-white border-gray-200 text-gray-500 hover:border-green-200 hover:bg-green-50/10"
                  }`}
                >
                  <span className="text-[10px]">{type}</span>
                  <input
                    type="checkbox"
                    checked={selected}
                    readOnly
                    className="w-3 h-3 rounded text-green-600 border-gray-300 pointer-events-none accent-green-600"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Number of Items */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5" /> Output Volume Limit</span>
            <span className="font-extrabold text-green-600 text-xs bg-green-50 px-2 py-0.5 rounded-full border border-green-100">{settings.itemCount} items</span>
          </label>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={settings.itemCount}
            onChange={(e) => update("itemCount", Number(e.target.value))}
            className="w-full accent-green-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Bloom's Taxonomy Level */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase tracking-wider">
            🧠 Bloom's Cognitive Level
          </label>
          <div className="relative">
            <select
              value={settings.bloomsLevel || "None"}
              onChange={(e) => update("bloomsLevel", e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-700 hover:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-500/10 focus:border-green-500 transition-all cursor-pointer appearance-none shadow-sm"
            >
              <option value="None">None (General Mix)</option>
              <option value="Remember">Remember (Recall Facts)</option>
              <option value="Understand">Understand (Explain Concepts)</option>
              <option value="Apply">Apply (Use Info in New Situations)</option>
              <option value="Analyze">Analyze (Draw Connections)</option>
              <option value="Evaluate">Evaluate (Justify Decisions)</option>
              <option value="Create">Create (Produce Original Work)</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

      </div>
    </div>
  );
}
