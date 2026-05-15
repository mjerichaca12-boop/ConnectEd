const GRADE_LEVELS = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const SUBJECTS = ["English","Filipino","Math","Science","Araling Panlipunan","MAPEH","TLE","Values Education","ESP"];
const DIFFICULTIES = ["Easy","Medium","Hard"];
const LANGUAGES = ["English","Filipino","Taglish"];

export function AISettings({ settings, setSettings }) {
  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <h3 className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">⚙️ Settings</h3>
      <div className="space-y-3">

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Grade Level</label>
          <select
            value={settings.gradeLevel}
            onChange={(e) => update("gradeLevel", e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Subject</label>
          <select
            value={settings.subject}
            onChange={(e) => update("subject", e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Difficulty</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => update("difficulty", d)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                  settings.difficulty === d
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Language</label>
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                onClick={() => update("language", l)}
                className={`flex-1 text-xs py-1 rounded-lg border transition-colors ${
                  settings.language === l
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            Number of Items: <span className="font-semibold text-gray-700">{settings.itemCount}</span>
          </label>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={settings.itemCount}
            onChange={(e) => update("itemCount", Number(e.target.value))}
            className="w-full accent-green-600"
          />
        </div>

      </div>
    </div>
  );
}
