/**
 * ConnectEd LMS — Official Teacher AI Knowledge Source of Truth
 * 
 * IMPORTANT MAINTENANCE NOTICE:
 * This file represents the ACTUAL, current features, workflows, and business rules
 * of the ConnectEd LMS for Teachers.
 * 
 * Rules:
 * 1. Do NOT add features that do not exist.
 * 2. Explicitly specify non-existent features to prevent AI hallucinations.
 * 3. Update this file whenever ConnectEd features or workflows change.
 */

export const CONNECTED_TEACHER_KNOWLEDGE = {
  systemName: "ConnectEd LMS",
  role: "Teacher",
  region: "DepEd Cavite, Philippines",
  
  coreModules: [
    {
      name: "Teacher Dashboard",
      path: "/teacher/dashboard",
      purpose: "Overview of teacher activities, greeting, quick stats (assigned classes, enrolled students, pending tasks), upcoming deadlines, recent grade updates, and school announcements.",
      workflows: [
        "View assigned classes summary",
        "Check pending assessment submissions needing grading",
        "View recent announcements from School Admin",
        "Quick access to AI Assistant and Class Materials"
      ]
    },
    {
      name: "My Classes / Subject Management",
      path: "/teacher/classes",
      purpose: "List of classes/subjects assigned to the teacher by the Admin.",
      workflows: [
        "View assigned subjects with Code, Name, Grade Level, Section, and Enrolled Student count",
        "Click on a class card to open Class Detail view",
        "Class Creation is handled exclusively by School Admin; teachers view assigned subjects"
      ],
      rules: [
        "A Class represents a specific Subject assigned to a Grade Level and Section (e.g. Science Grade 7 Emerald).",
        "Students enrolled in a class MUST match both the Grade Level and Section of the subject.",
        "A Grade 7 Ruby student CANNOT be enrolled in a Grade 7 Emerald class.",
        "Class Capacity is set by Admin. Enrollment cannot exceed capacity."
      ]
    },
    {
      name: "Class Detail & Student Roster",
      path: "/teacher/class/:id",
      purpose: "Manage a specific class, view enrolled students, lessons, and class materials.",
      workflows: [
        "View student roster (Name, LRN, Email, Status)",
        "Enroll existing students from the section masterlist into the class",
        "Create and manage Lessons (Topics, Status: Draft/Published)",
        "Upload learning materials (PDF, DOCX, PPTX) to specific lessons"
      ]
    },
    {
      name: "Grades Management & Encoding",
      path: "/teacher/grades",
      purpose: "Encode, compute, and manage student grades according to DepEd grading standards.",
      workflows: [
        "Select Subject, Quarter/Term, and Assessment Type (Written Work, Performance Task, Quarterly Assessment)",
        "Encode raw scores for individual students or bulk import via CSV template",
        "View automated weighted grade computation based on DepEd subject weights",
        "Export grade sheets to CSV/Excel"
      ]
    },
    {
      name: "Class Materials",
      path: "/teacher/materials",
      purpose: "Centralized repository for uploading and managing class learning materials.",
      workflows: [
        "Upload PDFs, DOCX, and presentations linked to specific subjects and lessons",
        "Make materials available to AI Assistant for lesson-aware content generation"
      ]
    },
    {
      name: "Announcements",
      path: "/teacher/announcements",
      purpose: "View school-wide announcements from Admin and post class-specific announcements.",
      workflows: [
        "View announcements filtered by audience (School-wide, Teachers, Class)",
        "Post class announcements for enrolled students"
      ]
    },
    {
      name: "Messages",
      path: "/teacher/messages",
      purpose: "Direct messaging and class discussions between teachers, students, and admin.",
      workflows: [
        "Send direct messages to students or admin",
        "Participate in class message threads",
        "Attach files or announcements to messages"
      ]
    },
    {
      name: "Automated Exam & Quiz Grading",
      purpose: "Automated evaluation of objective assessments.",
      workflows: [
        "Multiple Choice, True/False, and Identification questions are automatically graded upon student submission",
        "Teachers review automated scores and manually grade essay or open-ended questions in the Submissions view",
        "Final scores automatically sync to Grades Management"
      ]
    },
    {
      name: "AI Assistant",
      path: "/teacher/ai-assistant",
      purpose: "Lesson-aware AI assistant helping teachers with teaching, lesson planning, and content generation.",
      workflows: [
        "Generate quizzes, assignments, reviewers, and lesson plans aligned to DepEd K-12",
        "Analyze student performance metrics and identify struggle areas",
        "Answer questions grounded in uploaded class materials and live teacher data"
      ]
    }
  ],

  // EXPLICIT NEGATIVE KNOWLEDGE: Features that DO NOT exist in ConnectEd
  nonExistentFeatures: [
    {
      feature: "Meetings / Video Calling / Live Streaming",
      explanation: "ConnectEd LMS does NOT have a Meetings module, live video stream, or Zoom/Google Meet integration.",
      recommendedCorrection: "Use ConnectEd Messages for async communication or external video meeting links if needed."
    },
    {
      feature: "Facial Recognition / Biometric Attendance",
      explanation: "ConnectEd LMS does NOT support facial recognition or biometric scanning.",
      recommendedCorrection: "Attendance and enrollment are managed via section masterlists and profiles."
    },
    {
      feature: "Automated Phone Calls / SMS Alert Service",
      explanation: "ConnectEd LMS does NOT send automated phone calls or SMS messages to parents.",
      recommendedCorrection: "Use Announcements or Messages to communicate with parents and students."
    },
    {
      feature: "Virtual Reality Classroom / VR Features",
      explanation: "ConnectEd LMS does NOT have a Virtual Reality or VR classroom feature.",
      recommendedCorrection: "Use regular web classroom materials, PDFs, and assignments."
    },
    {
      feature: "Teacher Self-Registration / Class Self-Creation",
      explanation: "Teachers cannot self-register or create new classes directly without Admin assignment.",
      recommendedCorrection: "Contact the School Admin to set up new subject assignments or teacher accounts."
    }
  ],

  gradingRules: {
    framework: "DepEd K-12 Grading System (Order No. 8, s. 2015)",
    components: [
      "Written Work (WW)",
      "Performance Tasks (PT)",
      "Quarterly Assessment (QA)"
    ],
    passingGrade: 75,
    transmutation: "Raw scores are converted to percentage scores and transmuted according to official DepEd tables."
  }
};

/**
 * Returns a formatted prompt string summarizing ConnectEd system knowledge
 */
export const getFormattedConnectEdKnowledge = () => {
  const modulesList = CONNECTED_TEACHER_KNOWLEDGE.coreModules
    .map(m => `- **${m.name}** (${m.path || 'System Feature'}): ${m.purpose}\n  Workflows: ${m.workflows.join('; ')}`)
    .join('\n\n');

  const nonExistentList = CONNECTED_TEACHER_KNOWLEDGE.nonExistentFeatures
    .map(n => `- **${n.feature}**: ${n.explanation}`)
    .join('\n');

  return `
## CONNECTED LMS SYSTEM KNOWLEDGE & RULES
ConnectEd is a Philippine K-12 Learning Management System for DepEd schools.

### Core Modules & Workflows:
${modulesList}

### Class & Enrollment Rules:
- A Class is a Subject assigned to a Grade Level & Section.
- Students must match BOTH Grade Level and Section to be eligible for a class.
- Section mismatched enrollment is strictly prohibited (e.g. Grade 7 Ruby student cannot join Grade 7 Emerald class).

### Features That DO NOT Exist in ConnectEd (STRICTLY PROHIBITED TO MENTION AS EXISTING):
${nonExistentList}
If asked about any of these non-existent features, explicitly state: "ConnectEd LMS does not currently have a [feature name] feature."
`;
};
