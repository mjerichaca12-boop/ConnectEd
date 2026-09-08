import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { isColumnMissingError } from "@/app/lib/teacherHelpers";
import { ArrowLeft, BookOpen, FileText, CheckCircle, Clock, Eye, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { LessonMaterialsSubTab } from "./LessonMaterialsSubTab";
import { LessonActivitiesSubTab } from "./LessonActivitiesSubTab";
import { LessonReviewSubTab } from "./LessonReviewSubTab";

export function LessonDetailView({ lesson, onBack, onLessonUpdated, onActivitiesChange }) {
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const payload = {
        status: "Published",
        published_at: new Date().toISOString(),
        scheduled_publish_at: null
      };

      let { error } = await supabase
        .from("lessons")
        .update(payload)
        .eq("id", lesson.id);

      if (error && isColumnMissingError(error)) {
        console.warn("[LessonDetailView] Extended columns missing in schema, updating status only:", error);
        const retryRes = await supabase
          .from("lessons")
          .update({ status: "Published" })
          .eq("id", lesson.id);
        error = retryRes.error;
      }
        
      if (error) throw error;
      toast.success("Lesson published successfully!");
      onLessonUpdated({
        ...lesson,
        status: "Published",
        published_at: new Date().toISOString(),
        scheduled_publish_at: null
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to publish lesson.");
    } finally {
      setIsPublishing(false);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{lesson.title}</h2>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                lesson.status === 'Published' ? 'bg-green-100 text-green-800' :
                lesson.status === 'Scheduled' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                lesson.status === 'Draft' ? 'bg-amber-100 text-amber-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {lesson.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {lesson.week_number ? `Week ${lesson.week_number}` : "No Week Assigned"} 
              {lesson.topic ? ` • ${lesson.topic}` : ""}
              {lesson.status === "Scheduled" && lesson.scheduled_publish_at && (
                <span className="text-blue-600 font-medium ml-2">
                  • Scheduled for {formatDateTime(lesson.scheduled_publish_at)}
                </span>
              )}
            </p>
          </div>
        </div>

        {(lesson.status === "Draft" || lesson.status === "Scheduled") && (
          <button 
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold shadow-sm disabled:opacity-60"
          >
            <ShieldCheck className="w-5 h-5" />
            {isPublishing ? "Publishing..." : "Publish Lesson Now"}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[500px]">
        {/* Tabs */}
        <div className="flex items-center border-b border-gray-100 px-2 bg-gray-50/50">
          {[
            { id: "overview", label: "Overview", icon: <BookOpen className="w-4 h-4" /> },
            { id: "materials", label: "Materials", icon: <FileText className="w-4 h-4" /> },
            { id: "activities", label: "Activities", icon: <CheckCircle className="w-4 h-4" /> },
            { id: "review", label: "Review Mode", icon: <Eye className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
                activeSubTab === tab.id 
                  ? "border-green-600 text-green-700 bg-white" 
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 flex-1 bg-white">
          {activeSubTab === "overview" && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-gray-800 whitespace-pre-wrap">{lesson.description || "No description provided."}</p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Learning Objectives</h3>
                <p className="text-gray-800 whitespace-pre-wrap">{lesson.objectives || "No objectives defined."}</p>
              </div>
              <div className="flex flex-wrap gap-8">
                {lesson.status === "Scheduled" && lesson.scheduled_publish_at && (
                  <div>
                    <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider mb-2">Scheduled Publication</h3>
                    <div className="flex items-center gap-2 text-blue-900 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                      <Clock className="w-4 h-4 text-blue-600" />
                      {formatDateTime(lesson.scheduled_publish_at)}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Start Date</h3>
                  <div className="flex items-center gap-2 text-gray-800">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {lesson.start_date || "Not set"}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">End Date</h3>
                  <div className="flex items-center gap-2 text-gray-800">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {lesson.end_date || "Not set"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "materials" && (
            <LessonMaterialsSubTab lesson={lesson} />
          )}

          {activeSubTab === "activities" && (
            <LessonActivitiesSubTab lesson={lesson} onActivitiesChange={onActivitiesChange} />
          )}

          {activeSubTab === "review" && (
            <div className="space-y-6">
              <div className="bg-blue-600 text-white p-4 rounded-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Student Preview Mode</h3>
                    <p className="text-blue-100 text-sm">This accurately simulates how your students will see this lesson.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveSubTab("overview")}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm"
                >
                  Exit Preview
                </button>
              </div>
              <LessonReviewSubTab lesson={lesson} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
