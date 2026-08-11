import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { FileUploadZone } from "@/app/components/ai/FileUploadZone";
import { ClassMaterialsLoader } from "@/app/components/ai/ClassMaterialsLoader";
import { AIToolbar } from "@/app/components/ai/AIToolbar";
import { AIChat } from "@/app/components/ai/AIChat";
import { streamMessage } from "@/app/lib/groqClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { detectUserIntent, resolveContextForIntent } from "@/app/services/teacherAiRouter";
import { AIEvaluationPanel } from "@/app/components/ai/AIEvaluationPanel";
import { parseDocument } from "@/app/lib/documentParser";
import { useTourPreview } from "@/app/hooks/useTourPreview";
import { getTeacherAssignedClasses } from "@/app/lib/teacherHelpers";
import { supabase } from "@/app/lib/supabaseClient";

const STORAGE_BUCKET = "class-materials";

const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem("currentUser") || "{}"); } catch { return {}; }
};

const WELCOME_MSG = {
  role: "assistant",
  content: `👋 **Hello, Teacher!** I'm your ConnectEd AI Teaching Assistant, powered by Groq AI.

I generate **lesson-aware** responses based on your actual subjects, lessons, and uploaded learning materials.

### Guided Lesson Flow:
- When you ask to generate educational content (like a quiz or reviewer), I'll automatically verify:
  1. Your active **Class / Subject**
  2. The specific **Lesson** you want to work on
  3. The **learning materials** uploaded under that lesson
- I will guide you to select these step-by-step directly in our chat!

*Let's get started!* 🎓`,
  timestamp: Date.now(),
};

const formatGradeLabel = (level) => {
  if (!level) return "";
  const str = String(level).trim();
  if (str.toLowerCase().startsWith("grade")) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  return `Grade ${str}`;
};

// Check if query is an analytics request (only needs Class context, bypasses Lesson/Materials)
const isAnalyticsRequest = (text) => {
  const t = text.toLowerCase();
  return (
    t.includes("analyze") ||
    t.includes("analytics") ||
    t.includes("performance") ||
    t.includes("grade") ||
    t.includes("score") ||
    t.includes("average") ||
    t.includes("highest") ||
    t.includes("lowest") ||
    t.includes("submission rate") ||
    t.includes("statistics") ||
    t.includes("metrics")
  );
};

// Check if query is a content generation request (requires full Class -> Lesson -> Materials flow)
const isGenerationRequest = (text) => {
  const t = text.toLowerCase();
  const deliverables = ["quiz", "assignment", "summarize", "summary", "reviewer", "explain", "objective", "discussion", "flashcard", "announcement", "lesson plan", "rubric", "parent letter", "translate", "exam"];
  
  const matchesKeyword = deliverables.some(k => t.includes(k));
  if (!matchesKeyword) return false;

  // Prioritize analytics routing if the query is analyzing grades
  if (isAnalyticsRequest(text)) return false;

  return true;
};

export function AIAssistant() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inputRef = useRef(null);
  const storedUser = getStoredUser();

  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileContents, setFileContents] = useState([]);
  const [dbMaterialContents, setDbMaterialContents] = useState([]);

  // Lesson-aware context state
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [selectedContextLesson, setSelectedContextLesson] = useState(null);
  const [selectedContextMaterial, setSelectedContextMaterial] = useState(null);
  
  const [flowState, setFlowState] = useState(null); // { step, originalPrompt, classId, lessonId }
  const [loadingContext, setLoadingContext] = useState(false);

  // Analytics and Duplicate Detection Contexts
  const [analyticsContext, setAnalyticsContext] = useState(null);
  const [existingContentContext, setExistingContentContext] = useState(null);

  // Combine local uploads + database materials for AI context
  const allFileContents = useMemo(
    () => [...fileContents, ...dbMaterialContents],
    [fileContents, dbMaterialContents]
  );

  // Last user message for regeneration
  const lastUserMsgRef = useRef(null);

  const [settings, setSettings] = useState({
    gradeLevel: "7",
    subject: "English",
    difficulty: "Medium",
    language: "English",
    itemCount: 10,
    quizTypes: ["Multiple Choice"],
    section: "",
    teacherName: storedUser?.name || "",
    selectedClassId: "",
    classContext: null,
  });

  const [isLoadingClasses, setIsLoadingClasses] = useState(true);

  // Fetch subjects, lessons, and materials on mount
  useEffect(() => {
    const fetchTeacherContext = async () => {
      if (!supabase) {
        setIsLoadingClasses(false);
        return;
      }
      setIsLoadingClasses(true);
      try {
        const { teacherId, classes: classesList } = await getTeacherAssignedClasses(storedUser);
        if (teacherId) {
          setActiveTeacherId(teacherId);
        }

        // Fetch lessons for these classes
        const subjectIds = classesList.map((c) => c.id);
        let lessonsList = [];
        if (subjectIds.length > 0) {
          const { data: lessonsData } = await supabase
            .from("lessons")
            .select("id, subject_id, title, topic, status")
            .in("subject_id", subjectIds);

          lessonsList = (lessonsData || []).map((l) => ({
            id: String(l.id),
            subjectId: String(l.subject_id),
            title: String(l.title || l.topic || "Untitled Lesson").trim(),
            topic: String(l.topic || "").trim(),
            status: String(l.status || "").trim(),
            materials: [],
          }));
        }

        // Fetch materials for lessons
        const lessonIds = lessonsList.map((l) => l.id);
        let materialsList = [];
        if (lessonIds.length > 0) {
          const { data: materialsData, error: materialsErr } = await supabase
            .from("lesson_materials")
            .select("id, file_name, file_type, file_url, created_at, lesson_id")
            .in("lesson_id", lessonIds);

          if (!materialsErr && materialsData) {
            materialsList = materialsData.map((m) => {
              const fileUrl = String(m.file_url || "").trim();
              const filePath = fileUrl ? fileUrl.split("/object/public/class-materials/")[1] || "" : "";
              return {
                id: String(m.id),
                title: String(m.file_name || "Untitled").trim(),
                fileType: String(m.file_type || "").trim().toUpperCase(),
                filePath,
                fileUrl,
                fileName: String(m.file_name || "").trim(),
                lessonId: String(m.lesson_id),
              };
            });
          }
        }

        lessonsList.forEach((les) => {
          les.materials = materialsList.filter((m) => m.lessonId === les.id);
        });

        classesList.forEach((cls) => {
          cls.lessons = lessonsList.filter((l) => l.subjectId === cls.id);
        });

        setTeacherClasses(classesList);

        // Auto-select first class if available and none selected yet
        if (classesList.length > 0 && !settings.selectedClassId) {
          const firstCls = classesList[0];
          setSettings((prev) => ({
            ...prev,
            selectedClassId: firstCls.id,
            subject: firstCls.name,
            gradeLevel: firstCls.gradeLevel,
            section: firstCls.section,
            classContext: {
              className: firstCls.name,
              subject: firstCls.name,
              gradeLevel: firstCls.gradeLevel,
              section: firstCls.section,
              teacherName: storedUser?.name || "",
            },
          }));
        }
      } catch (err) {
        console.error("Failed to load teacher classes context:", err);
      } finally {
        setIsLoadingClasses(false);
      }
    };

    fetchTeacherContext();
  }, [storedUser?.email, storedUser?.id]);

  // URL Param Syncing (Auto-anchors class context from current page context)
  useEffect(() => {
    const classIdParam = searchParams.get("classId") || searchParams.get("subjectId");
    const lessonIdParam = searchParams.get("lessonId");

    if (classIdParam && teacherClasses.length > 0) {
      const cls = teacherClasses.find(c => c.id === classIdParam);
      if (cls) {
        setSettings((prev) => ({
          ...prev,
          selectedClassId: cls.id,
          subject: cls.name,
          gradeLevel: cls.gradeLevel,
          section: cls.section,
          classContext: {
            className: cls.name,
            subject: cls.name,
            gradeLevel: cls.gradeLevel,
            section: cls.section,
            teacherName: storedUser?.name || "",
          },
        }));

        if (lessonIdParam && cls.lessons && cls.lessons.length > 0) {
          const les = cls.lessons.find(l => l.id === lessonIdParam);
          if (les) {
            setSelectedContextLesson(les);
            
            // Auto load materials for this lesson if they exist
            if (les.materials && les.materials.length > 0) {
              setSelectedContextMaterial({ title: "All Materials", value: "all" });
              
              const loadAll = async () => {
                const loadedContents = [];
                for (const mat of les.materials) {
                  try {
                    let fileBlob = null;
                    if (mat.filePath) {
                      const { data } = await supabase.storage.from(STORAGE_BUCKET).download(mat.filePath);
                      if (data) fileBlob = data;
                    }
                    if (!fileBlob && mat.fileUrl) {
                      const resp = await fetch(mat.fileUrl);
                      if (resp.ok) fileBlob = await resp.blob();
                    }
                    if (fileBlob) {
                      const file = new File([fileBlob], mat.fileName || mat.title, { type: fileBlob.type });
                      const content = await parseDocument(file);
                      if (content) {
                        loadedContents.push({ name: mat.title, content, type: fileBlob.type, _materialId: mat.id });
                      }
                    }
                  } catch (e) {
                    console.error("Auto load material failed:", mat.title, e);
                  }
                }
                if (loadedContents.length > 0) {
                  setDbMaterialContents(loadedContents);
                }
              };
              loadAll();
            }
          }
        }
      }
    }
  }, [searchParams, teacherClasses]);

  // Load Analytics and Existing Content (Duplicates) whenever class/lesson changes
  useEffect(() => {
    if (!settings.selectedClassId) {
      setAnalyticsContext(null);
      setExistingContentContext(null);
      return;
    }
    
    const classId = settings.selectedClassId;
    const lessonId = selectedContextLesson?.id || null;
    
    const fetchAnalytics = async () => {
      try {
        const { data: students } = await supabase
          .from("teacher_student_assignments")
          .select("student_id")
          .eq("subject_id", classId);
        const studentIds = (students || []).map(s => s.student_id);

        let analyticsData = [];
        if (studentIds.length > 0) {
          const { data: acts } = await supabase
            .from("assignments_activity")
            .select("id, title, max_score, activity_type")
            .eq("subject_id", classId);
          
          const assessmentsList = acts || [];

          if (assessmentsList.length > 0) {
            const assessmentIds = assessmentsList.map(a => a.id);
            
            const { data: grades } = await supabase
              .from("teacher_assessment_grades")
              .select("assessment_id, student_id, grade_value, status")
              .in("assessment_id", assessmentIds)
              .in("student_id", studentIds);

            const { data: submissions } = await supabase
              .from("teacher_assessment_submissions")
              .select("assessment_id, student_id, status")
              .in("assessment_id", assessmentIds)
              .in("student_id", studentIds);

            analyticsData = assessmentsList.map(assess => {
              const assessGrades = (grades || [])
                .filter(g => g.assessment_id === assess.id)
                .map(g => Number(g.grade_value || 0));
              
              const totalSubs = (submissions || []).filter(s => s.assessment_id === assess.id).length;
              
              const max = assessGrades.length > 0 ? Math.max(...assessGrades) : 0;
              const min = assessGrades.length > 0 ? Math.min(...assessGrades) : 0;
              const avg = assessGrades.length > 0 ? (assessGrades.reduce((a, b) => a + b, 0) / assessGrades.length).toFixed(1) : 0;
              const rate = studentIds.length > 0 ? ((totalSubs / studentIds.length) * 100).toFixed(0) : 0;

              return {
                id: assess.id,
                title: assess.title,
                type: assess.activity_type || "Assessment",
                averageScore: avg,
                highestScore: max,
                lowestScore: min,
                submissionRate: `${rate}%`,
                enrolledCount: studentIds.length,
                submissionCount: totalSubs
              };
            });
          }
        }

        setAnalyticsContext(analyticsData);
      } catch (e) {
        console.error("Failed to load class analytics:", e);
      }
      
      if (lessonId) {
        try {
          let quizTitles = [];
          let quizQuestions = [];
          let assignmentTitles = [];

          try {
            const { data: quizzes } = await supabase
              .from("quizzes")
              .select("id, title")
              .eq("lesson_id", lessonId);
            
            quizTitles = (quizzes || []).map(q => q.title);
            const quizIds = (quizzes || []).map(q => q.id);

            if (quizIds.length > 0) {
              const { data: qq } = await supabase
                .from("quiz_questions")
                .select("question_text, question_type")
                .in("quiz_id", quizIds);
              quizQuestions = (qq || []).map(q => `[${q.question_type || 'Question'}] ${q.question_text}`);
            }
          } catch {
            // Ignore optional quiz context failure
          }

          try {
            const { data: assignments } = await supabase
              .from("assignments")
              .select("id, title")
              .eq("lesson_id", lessonId);
            
            assignmentTitles = (assignments || []).map(a => a.title);
          } catch {
            // Ignore optional assignment context failure
          }

          setExistingContentContext({
            quizzes: quizTitles,
            questions: quizQuestions,
            assignments: assignmentTitles
          });
        } catch (e) {
          console.error("Failed to load lesson existing content:", e);
        }
      } else {
        setExistingContentContext(null);
      }
    };
    
    fetchAnalytics();
  }, [settings.selectedClassId, selectedContextLesson]);

  const handleLogout = () => {
    navigate("/login");
  };

  const [activeTeacherId, setActiveTeacherId] = useState(null);
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);

  const sendToAI = useCallback(async (promptText, historyMessages) => {
    setIsStreaming(true);

    const userMessage = { role: "user", content: promptText, timestamp: Date.now() };
    const currentMessages = [...historyMessages, userMessage];
    setMessages([...currentMessages, { role: "assistant", content: "", timestamp: Date.now() }]);

    // Detect Intent and Resolve System Context / Tool Retrieval
    const intentResult = detectUserIntent(promptText);
    const contextResult = await resolveContextForIntent(intentResult, activeTeacherId, promptText);

    if (contextResult.overrideResponse) {
      setMessages([
        ...currentMessages,
        { role: "assistant", content: contextResult.overrideResponse, timestamp: Date.now() }
      ]);
      setIsStreaming(false);
      return;
    }

    // Filter history to exclude guided choices from API context
    const apiMessages = currentMessages
      .filter(m => {
        const isWelcome = m.content?.includes("Hello, Teacher!");
        const isChoiceMessage = m.choices && m.choices.length > 0;
        const hasContent = m.content && m.content.trim() !== "";
        return !isWelcome && !isChoiceMessage && hasContent;
      })
      .map(m => ({ role: m.role, content: m.content }));

    let assistantMessage = "";
    const usedFiles = allFileContents.map(f => f.name);

    await streamMessage({
      messages: apiMessages,
      fileContents: allFileContents,
      role: "teacher",
      classContext: settings.classContext,
      analyticsContext,
      existingContentContext,
      bloomsLevel: settings.bloomsLevel || "None",
      activeModule: searchParams.get("module") || searchParams.get("page") || "",
      injectedSystemContext: contextResult.systemContext,
      onChunk: (text) => {
        assistantMessage += text;
        setMessages([
          ...currentMessages,
          { role: "assistant", content: assistantMessage + "▌", timestamp: Date.now() },
        ]);
      },
      onDone: (fullText) => {
        if (fullText) {
          setMessages([
            ...currentMessages,
            {
              role: "assistant",
              content: fullText,
              timestamp: Date.now(),
              usedFiles: allFileContents.length > 0 ? usedFiles : [],
            },
          ]);
        } else {
          setMessages(currentMessages);
        }
        setIsStreaming(false);
      },
      onError: (err) => {
        console.error("Groq Error:", err);
        const errorContent = err?.status === 429
          ? "⚠️ I'm receiving too many requests right now. Please wait a moment before trying again."
          : "⚠️ Sorry, I encountered an error while processing your request. Please try again later.";
        setMessages([
          ...currentMessages,
          { role: "assistant", content: errorContent, timestamp: Date.now() },
        ]);
        setIsStreaming(false);
      },
    });
  }, [allFileContents, settings.classContext, activeTeacherId]);

  const callStreamAiFnForEval = useCallback(async (question, injectedContext) => {
    let resultText = "";
    return new Promise((resolve, reject) => {
      streamMessage({
        messages: [{ role: "user", content: question }],
        role: "teacher",
        classContext: settings.classContext,
        injectedSystemContext: injectedContext,
        onChunk: (chunk) => {
          resultText += chunk;
        },
        onDone: (fullText) => {
          resolve(fullText || resultText);
        },
        onError: (err) => {
          reject(err);
        }
      });
    });
  }, [settings.classContext]);

  // Download and parse a list of materials helper
  const loadMaterialsToContext = async (materialsToLoad, userConfirmMsg, readyText) => {
    setLoadingContext(true);
    
    const loadingMsg = {
      role: "assistant",
      content: `📥 Downloading and processing ${materialsToLoad.length} material${materialsToLoad.length > 1 ? "s" : ""}...`,
      timestamp: Date.now() + 10,
    };
    setMessages((prev) => [...prev, userConfirmMsg, loadingMsg]);

    const loadedContents = [];
    let successCount = 0;

    for (const mat of materialsToLoad) {
      try {
        let fileBlob = null;
        if (mat.filePath) {
          const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .download(mat.filePath);
          if (!error && data) fileBlob = data;
        }

        if (!fileBlob && mat.fileUrl) {
          const resp = await fetch(mat.fileUrl);
          if (resp.ok) fileBlob = await resp.blob();
        }

        if (fileBlob) {
          const file = new File([fileBlob], mat.fileName || mat.title, { type: fileBlob.type });
          const content = await parseDocument(file);
          if (content) {
            loadedContents.push({ name: mat.title, content, type: fileBlob.type, _materialId: mat.id });
            successCount++;
          }
        }
      } catch (err) {
        console.error("Failed to parse material:", mat.title, err);
      }
    }

    setLoadingContext(false);

    if (successCount > 0) {
      setDbMaterialContents(loadedContents);
      const readyMsg = {
        role: "assistant",
        content: readyText,
        timestamp: Date.now() + 20,
      };

      setMessages((prev) => {
        const clean = prev.filter((m) => m.content !== loadingMsg.content);
        return [...clean, readyMsg];
      });

      setFlowState(null);
      const history = messages
        .filter((m) => m.content !== loadingMsg.content)
        .concat(userConfirmMsg, readyMsg);
      await sendToAI(flowState.originalPrompt, history);
    } else {
      // Fallback
      setMessages((prev) => [
        ...prev.filter((m) => m.content !== loadingMsg.content),
        {
          role: "assistant",
          content: "⚠️ Failed to extract text from materials. Falling back to general knowledge.",
          timestamp: Date.now() + 20,
        },
      ]);
      setFlowState(null);
      await sendToAI(flowState.originalPrompt, [...messages, userConfirmMsg]);
    }
  };

  // Handle guided wizard choice selections
  const handleChoiceClick = async (choice, msgIdx) => {
    // 1. Highlight selected option in bubble
    setMessages((prev) => {
      const next = [...prev];
      if (next[msgIdx]) {
        next[msgIdx] = {
          ...next[msgIdx],
          selectedChoiceIndex: next[msgIdx].choices.findIndex((c) => c.value === choice.value),
        };
      }
      return next;
    });

    const userConfirmMsg = {
      role: "user",
      content: choice.label,
      timestamp: Date.now(),
    };

    // WIZARD STEP transitions
    if (choice.type === "class") {
      const cls = teacherClasses.find((c) => c.id === choice.value);
      if (!cls) return;

      // Update class settings
      setSettings((prev) => ({
        ...prev,
        selectedClassId: cls.id,
        subject: cls.name,
        gradeLevel: cls.gradeLevel,
        section: cls.section,
        classContext: {
          className: cls.name,
          subject: cls.name,
          gradeLevel: cls.gradeLevel,
          section: cls.section,
          teacherName: storedUser?.name || "",
        },
      }));

      if (flowState?.step === "select_class_analytics") {
        setFlowState(null);
        setMessages((prev) => [...prev, userConfirmMsg]);
        await sendToAI(flowState.originalPrompt, [...messages, userConfirmMsg]);
        return;
      }

      // Evaluate lessons
      if (cls.lessons && cls.lessons.length > 0) {
        // Prompt for lesson
        const nextPrompt = {
          role: "assistant",
          content: `I found the following lessons in this class. Which lesson would you like me to use?`,
          choices: cls.lessons.map((l) => ({
            label: l.title,
            value: l.id,
            type: "lesson",
          })),
          timestamp: Date.now() + 10,
        };

        setMessages((prev) => [...prev, userConfirmMsg, nextPrompt]);
        setFlowState((prev) => ({
          ...prev,
          step: "select_lesson",
          classId: cls.id,
        }));
      } else {
        // No lessons exist -> ask decision
        const nextPrompt = {
          role: "assistant",
          content: `This class has no lessons defined yet. Would you like to generate content using general knowledge, or would you like to configure a lesson first?`,
          choices: [
            { label: "Use general knowledge", value: "general", type: "no_materials" },
            { label: "I will upload/configure later", value: "upload", type: "no_materials" },
          ],
          timestamp: Date.now() + 10,
        };

        setMessages((prev) => [...prev, userConfirmMsg, nextPrompt]);
        setFlowState((prev) => ({
          ...prev,
          step: "no_materials_decision",
          classId: cls.id,
        }));
      }
    } else if (choice.type === "lesson") {
      const cls = teacherClasses.find((c) => c.id === flowState.classId);
      const les = cls?.lessons.find((l) => l.id === choice.value);

      if (!les) return;
      setSelectedContextLesson(les);

      await handleLessonTransition(les, flowState.classId, [...messages, userConfirmMsg]);
    } else if (choice.type === "material") {
      const cls = teacherClasses.find((c) => c.id === flowState.classId);
      const les = cls?.lessons.find((l) => l.id === flowState.lessonId);

      if (choice.value === "general") {
        setSelectedContextMaterial({ title: "General Knowledge", value: "general" });
        setDbMaterialContents([]);

        const nextPrompt = {
          role: "assistant",
          content: `Great! I'll use general knowledge to generate your request.`,
          timestamp: Date.now() + 10,
        };

        setMessages((prev) => [...prev, userConfirmMsg, nextPrompt]);
        setFlowState(null);
        await sendToAI(flowState.originalPrompt, [...messages, userConfirmMsg, nextPrompt]);
      } else if (choice.value === "all") {
        const matList = les?.materials || [];
        setSelectedContextMaterial({ title: "All Materials", value: "all" });

        await loadMaterialsToContext(
          matList,
          userConfirmMsg,
          `Great! I've loaded all ${matList.length} materials from "**${les.title}**". Generating now...`
        );
      } else {
        const mat = les?.materials.find((m) => m.id === choice.value);
        if (!mat) return;

        setSelectedContextMaterial(mat);

        await loadMaterialsToContext(
          [mat],
          userConfirmMsg,
          `Great! I've loaded "${mat.title}" from "**${les.title}**". Generating now...`
        );
      }
    } else if (choice.type === "no_materials") {
      if (choice.value === "general") {
        setSelectedContextMaterial({ title: "General Knowledge", value: "general" });
        setDbMaterialContents([]);

        const nextPrompt = {
          role: "assistant",
          content: `Great! I'll use general knowledge to generate your request.`,
          timestamp: Date.now() + 10,
        };

        setMessages((prev) => [...prev, userConfirmMsg, nextPrompt]);
        setFlowState(null);
        await sendToAI(flowState.originalPrompt, [...messages, userConfirmMsg, nextPrompt]);
      } else {
        const nextPrompt = {
          role: "assistant",
          content: `Please configure lessons and upload materials under your class settings, then trigger your prompt again.`,
          timestamp: Date.now() + 10,
        };
        setMessages((prev) => [...prev, userConfirmMsg, nextPrompt]);
        setFlowState(null);
      }
    }
  };

  // Intermediate helper to handle lesson transition
  const handleLessonTransition = async (les, classId, currentMessages) => {
    if (les.materials && les.materials.length > 0) {
      // Multiple or single materials -> ask which one to use
      const nextPrompt = {
        role: "assistant",
        content: `I found learning materials for this lesson. Which material should I use? Or would you like me to use all uploaded materials?`,
        choices: [
          ...les.materials.map((m) => ({
            label: m.title,
            value: m.id,
            type: "material",
          })),
          { label: "Use all uploaded materials", value: "all", type: "material" },
          { label: "Use general knowledge", value: "general", type: "material" },
        ],
        timestamp: Date.now() + 10,
      };

      setMessages([...currentMessages, nextPrompt]);
      setFlowState((prev) => ({
        ...prev,
        step: "select_material",
        classId,
        lessonId: les.id,
      }));
    } else {
      // No materials in lesson -> ask decision
      const nextPrompt = {
        role: "assistant",
        content: `This lesson does not contain any uploaded learning materials yet. Would you like to:`,
        choices: [
          { label: "Generate content using general knowledge", value: "general", type: "no_materials" },
          { label: "Upload a learning material first", value: "upload", type: "no_materials" },
        ],
        timestamp: Date.now() + 10,
      };

      setMessages([...currentMessages, nextPrompt]);
      setFlowState((prev) => ({
        ...prev,
        step: "no_materials_decision",
        classId,
        lessonId: les.id,
      }));
    }
  };

  const handleQuickActionClick = async (action) => {
    let queryText = "";
    let actionLabel = "Quick Action";
    if (typeof action === "string") {
      actionLabel = action;
      queryText = `Generate content for ${action}`;
    } else if (action && typeof action.prompt === "function") {
      actionLabel = action.label || "Quick Action";
      queryText = action.prompt(settings);
    } else if (action && typeof action.prompt === "string") {
      actionLabel = action.label || "Quick Action";
      queryText = action.prompt;
    }
    
    const userActionMsg = {
      role: "user",
      content: `⚡ Triggered Quick Action: **${actionLabel}**`,
      timestamp: Date.now()
    };
    
    const hasClass = !!settings.selectedClassId;
    const hasLesson = !!selectedContextLesson;
    const hasMaterial = !!selectedContextMaterial;
    
    if (!hasClass) {
      if (teacherClasses.length === 0) {
        setMessages((prev) => [
          ...prev,
          userActionMsg,
          {
            role: "assistant",
            content: "⚠️ I couldn't find any classes assigned to you. Please contact your administrator.",
            timestamp: Date.now() + 10,
          },
        ]);
        return;
      }
      
      const nextPrompt = {
        role: "assistant",
        content: `Which class would you like me to use to generate the **${action.label}**?`,
        choices: teacherClasses.map((c) => ({
          label: `${formatGradeLabel(c.gradeLevel)} – ${c.section} (${c.name})`,
          value: c.id,
          type: "class",
        })),
        timestamp: Date.now() + 10,
      };
      
      setMessages((prev) => [...prev, userActionMsg, nextPrompt]);
      setFlowState({
        step: "select_class",
        originalPrompt: queryText,
        quickAction: action
      });
      return;
    }
    
    if (hasClass && !hasLesson) {
      const cls = teacherClasses.find(c => c.id === settings.selectedClassId);
      if (cls && cls.lessons && cls.lessons.length > 0) {
        const nextPrompt = {
          role: "assistant",
          content: `Which lesson would you like me to use to generate the **${action.label}**?`,
          choices: cls.lessons.map((l) => ({
            label: l.title,
            value: l.id,
            type: "lesson",
          })),
          timestamp: Date.now() + 10,
        };
        
        setMessages((prev) => [...prev, userActionMsg, nextPrompt]);
        setFlowState({
          step: "select_lesson",
          classId: cls.id,
          originalPrompt: queryText,
          quickAction: action
        });
      } else {
        const noLessonsMsg = {
          role: "assistant",
          content: `⚠️ This class does not have any lessons yet. Please add a lesson first or choose another class context.`,
          timestamp: Date.now() + 10
        };
        setMessages((prev) => [...prev, userActionMsg, noLessonsMsg]);
      }
      return;
    }
    
    if (hasClass && hasLesson && !hasMaterial) {
      const cls = teacherClasses.find(c => c.id === settings.selectedClassId);
      const les = cls?.lessons.find(l => l.id === selectedContextLesson.id);
      
      setFlowState({
        step: "select_material",
        classId: settings.selectedClassId,
        lessonId: selectedContextLesson.id,
        originalPrompt: queryText,
        quickAction: action
      });
      
      if (les && les.materials && les.materials.length > 0) {
        const nextPrompt = {
          role: "assistant",
          content: `Which learning material should I use to generate the **${action.label}**?`,
          choices: [
            ...les.materials.map((m) => ({
              label: m.title,
              value: m.id,
              type: "material",
            })),
            { label: "Use all uploaded materials", value: "all", type: "material" },
            { label: "Use general knowledge", value: "general", type: "material" },
          ],
          timestamp: Date.now() + 10,
        };
        setMessages((prev) => [...prev, userActionMsg, nextPrompt]);
      } else {
        const nextPrompt = {
          role: "assistant",
          content: `⚠️ No learning materials were found for the lesson "**${les?.title || 'this lesson'}**". Please upload a learning material first, or choose another lesson, or confirm to proceed with general knowledge:`,
          choices: [
            { label: "Generate content using general knowledge", value: "general", type: "no_materials" },
            { label: "I will upload a learning material first", value: "upload", type: "no_materials" },
          ],
          timestamp: Date.now() + 10,
        };
        setMessages((prev) => [...prev, userActionMsg, nextPrompt]);
      }
      return;
    }
    
    setMessages((prev) => [...prev, userActionMsg]);
    await sendToAI(queryText, [...messages, userActionMsg]);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isStreaming || loadingContext) return;

    const queryText = inputText.trim();
    setInputText("");

    const userMessage = { role: "user", content: queryText, timestamp: Date.now() };
    lastUserMsgRef.current = userMessage;

    // 1. Intercept prompt based on detected intent
    const isAnalytics = isAnalyticsRequest(queryText);
    const isGen = isGenerationRequest(queryText);
    const hasClass = !!settings.selectedClassId;
    const hasLesson = !!selectedContextLesson;

    // A. Analytics Intent Flow (Only requires Class context, bypasses Lesson/Material)
    if (isAnalytics) {
      if (!hasClass) {
        if (teacherClasses.length === 0) {
          setMessages((prev) => [
            ...prev,
            userMessage,
            {
              role: "assistant",
              content: "⚠️ I couldn't find any classes assigned to you. Please contact your administrator.",
              timestamp: Date.now() + 10,
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          userMessage,
          {
            role: "assistant",
            content: "Which class would you like me to analyze for this request?",
            choices: teacherClasses.map((c) => ({
              label: `${formatGradeLabel(c.gradeLevel)} – ${c.section} (${c.name})`,
              value: c.id,
              type: "class",
            })),
            timestamp: Date.now() + 10,
          },
        ]);

        setFlowState({
          step: "select_class_analytics",
          originalPrompt: queryText,
        });
        return;
      }

      // Class already active -> proceed immediately
      setMessages((prev) => [...prev, userMessage]);
      await sendToAI(queryText, [...messages, userMessage]);
      return;
    }

    // B. Content Generation Intent Flow (Requires Class -> Lesson -> Material)
    if (isGen) {
      if (!hasClass) {
        if (teacherClasses.length === 0) {
          setMessages((prev) => [
            ...prev,
            userMessage,
            {
              role: "assistant",
              content: "⚠️ I couldn't find any classes assigned to you. Please contact your administrator.",
              timestamp: Date.now() + 10,
            },
          ]);
          return;
        }

        // Prompt for class
        setMessages((prev) => [
          ...prev,
          userMessage,
          {
            role: "assistant",
            content: "I found learning materials in your classes. Which class would you like me to use?",
            choices: teacherClasses.map((c) => ({
              label: `${formatGradeLabel(c.gradeLevel)} – ${c.section} (${c.name})`,
              value: c.id,
              type: "class",
            })),
            timestamp: Date.now() + 10,
          },
        ]);

        setFlowState({
          step: "select_class",
          originalPrompt: queryText,
        });
        return;
      }

      if (!hasLesson) {
        const cls = teacherClasses.find((c) => c.id === settings.selectedClassId);
        if (cls) {
          setFlowState({
            step: "select_lesson",
            classId: cls.id,
            originalPrompt: queryText,
          });
          setMessages((prev) => [...prev, userMessage]);
          setTimeout(() => handleClassLessonsEval(cls, queryText, [...messages, userMessage]), 0);
          return;
        }
      }

      if (!selectedContextMaterial && allFileContents.length === 0) {
        const cls = teacherClasses.find((c) => c.id === settings.selectedClassId);
        const les = cls?.lessons.find((l) => l.id === selectedContextLesson.id);
        if (les) {
          setMessages((prev) => [...prev, userMessage]);
          setTimeout(() => handleLessonTransition(les, settings.selectedClassId, [...messages, userMessage]), 0);
          return;
        }
      }
    }

    // C. General Conversation Flow
    setMessages((prev) => [...prev, userMessage]);
    await sendToAI(queryText, [...messages, userMessage]);
  };

  // Helper when class lessons need evaluation inside handleSend
  const handleClassLessonsEval = async (cls, queryText, currentMessages) => {
    if (cls.lessons && cls.lessons.length > 0) {
      // Prompt lesson
      const nextPrompt = {
        role: "assistant",
        content: `I found the following lessons in this class. Which lesson would you like me to use?`,
        choices: cls.lessons.map((l) => ({
          label: l.title,
          value: l.id,
          type: "lesson",
        })),
        timestamp: Date.now() + 10,
      };
      setMessages((prev) => [...prev, nextPrompt]);
    } else {
      // 0 lessons
      const nextPrompt = {
        role: "assistant",
        content: `This class has no lessons defined yet. Would you like to generate content using general knowledge, or upload learning materials?`,
        choices: [
          { label: "Use general knowledge", value: "general", type: "no_materials" },
          { label: "Upload a learning material first", value: "upload", type: "no_materials" },
        ],
        timestamp: Date.now() + 10,
      };
      setMessages((prev) => [...prev, nextPrompt]);
      setFlowState((prev) => ({ ...prev, step: "no_materials_decision" }));
    }
  };

  const handleChangeContext = () => {
    setSelectedContextLesson(null);
    setSelectedContextMaterial(null);
    setDbMaterialContents([]);
    setSettings((prev) => ({
      ...prev,
      selectedClassId: "",
      classContext: null,
    }));
    setFlowState(null);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "🔄 Context reset. Please ask to generate a new topic to begin guided lesson context selection.",
        timestamp: Date.now(),
      },
    ]);
  };

  const handleRegenerate = useCallback(async () => {
    if (!lastUserMsgRef.current || isStreaming) return;

    setMessages(prev => {
      const withoutLast = [...prev];
      while (withoutLast.length > 0 && withoutLast[withoutLast.length - 1].role === "assistant") {
        withoutLast.pop();
      }
      const historyWithoutLastUser = [...withoutLast];
      if (historyWithoutLastUser.length > 0 && historyWithoutLastUser[historyWithoutLastUser.length - 1].role === "user") {
        historyWithoutLastUser.pop();
      }
      setTimeout(() => sendToAI(lastUserMsgRef.current.content, historyWithoutLastUser), 0);
      return withoutLast;
    });
  }, [isStreaming, sendToAI]);

  // Find class details for active context banner
  const activeClassObj = useMemo(
    () => teacherClasses.find((c) => c.id === settings.selectedClassId),
    [teacherClasses, settings.selectedClassId]
  );

  return (
    <div className="h-screen bg-gradient-to-tr from-gray-50 via-slate-50 to-emerald-50/20 flex overflow-hidden">
      <TeacherSidebar teacherName={storedUser?.name || "Teacher"} onLogout={handleLogout} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-64">

        {/* Top bar */}
        <div data-tour="teacher-ai-header" className="bg-white/80 backdrop-blur-md border-b border-gray-150 sticky top-0 z-20 flex-shrink-0">
          <div className="px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-green-600 text-[10px] font-bold uppercase tracking-widest">Teacher Portal</p>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  AI Assistant
                </h2>
              </div>

              {/* Class Context Selector Dropdown */}
              <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
                <span className="text-xs font-bold text-gray-500">Current Class:</span>
                <select
                  value={settings.selectedClassId || ""}
                  onChange={(e) => {
                    const clsId = e.target.value;
                    if (!clsId) {
                      handleChangeContext();
                    } else {
                      const cls = teacherClasses.find((c) => c.id === clsId);
                      if (cls) {
                        setSettings((prev) => ({
                          ...prev,
                          selectedClassId: cls.id,
                          subject: cls.name,
                          gradeLevel: cls.gradeLevel,
                          section: cls.section,
                          classContext: {
                            className: cls.name,
                            subject: cls.name,
                            gradeLevel: cls.gradeLevel,
                            section: cls.section,
                            teacherName: storedUser?.name || "",
                          },
                        }));
                      }
                    }
                  }}
                  className="bg-emerald-50/60 border border-emerald-300 text-emerald-900 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                >
                  <option value="">Select Class Context...</option>
                  {teacherClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} — Grade {cls.gradeLevel} {cls.section}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsEvalModalOpen(true)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <span>🧪</span> AI Evaluation Suite
              </button>
              <NotificationDropdown
                notifications={[]}
                onMarkAsRead={() => {}}
                onNotificationsChange={() => {}}
              />
            </div>
          </div>

          {/* Safe Development Context Debug View */}
          {activeClassObj && (
            <div className="bg-slate-900 text-slate-100 px-6 py-2 flex flex-wrap items-center justify-between text-xs border-t border-slate-800">
              <div className="flex items-center gap-4">
                <span className="font-bold text-green-400">🔍 Safe AI Context Loaded:</span>
                <span>Teacher: <strong>{storedUser?.name || "Authenticated Teacher"}</strong></span>
                <span>Subject: <strong>{activeClassObj.name}</strong></span>
                <span>Grade: <strong>Grade {activeClassObj.gradeLevel}</strong></span>
                <span>Section: <strong>{activeClassObj.section}</strong></span>
                <span>Class ID: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-green-300 font-mono">{activeClassObj.id}</code></span>
              </div>
              <div className="flex items-center gap-3 font-medium text-slate-300">
                <span>Enrolled: <strong>{activeClassObj.enrolled || analyticsContext?.length || 30}</strong></span>
                <span>Lessons: <strong>{activeClassObj.lessons?.length || 0}</strong></span>
                <span>Materials: <strong>{allFileContents.length}</strong></span>
                <span>Submissions: <strong>5</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Two-panel content */}
        <div className="flex-1 flex gap-5 p-6 overflow-hidden min-h-0">

          {/* LEFT PANEL */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-1 select-scrollbar">

            {/* File Upload Zone */}
            <div data-tour="teacher-ai-upload-zone" className="bg-white border border-gray-150 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition-all duration-300">
              <FileUploadZone
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                setFileContents={setFileContents}
              />
            </div>

            {/* Class & Lesson Context Selector */}
            <div data-tour="teacher-ai-class-context" className="bg-white border border-gray-150 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition-all duration-300">
              <ClassMaterialsLoader
                teacherClasses={teacherClasses}
                selectedClassId={settings.selectedClassId}
                selectedLesson={selectedContextLesson}
                selectedMaterial={selectedContextMaterial}
                onSelectClass={(cls) => {
                  if (cls) {
                    setSettings((prev) => ({
                      ...prev,
                      selectedClassId: cls.id,
                      subject: cls.name,
                      gradeLevel: cls.gradeLevel,
                      section: cls.section,
                      classContext: {
                        className: cls.name,
                        subject: cls.name,
                        gradeLevel: cls.gradeLevel,
                        section: cls.section,
                        teacherName: storedUser?.name || "",
                      },
                    }));
                  } else {
                    handleChangeContext();
                  }
                }}
                onSelectLesson={(les) => setSelectedContextLesson(les)}
                onSelectMaterial={(mat) => setSelectedContextMaterial(mat)}
                setDbMaterialContents={setDbMaterialContents}
              />
            </div>

            {/* AI Customization Controls */}
            <div data-tour="teacher-ai-toolbar" className="bg-white border border-gray-150 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition-all duration-300 flex-1">
              <AIToolbar settings={settings} setSettings={setSettings} onActionClick={handleQuickActionClick} teacherClasses={teacherClasses} />
            </div>

          </div>

          {/* RIGHT PANEL - CHAT DISPLAY */}
          <div data-tour="teacher-ai-chat" className="flex-1 flex flex-col min-w-0 bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden">
            <AIChat
              messages={messages}
              inputText={inputText}
              setInputText={setInputText}
              handleSend={handleSend}
              onSend={handleSend}
              isStreaming={isStreaming || loadingContext}
              fileContents={allFileContents}
              inputRef={inputRef}
              onRegenerate={handleRegenerate}
              onChoiceClick={handleChoiceClick}
              selectedClass={activeClassObj}
              selectedLesson={selectedContextLesson}
              selectedMaterial={selectedContextMaterial}
              onChangeContext={handleChangeContext}
            />
          </div>

        </div>
      </div>

      <AIEvaluationPanel
        isOpen={isEvalModalOpen}
        onClose={() => setIsEvalModalOpen(false)}
        callStreamAiFn={callStreamAiFnForEval}
      />
    </div>
  );
}
