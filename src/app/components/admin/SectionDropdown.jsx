import { useState, useEffect } from "react";
import { CustomSelect } from "./CustomSelect";
import { supabase } from "../../lib/supabaseClient";
import { adminApi } from "@/app/lib/adminApi";
import { Settings, Plus, Edit2, Trash2, X, Loader2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const db = supabase;

export function SectionDropdown({ gradeLevel, value, onChange, error, disabled, className = "" }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const fetchSections = async () => {
    if (!gradeLevel) {
      setSections([]);
      if (value) onChange("");
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await adminApi.db("grade_sections", "select", {
        eq: { column: "grade_level", value: gradeLevel.replace("Grade ", "").trim() }
      });
      // Sort manually since adminApi doesn't support order yet
      if (data) {
        data.sort((a, b) => a.section_name.localeCompare(b.section_name));
      }
        
      if (error) throw error;
      
      const formattedSections = data || [];
      setSections(formattedSections);
      
      // If current value is not in the list, clear it
      if (value && !formattedSections.some(s => s.section_name === value)) {
        onChange("");
      }
    } catch (err) {
      toast.error("Failed to load sections.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, [gradeLevel]);

  const handleCreateSection = async (e) => {
    if (e) e.preventDefault();
    const sectionName = newSectionName.trim();
    if (!sectionName) {
      toast.error("Section name is required.");
      return;
    }
    
    const dbGradeLevel = gradeLevel.replace("Grade ", "").trim();
    
    // Check duplicates
    if (sections.some(s => s.section_name.toLowerCase() === sectionName.toLowerCase())) {
      toast.error(`Section '${sectionName}' already exists for ${gradeLevel}.`);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { data, error } = await adminApi.db("grade_sections", "insert", {
        payload: { grade_level: dbGradeLevel, section_name: sectionName },
        single: true
      });
        
      if (error) throw error;
      toast.success(`Section '${sectionName}' created!`);
      setNewSectionName("");
      setSections([...sections, data].sort((a, b) => a.section_name.localeCompare(b.section_name)));
      onChange(sectionName);
      setShowManageModal(false);
    } catch (err) {
      toast.error(err.message || "Failed to create section.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSection = async (id, oldName) => {
    const updatedName = editName.trim();
    if (!updatedName || updatedName === oldName) {
      setEditingId(null);
      return;
    }
    
    if (sections.some(s => s.id !== id && s.section_name.toLowerCase() === updatedName.toLowerCase())) {
      toast.error(`Section '${updatedName}' already exists.`);
      return;
    }
    
    try {
      const { error } = await adminApi.db("grade_sections", "update", {
        payload: { section_name: updatedName },
        eq: { column: "id", value: id }
      });
        
      if (error) throw error;
      
      toast.success("Section updated successfully.");
      setSections(sections.map(s => s.id === id ? { ...s, section_name: updatedName } : s));
      setEditingId(null);
      if (value === oldName) onChange(updatedName);
    } catch (err) {
      toast.error(err.message || "Failed to update section.");
    }
  };

  const handleDeleteSection = async (id, sectionName) => {
    setDeleteError("");
    const dbGradeLevel = gradeLevel.replace("Grade ", "").trim();
    const formattedGradeLevel = `Grade ${dbGradeLevel}`;
    
    setIsSubmitting(true);
    try {
      // Check foreign keys
      const { count: studentCount } = await db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .eq("year_level", formattedGradeLevel)
        .eq("section", sectionName);
        
      const { count: subjectCount } = await db
        .from("subjects")
        .select("id", { count: "exact", head: true })
        .eq("grade_level", formattedGradeLevel)
        .eq("section", sectionName);
        
      const teacherCheckString = `${formattedGradeLevel} - ${sectionName}`;
      const { count: teacherCount } = await db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "teacher")
        .ilike("assigned_class", `%${teacherCheckString}%`);
        
      const totalUsage = (studentCount || 0) + (subjectCount || 0) + (teacherCount || 0);
      
      if (totalUsage > 0) {
        let msg = `Cannot delete section because it is currently assigned to: `;
        const parts = [];
        if (studentCount > 0) parts.push(`${studentCount} student(s)`);
        if (teacherCount > 0) parts.push(`${teacherCount} teacher(s)`);
        if (subjectCount > 0) parts.push(`${subjectCount} subject(s)`);
        msg += parts.join(", ") + ".";
        setDeleteError(msg);
        setIsSubmitting(false);
        return;
      }
      
      const { error } = await adminApi.db("grade_sections", "delete", {
        eq: { column: "id", value: id }
      });
      if (error) throw error;
      
      toast.success("Section deleted successfully.");
      setSections(sections.filter(s => s.id !== id));
      if (value === sectionName) onChange("");
      setDeleteConfirmId(null);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete section.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const options = sections.map(s => ({ value: s.section_name, label: s.section_name }));

  return (
    <div className={className}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <CustomSelect
            value={value}
            onChange={onChange}
            options={options}
            placeholder={loading ? "Loading..." : gradeLevel ? "Select section" : "Select Grade Level first"}
            disabled={disabled || !gradeLevel || loading}
            className="w-full"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowManageModal(true)}
          disabled={disabled || !gradeLevel}
          className={`flex items-center justify-center p-3 mt-[1px] border rounded-xl transition-all ${
            disabled || !gradeLevel 
              ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed" 
              : "bg-white border-gray-200 text-green-600 hover:bg-green-50 hover:border-green-300 hover:shadow-sm shadow-sm"
          }`}
          title="Manage Sections"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
      
      {showManageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50">
              <h2 className="text-xl font-bold text-gray-900">Manage Sections</h2>
              <button onClick={() => setShowManageModal(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-600" /> Add New Section
                </h3>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Grade Level</label>
                  <input type="text" value={gradeLevel} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Section Name</label>
                  <input 
                    type="text" 
                    value={newSectionName} 
                    onChange={e => setNewSectionName(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!isSubmitting && newSectionName.trim()) {
                          handleCreateSection();
                        }
                      }
                    }}
                    placeholder="e.g. Emerald"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setNewSectionName("")} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    Clear
                  </button>
                  <button type="button" onClick={handleCreateSection} disabled={isSubmitting || !newSectionName.trim()} className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create Section"}
                  </button>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Existing Sections</h3>
                {sections.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">No sections found for this grade level.</p>
                ) : (
                  <div className="space-y-2">
                    {sections.map(section => (
                      <div key={section.id} className="group flex items-center justify-between p-3 bg-white border border-gray-100 hover:border-gray-200 rounded-xl hover:shadow-sm transition-all">
                        {editingId === section.id ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <input 
                              type="text" 
                              value={editName} 
                              onChange={e => setEditName(e.target.value)} 
                              className="flex-1 px-2 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500" 
                              autoFocus 
                            />
                            <button onClick={() => handleUpdateSection(section.id, section.section_name)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-gray-700">{section.section_name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingId(section.id); setEditName(section.section_name); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Edit">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteConfirmId(section.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Delete Section?</h3>
              <p className="text-center text-gray-600 text-sm mb-6">
                Are you sure you want to delete this section? This action cannot be undone.
              </p>
              
              {deleteError && (
                <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                  {deleteError}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmId(null);
                    setDeleteError("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSection(deleteConfirmId, sections.find(s => s.id === deleteConfirmId)?.section_name)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
