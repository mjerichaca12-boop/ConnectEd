import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/app/lib/supabaseClient";
import { adminApi } from "@/app/lib/adminApi";
import { toast } from "sonner";
import { Save, AlertTriangle, Calendar } from "lucide-react";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { CustomSelect } from "@/app/components/admin/CustomSelect";

const db = supabase;

export default function AdminAcademicSettings() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [quarter, setQuarter] = useState("1st Quarter");
  const [originalSettings, setOriginalSettings] = useState(null);

  // Dialog state
  const [showConfirm, setShowConfirm] = useState(false);

  const availableSchoolYears = ["2025-2026", "2026-2027", "2027-2028"];
  const availableQuarters = ["1st Quarter", "2nd Quarter", "3rd Quarter"];

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
    fetchAcademicSettings();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const fetchAcademicSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await db
        .from("academic_settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        const loadedQuarter = data.current_quarter === "4th Quarter" ? "3rd Quarter" : (data.current_quarter || "1st Quarter");
        setSchoolYear(data.current_school_year || "2026-2027");
        setQuarter(loadedQuarter);
        setOriginalSettings({
          schoolYear: data.current_school_year || "2026-2027",
          quarter: loadedQuarter,
        });
      } else {
        // Fallback defaults
        setOriginalSettings({
          schoolYear: "2026-2027",
          quarter: "1st Quarter",
        });
      }
    } catch (err) {
      console.error("Error fetching academic settings:", err);
      toast.error("Failed to load academic settings");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClick = () => {
    if (!originalSettings) return;

    // Only show dialog if the quarter is actually changing
    if (quarter !== originalSettings.quarter) {
      setShowConfirm(true);
    } else {
      saveSettings();
    }
  };

  const saveSettings = async () => {
    try {
      setShowConfirm(false);
      setSaving(true);
      
      const userStr = localStorage.getItem("currentUser");
      const userId = userStr ? JSON.parse(userStr).id : null;

      const payload = {
        id: 1,
        current_school_year: schoolYear,
        current_quarter: quarter,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      };

      const { error } = await adminApi.db("academic_settings", "upsert", {
        payload,
        onConflict: "id"
      });

      if (error) throw error;

      setOriginalSettings({ schoolYear, quarter });
      toast.success("Academic settings updated successfully!");
    } catch (err) {
      console.error("Error saving academic settings:", err);
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };



  const hasChanges =
    originalSettings &&
    (schoolYear !== originalSettings.schoolYear || quarter !== originalSettings.quarter);

  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
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
                <h2 className="text-lg font-bold text-gray-900">Academic Settings</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div data-tour="settings-header" className="relative rounded-2xl p-8 text-gray-900 shadow-lg overflow-hidden bg-white border border-gray-200">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/8 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4">
              <h1 className="text-3xl font-bold mb-2 text-green-600">Academic Settings</h1>
              <p className="text-gray-600">Manage the current school year and active quarter across the system.</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Academic Schedule</h3>
              </div>
            </div>
            <div className="p-6 md:p-8 space-y-8">
              
              {/* School Year Section */}
              <div data-tour="settings-school-year">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              School Year
            </h2>
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Active School Year
              </label>
              <CustomSelect
                value={schoolYear}
                onChange={(value) => setSchoolYear(value)}
                options={availableSchoolYears.map((sy) => ({
                  value: sy,
                  label: sy
                }))}
              />
              <p className="mt-2 text-xs text-gray-500">
                This dictates the current academic year displayed across the system.
              </p>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Current Quarter Section */}
          <div data-tour="settings-sections-config">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Current Quarter
            </h2>
            
            <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-100 inline-block">
              <span className="text-sm text-green-800 font-medium mr-2">🟢 Active Quarter:</span>
              <span className="text-sm font-bold text-green-900">{originalSettings?.quarter}</span>
            </div>

            <div className="space-y-3 max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Active Quarter
              </label>
              {availableQuarters.map((q) => (
                <label
                  key={q}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    quarter === q
                      ? "border-green-500 bg-green-50/50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="quarter"
                    value={q}
                    checked={quarter === q}
                    onChange={(e) => setQuarter(e.target.value)}
                    className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 focus:ring-green-500"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">{q}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleUpdateClick}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>

  {/* Confirmation Dialog moved outside main to ensure it covers the navbar and sidebar */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex items-center gap-3 text-amber-600 mb-4">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-bold text-gray-900">Change Active Quarter?</h3>
              </div>
              <p className="text-gray-600 text-sm mb-6">
                You are about to change the global active quarter from{" "}
                <span className="font-semibold text-gray-900">{originalSettings.quarter}</span> to{" "}
                <span className="font-semibold text-gray-900">{quarter}</span>. 
                This will lock editing for previous quarters and affect how teachers input grades. 
                <br /><br />
                Are you sure you want to proceed?
              </p>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? "Updating..." : "Yes, change quarter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
