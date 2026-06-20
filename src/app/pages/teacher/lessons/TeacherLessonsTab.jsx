import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { Plus, BookOpen, Clock, ChevronRight, ArrowLeft, FileText, CheckCircle, Video, Image as ImageIcon, Archive, Trash2, Edit, RefreshCw, FolderArchive } from "lucide-react";
import { toast } from "sonner";
import { LessonBuilderModal } from "./LessonBuilderModal";
import { DeleteConfirmationModal } from "@/app/components/ui/DeleteConfirmationModal";
import { LessonDetailView } from "./LessonDetailView";

export function TeacherLessonsTab({ subjectId, teacherId, onLessonsChange }) {
  const [lessons, setLessons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [lessonToEdit, setLessonToEdit] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [activeTab, setActiveTab] = useState("Active");
  const [lessonToDelete, setLessonToDelete] = useState(null);

  useEffect(() => {
    if (subjectId && teacherId) {
      loadLessons();
    }
  }, [subjectId, teacherId, activeTab]);

  const loadLessons = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("lessons")
        .select(`
          *,
          lesson_materials(id),
          lesson_activities(id)
        `)
        .eq("subject_id", subjectId)
        .eq("teacher_id", teacherId)
        .in("status", activeTab === "Active" ? ["Draft", "Published"] : ["Archived"])
        .order("week_number", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLessons(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load lessons.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLessonSaved = () => {
    loadLessons();
    setShowBuilderModal(false);
    setLessonToEdit(null);
    if (onLessonsChange) onLessonsChange();
  };

  const handleArchiveToggle = async (lesson) => {
    const newStatus = lesson.status === "Archived" ? "Draft" : "Archived";
    try {
      const { error } = await supabase.from("lessons").update({ status: newStatus }).eq("id", lesson.id);
      if (error) throw error;
      toast.success(`Lesson ${newStatus === "Archived" ? "archived" : "restored"} successfully`);
      loadLessons();
      if (onLessonsChange) onLessonsChange();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${newStatus === "Archived" ? "archive" : "restore"} lesson`);
    }
  };

  const confirmDelete = async () => {
    if (!lessonToDelete) return;
    try {
      const { error } = await supabase.from("lessons").delete().eq("id", lessonToDelete.id);
      if (error) throw error;
      toast.success("Lesson deleted successfully");
      loadLessons();
      if (onLessonsChange) onLessonsChange();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete lesson");
    } finally {
      setLessonToDelete(null);
    }
  };

  if (selectedLesson) {
    return (
      <LessonDetailView 
        lesson={selectedLesson} 
        onBack={() => setSelectedLesson(null)} 
        onLessonUpdated={(updatedLesson) => {
          setSelectedLesson(updatedLesson);
          loadLessons();
          if (onLessonsChange) onLessonsChange();
        }}
        onActivitiesChange={onLessonsChange}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Lesson Management</h2>
          <p className="text-sm text-gray-500 mt-1">Organize your materials, assignments, and quizzes into structured lessons.</p>
        </div>
        <button 
          onClick={() => {
            setLessonToEdit(null);
            setShowBuilderModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Lesson
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
        <button
          onClick={() => setActiveTab("Active")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === "Active" ? "bg-green-100 text-green-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"}`}
        >
          Active Lessons
        </button>
        <button
          onClick={() => setActiveTab("Archived")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === "Archived" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"}`}
        >
          <FolderArchive className="w-4 h-4" />
          Archived
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : lessons.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
            {activeTab === "Active" ? <BookOpen className="w-8 h-8" /> : <FolderArchive className="w-8 h-8" />}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No {activeTab} Lessons</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {activeTab === "Active" 
              ? "Create your first lesson to start organizing materials and activities for your students." 
              : "No lessons have been archived yet."}
          </p>
          {activeTab === "Active" && (
            <button 
              onClick={() => {
                setLessonToEdit(null);
                setShowBuilderModal(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold shadow-sm hover:shadow-md"
            >
              <Plus className="w-5 h-5" />
              Create Your First Lesson
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {lessons.map(lesson => (
            <div 
              key={lesson.id} 
              onClick={() => setSelectedLesson(lesson)}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-green-300 transition-colors cursor-pointer group shadow-sm flex justify-between items-center"
            >
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs text-gray-500 font-medium">Week</span>
                  <span className="text-lg font-bold text-green-700">{lesson.week_number || "-"}</span>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-gray-900 text-lg group-hover:text-green-700 transition-colors">{lesson.title}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      lesson.status === 'Published' ? 'bg-green-100 text-green-800' :
                      lesson.status === 'Draft' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {lesson.status}
                    </span>
                  </div>
                  {lesson.topic && <p className="text-sm text-gray-600 mb-3">{lesson.topic}</p>}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> {lesson.lesson_materials?.length || 0} Materials</div>
                    <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {lesson.lesson_activities?.length || 0} Activities</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLessonToEdit(lesson);
                    setShowBuilderModal(true);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit Lesson"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchiveToggle(lesson);
                  }}
                  className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title={activeTab === "Active" ? "Archive Lesson" : "Restore Lesson"}
                >
                  {activeTab === "Active" ? <Archive className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLessonToDelete(lesson);
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Lesson"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-green-600 transition-colors ml-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilderModal && (
        <LessonBuilderModal 
          subjectId={subjectId} 
          teacherId={teacherId} 
          initialLesson={lessonToEdit}
          onClose={() => {
            setShowBuilderModal(false);
            setLessonToEdit(null);
          }}
          onSuccess={handleLessonSaved}
        />
      )}

      {lessonToDelete && (
        <DeleteConfirmationModal
          isOpen={!!lessonToDelete}
          onClose={() => setLessonToDelete(null)}
          onConfirm={confirmDelete}
          title="Delete Lesson?"
          message="This action cannot be undone. Are you sure you want to permanently delete this lesson?"
          itemName={lessonToDelete.title}
        />
      )}
    </div>
  );
}
