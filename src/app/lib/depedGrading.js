export const DEPED_SUBJECT_CATEGORIES = [
  "Languages / AP / EsP",
  "Science / Mathematics",
  "MAPEH / EPP / TLE",
];

export const DEPED_DEFAULT_GRADE_SETTINGS = {
  "Languages / AP / EsP": {
    writtenWorksWeight: 40,
    performanceTasksWeight: 60,
    writtenWorksEnabled: true,
    performanceTasksEnabled: true,
  },
  "Science / Mathematics": {
    writtenWorksWeight: 50,
    performanceTasksWeight: 50,
    writtenWorksEnabled: true,
    performanceTasksEnabled: true,
  },
  "MAPEH / EPP / TLE": {
    writtenWorksWeight: 30,
    performanceTasksWeight: 70,
    writtenWorksEnabled: true,
    performanceTasksEnabled: true,
  },
};

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

export const normalizeSubjectCategory = (value, subjectName = "") => {
  const normalized = normalizeText(value);
  if (DEPED_SUBJECT_CATEGORIES.some((category) => normalizeText(category) === normalized)) {
    return DEPED_SUBJECT_CATEGORIES.find((category) => normalizeText(category) === normalized) || DEPED_SUBJECT_CATEGORIES[0];
  }

  const name = normalizeText(subjectName);
  if (/^(english|filipino|araling panlipunan|esp|values|hsp|reading|language)/i.test(name)) {
    return "Languages / AP / EsP";
  }

  if (/^(science|mathematics|math)/i.test(name)) {
    return "Science / Mathematics";
  }

  if (/^(mapeh|music|arts|pe|physical education|health|epp|tle)/i.test(name)) {
    return "MAPEH / EPP / TLE";
  }

  return DEPED_SUBJECT_CATEGORIES[0];
};

export const getDepedCategorySettings = (subjectCategory, gradingSettingsByCategory = {}) => {
  const category = normalizeSubjectCategory(subjectCategory);
  const fallback = DEPED_DEFAULT_GRADE_SETTINGS[category] || DEPED_DEFAULT_GRADE_SETTINGS[DEPED_SUBJECT_CATEGORIES[0]];
  const stored = gradingSettingsByCategory?.[category] || {};

  return {
    writtenWorksWeight: Number(stored.writtenWorksWeight ?? fallback.writtenWorksWeight) || 0,
    performanceTasksWeight: Number(stored.performanceTasksWeight ?? fallback.performanceTasksWeight) || 0,
    writtenWorksEnabled: stored.writtenWorksEnabled !== false,
    performanceTasksEnabled: stored.performanceTasksEnabled !== false,
  };
};

export const inferAssessmentComponent = (assessment = {}) => {
  const explicit = normalizeText(
    assessment.gradingComponent ?? assessment.grading_component ?? assessment.component ?? assessment.componentType
  );

  if (explicit.includes("written")) return "writtenWorks";
  if (explicit.includes("performance")) return "performanceTasks";

  const descriptor = normalizeText(
    [assessment.designation, assessment.type, assessment.assessment_type, assessment.title]
      .filter(Boolean)
      .join(" ")
  );

  if (
    descriptor.includes("activity") ||
    descriptor.includes("seatwork") ||
    descriptor.includes("performance") ||
    descriptor.includes("project") ||
    descriptor.includes("practical")
  ) {
    return "performanceTasks";
  }

  if (
    descriptor.includes("quiz") ||
    descriptor.includes("written") ||
    descriptor.includes("test") ||
    descriptor.includes("exam") ||
    descriptor.includes("assignment") ||
    descriptor.includes("worksheet")
  ) {
    return "writtenWorks";
  }

  return "performanceTasks";
};

export const resolveQuarterFromTerm = (term) => {
  const normalized = normalizeText(term);
  if (/\b(q1|quarter\s*1|1st\s*quarter|first\s*quarter|term\s*1)\b/.test(normalized)) return 1;
  if (/\b(q2|quarter\s*2|2nd\s*quarter|second\s*quarter|term\s*2)\b/.test(normalized)) return 2;
  if (/\b(q3|quarter\s*3|3rd\s*quarter|third\s*quarter|term\s*3)\b/.test(normalized)) return 3;
  if (/\b(q4|quarter\s*4|4th\s*quarter|fourth\s*quarter|term\s*4)\b/.test(normalized)) return 4;

  const digitMatch = normalized.match(/\b([1-4])\b/);
  if (digitMatch) return Number(digitMatch[1]);

  return 1;
};

export const isCountedGradeStatus = (status) => {
  const normalized = normalizeText(status);
  return normalized === "graded" || normalized === "returned";
};

export const clampNumericGrade = (value, min = 0, max = 100) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(min, Math.min(max, numeric));
};

export const roundTwo = (value) => Math.round(Number(value || 0) * 100) / 100;

export const transmuteDepEdQuarterGrade = (initialGrade) => {
  const numeric = Number(initialGrade);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;

  const transmuted = 37.5 + (numeric * 0.625);
  return Math.max(0, Math.min(100, Math.round(transmuted)));
};

const createComponentSummary = () => ({
  rawScore: 0,
  highestScore: 0,
  percentageScore: 0,
  weightedScore: 0,
  itemCount: 0,
});

const createQuarterSummary = () => ({
  writtenWorks: createComponentSummary(),
  performanceTasks: createComponentSummary(),
  initialGrade: 0,
  quarterlyGrade: 0,
});

export const computeDepEdQuarterSummary = ({
  assessmentItems = [],
  assessmentGradesMap = {},
  assessmentStatusMap = {},
  studentId = "",
  subjectCategory = DEPED_SUBJECT_CATEGORIES[0],
  quarter = 1,
  gradingSettingsByCategory = {},
}) => {
  const quarterSummary = createQuarterSummary();
  const weights = getDepedCategorySettings(subjectCategory, gradingSettingsByCategory);
  const targetQuarter = Number(quarter) || 1;

  assessmentItems.forEach((assessment) => {
    const itemQuarter = resolveQuarterFromTerm(assessment.term ?? assessment.quarter ?? assessment.gradingTerm ?? assessment.grading_term);
    if (itemQuarter !== targetQuarter) return;

    const assessmentId = String(assessment.id ?? "").trim();
    if (!assessmentId) return;

    const gradeValue = assessmentGradesMap?.[assessmentId]?.[studentId];
    if (gradeValue === undefined || gradeValue === null || gradeValue === "") return;

    const status = assessmentStatusMap?.[assessmentId]?.[studentId] ?? assessmentGradesMap?.[assessmentId]?.status ?? assessmentGradesMap?.[assessmentId]?.meta?.[studentId]?.status;
    if (status && !isCountedGradeStatus(status)) {
      return;
    }

    const componentKey = inferAssessmentComponent(assessment);
    const componentSummary = quarterSummary[componentKey];
    if (!componentSummary) return;

    const rawScore = clampNumericGrade(gradeValue, 0, 100);
    const highestScore = Math.max(0, Number(assessment.maxPoints ?? assessment.max_points ?? assessment.total_points ?? 0) || 0);

    componentSummary.rawScore += rawScore;
    componentSummary.highestScore += highestScore;
    componentSummary.itemCount += 1;
  });

  const finalizeComponent = (summary, weight, enabled) => {
    if (!enabled || summary.highestScore <= 0) {
      summary.percentageScore = 0;
      summary.weightedScore = 0;
      return summary;
    }

    summary.percentageScore = roundTwo((summary.rawScore / summary.highestScore) * 100);
    summary.weightedScore = roundTwo((summary.percentageScore * weight) / 100);
    return summary;
  };

  finalizeComponent(quarterSummary.writtenWorks, weights.writtenWorksWeight, weights.writtenWorksEnabled);
  finalizeComponent(quarterSummary.performanceTasks, weights.performanceTasksWeight, weights.performanceTasksEnabled);

  quarterSummary.initialGrade = roundTwo(quarterSummary.writtenWorks.weightedScore + quarterSummary.performanceTasks.weightedScore);
  quarterSummary.quarterlyGrade = transmuteDepEdQuarterGrade(quarterSummary.initialGrade);

  return {
    quarter: targetQuarter,
    weights,
    writtenWorks: quarterSummary.writtenWorks,
    performanceTasks: quarterSummary.performanceTasks,
    initialGrade: quarterSummary.initialGrade,
    quarterlyGrade: quarterSummary.quarterlyGrade,
  };
};

export const computeDepEdStudentComputation = ({
  assessmentItems = [],
  assessmentGradesMap = {},
  assessmentStatusMap = {},
  studentId = "",
  subjectCategory = DEPED_SUBJECT_CATEGORIES[0],
  gradingSettingsByCategory = {},
}) => {
  const quarters = [1, 2, 3, 4].reduce((accumulator, quarter) => {
    accumulator[`quarter${quarter}`] = computeDepEdQuarterSummary({
      assessmentItems,
      assessmentGradesMap,
      assessmentStatusMap,
      studentId,
      subjectCategory,
      quarter,
      gradingSettingsByCategory,
    });
    return accumulator;
  }, {});

  const quarterGrades = Object.values(quarters).map((summary) => Number(summary.quarterlyGrade || 0));
  const gradedQuarterCount = quarterGrades.filter((value) => value > 0).length;
  const finalGrade = gradedQuarterCount > 0
    ? roundTwo(quarterGrades.reduce((sum, value) => sum + value, 0) / gradedQuarterCount)
    : 0;

  return {
    subjectCategory: normalizeSubjectCategory(subjectCategory),
    quarters,
    finalGrade,
    remarks: finalGrade >= 90 ? "Outstanding" : finalGrade >= 85 ? "Excellent" : finalGrade >= 80 ? "Very Good" : finalGrade >= 75 ? "Good" : "Needs Improvement",
  };
};

export const serializeDepEdComputation = (computation) => {
  try {
    return JSON.stringify(computation || {});
  } catch {
    return "{}";
  }
};
