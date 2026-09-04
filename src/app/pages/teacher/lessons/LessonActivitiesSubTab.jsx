import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { CheckCircle, FileText, Settings, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { QuizBuilderModal } from "./QuizBuilderModal";
import { AssignmentBuilderModal } from "./AssignmentBuilderModal";
import { DeleteConfirmationModal } from "@/app/components/ui/DeleteConfirmationModal";

export function LessonActivitiesSubTab({ lesson, onActivitiesChange }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    if (lesson?.id) {
      loadActivities();
    }
  }, [lesson?.id]);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const { data: actData, error: actError } = await supabase
        .from("lesson_activities")
        .select("*")
        .eq("lesson_id", lesson.id)
        .order("created_at", { ascending: false });

      if (actError) throw actError;

      if (!actData || actData.length === 0) {
        setActivities([]);
        setIsLoading(false);
        return;
      }

      // Fetch titles for quizzes and assignments
      const quizIds = actData.filter(a => a.activity_type === 'Quiz').map(a => a.activity_id);
      const assignmentIds = actData.filter(a => a.activity_type !== 'Quiz').map(a => a.activity_id);

      let quizzes = [];
      let assignments = [];

      if (quizIds.length > 0) {
        const { data: qData } = await supabase.from("quizzes").select("id, title").in("id", quizIds);
        quizzes = qData || [];
      }
      
      if (assignmentIds.length > 0) {
        const { data: aData } = await supabase.from("assignments").select("id, title").in("id", assignmentIds);
        assignments = aData || [];
      }

      const enrichedActivities = actData.map(act => {
        let title = null;
        if (act.activity_type === 'Quiz') {
          const q = quizzes.find(q => q.id === act.activity_id);
          if (q) title = q.title;
        } else {
          // Assignment, Activity, Assessment
          const a = assignments.find(a => a.id === act.activity_id);
          if (a) title = a.title;
        }
        return { ...act, title };
      }).filter(act => act.title !== null); // Filter out orphaned records

      setActivities(enrichedActivities);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load activities");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      // 1. Delete from lesson_activities first
      const { error: linkError } = await supabase.from("lesson_activities").delete().eq("id", itemToDelete.id);
      if (linkError) throw linkError;

      // 2. Delete the actual quiz or assignment
      let table = itemToDelete.activity_type === 'Quiz' ? 'quizzes' : 'assignments';
      const { error } = await supabase.from(table).delete().eq("id", itemToDelete.activity_id);
      if (error) throw error;
      
      toast.success(`${itemToDelete.activity_type === "Assessment" ? "Seatwork" : itemToDelete.activity_type} deleted successfully`);
      loadActivities();
      if (onActivitiesChange) onActivitiesChange();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("connected:assessments-changed", { detail: { lessonId: lesson?.id } }));
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to delete ${itemToDelete.activity_type.toLowerCase()}`);
    } finally {
      setItemToDelete(null);
    }
  };

  const openEditModal = (act) => {
    setSelectedActivity(act.activity_id);
    if (act.activity_type === 'Quiz') {
      setShowQuizModal(true);
    } else {
      setShowAssignmentModal(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => { setSelectedActivity(null); setShowQuizModal(true); }}
          className="flex-1 bg-white border border-green-200 hover:border-green-400 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all text-center group"
        >
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Create Quiz</h3>
          <p className="text-xs text-gray-500 mt-1">Multiple choice, true/false, etc.</p>
        </button>

        <button 
          onClick={() => { setSelectedActivity(null); setShowAssignmentModal(true); }}
          className="flex-1 bg-white border border-blue-200 hover:border-blue-400 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all text-center group"
        >
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Create Task/Assignment</h3>
          <p className="text-xs text-gray-500 mt-1">File uploads, essays, etc.</p>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
          No activities added to this lesson yet.
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => (
            <div key={act.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-gray-300 transition-colors shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg ${act.activity_type === 'Quiz' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                  {act.activity_type === 'Quiz' ? <CheckCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{act.title}</h4>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{act.activity_type === "Assessment" ? "Seatwork" : act.activity_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => openEditModal(act)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit Activity"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setItemToDelete(act)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Activity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showQuizModal && (
        <QuizBuilderModal 
          lessonId={lesson.id} 
          initialQuizId={selectedActivity}
          onClose={() => { setShowQuizModal(false); setSelectedActivity(null); }}
          onSuccess={() => {
            setShowQuizModal(false);
            setSelectedActivity(null);
            loadActivities();
            if (onActivitiesChange) onActivitiesChange();
          }}
        />
      )}

      {showAssignmentModal && (
        <AssignmentBuilderModal 
          lessonId={lesson.id} 
          initialAssignmentId={selectedActivity}
          onClose={() => { setShowAssignmentModal(false); setSelectedActivity(null); }}
          onSuccess={() => {
            setShowAssignmentModal(false);
            setSelectedActivity(null);
            loadActivities();
            if (onActivitiesChange) onActivitiesChange();
          }}
        />
      )}

      {itemToDelete && (
        <DeleteConfirmationModal
          title={`Delete ${itemToDelete.activity_type}`}
          message={`Are you sure you want to completely remove "${itemToDelete.title}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setItemToDelete(null)}
          confirmText="Delete"
        />
      )}
    </div>
  );
}
