import { CONNECTED_TEACHER_KNOWLEDGE, getFormattedConnectEdKnowledge } from "../docs/ai/connectedTeacherKnowledge.js";
import {
  getTeacherClasses,
  getClassStudents,
  getNeedsGrading,
  getUpcomingTasks,
  getRecentlyUpdatedGrades
} from "./teacherAiTools.js";

/**
 * ConnectEd Teacher AI Router & Intent Processor
 * 
 * Intent Types:
 * - LIVE_DATA: User asks for current enrollment, grades, pending submissions, or upcoming tasks.
 * - CONNECTED_SYSTEM_KNOWLEDGE: User asks how ConnectEd works (enrollment, grading, assignments, etc.).
 * - NON_EXISTENT_FEATURE: User asks about features that do not exist (Meetings, biometrics, calls, etc.).
 * - DATA_PRIVACY_VIOLATION: User attempts to access unauthorized teacher data or passwords.
 * - GENERAL_TEACHING: Educational strategies, lesson ideas, rubrics, quizzes, DepEd guidelines.
 */

export const INTENT_TYPES = {
  LIVE_DATA: "LIVE_DATA",
  CONNECTED_SYSTEM_KNOWLEDGE: "CONNECTED_SYSTEM_KNOWLEDGE",
  NON_EXISTENT_FEATURE: "NON_EXISTENT_FEATURE",
  DATA_PRIVACY_VIOLATION: "DATA_PRIVACY_VIOLATION",
  GENERAL_TEACHING: "GENERAL_TEACHING"
};

/**
 * Detect user intent based on prompt text
 */
export function detectUserIntent(promptText) {
  const t = (promptText || "").toLowerCase().trim();

  // 1. Data Privacy Violation attempt
  if (
    (t.includes("teacher b") || t.includes("other teacher") || t.includes("another teacher") || t.includes("someone else's student")) ||
    (t.includes("another school") || t.includes("other school") || t.includes("different school")) ||
    (t.includes("password") || t.includes("student password") || t.includes("credentials"))
  ) {
    return { intent: INTENT_TYPES.DATA_PRIVACY_VIOLATION };
  }

  // 2. Non-existent feature attempt
  const nonExistentMatch = CONNECTED_TEACHER_KNOWLEDGE.nonExistentFeatures.find(f => {
    const featKey = f.feature.toLowerCase();
    return (
      (featKey.includes("meeting") && (t.includes("meeting") || t.includes("schedule a meeting") || t.includes("video call font") || t.includes("video call") || t.includes("video class") || t.includes("live video") || t.includes("zoom"))) ||
      (featKey.includes("facial") && (t.includes("facial") || t.includes("biometric") || t.includes("face recognition"))) ||
      (featKey.includes("phone") && (t.includes("phone call") || t.includes("sms alert") || t.includes("call parent"))) ||
      (featKey.includes("virtual reality") && (t.includes("virtual reality") || t.includes("vr classroom")))
    );
  });

  if (nonExistentMatch) {
    return {
      intent: INTENT_TYPES.NON_EXISTENT_FEATURE,
      feature: nonExistentMatch.feature,
      explanation: nonExistentMatch.explanation,
      recommendedCorrection: nonExistentMatch.recommendedCorrection
    };
  }

  // 3. Live Data Query
  if (
    t.includes("how many student") ||
    t.includes("my students") ||
    t.includes("student count") ||
    t.includes("how many in my class") ||
    t.includes("need grading") ||
    t.includes("needs grading") ||
    t.includes("pending grading") ||
    t.includes("submissions need grading") ||
    t.includes("upcoming task") ||
    t.includes("upcoming deadline") ||
    t.includes("recently updated grade") ||
    t.includes("latest grade") ||
    t.includes("who has not submitted") ||
    t.includes("haven't submitted")
  ) {
    return { intent: INTENT_TYPES.LIVE_DATA };
  }

  // 4. ConnectEd System Knowledge
  if (
    t.includes("connected") ||
    t.includes("how do i") ||
    t.includes("how does") ||
    t.includes("can i add") ||
    t.includes("can i create") ||
    t.includes("create class") ||
    t.includes("create new class") ||
    t.includes("capacity work") ||
    t.includes("automated exam") ||
    t.includes("encode grade") ||
    t.includes("teacher dashboard") ||
    t.includes("masterlist") ||
    t.includes("where do exam scores come from")
  ) {
    return { intent: INTENT_TYPES.CONNECTED_SYSTEM_KNOWLEDGE };
  }

  // 5. General Teaching
  return { intent: INTENT_TYPES.GENERAL_TEACHING };
}

/**
 * Process intent and resolve live data or grounding context
 */
export async function resolveContextForIntent(intentResult, teacherId, promptText) {
  const { intent } = intentResult;

  if (intent === INTENT_TYPES.DATA_PRIVACY_VIOLATION) {
    return {
      overrideResponse: "🔒 **Data Privacy Restriction**: I am strictly prohibited from displaying unauthorized student passwords or accessing data belonging to other teachers. You can only view data for your own assigned subjects.",
      systemContext: ""
    };
  }

  if (intent === INTENT_TYPES.NON_EXISTENT_FEATURE) {
    return {
      overrideResponse: `⚠️ **Feature Not Available**: ConnectEd LMS does not currently have a **${intentResult.feature}** feature.\n\n${intentResult.explanation}\n\n*Alternative:* ${intentResult.recommendedCorrection}`,
      systemContext: ""
    };
  }

  if (intent === INTENT_TYPES.LIVE_DATA) {
    if (!teacherId) {
      return {
        overrideResponse: "⚠️ I couldn't retrieve your live data right now because your teacher session is not active.",
        systemContext: ""
      };
    }

    const t = promptText.toLowerCase();
    let liveDataSummary = "";

    try {
      if (t.includes("student") || t.includes("class")) {
        const classRes = await getTeacherClasses(teacherId);
        const studentRes = await getClassStudents(teacherId);
        
        if (classRes.success && classRes.data.length > 0) {
          const classesStr = classRes.data.map(c => `- ${c.name} (${c.gradeLevel} Section ${c.section}): ${c.enrolled}/${c.capacity} students enrolled`).join("\n");
          liveDataSummary += `### AUTHORIZED TEACHER CLASSES:\n${classesStr}\nTotal Enrolled Students Across Classes: ${studentRes.totalStudents || 0}\n`;
        } else {
          liveDataSummary += `### AUTHORIZED TEACHER CLASSES:\nNo assigned classes found.\n`;
        }
      }

      if (t.includes("grading") || t.includes("need")) {
        const gradingRes = await getNeedsGrading(teacherId);
        if (gradingRes.success) {
          liveDataSummary += `\n### SUBMISSIONS NEEDING GRADING:\nTotal Submissions Needing Grading: ${gradingRes.pendingCount}\n`;
        }
      }

      if (t.includes("upcoming") || t.includes("task") || t.includes("deadline")) {
        const taskRes = await getUpcomingTasks(teacherId);
        if (taskRes.success) {
          const taskStr = taskRes.data.map(t => `- [${t.type}] ${t.title} (Due: ${new Date(t.dueDate).toLocaleDateString()})`).join("\n") || "No upcoming tasks.";
          liveDataSummary += `\n### UPCOMING TASKS & DEADLINES:\nTotal Upcoming Tasks: ${taskRes.count}\n${taskStr}\n`;
        }
      }

      if (t.includes("latest grade") || t.includes("recently updated")) {
        const gradeRes = await getRecentlyUpdatedGrades(teacherId);
        if (gradeRes.success && gradeRes.data.length > 0) {
          const latest = gradeRes.data[0];
          liveDataSummary += `\n### RECENTLY UPDATED GRADE:\nLatest Recorded Score: ${latest.displayGrade} (Updated: ${new Date(latest.updatedAt).toLocaleDateString()})\n`;
        }
      }

      return {
        overrideResponse: null,
        systemContext: `\n## AUTHORIZED LIVE TEACHER DATA (RETRIEVED FROM DATABASE)\nUse ONLY this retrieved data to answer the user's question about live class numbers, submissions, or deadlines. DO NOT guess or hallucinate different numbers.\n\n${liveDataSummary}`
      };
    } catch (e) {
      console.error("[teacherAiRouter] Live data retrieval failed:", e);
      return {
        overrideResponse: "⚠️ I couldn't retrieve your current class data right now. Please try again in a moment.",
        systemContext: ""
      };
    }
  }

  if (intent === INTENT_TYPES.CONNECTED_SYSTEM_KNOWLEDGE) {
    return {
      overrideResponse: null,
      systemContext: `\n${getFormattedConnectEdKnowledge()}`
    };
  }

  // General Teaching
  return {
    overrideResponse: null,
    systemContext: "\n## GENERAL PEDAGOGICAL KNOWLEDGE\nProvide clear, structured, classroom-ready educational explanations and activities tailored to DepEd K-12 standards."
  };
}
