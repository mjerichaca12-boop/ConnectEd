export function AISettings({ settings, setSettings }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const selectClass = "w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none shadow-sm";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Generation Settings</h3>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Grade Level</label>
          <select name="gradeLevel" value={settings.gradeLevel} onChange={handleChange} className={selectClass}>
            {["7", "8", "9", "10", "11", "12"].map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Subject</label>
          <select name="subject" value={settings.subject} onChange={handleChange} className={selectClass}>
            {["English", "Mathematics", "Science", "Filipino", "Araling Panlipunan", "MAPEH", "TLE", "EsP"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Difficulty</label>
          <select name="difficulty" value={settings.difficulty} onChange={handleChange} className={selectClass}>
            {["Easy", "Medium", "Hard"].map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Language</label>
          <select name="language" value={settings.language} onChange={handleChange} className={selectClass}>
            {["English", "Filipino", "Bilingual"].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 mb-1 block">No. of Items</label>
          <input 
            type="number" 
            name="itemCount" 
            value={settings.itemCount} 
            onChange={handleChange} 
            min="1" 
            max="50"
            className={selectClass}
          />
        </div>
      </div>
    </div>
  );
}
