import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { CustomSelect } from "@/app/components/admin/CustomSelect";
import { Bell, Calendar, Shield, Database, Globe, Save, Snowflake, Sun } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/app/lib/supabaseClient";
import { DEPED_DEFAULT_GRADE_SETTINGS, DEPED_SUBJECT_CATEGORIES } from "@/app/lib/depedGrading";
function SystemSettings() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [notifications, setNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    academicYear: "2025-2026",
    currentSemester: "First Semester",
    enrollmentOpen: true,
    systemMaintenance: false,
    allowSelfEnrollment: true,
    requireApproval: true
  });
  const [gradingSettings, setGradingSettings] = useState(DEPED_DEFAULT_GRADE_SETTINGS);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingSaving, setGradingSaving] = useState(false);
  const [gradingError, setGradingError] = useState("");
  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "admin") {
      navigate("/login");
      return;
    }
    setAdminName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  useEffect(() => {
    const loadGradingSettings = async () => {
      if (!supabase) {
        setGradingSettings(DEPED_DEFAULT_GRADE_SETTINGS);
        return;
      }

      setGradingLoading(true);
      const { data, error } = await supabase
        .from("grading_settings")
        .select("subject_category, written_works_weight, performance_tasks_weight, written_works_enabled, performance_tasks_enabled");

      if (error || !data) {
        console.warn("Failed to load grading settings:", error);
        setGradingSettings(DEPED_DEFAULT_GRADE_SETTINGS);
        setGradingLoading(false);
        return;
      }

      const mapped = { ...DEPED_DEFAULT_GRADE_SETTINGS };
      (data ?? []).forEach((row) => {
        if (!row?.subject_category) return;
        mapped[row.subject_category] = {
          writtenWorksWeight: Number(row.written_works_weight ?? 0) || 0,
          performanceTasksWeight: Number(row.performance_tasks_weight ?? 0) || 0,
          writtenWorksEnabled: row.written_works_enabled !== false,
          performanceTasksEnabled: row.performance_tasks_enabled !== false,
        };
      });

      setGradingSettings(mapped);
      setGradingLoading(false);
    };

    loadGradingSettings();
  }, []);
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };
  const handleSaveSettings = () => {
    alert("Settings saved successfully!");
  };

  const updateCategorySetting = (category, field, value) => {
    setGradingSettings((current) => ({
      ...current,
      [category]: {
        ...(current[category] || DEPED_DEFAULT_GRADE_SETTINGS[category]),
        [field]: value,
      },
    }));
  };

  const validateGradingSettings = () => {
    for (const category of DEPED_SUBJECT_CATEGORIES) {
      const config = gradingSettings[category] || DEPED_DEFAULT_GRADE_SETTINGS[category];
      const total = Number(config.writtenWorksWeight || 0) + Number(config.performanceTasksWeight || 0);
      if (Math.round(total * 100) / 100 !== 100) {
        return `${category} must total 100%.`;
      }
    }

    return "";
  };

  const handleSaveGradingSettings = async (overrideSettings = null) => {
    const nextSettings = overrideSettings || gradingSettings;
    const validationError = (() => {
      for (const category of DEPED_SUBJECT_CATEGORIES) {
        const config = nextSettings[category] || DEPED_DEFAULT_GRADE_SETTINGS[category];
        const total = Number(config.writtenWorksWeight || 0) + Number(config.performanceTasksWeight || 0);
        if (Math.round(total * 100) / 100 !== 100) {
          return `${category} must total 100%.`;
        }
      }

      return "";
    })();
    if (validationError) {
      setGradingError(validationError);
      return;
    }

    if (!supabase) {
      setGradingError("Supabase client is not configured.");
      return;
    }

    setGradingSaving(true);
    setGradingError("");

    try {
      const payload = DEPED_SUBJECT_CATEGORIES.map((category) => ({
        subject_category: category,
        written_works_weight: Number(nextSettings[category]?.writtenWorksWeight || 0),
        performance_tasks_weight: Number(nextSettings[category]?.performanceTasksWeight || 0),
        written_works_enabled: nextSettings[category]?.writtenWorksEnabled !== false,
        performance_tasks_enabled: nextSettings[category]?.performanceTasksEnabled !== false,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("grading_settings").upsert(payload, { onConflict: "subject_category" });
      if (error) throw error;

      toast.success("Grading settings saved successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save grading settings.";
      setGradingError(message);
      toast.error(message);
    } finally {
      setGradingSaving(false);
    }
  };

  const handleRestoreDefaultGradingSettings = async () => {
    setGradingSettings(DEPED_DEFAULT_GRADE_SETTINGS);
    setGradingError("");
    await handleSaveGradingSettings(DEPED_DEFAULT_GRADE_SETTINGS);
  };

  return <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10 lg:pl-64">
        <div className="bg-gray-50/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
                <h2 className="text-lg font-bold text-gray-900">System Settings</h2>
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors border border-transparent hover:border-gray-200">
                <Bell className="w-6 h-6 text-gray-600 hover:text-green-600 transition-colors" />
                
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="relative rounded-2xl p-8 text-gray-900 shadow-lg overflow-hidden bg-white border border-gray-200">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/8 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4">
              <h1 className="text-3xl font-bold mb-2 text-green-600">System Settings</h1>
              <p className="text-gray-600">Configure system-wide settings and preferences</p>
            </div>
          </div>

          {
    /* Academic Year Settings */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Academic Year Settings</h3>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Academic Year</label>
                <input
    type="text"
    value={settings.academicYear}
    onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
    className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500/50"
  />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Current Semester</label>
                <CustomSelect
    value={settings.currentSemester}
    onChange={(value) => setSettings({ ...settings, currentSemester: value })}
    options={[
      {
        value: "First Semester",
        label: "First Semester",
        icon: <Snowflake className="w-5 h-5 text-blue-400" />
      },
      {
        value: "Second Semester",
        label: "Second Semester",
        icon: <Sun className="w-5 h-5 text-blue-400" />
      }
    ]}
    icon={<Calendar className="w-5 h-5" />}
    placeholder="Select semester"
  />
              </div>
            </div>
          </div>

          {
    /* Enrollment Settings */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <Database className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Enrollment Settings</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-gray-200 bg-gray-50 rounded-xl gap-4">
                <div>
                  <p className="font-semibold text-gray-900">Enrollment Open</p>
                  <p className="text-sm text-gray-500 mt-1">Allow students to enroll in subjects</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.enrollmentOpen}
    onChange={(e) => setSettings({ ...settings, enrollmentOpen: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500 border border-gray-200" />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-gray-200 bg-gray-50 rounded-xl gap-4">
                <div>
                  <p className="font-semibold text-gray-900">Allow Self-Enrollment</p>
                  <p className="text-sm text-gray-500 mt-1">Students can enroll without admin approval</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.allowSelfEnrollment}
    onChange={(e) => setSettings({ ...settings, allowSelfEnrollment: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500 border border-gray-200" />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-gray-200 bg-gray-50 rounded-xl gap-4">
                <div>
                  <p className="font-semibold text-gray-900">Require Enrollment Approval</p>
                  <p className="text-sm text-gray-500 mt-1">Admin must approve enrollment requests</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.requireApproval}
    onChange={(e) => setSettings({ ...settings, requireApproval: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500 border border-gray-200" />
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <Save className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Grading Settings</h3>
                  <p className="text-sm text-gray-500">DepEd JHS weights for Written Works and Performance Tasks by subject category.</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {gradingLoading ? (
                <p className="text-sm text-gray-500">Loading grading settings...</p>
              ) : (
                DEPED_SUBJECT_CATEGORIES.map((category) => {
                  const config = gradingSettings[category] || DEPED_DEFAULT_GRADE_SETTINGS[category];
                  return (
                    <div key={category} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <h4 className="font-semibold text-gray-900">{category}</h4>
                          <p className="text-xs text-gray-500 mt-1">Total weight must remain 100%.</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => updateCategorySetting(category, "writtenWorksEnabled", !config.writtenWorksEnabled)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${config.writtenWorksEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                          >
                            Written Works {config.writtenWorksEnabled ? "On" : "Off"}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCategorySetting(category, "performanceTasksEnabled", !config.performanceTasksEnabled)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${config.performanceTasksEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                          >
                            Performance Tasks {config.performanceTasksEnabled ? "On" : "Off"}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-2">Written Works (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={config.writtenWorksWeight}
                            onChange={(e) => updateCategorySetting(category, "writtenWorksWeight", Number(e.target.value || 0))}
                            className="w-full px-4 py-3 bg-white text-gray-900 placeholder-gray-500 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-2">Performance Tasks (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={config.performanceTasksWeight}
                            onChange={(e) => updateCategorySetting(category, "performanceTasksWeight", Number(e.target.value || 0))}
                            className="w-full px-4 py-3 bg-white text-gray-900 placeholder-gray-500 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500/50"
                          />
                        </div>
                      </div>

                      <p className="text-xs text-gray-500">Current total: {Number(config.writtenWorksWeight || 0) + Number(config.performanceTasksWeight || 0)}%</p>
                    </div>
                  );
                })
              )}

              {gradingError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{gradingError}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRestoreDefaultGradingSettings}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors border border-gray-200"
                  disabled={gradingSaving}
                >
                  Restore Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSaveGradingSettings}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                  disabled={gradingSaving}
                >
                  {gradingSaving ? "Saving..." : "Save Grading Settings"}
                </button>
              </div>
            </div>
          </div>

          {
    /* System Status */
  }
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <Shield className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-gray-200 bg-gray-50 rounded-xl gap-4">
                <div>
                  <p className="font-semibold text-gray-900">Maintenance Mode</p>
                  <p className="text-sm text-gray-500 mt-1">Temporarily disable system access</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
    type="checkbox"
    checked={settings.systemMaintenance}
    onChange={(e) => setSettings({ ...settings, systemMaintenance: e.target.checked })}
    className="sr-only peer"
  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500 border border-gray-200" />
                </label>
              </div>

              <div className="p-5 bg-green-500/5 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Globe className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-600">System Status: Online</p>
                    <p className="text-sm text-green-600/70 mt-0.5">All systems operational</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {
    /* Save Button */
  }
          <div className="flex justify-end pt-4">
            <button
    onClick={handleSaveSettings}
    className="flex items-center gap-2 px-8 py-3.5 bg-green-600 text-gray-900 font-semibold rounded-xl hover:bg-green-500 transition-colors shadow-lg shadow-green-500/20"
  >
              <Save className="w-5 h-5" />
              Save All Settings
            </button>
          </div>
        </div>
      </main>
    </div>;
}
export {
  SystemSettings
};
