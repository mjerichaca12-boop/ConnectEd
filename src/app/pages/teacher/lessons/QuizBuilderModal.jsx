import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { X, Plus, Trash2, Settings, ListOrdered, Shuffle, Clock, Award, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

export function QuizBuilderModal({ lessonId, initialQuizId = null, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState("questions");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [quizDetails, setQuizDetails] = useState({
    title: "",
    description: "",
    passing_score: 0,
    time_limit_minutes: "",
    attempts_allowed: 1,
    shuffle_questions: false,
    shuffle_choices: false,
  });

  const [questions, setQuestions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);

  useEffect(() => {
    if (initialQuizId) {
      fetchQuiz();
    }
  }, [initialQuizId]);

  const fetchQuiz = async () => {
    setIsLoading(true);
    try {
      const { data: qData, error: qError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", initialQuizId)
        .single();
      
      if (qError) throw qError;

      setQuizDetails({
        title: qData.title,
        description: qData.description || "",
        passing_score: qData.passing_score || 0,
        time_limit_minutes: qData.time_limit_minutes || "",
        attempts_allowed: qData.attempts_allowed || "",
        shuffle_questions: qData.shuffle_questions || false,
        shuffle_choices: qData.shuffle_choices || false,
      });

      let parsedAttachments = [];
      if (qData.attachment_url) {
        try {
          parsedAttachments = JSON.parse(qData.attachment_url);
        } catch(e) {
          parsedAttachments = [{ url: qData.attachment_url, name: qData.attachment_name || "Attachment" }];
        }
      }
      setExistingAttachments(parsedAttachments);

      const { data: qqData, error: qqError } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", initialQuizId)
        .order("order_index", { ascending: true });

      if (qqError) throw qqError;

      if (qqData) {
        setQuestions(qqData.map(q => ({
          ...q,
          options: q.options || [],
          correct_answer: q.correct_answer || ""
        })));
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load quiz details");
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
      e.target.value = null;
    }
  };

  const handleDetailChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setQuizDetails({ ...quizDetails, [e.target.name]: value });
  };

  const addQuestion = (type) => {
    setQuestions([
      ...questions,
      {
        id: Date.now().toString(),
        question_type: type,
        question_text: "",
        options: type === "Multiple Choice" ? ["", "", "", ""] : [],
        correct_answer: type === "True/False" ? "True" : "",
        points: 1
      }
    ]);
  };

  const updateQuestion = (id, field, value) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOption = (qId, optionIndex, value) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const removeQuestion = (id) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quizDetails.title) return toast.error("Quiz title is required");
    if (questions.length === 0) return toast.error("Please add at least one question");

    let totalPoints = 0;
    for (const q of questions) {
      if (!q.question_text) return toast.error("All questions must have text.");
      if (q.question_type === "Multiple Choice") {
        if (q.options.some(opt => !opt)) return toast.error("All multiple choice options must be filled.");
        if (!q.correct_answer || !q.options.includes(q.correct_answer)) {
          return toast.error("Please select a valid correct answer for multiple choice questions.");
        }
      }
      if (q.question_type === "Identification" && !q.correct_answer) {
        return toast.error("Identification questions must have a correct answer.");
      }
      totalPoints += parseInt(q.points) || 1;
    }

    setIsSubmitting(true);
    try {
      let finalAttachments = [...existingAttachments];

      if (attachments.length > 0) {
        for (const file of attachments) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          const filePath = `lesson_quizzes/${lessonId}/${fileName}`;

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

      const quizPayload = {
        lesson_id: lessonId,
        title: quizDetails.title,
        description: quizDetails.description,
        passing_score: parseInt(quizDetails.passing_score) || 0,
        time_limit_minutes: parseInt(quizDetails.time_limit_minutes) || null,
        attempts_allowed: parseInt(quizDetails.attempts_allowed) || null,
        shuffle_questions: quizDetails.shuffle_questions,
        shuffle_choices: quizDetails.shuffle_choices,
        total_points: totalPoints,
        attachment_url: finalAttachments.length > 0 ? JSON.stringify(finalAttachments) : null,
        attachment_name: null
      };

      let finalQuizId = initialQuizId;

      if (initialQuizId) {
        // Update existing quiz
        const { error: quizError } = await supabase
          .from("quizzes")
          .update(quizPayload)
          .eq("id", initialQuizId);
        if (quizError) throw quizError;
        
        // Delete old questions to re-insert
        await supabase.from("quiz_questions").delete().eq("quiz_id", initialQuizId);
      } else {
        // Insert new quiz
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .insert(quizPayload)
          .select()
          .single();
        if (quizError) throw quizError;
        finalQuizId = quizData.id;

        // Link to lesson activities
        const activityPayload = {
          lesson_id: lessonId,
          activity_type: 'Quiz',
          activity_id: finalQuizId
        };
        const { error: actError } = await supabase.from("lesson_activities").insert(activityPayload);
        if (actError) throw actError;
      }

      // Insert Questions
      const questionsPayload = questions.map((q, index) => ({
        quiz_id: finalQuizId,
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options.length ? q.options : null,
        correct_answer: q.correct_answer || null,
        points: parseInt(q.points) || 1,
        order_index: index
      }));

      const { error: questionsError } = await supabase.from("quiz_questions").insert(questionsPayload);
      if (questionsError) throw questionsError;

      toast.success(initialQuizId ? "Quiz updated successfully!" : "Quiz created successfully!");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(initialQuizId ? "Failed to update quiz" : "Failed to create quiz");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg text-green-600">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{initialQuizId ? "Edit Quiz" : "Create Quiz"}</h2>
              <p className="text-xs text-gray-500">Add questions and configure settings</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 shrink-0">
          <button 
            onClick={() => setActiveTab("questions")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "questions" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Builder ({questions.length})
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "settings" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Settings
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30 p-6">
          {activeTab === "questions" ? (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quiz Title *</label>
                  <input 
                    type="text" 
                    name="title"
                    placeholder="e.g. Midterm Examination" 
                    value={quizDetails.title}
                    onChange={handleDetailChange}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quiz Description / Instructions (Optional)</label>
                  <textarea 
                    name="description"
                    placeholder="Provide clear instructions for taking this quiz..." 
                    value={quizDetails.description}
                    onChange={handleDetailChange}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all resize-none"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <LinkIcon className="w-4 h-4 text-gray-400" /> Reference Material / Attachment (Optional)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="w-full px-0 py-2 bg-transparent text-sm focus:outline-none focus:ring-0 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Students can download these files when taking the quiz. Max 50MB per file.</p>
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

              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600">{idx + 1}</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-1 rounded">{q.question_type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <span>Pts:</span>
                        <input 
                          type="number" 
                          min="1" 
                          className="w-16 px-2 py-1 border border-gray-200 rounded-md text-center" 
                          value={q.points}
                          onChange={(e) => updateQuestion(q.id, 'points', e.target.value)}
                        />
                      </div>
                      <button onClick={() => removeQuestion(q.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Question Text</label>
                    <textarea 
                      placeholder="Type your question here..." 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all resize-none shadow-inner"
                      rows="3"
                      value={q.question_text}
                      onChange={(e) => updateQuestion(q.id, 'question_text', e.target.value)}
                    />
                  </div>

                  {q.question_type === "Multiple Choice" && (
                    <div className="space-y-3 pt-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Answers & Choices (Select the correct one)</label>
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${q.correct_answer === opt && opt !== "" ? 'border-green-400 bg-green-50/50 shadow-sm' : 'border-transparent hover:bg-gray-50'}`}>
                          <input 
                            type="radio" 
                            name={`correct_${q.id}`} 
                            checked={q.correct_answer === opt && opt !== ""}
                            onChange={() => updateQuestion(q.id, 'correct_answer', opt)}
                            className="w-5 h-5 text-green-600 border-gray-300 focus:ring-green-500 cursor-pointer"
                          />
                          <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 select-none">
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            <input 
                              type="text" 
                              placeholder={`Option text...`} 
                              value={opt}
                              onChange={(e) => updateOption(q.id, oIdx, e.target.value)}
                              className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all ${q.correct_answer === opt && opt !== "" ? 'border-green-300 bg-white' : 'border-gray-200 bg-white shadow-sm'}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.question_type === "True/False" && (
                    <div className="pt-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Select the correct answer</label>
                      <div className="flex gap-4">
                        {["True", "False"].map(opt => (
                          <label key={opt} className={`flex items-center justify-center flex-1 py-4 rounded-xl border-2 cursor-pointer transition-all shadow-sm ${q.correct_answer === opt ? 'border-green-500 bg-green-50 font-bold text-green-700 shadow-md transform scale-[1.02]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            <input 
                              type="radio" 
                              name={`correct_${q.id}`} 
                              className="hidden"
                              checked={q.correct_answer === opt}
                              onChange={() => updateQuestion(q.id, 'correct_answer', opt)}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.question_type === "Identification" && (
                    <div className="pl-4 border-l-2 border-gray-100">
                      <input 
                        type="text" 
                        placeholder="Exact correct answer..." 
                        value={q.correct_answer || ""}
                        onChange={(e) => updateQuestion(q.id, 'correct_answer', e.target.value)}
                        className="w-full px-4 py-2 border border-green-300 bg-green-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      />
                      <p className="text-xs text-gray-500 mt-1 italic">Auto-grading is case-insensitive.</p>
                    </div>
                  )}

                  {(q.question_type === "Short Answer" || q.question_type === "Essay") && (
                    <div className="pl-4 border-l-2 border-gray-100">
                      <div className="w-full p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
                        Students will type their answer here (Manual grading required)
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add Question Toolbar */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-2 justify-center">
                <span className="text-sm font-semibold text-gray-500 w-full text-center mb-2">Add New Question</span>
                {[
                  { type: "Multiple Choice", label: "Multiple Choice" },
                  { type: "True/False", label: "True / False" },
                  { type: "Identification", label: "Identification" },
                  { type: "Short Answer", label: "Short Answer" },
                  { type: "Essay", label: "Essay" }
                ].map(btn => (
                  <button 
                    key={btn.type}
                    onClick={() => addQuestion(btn.type)}
                    className="px-3 py-2 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-lg text-sm font-medium transition-colors text-gray-700 hover:text-green-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-400" /> General Settings</h3>
                
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1"><Award className="w-4 h-4 text-gray-400"/> Passing Score</label>
                    <input 
                      type="number" 
                      name="passing_score"
                      value={quizDetails.passing_score}
                      onChange={handleDetailChange}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-green-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1"><Clock className="w-4 h-4 text-gray-400"/> Time Limit (Minutes)</label>
                    <input 
                      type="number" 
                      name="time_limit_minutes"
                      value={quizDetails.time_limit_minutes}
                      onChange={handleDetailChange}
                      placeholder="No limit"
                      min="1"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-green-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1"><ListOrdered className="w-4 h-4 text-gray-400"/> Attempts Allowed</label>
                    <input 
                      type="number" 
                      name="attempts_allowed"
                      value={quizDetails.attempts_allowed}
                      onChange={handleDetailChange}
                      placeholder="Unlimited"
                      min="1"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-green-500/20"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="shuffle_questions"
                      checked={quizDetails.shuffle_questions}
                      onChange={handleDetailChange}
                      className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <div>
                      <span className="block font-medium text-gray-900">Shuffle Questions</span>
                      <span className="block text-xs text-gray-500">Randomize the order of questions for each student</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="shuffle_choices"
                      checked={quizDetails.shuffle_choices}
                      onChange={handleDetailChange}
                      className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <div>
                      <span className="block font-medium text-gray-900">Shuffle Choices</span>
                      <span className="block text-xs text-gray-500">Randomize the order of choices in multiple choice questions</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-white shrink-0 rounded-b-2xl">
          <div className="text-sm font-bold text-gray-500">
            Total Points: <span className="text-green-600 text-lg">{questions.reduce((acc, q) => acc + (parseInt(q.points) || 1), 0)}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm disabled:opacity-60 flex items-center gap-2"
            >
              {isSubmitting ? (initialQuizId ? "Updating..." : "Saving...") : (initialQuizId ? "Update Quiz" : "Save Quiz")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
