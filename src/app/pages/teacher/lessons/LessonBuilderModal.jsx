import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { X, Calendar, Clock, Send, ShieldCheck, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAcademic } from "@/app/context/AcademicContext";

const formatForDateTimeInput = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function LessonBuilderModal({ subjectId, teacherId, initialLesson, onClose, onSuccess }) {
  const { activeSchoolYear, activeQuarter } = useAcademic();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialPublishMode = initialLesson?.status === "Published"
    ? "now"
    : initialLesson?.status === "Scheduled"
    ? "scheduled"
    : "draft";

  const [publishMode, setPublishMode] = useState(initialPublishMode);
  const [scheduledPublishAt, setScheduledPublishAt] = useState(
    formatForDateTimeInput(initialLesson?.scheduled_publish_at)
  );

  const [formData, setFormData] = useState({
    title: initialLesson?.title || "",
    week_number: initialLesson?.week_number || "",
    topic: initialLesson?.topic || "",
    description: initialLesson?.description || "",
    objectives: initialLesson?.objectives || "",
    start_date: initialLesson?.start_date || "",
    end_date: initialLesson?.end_date || ""
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Lesson title is required.");
      return;
    }

    if (publishMode === "scheduled") {
      if (!scheduledPublishAt) {
        toast.error("Please select a date and time to schedule publication.");
        return;
      }
      const scheduledDate = new Date(scheduledPublishAt);
      if (isNaN(scheduledDate.getTime())) {
        toast.error("Invalid scheduled date and time.");
        return;
      }
      if (scheduledDate <= new Date()) {
        toast.error("Scheduled time must be in the future.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let finalStatus = "Draft";
      let scheduledAtValue = null;
      let publishedAtValue = initialLesson?.published_at || null;

      if (publishMode === "now") {
        finalStatus = "Published";
        publishedAtValue = new Date().toISOString();
        scheduledAtValue = null;
      } else if (publishMode === "scheduled") {
        finalStatus = "Scheduled";
        scheduledAtValue = new Date(scheduledPublishAt).toISOString();
      } else {
        finalStatus = "Draft";
        scheduledAtValue = null;
      }

      const payload = {
        subject_id: subjectId,
        teacher_id: teacherId,
        title: formData.title.trim(),
        topic: formData.topic || null,
        description: formData.description || null,
        objectives: formData.objectives || null,
        week_number: formData.week_number ? parseInt(formData.week_number) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: finalStatus,
        scheduled_publish_at: scheduledAtValue,
        published_at: publishedAtValue
      };

      if (initialLesson?.id) {
        const { error } = await supabase.from("lessons").update(payload).eq("id", initialLesson.id);
        if (error) throw error;
        toast.success(
          finalStatus === "Published"
            ? "Lesson published successfully!"
            : finalStatus === "Scheduled"
            ? "Lesson scheduled successfully!"
            : "Lesson updated as draft"
        );
      } else {
        payload.school_year = activeSchoolYear;
        payload.term = activeQuarter;
        const { error } = await supabase.from("lessons").insert(payload);
        if (error) throw error;
        toast.success(
          finalStatus === "Published"
            ? "Lesson created and published!"
            : finalStatus === "Scheduled"
            ? "Lesson scheduled for publication!"
            : "Lesson created as draft"
        );
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(initialLesson ? "Failed to update lesson." : "Failed to create lesson.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-900">{initialLesson ? "Edit Lesson" : "Create New Lesson"}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="create-lesson-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="md:col-span-3">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lesson Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Introduction to Cells"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                  required
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Week No.</label>
                <input
                  type="number"
                  name="week_number"
                  value={formData.week_number}
                  onChange={handleChange}
                  min="1"
                  placeholder="e.g. 1"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Topic</label>
              <input
                type="text"
                name="topic"
                value={formData.topic}
                onChange={handleChange}
                placeholder="e.g. Biology - Chapter 1"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-gray-400" /> Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-gray-400" /> End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                placeholder="Briefly describe what this lesson is about..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all resize-none"
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Learning Objectives</label>
              <textarea
                name="objectives"
                value={formData.objectives}
                onChange={handleChange}
                rows="3"
                placeholder="What will students learn in this lesson? (e.g. 1. Understand cell structure...)"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all resize-none"
              ></textarea>
            </div>

            {/* Publication Settings Panel */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
              <label className="block text-sm font-bold text-gray-800 flex items-center gap-2">
                <Send className="w-4 h-4 text-green-600" />
                Publication Settings
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label
                  onClick={() => setPublishMode("now")}
                  className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    publishMode === "now"
                      ? "border-green-600 bg-green-50/50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                      Publish Now
                    </span>
                    <input
                      type="radio"
                      name="publishMode"
                      checked={publishMode === "now"}
                      onChange={() => setPublishMode("now")}
                      className="accent-green-600"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500">Visible to students immediately</span>
                </label>

                <label
                  onClick={() => setPublishMode("scheduled")}
                  className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    publishMode === "scheduled"
                      ? "border-blue-600 bg-blue-50/50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Schedule
                    </span>
                    <input
                      type="radio"
                      name="publishMode"
                      checked={publishMode === "scheduled"}
                      onChange={() => setPublishMode("scheduled")}
                      className="accent-blue-600"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500">Publish at future date & time</span>
                </label>

                <label
                  onClick={() => setPublishMode("draft")}
                  className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    publishMode === "draft"
                      ? "border-amber-600 bg-amber-50/50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-600" />
                      Save Draft
                    </span>
                    <input
                      type="radio"
                      name="publishMode"
                      checked={publishMode === "draft"}
                      onChange={() => setPublishMode("draft")}
                      className="accent-amber-600"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500">Hidden from students</span>
                </label>
              </div>

              {publishMode === "scheduled" && (
                <div className="mt-3 pt-3 border-t border-gray-200/80">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Scheduled Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledPublishAt}
                    onChange={(e) => setScheduledPublishAt(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required={publishMode === "scheduled"}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Students will gain access automatically at this timestamp.
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-lesson-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm disabled:opacity-60"
          >
            {isSubmitting
              ? "Saving..."
              : initialLesson
              ? "Save Changes"
              : publishMode === "now"
              ? "Publish Lesson"
              : publishMode === "scheduled"
              ? "Schedule Lesson"
              : "Save Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
