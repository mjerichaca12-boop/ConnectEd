import { useState } from "react";
import {
  AI_TEST_CASES,
  EVALUATION_CATEGORIES,
  executeSingleTestCase,
  calculateOverallMetrics
} from "../../services/teacherAiEvaluation";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Loader2,
  ShieldCheck,
  Award,
  BookOpen,
  Database,
  Lock,
  Search,
  Check,
  X
} from "lucide-react";

export function AIEvaluationPanel({ isOpen, onClose, callStreamAiFn }) {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const handleRunAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    setCurrentIndex(0);

    const results = [];
    for (let i = 0; i < AI_TEST_CASES.length; i++) {
      setCurrentIndex(i + 1);
      const testCase = AI_TEST_CASES[i];
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 1200));
      }
      const res = await executeSingleTestCase(testCase, callStreamAiFn);
      results.push(res);
      setTestResults([...results]);
    }

    setIsRunning(false);
  };

  const metrics = calculateOverallMetrics(testResults);

  const filteredResults = testResults.filter((r) => {
    const matchesCat = selectedCategory === "ALL" || r.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      r.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.actualResponse.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-500/20 rounded-xl border border-green-500/30 text-green-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Teacher AI Quality & Evaluation Suite
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                  35 Test Cases
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Deterministic automated quality benchmarks, grounding assertions, and hallucination resistance checks.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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
                  Run all 35 test cases across 5 categories to generate an objective accuracy score.
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
                    Run All 35 AI Tests
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

          {/* Progress Bar when running */}
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
            {filteredResults.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 text-sm font-semibold">No test evaluation results yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click "Run All 35 AI Tests" above to execute the automated benchmark suite.
                </p>
              </div>
            ) : (
              filteredResults.map((r) => (
                <div
                  key={r.testId}
                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                        {r.testId}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {r.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">{r.durationMs}ms</span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          r.status === "PASS"
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : r.status === "PARTIAL"
                            ? "bg-amber-100 text-amber-700 border border-amber-200"
                            : "bg-red-100 text-red-700 border border-red-200"
                        }`}
                      >
                        {r.status === "PASS" && <Check className="w-3 h-3" />}
                        {r.status === "PARTIAL" && <AlertTriangle className="w-3 h-3" />}
                        {r.status === "FAIL" && <X className="w-3 h-3" />}
                        {r.status} ({r.score}%)
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-900">Question: "{r.question}"</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      <span className="font-semibold">Expected Behavior:</span> {r.expectedBehavior}
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80">
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">Actual AI Response:</p>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                      {r.actualResponse}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
