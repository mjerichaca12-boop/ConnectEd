import { useState } from "react";
import {
  AI_TEST_CASES,
  EVALUATION_CATEGORIES,
  executeSingleTestCase,
  calculateOverallMetrics
} from "../../services/teacherAiEvaluation";
import {
  Sparkles,
  Award,
  BookOpen,
  Database,
  ShieldCheck,
  Lock,
  Play,
  Loader2,
  Search,
  Check,
  X,
  AlertTriangle,
  Zap
} from "lucide-react";

export function AIEvaluationPanel({ isOpen, onClose, callStreamAiFn }) {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [mockMode, setMockMode] = useState(true); // Default to Mock Mode to avoid burning tokens on dev clicks

  if (!isOpen) return null;

  const handleRunAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    setCurrentIndex(0);

    const results = [];
    for (let i = 0; i < AI_TEST_CASES.length; i++) {
      setCurrentIndex(i + 1);
      const testCase = AI_TEST_CASES[i];
      if (i > 0 && !mockMode) {
        await new Promise((r) => setTimeout(r, 1200));
      }
      const res = await executeSingleTestCase(testCase, callStreamAiFn, mockMode);
      results.push(res);
      setTestResults([...results]);
    }

    setIsRunning(false);
  };

  const handleRunSingleTest = async (testCase) => {
    const res = await executeSingleTestCase(testCase, callStreamAiFn, mockMode);
    setTestResults((prev) => {
      const idx = prev.findIndex((r) => r.testId === testCase.testId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = res;
        return next;
      }
      return [...prev, res];
    });
  };

  const metrics = calculateOverallMetrics(testResults);

  const displayTestList = AI_TEST_CASES.filter((tc) => {
    const matchesCat = selectedCategory === "ALL" || tc.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      tc.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.testId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-xl border border-green-500/30 text-green-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                ConnectEd AI Quality & Benchmark Suite
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                  {AI_TEST_CASES.length} Test Cases
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Grounding assertions, hallucination resistance, and context accuracy testing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mock Mode Toggle */}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
                className="rounded text-green-500 focus:ring-0"
              />
              <Zap className={`w-3.5 h-3.5 ${mockMode ? "text-amber-400" : "text-slate-500"}`} />
              <span>Offline Mock Mode</span>
            </label>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {/* Action & Metrics Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Run Button Card */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Execute Evaluation Suite</h3>
                <p className="text-xs text-slate-500 mb-4">
                  {mockMode
                    ? "Offline Mock Mode active: runs instant assertion checks without consuming Groq API tokens."
                    : "Live Mode active: streams live completions from Groq models to evaluate actual AI outputs."}
                </p>
              </div>

              <button
                onClick={handleRunAllTests}
                disabled={isRunning}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running ({currentIndex}/{AI_TEST_CASES.length})...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Run All {AI_TEST_CASES.length} AI Tests
                  </>
                )}
              </button>
            </div>

            {/* Overall Score Metrics */}
            <div className="lg:col-span-2 bg-slate-900 text-white rounded-xl p-5 shadow-sm grid grid-cols-2 sm:grid-cols-3 gap-4 border border-slate-800">
              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-400" /> Overall Quality
                </p>
                <p className="text-2xl font-black text-emerald-400">
                  {metrics ? `${metrics.overallQualityScore}%` : "N/A"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {metrics ? `${metrics.passed}/${metrics.totalTests} Passed` : "Not evaluated"}
                </p>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" /> ConnectEd System
                </p>
                <p className="text-2xl font-bold text-white">
                  {metrics ? `${metrics.connectEdKnowledgeScore}%` : "N/A"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">System workflows & rules</p>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Teaching Knowledge
                </p>
                <p className="text-2xl font-bold text-white">
                  {metrics ? `${metrics.teachingKnowledgeScore}%` : "N/A"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Pedagogy & DepEd K-12</p>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-green-400" /> Live Data Accuracy
                </p>
                <p className="text-2xl font-bold text-white">
                  {metrics ? `${metrics.liveDataScore}%` : "N/A"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Authorized teacher tools</p>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-red-400" /> Hallucination Resist
                </p>
                <p className="text-2xl font-bold text-white">
                  {metrics ? `${metrics.hallucinationScore}%` : "N/A"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Non-existent feature check</p>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-yellow-400" /> Security & Privacy
                </p>
                <p className="text-2xl font-bold text-white">
                  {metrics ? `${metrics.securityScore}%` : "N/A"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Data privacy protection</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {isRunning && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Executing Evaluation Test Suite...</span>
                <span>{Math.round((currentIndex / AI_TEST_CASES.length) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-500 h-2 transition-all duration-300 rounded-full"
                  style={{ width: `${(currentIndex / AI_TEST_CASES.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
              {["ALL", ...Object.values(EVALUATION_CATEGORIES)].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedCategory === cat
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat === "ALL" ? "All Categories" : cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter test cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-xs text-slate-800 pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          {/* Test Case Breakdown List */}
          <div className="space-y-3">
            {displayTestList.map((tc) => {
              const res = testResults.find((r) => r.testId === tc.testId);
              return (
                <div
                  key={tc.testId}
                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                        {tc.testId}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {tc.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRunSingleTest(tc)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Play className="w-3 h-3" /> Run Test
                      </button>

                      {res && (
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                            res.status === "PASS"
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : res.status === "PARTIAL"
                              ? "bg-amber-100 text-amber-700 border border-amber-200"
                              : "bg-red-100 text-red-700 border border-red-200"
                          }`}
                        >
                          {res.status === "PASS" && <Check className="w-3 h-3" />}
                          {res.status === "PARTIAL" && <AlertTriangle className="w-3 h-3" />}
                          {res.status === "FAIL" && <X className="w-3 h-3" />}
                          {res.status} ({res.score}%)
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-900">Question: "{tc.question}"</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      <span className="font-semibold">Expected Behavior:</span> {tc.expectedBehavior}
                    </p>
                  </div>

                  {res && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80">
                      <p className="text-[11px] font-semibold text-slate-600 mb-1">Actual AI Response ({res.durationMs}ms):</p>
                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                        {res.actualResponse}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
