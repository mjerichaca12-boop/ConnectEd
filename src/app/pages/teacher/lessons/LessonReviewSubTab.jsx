import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { FileText, Download, CheckCircle, Image as ImageIcon, Video, File, Clock, BookOpen } from "lucide-react";
import { toast } from "sonner";

export function LessonReviewSubTab({ lesson }) {
  const [materials, setMaterials] = useState([]);
  const [activities, setActivities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (lesson?.id) {
      loadLessonContent();
    }
  }, [lesson?.id]);

  const loadLessonContent = async () => {
    setIsLoading(true);
    try {
      // Fetch Materials
      const { data: matData, error: matError } = await supabase
        .from("lesson_materials")
        .select("*")
        .eq("lesson_id", lesson.id)
        .order("created_at", { ascending: false });
      
      if (matError) throw matError;
      setMaterials(matData || []);

      // Fetch Activities
      const { data: actData, error: actError } = await supabase
        .from("lesson_activities")
        .select("*")
        .eq("lesson_id", lesson.id)
        .order("created_at", { ascending: false });

      if (actError) throw actError;

      if (!actData || actData.length === 0) {
        setActivities([]);
      } else {
        const quizIds = actData.filter(a => a.activity_type === 'Quiz').map(a => a.activity_id);
        const assignmentIds = actData.filter(a => a.activity_type !== 'Quiz').map(a => a.activity_id);

        let quizzes = [];
        let assignments = [];

        if (quizIds.length > 0) {
          const { data: qData } = await supabase.from("quizzes").select("id, title, total_points, attachment_url, attachment_name").in("id", quizIds);
          quizzes = qData || [];
        }
        
        if (assignmentIds.length > 0) {
          const { data: aData } = await supabase.from("assignments").select("id, title, total_points, due_date, attachment_url, attachment_name").in("id", assignmentIds);
          assignments = aData || [];
        }

        const enrichedActivities = actData.map(act => {
          let enrichedData = null;
          if (act.activity_type === 'Quiz') {
            const q = quizzes.find(q => q.id === act.activity_id);
            if (q) enrichedData = { title: q.title, points: q.total_points, due: null, attachment_url: q.attachment_url, attachment_name: q.attachment_name };
          } else {
            const a = assignments.find(a => a.id === act.activity_id);
            if (a) enrichedData = { title: a.title, points: a.total_points, due: a.due_date, attachment_url: a.attachment_url, attachment_name: a.attachment_name };
          }
          return { ...act, ...enrichedData };
        }).filter(act => act.title); // Filter out orphans

        setActivities(enrichedActivities);

        // Fetch Class Announcements
        const { data: annData, error: annError } = await supabase
          .from("class_announcements")
          .select("*")
          .eq("class_id", lesson.subject_id)
          .order("created_at", { ascending: false })
          .limit(5); // Show latest 5 announcements
        
        if (annError) {
          console.error("Announcements error:", annError);
        } else {
          setAnnouncements(annData || []);
        }

      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load review content");
    } finally {
      setIsLoading(false);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return <FileText className="w-6 h-6 text-red-500" />;
    if (fileType?.includes('image')) return <ImageIcon className="w-6 h-6 text-blue-500" />;
    if (fileType?.includes('video')) return <Video className="w-6 h-6 text-purple-500" />;
    return <File className="w-6 h-6 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      {/* Lesson Header Simulation */}
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full mb-4 uppercase tracking-wider">
          Week {lesson.order_index || 1}
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">{lesson.title}</h1>
        
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
          {lesson.start_date && (
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg">
              <Clock className="w-4 h-4" /> Available: {new Date(lesson.start_date).toLocaleDateString()}
            </div>
          )}
          {lesson.end_date && (
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg text-orange-600">
              <Clock className="w-4 h-4" /> Closes: {new Date(lesson.end_date).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="prose prose-blue max-w-none">
          <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" /> Description & Overview
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{lesson.description || "No description provided."}</p>
        </div>

        {lesson.objectives && (
          <div className="mt-8 bg-green-50/50 rounded-xl p-5 border border-green-100">
            <h3 className="text-sm font-bold text-green-800 uppercase tracking-wider mb-2">Learning Objectives</h3>
            <p className="text-gray-700 whitespace-pre-wrap text-sm">{lesson.objectives}</p>
          </div>
        )}
      </div>

      {/* Announcements Section */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-2xl p-8 border border-blue-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-500" /> Class Announcements
          </h2>
          <div className="space-y-4">
            {announcements.map(ann => (
              <div key={ann.id} className="p-4 rounded-xl border border-blue-50 bg-blue-50/30">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-900">{ann.title}</h3>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
                    {new Date(ann.created_at).toLocaleDateString()}
                  </span>
                </div>
                {ann.content && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{ann.content}</p>
                )}
                {ann.created_by_name && (
                  <p className="text-xs text-gray-500 mt-3 font-medium">Posted by {ann.created_by_name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Materials Section */}
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <FileText className="w-6 h-6 text-gray-400" /> Learning Materials
        </h2>
        
        {materials.length === 0 ? (
          <p className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg text-center">No reading materials attached to this lesson.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {materials.map(mat => (
              <a 
                key={mat.id} 
                href={mat.file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
              >
                <div className="w-12 h-12 bg-white border border-gray-100 rounded-lg flex items-center justify-center shrink-0 shadow-sm group-hover:shadow">
                  {getFileIcon(mat.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">{mat.file_name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(mat.file_size)}</p>
                </div>
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  <Download className="w-4 h-4" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Required Tasks Section */}
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-green-500" /> Required Tasks
        </h2>
        
        {activities.length === 0 ? (
          <p className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg text-center">No required tasks for this lesson.</p>
        ) : (
          <div className="space-y-3">
            {activities.map(act => {
              const isQuiz = act.activity_type === 'Quiz';
              const isSeatwork = act.activity_type === 'Assessment' || act.activity_type === 'Seatwork';
              const badgeLabel = isQuiz ? 'QUIZ' : isSeatwork ? 'SEATWORK' : 'ASSIGNMENT';

              return (
                <div key={act.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-gray-200 bg-white hover:border-gray-300 shadow-sm transition-all gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      isQuiz ? 'bg-emerald-50 text-emerald-600' : isSeatwork ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {isQuiz ? <CheckCircle className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{act.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase border ${
                          isQuiz 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : isSeatwork 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {badgeLabel}
                        </span>
                        {act.points && <span className="text-xs text-gray-500 font-medium">• {act.points} Points</span>}
                        {act.due && <span className="text-xs text-orange-600 font-medium">• Due: {new Date(act.due).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>
                      {/* Render attachments if any */}
                      {(() => {
                        if (!act.attachment_url) return null;
                        let parsed = [];
                        try {
                          parsed = JSON.parse(act.attachment_url);
                        } catch(e) {
                          parsed = [{ url: act.attachment_url, name: act.attachment_name || "Attachment" }];
                        }
                        if (parsed.length === 0) return null;
                        return (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {parsed.map((f, i) => (
                              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-white shadow-sm hover:bg-blue-50 hover:text-blue-700 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:border-blue-200 transition-colors">
                                <Download className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[150px]">{f.name}</span>
                              </a>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <button 
                    className="w-full sm:w-auto px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
                    onClick={() => toast.info(`This is a preview. The "${badgeLabel}" will open here for students.`)}
                  >
                    Start {badgeLabel === 'QUIZ' ? 'Quiz' : 'Assignment'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
