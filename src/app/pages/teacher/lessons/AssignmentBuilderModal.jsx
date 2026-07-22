import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useAcademic } from "@/app/context/AcademicContext";
import { X, Calendar, Clock, FileText, Link as LinkIcon, Settings, Target, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { CustomSelect } from "@/app/components/admin/CustomSelect";

export function AssignmentBuilderModal({ lessonId, initialAssignmentId = null, onClose, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    task_category: "Assignment", // 'Assignment', 'Activity', 'Assessment'
    assignment_type: "File Upload",
    due_date: "",
    due_time: "23:59",
    allow_late_submission: false,
    late_submission_deadline: "",
    late_submission_deadline_time: "23:59",
    total_points: 100,
  });

  const [validationErrors, setValidationErrors] = useState({});

  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const { activeSchoolYear, activeQuarter } = useAcademic();

  useEffect(() => {
    if (initialAssignmentId) {
      fetchAssignment();
    }
  }, [initialAssignmentId]);

  const fetchAssignment = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch assignment details
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", initialAssignmentId)
        .single();
      
      if (error) throw error;

      // 2. Fetch its category from lesson_activities
      const { data: actData } = await supabase
        .from("lesson_activities")
        .select("activity_type")
        .eq("activity_id", initialAssignmentId)
        .single();
      
      let dDate = "";
      let dTime = "23:59";
      if (data.due_date) {
        const d = new Date(data.due_date);
        dDate = d.toISOString().split("T")[0];
        dTime = d.toISOString().split("T")[1].substring(0,5);
      }

      let lateDate = "";
      let lateTime = "23:59";
      if (data.late_submission_deadline) {
        const ld = new Date(data.late_submission_deadline);
        lateDate = ld.toISOString().split("T")[0];
        lateTime = ld.toISOString().split("T")[1].substring(0,5);
      }

      setFormData({
        title: data.title,
        description: data.description || "",
        task_category: actData?.activity_type || "Assignment",
        assignment_type: data.assignment_type,
        due_date: dDate,
        due_time: dTime,
        allow_late_submission: data.allow_late_submission,
        late_submission_deadline: lateDate,
        late_submission_deadline_time: lateTime,
        total_points: data.total_points
      });
      
      let parsedAttachments = [];
      if (data.attachment_url) {
        try {
          parsedAttachments = JSON.parse(data.attachment_url);
        } catch(e) {
          parsedAttachments = [{ url: data.attachment_url, name: data.attachment_name || "Attachment" }];
        }
      }
      setExistingAttachments(parsedAttachments);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load assignment details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(f => {
        if (f.size > 50 * 1024 * 1024) {
          toast.error(`${f.name} exceeds 50MB limit`);
          return false;
        }
        return true;
      });
      setAttachments(prev => [...prev, ...validFiles]);
      // clear the input so the same files can be selected again if needed
      e.target.value = null; 
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!formData.title) errors.title = "Title is required.";
    if (!formData.due_date) errors.due_date = "Due Date is required.";
    if (!formData.due_time) errors.due_time = "Due Time is required.";

    if (formData.due_date && formData.due_time) {
      const dueDateTime = new Date(`${formData.due_date}T${formData.due_time}`);
      if (dueDateTime <= new Date()) {
        errors.due_date = "Due Date must be in the future.";
      }
    }

    if (formData.allow_late_submission && formData.late_submission_deadline) {
      const lateDT = new Date(`${formData.late_submission_deadline}T${formData.late_submission_deadline_time || "23:59"}`);
      const dueDT = new Date(`${formData.due_date}T${formData.due_time}`);
      if (lateDT <= dueDT) {
        errors.late_submission_deadline = "Late Submission Deadline must be after the Due Date.";
      }
    }

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return;
    }

    setIsSubmitting(true);
    try {
      let finalAttachments = [...existingAttachments];

      if (attachments.length > 0) {
        for (const file of attachments) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          const filePath = `lesson_assignments/${lessonId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("class-materials")
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage
            .from("class-materials")
            .getPublicUrl(filePath);

          finalAttachments.push({ url: publicData.publicUrl, name: file.name, size: file.size });
        }
      }

      // Combine date and time
      const finalDueDate = new Date(`${formData.due_date}T${formData.due_time}`).toISOString();

      let finalLateDeadline = null;
      if (formData.allow_late_submission && formData.late_submission_deadline) {
        finalLateDeadline = new Date(`${formData.late_submission_deadline}T${formData.late_submission_deadline_time || "23:59"}`).toISOString();
      }

      const payload = {
        lesson_id: lessonId,
        title: formData.title,
        description: formData.description || null,
        assignment_type: formData.assignment_type,
        due_date: finalDueDate,
        allow_late_submission: formData.allow_late_submission,
        late_submission_deadline: finalLateDeadline,
        total_points: parseInt(formData.total_points) || 100,
        attachment_url: finalAttachments.length > 0 ? JSON.stringify(finalAttachments) : null,
        attachment_name: null,
        school_year: activeSchoolYear,
        term: activeQuarter
      };

      if (initialAssignmentId) {
        const { error } = await supabase
          .from("assignments")
          .update(payload)
          .eq("id", initialAssignmentId);
        if (error) throw error;
        toast.success(`${formData.task_category === "Assessment" ? "Seatwork" : formData.task_category} updated successfully!`);
      } else {
        const { data, error } = await supabase
          .from("assignments")
          .insert(payload)
          .select()
          .single();
        
        if (error) throw error;

        // Link to lesson_activities
        const activityPayload = {
          lesson_id: lessonId,
          activity_type: formData.task_category,
          activity_id: data.id
        };
        
        const { error: actError } = await supabase.from("lesson_activities").insert(activityPayload);
        if (actError) throw actError;

        toast.success(`${formData.task_category === "Assessment" ? "Seatwork" : formData.task_category} created successfully!`);
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(initialAssignmentId ? `Failed to update ${formData.task_category.toLowerCase()}` : `Failed to create ${formData.task_category.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{initialAssignmentId ? "Edit Task" : "Create Task"}</h2>
              <p className="text-xs text-gray-500">Configure instructions and submission rules</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
          <form id="create-assignment-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* General Information */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Research Paper on Climate Change"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Instructions / Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Provide clear instructions on what students need to do..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <LinkIcon className="w-4 h-4 text-gray-400" /> Reference Material / Attachment (Optional)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">Students can download these files when viewing the assignment.</p>
                
                {(existingAttachments.length > 0 || attachments.length > 0) && (
                  <div className="mt-3 space-y-2">
                    {existingAttachments.map((f, i) => (
                      <div key={`existing-${i}`} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                        <span className="truncate max-w-[80%] text-blue-600 font-medium">{f.name}</span>
                        <button type="button" onClick={() => setExistingAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {attachments.map((f, i) => (
                      <div key={`new-${i}`} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg text-sm">
                        <span className="truncate max-w-[80%] text-green-700 font-medium">{f.name}</span>
                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submission & Settings */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-5">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                <Settings className="w-4 h-4 text-gray-400" /> Settings & Requirements
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-gray-400" /> Task Category
                  </label>
                  <CustomSelect
                    value={formData.task_category}
                    onChange={(val) => handleSelectChange("task_category", val)}
                    options={[
                      { value: "Assignment", label: "Assignment" },
                      { value: "Assessment", label: "Seatwork" }
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-gray-400" /> Submission Format
                  </label>
                  <CustomSelect
                    value={formData.assignment_type}
                    onChange={(val) => handleSelectChange("assignment_type", val)}
                    options={[
                      { value: "File Upload", label: "File Upload (PDF, DOCX, etc.)" },
                      { value: "Essay", label: "Essay (Text Submission)" }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-gray-400" /> Max Points
                  </label>
                  <input
                    type="number"
                    name="total_points"
                    value={formData.total_points}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-gray-400" /> Due Date <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={(e) => { handleChange(e); setValidationErrors(prev => ({ ...prev, due_date: undefined })); }}
                    required
                    className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.due_date ? 'border-red-400 bg-red-50/50' : 'border-gray-200'}`}
                  />
                  {validationErrors.due_date && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{validationErrors.due_date}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-gray-400" /> Due Time <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="time"
                    name="due_time"
                    value={formData.due_time}
                    onChange={(e) => { handleChange(e); setValidationErrors(prev => ({ ...prev, due_time: undefined })); }}
                    required
                    className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.due_time ? 'border-red-400 bg-red-50/50' : 'border-gray-200'}`}
                  />
                  {validationErrors.due_time && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{validationErrors.due_time}</p>
                  )}
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    name="allow_late_submission"
                    checked={formData.allow_late_submission}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="block font-medium text-gray-900">Allow Late Submissions</span>
                    <span className="block text-xs text-gray-500">Students can submit after the due date (marked as late)</span>
                  </div>
                </label>

                {formData.allow_late_submission && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pl-8 pt-1 pb-1 border-l-2 border-blue-200 ml-2">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-orange-400" /> Late Deadline Date
                      </label>
                      <input
                        type="date"
                        name="late_submission_deadline"
                        value={formData.late_submission_deadline}
                        onChange={(e) => { handleChange(e); setValidationErrors(prev => ({ ...prev, late_submission_deadline: undefined })); }}
                        className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all ${validationErrors.late_submission_deadline ? 'border-red-400 bg-red-50/50' : 'border-gray-200'}`}
                      />
                      {validationErrors.late_submission_deadline && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{validationErrors.late_submission_deadline}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-orange-400" /> Late Deadline Time
                      </label>
                      <input
                        type="time"
                        name="late_submission_deadline_time"
                        value={formData.late_submission_deadline_time}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      />
                    </div>
                    <p className="text-xs text-gray-500 md:col-span-2 -mt-2">If set, students can submit until this deadline. Leave empty to allow indefinite late submissions.</p>
                  </div>
                )}
              </div>

            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-assignment-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm disabled:opacity-60 flex items-center gap-2"
          >
            {isSubmitting ? (initialAssignmentId ? "Updating..." : "Creating...") : (initialAssignmentId ? "Update Task" : "Create Task")}
          </button>
        </div>

      </div>
    </div>
  );
}
