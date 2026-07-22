import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { X, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useAcademic } from "@/app/context/AcademicContext";

export function LessonBuilderModal({ subjectId, teacherId, initialLesson, onClose, onSuccess }) {
  const { activeSchoolYear, activeQuarter } = useAcademic();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    if (!formData.title) {
      toast.error("Lesson title is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        subject_id: subjectId,
        teacher_id: teacherId,
        title: formData.title,
        topic: formData.topic || null,
        description: formData.description || null,
        objectives: formData.objectives || null,
        week_number: formData.week_number ? parseInt(formData.week_number) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: "Draft"
      };

      if (initialLesson?.id) {
        const { error } = await supabase.from("lessons").update(payload).eq("id", initialLesson.id);
        if (error) throw error;
        toast.success("Lesson updated successfully");
      } else {
        payload.school_year = activeSchoolYear;
        payload.term = activeQuarter;
        const { error } = await supabase.from("lessons").insert(payload);
        if (error) throw error;
        toast.success("Lesson created successfully");
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
            {isSubmitting ? "Saving..." : (initialLesson ? "Save Changes" : "Create Lesson")}
          </button>
        </div>
      </div>
    </div>
  );
}
