import { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle, Clock, ChevronRight, ChevronLeft } from "lucide-react";

/**
 * Parses an AI-generated quiz text into a structured format.
 * Expects numbered questions and lettered options (A, B, C, D).
 * Expects an "Answer Key" section at the end.
 */
export const parseQuizText = (text) => {
  if (!text) return null;

  const lines = text.split("\n");
  const questions = [];
  let currentQuestion = null;
  let answerKey = {};
  let inAnswerKey = false;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const lowerLine = line.toLowerCase();
    if (lowerLine.includes("answer key") || lowerLine.startsWith("## answer") || lowerLine.startsWith("**answer")) {
      inAnswerKey = true;
      continue;
    }

    if (inAnswerKey) {
      // Parse answer key: "1. A", "Question 1: B", etc.
      const match = line.match(/^(\d+)[.:]\s*([A-D])/i);
      if (match) {
        answerKey[parseInt(match[1])] = match[2].toUpperCase();
      }
      continue;
    }

    // Parse question: "1. What is...", "Q1: How does..."
    const qMatch = line.match(/^(\d+)[.:]\s*(.+)/);
    if (qMatch) {
      if (currentQuestion) questions.push(currentQuestion);
      currentQuestion = {
        id: parseInt(qMatch[1]),
        question: qMatch[2],
        options: {},
      };
      continue;
    }

    // Parse option: "A. Option text", "(B) Other text"
    const oMatch = line.match(/^([A-D])[.:)]\s*(.+)/i);
    if (oMatch && currentQuestion) {
      currentQuestion.options[oMatch[1].toUpperCase()] = oMatch[2];
      continue;
    }
    
    // Append to current question text if it doesn't match a new question or option
    if (currentQuestion && !oMatch && !qMatch) {
        currentQuestion.question += " " + line;
    }
  }

  if (currentQuestion) questions.push(currentQuestion);

  // Attach correct answers to questions
  const finalQuestions = questions.map(q => ({
    ...q,
    correctAnswer: answerKey[q.id] || null
  }));

  return finalQuestions.length > 0 ? finalQuestions : null;
};

export function QuizTakingModal({ isOpen, onClose, quizTitle, quizContent, onComplete, maxPoints }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentStep, setCurrentStep] = useState(0); // 0: Start, 1: Questions, 2: Result
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (isOpen && quizContent) {
      const parsed = parseQuizText(quizContent);
      if (parsed) {
        setQuestions(parsed);
        setAnswers({});
        setCurrentStep(1);
        setCurrentQuestionIndex(0);
      } else {
        // If parsing fails, we might just show the text, but the goal is auto-grading
        // For now, we'll assume it's parsable or notify
        console.error("Failed to parse quiz content for interactive mode");
      }
    }
  }, [isOpen, quizContent]);

  const handleOptionSelect = (questionId, optionKey) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionKey }));
  };

  const calculateResults = () => {
    let correctCount = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    const calculatedScore = Math.round((correctCount / questions.length) * maxPoints);
    setScore(calculatedScore);
    setCurrentStep(2);
    return calculatedScore;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{quizTitle}</h3>
            {currentStep === 1 && (
              <p className="text-xs text-gray-500 font-medium">Question {currentQuestionIndex + 1} of {questions.length}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 1 && questions.length > 0 && (
            <div className="space-y-6">
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-5">
                <h4 className="text-base font-semibold text-gray-900 leading-relaxed">
                  {questions[currentQuestionIndex].id}. {questions[currentQuestionIndex].question}
                </h4>
              </div>

              <div className="space-y-3">
                {Object.entries(questions[currentQuestionIndex].options).map(([key, text]) => (
                  <button
                    key={key}
                    onClick={() => handleOptionSelect(questions[currentQuestionIndex].id, key)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${
                      answers[questions[currentQuestionIndex].id] === key
                        ? "border-violet-600 bg-violet-50 text-violet-900"
                        : "border-gray-100 bg-white hover:border-violet-200"
                    }`}
                  >
                    <span className="text-sm font-medium"><span className="font-bold mr-2">{key}.</span> {text}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                       answers[questions[currentQuestionIndex].id] === key
                        ? "border-violet-600 bg-violet-600"
                        : "border-gray-200 group-hover:border-violet-300"
                    }`}>
                      {answers[questions[currentQuestionIndex].id] === key && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h4 className="text-2xl font-bold text-gray-900">Quiz Completed!</h4>
                <p className="text-gray-500 mt-1">Great job finishing the assessment.</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 max-w-sm mx-auto">
                <p className="text-gray-500 text-sm mb-1 uppercase tracking-wider font-bold">Your Score</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-black text-violet-600">{score}</span>
                  <span className="text-gray-400 font-bold">/ {maxPoints}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                   <p className="text-xs font-bold text-gray-400">PERCENTAGE</p>
                   <p className="text-xl font-bold text-gray-900">{Math.round((score / maxPoints) * 100)}%</p>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                 <button
                  onClick={() => onComplete(score)}
                  className="w-full py-4 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition-all shadow-lg"
                >
                  Submit Results
                </button>
                <p className="text-xs text-gray-400 italic">Your grade will be automatically recorded in the system.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {currentStep === 1 && (
          <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex items-center justify-between">
            <button
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <div className="flex items-center gap-2">
              {currentQuestionIndex === questions.length - 1 ? (
                <button
                  onClick={calculateResults}
                  className="px-6 py-2 bg-violet-600 text-white rounded-lg font-bold hover:bg-violet-700 transition-all text-sm"
                >
                  Finish Quiz
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  className="flex items-center gap-1 px-6 py-2 bg-white border border-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-50 transition-all text-sm shadow-sm"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
