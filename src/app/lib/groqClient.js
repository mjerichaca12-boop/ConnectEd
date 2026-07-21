import Groq from "groq-sdk";

const apiKey = import.meta.env.VITE_GROQ_API_KEY;

if (!apiKey) {
  console.error("Groq API key missing. Add VITE_GROQ_API_KEY to your .env file.");
}

const groq = apiKey
  ? new Groq({ apiKey, dangerouslyAllowBrowser: true })
  : null;

export const isGroqConfigured = () => !!groq;

const MODEL_PRIMARY  = "llama-3.3-70b-versatile";
const MODEL_FALLBACK = "llama-3.1-8b-instant";
const MAX_TOKENS     = 4096;
const MAX_TOTAL_FILE_CHARS = 16000; // Limit combined context size to ~4,000 tokens to fit Groq free limits safely

// Proportional truncation helper to stay under character limits across multiple files
const truncateFilesToLimit = (files, maxTotalChars) => {
  if (!files || files.length === 0) return [];
  const totalLen = files.reduce((acc, f) => acc + (f.content || "").length, 0);
  if (totalLen <= maxTotalChars) return files;

  let remainingChars = maxTotalChars;
  const sortedFiles = [...files].sort((a, b) => (a.content || "").length - (b.content || "").length);
  const contentMap = new Map();

  for (let i = 0; i < sortedFiles.length; i++) {
    const file = sortedFiles[i];
    const len = (file.content || "").length;
    const equalShare = Math.floor(remainingChars / (sortedFiles.length - i));

    if (len <= equalShare) {
      contentMap.set(file.name, file.content);
      remainingChars -= len;
    } else {
      const truncated = file.content.substring(0, equalShare) + "\n\n[... Content truncated to fit size limits ...]";
      contentMap.set(file.name, truncated);
      remainingChars -= equalShare;
    }
  }

  return files.map(f => ({
    ...f,
    content: contentMap.get(f.name) || ""
  }));
};

// ── System Prompt Builder ────────────────────────────────────────
/**
 * @param {Array}  fileContents  - [{ name, content, type }]
 * @param {string} role          - "teacher" | "student"
 * @param {Object} classContext  - { className, subject, gradeLevel, section, teacherName }
 */
const buildSystemPrompt = (
  fileContents = [], 
  role = "teacher", 
  classContext = null,
  analyticsContext = null,
  existingContentContext = null,
  bloomsLevel = "None",
  activeModule = ""
) => {
  const isStudent = role === "student";

  // ── Active Page/Module Context ────────────────────────────────
  let moduleBlock = "";
  if (activeModule) {
    moduleBlock = `\n- **Current App Page/Module:** ${activeModule}\n`;
  }

  // ── Class context block ──────────────────────────────────────
  let contextBlock = "";
  if (classContext && (classContext.className || classContext.subject || classContext.gradeLevel)) {
    contextBlock = `
## ACTIVE CLASS CONTEXT
- **Class / Subject:** ${classContext.subject || classContext.className || "Not specified"}
- **Grade Level:** ${classContext.gradeLevel ? `Grade ${classContext.gradeLevel}` : "Not specified"}
- **Section:** ${classContext.section || "Not specified"}
- **Teacher:** ${classContext.teacherName || "Not specified"}${moduleBlock}

This context MUST anchor all responses. Never use information from a different class or subject.
`;
  }

  // ── Base prompt ──────────────────────────────────────────────
  const base = `You are ConnectEd's AI ${isStudent ? "Study" : "Teaching"} Assistant — an experienced educational assistant and expert K-12 pedagogical designer for DepEd curriculum in Cavite, Philippines.
${contextBlock}

## CORE MISSION
Your goal is to act like a real, experienced human teaching assistant who has thoroughly studied the uploaded learning materials before responding. Provide accurate, classroom-ready, structured outputs. Do not behave like a generic chatbot.

## DEEP MATERIAL COMPREHENSION
When uploaded materials are present, you must perform deep analysis to:
1. **Analyze and Map Content Structure**: Identify the main topic, subtopics, learning objectives, core concepts, definitions, formulas, chronological sequences/processes, cause-and-effect relations, comparisons, and important facts.
2. **Pedagogical Anchoring**: Pinpoint frequently assessed concepts, potential student misconceptions, and critical vocabulary tailored to the active grade level.
3. **Intelligent Text Cleansing**: Cleanse the input by removing duplicate boilerplate info, ignoring page numbers, headers, footers, and formatting. Merge concepts distributed across different pages or files into one single, cohesive lesson context.
4. **Context Integrity & Verification**: If the materials do not contain sufficient context or text to generate a high-quality answer, clearly state what information is missing. Never hallucinate or invent facts.

## PEDAGOGICAL COMPLIANCE BY GRADE LEVEL
Adjust the depth, vocabulary, and analytical complexity of outputs automatically according to the active Grade Level:
- **Grade 7**: Simpler, straightforward language; focus on foundational recall and understanding.
- **Grade 8**: Moderate complexity; focus on practical application and concept connections.
- **Grade 9**: Analytical depth; require students to compare, contrast, and relate concepts.
- **Grade 10**: Higher-Order Thinking Skills (HOTS); require evaluate/create levels of cognitive comprehension.

## OUTPUT STANDARDS
- **Materials First**: Base all answers strictly on the facts in the uploaded materials. CITE the source materials you used by name.
- **No Hallucinations**: If facts are missing, state: "I could not find information about [topic] in the uploaded materials."
- **Structured Formatting**: Use bold terms, headers (##, ###), bulleted lists, and tables to make your outputs clean and readable.
- **Answer Keys**: For all quizzes or activities, you MUST include a complete answer key at the bottom, separated by a horizontal divider (---).
`;

  // ── Bloom's Taxonomy ──────────────────────────────────────────
  let bloomsBlock = "";
  if (bloomsLevel && bloomsLevel !== "None") {
    bloomsBlock = `
## COGNITIVE LEVEL (BLOOM'S TAXONOMY)
Align all generated questions, activities, and tasks to the following level:
- **Bloom's Cognitive Level:** ${bloomsLevel}
Design items that measure cognitive skills corresponding specifically to this domain (Remember, Understand, Apply, Analyze, Evaluate, Create).
`;
  }

  // ── Existing Content & Duplicate Detection ──────────────────────
  let duplicateBlock = "";
  if (existingContentContext) {
    const quizList = (existingContentContext.quizzes || []).join(", ") || "None";
    const qList = (existingContentContext.questions || []).map(q => `- ${q}`).join("\n") || "None";
    const assList = (existingContentContext.assignments || []).join(", ") || "None";
    duplicateBlock = `
## EXISTING LESSON CONTENT (DO NOT DUPLICATE)
The following content already exists in the database for this lesson. You MUST NOT duplicate these items:
- **Quizzes:** ${quizList}
- **Questions:**
${qList}
- **Assignments:** ${assList}
`;
  }

  // ── Student Performance Analytics ───────────────────────────────
  let analyticsBlock = "";
  if (analyticsContext && analyticsContext.length > 0) {
    const statsList = analyticsContext.map(s => 
      `- **${s.title}** (${s.type}): Avg Score: ${s.averageScore} | High: ${s.highestScore} | Low: ${s.lowestScore} | Submissions: ${s.submissionCount}/${s.enrolledCount} (${s.submissionRate})`
    ).join("\n");
    analyticsBlock = `
## STUDENT PERFORMANCE DATA
Here are the current grades, submissions, and metrics for this class:
${statsList}

Use this data to analyze performance, identify struggle areas, and suggest classroom interventions.
`;
  }

  // ── Smart Resource Recommendations Suggestion ───────────────────
  const recommendationsBlock = `
## SMART RESOURCE RECOMMENDATIONS
At the end of your response, always append a short section titled "📋 Suggested Next Steps" containing 2-3 tailored recommendations for related resources to generate or activities to run next, based on the content or performance analysis (e.g. Remediation activity for struggling students, Exit ticket on a specific subtopic, Quiz format suggestion).
`;

  const finalBase = base + bloomsBlock + duplicateBlock + analyticsBlock + recommendationsBlock;

  // ── File content injection ───────────────────────────────────
  if (fileContents.length > 0) {
    const fileNames = fileContents.map(f => `"${f.name}"`).join(", ");
    const truncatedFiles = truncateFilesToLimit(fileContents, MAX_TOTAL_FILE_CHARS);
    const formattedContents = truncatedFiles.map((f, i) => {
      return `--- MATERIAL ${i + 1}: ${f.name} ---\n${f.content || ""}`;
    }).join("\n\n");

    return finalBase + `\n\n## UPLOADED CLASS MATERIALS\nThe following materials have been provided (${fileNames}). Base your response STRICTLY on this content:\n\n${formattedContents}\n\n---\nREMINDER: Use ONLY the content from the materials above. State clearly if something is not covered.`;
  }

  return finalBase + "\n\n## NOTE: No materials uploaded\nNo learning materials have been uploaded for this session. You may generate content from your general knowledge about the subject and grade level, but remind the user that responses will be more accurate and tailored if they upload their class materials.";
};

// ── Streaming message sender ─────────────────────────────────────
export const streamMessage = async ({
  messages,
  fileContents = [],
  role = "teacher",
  classContext = null,
  analyticsContext = null,
  existingContentContext = null,
  bloomsLevel = "None",
  activeModule = "",
  onChunk,
  onDone,
  onError,
}) => {
  if (!groq) {
    onError?.(new Error("Groq API key not configured. Add VITE_GROQ_API_KEY to .env"));
    return;
  }

  const validatedMessages = messages
    .filter(m => m && m.content && m.content.trim() !== "")
    .map(m => ({
      role: m.role || "user",
      content: m.content.toString()
    }));

  if (validatedMessages.length === 0) {
    onError?.(new Error("No valid messages to send"));
    return;
  }

  const systemPrompt = buildSystemPrompt(
    fileContents, 
    role, 
    classContext, 
    analyticsContext, 
    existingContentContext, 
    bloomsLevel, 
    activeModule
  );

  const callGroq = async (model) => {
    const stream = await groq.chat.completions.create({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...validatedMessages,
      ],
    });

    let fullText = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
    }
    onDone?.(fullText);
  };

  try {
    await callGroq(MODEL_PRIMARY);
  } catch (error) {
    console.error(`Groq Primary Model Error (${MODEL_PRIMARY}):`, error);

    const isRateLimit = error?.status === 429 || error?.message?.includes("rate limit");
    const isOverloaded = error?.status === 503 || error?.message?.includes("overloaded");

    if (isRateLimit || isOverloaded || error?.status === 400) {
      console.log(`Attempting fallback to ${MODEL_FALLBACK}...`);
      try {
        await callGroq(MODEL_FALLBACK);
      } catch (fallbackError) {
        console.error(`Groq Fallback Model Error (${MODEL_FALLBACK}):`, fallbackError);
        onError?.(fallbackError);
      }
    } else {
      onError?.(error);
    }
  }
};

// ── Quick action prompt builder ──────────────────────────────────
export const buildQuickPrompt = (action, settings) => {
  const { gradeLevel, subject, difficulty, language, itemCount, quizTypes = [], section = "", teacherName = "" } = settings;
  const classCtx = `Grade ${gradeLevel} ${subject}${section ? ` – Section ${section}` : ""}`;
  const diffLabel = difficulty || "Medium";
  const langLabel = language || "English";

  // Determine quiz type breakdown
  const selectedTypes = quizTypes.length > 0 ? quizTypes : ["Multiple Choice"];
  const typesStr = selectedTypes.join(", ");
  const perType = Math.max(1, Math.floor(itemCount / selectedTypes.length));

  const prompts = {
    // ── New specialized actions ───────────────────────
    generateQuiz: `Generate a ${itemCount}-item quiz for ${classCtx} using ONLY content from the uploaded learning materials.

**Quiz Types to include:** ${typesStr}
**Difficulty:** ${diffLabel}
**Language:** ${langLabel}

Instructions:
- Distribute items evenly: approximately ${perType} items per type.
- ALL questions MUST come directly from the uploaded materials. Do not invent questions.
- Label each question with its type: [Multiple Choice], [True/False], [Identification], or [Essay].
- Include Bloom's Taxonomy level for each item.
- If uploaded materials are insufficient, state which topics have limited coverage.

Format:
## Quiz – ${classCtx}
**Total Items:** ${itemCount} | **Difficulty:** ${diffLabel}

[Questions numbered 1–${itemCount}]

---
## Answer Key
[Complete answers with brief explanations referencing the material]`,

    generateAssignment: `Create a detailed assignment for ${classCtx} based ONLY on the uploaded learning materials.

**Language:** ${langLabel}

Include:
1. **Assignment Title** – specific and descriptive
2. **Learning Objectives** – 3–5 measurable SMART objectives aligned with DepEd K-12
3. **Instructions** – clear, step-by-step student instructions
4. **Submission Requirements** – format, length, due date placeholder
5. **Grading Rubric** – table with criteria, point values, and descriptions (4-level rubric)
6. **Resources** – reference only the uploaded materials

IMPORTANT: Base ALL content on the uploaded materials. Do not invent topics not covered in the materials.`,

    summarizeLesson: `Summarize the uploaded learning materials for ${classCtx}.

Provide all three of the following:

## 1. Concise Summary (3–5 sentences)
[Quick overview of the main lesson content]

## 2. Key Takeaways
[Bulleted list of the 5–10 most important points students must remember]

## 3. Important Terms & Concepts
[Table with Term | Definition | Where Found in Material]

## 4. Review Questions (${Math.min(5, itemCount)} questions with answers)
[Questions that test understanding of the uploaded materials]

IMPORTANT: Summarize ONLY what is in the uploaded materials. Do not add external information.`,

    generateReviewer: `Create a comprehensive study reviewer for ${classCtx} based ONLY on the uploaded learning materials.

Include:

## Key Concepts
[List of the most important concepts with brief explanations, drawn strictly from the materials]

## Review Questions (${itemCount} items, mixed difficulty)
[Numbered questions covering the main topics in the materials]

## Flashcards
[10–15 Q&A pairs in this format:]
**Q:** [Question]
**A:** [Answer from the materials]

---
## Answer Key
[Answers to the review questions with page/section references if possible]

IMPORTANT: Use ONLY content from the uploaded materials. Clearly note any topic areas not covered.`,

    explainTopic: `Explain the main topics covered in the uploaded learning materials for ${classCtx} students.

Adapt the explanation for Grade ${gradeLevel} comprehension level.

Format:
## Topic Overview
[1-paragraph introduction using simple, grade-appropriate language]

## Key Concepts Explained
[For each major concept in the materials:]
### [Concept Name]
- **What it is:** [Simple explanation]
- **Why it matters:** [Real-world connection]
- **Example:** [From the uploaded materials]

## Summary
[2–3 sentence recap]

IMPORTANT: Explain ONLY what is covered in the uploaded materials. If a student asks about something not in the materials, note that it is not covered.`,

    generateAnnouncement: `Draft a class announcement for ${classCtx}${teacherName ? ` by ${teacherName}` : ""}.

Write it in a professional yet friendly tone suitable for students and parents.

Format:
## 📢 Class Announcement
**Subject:** ${subject}
**Grade & Section:** ${classCtx}
**Date:** [Current Date]

[Main announcement content — reference specific topics, activities, or requirements from the uploaded materials if applicable]

**Important Reminders:**
- [Bullet points]

**Action Required:**
- [What students/parents need to do]

Thank you,
${teacherName || "[Teacher Name]"}`,

    generateObjectives: `Generate 5–7 measurable SMART learning objectives for ${classCtx} based on the uploaded learning materials.

Each objective must:
- Start with an action verb (Bloom's Taxonomy)
- Be specific and measurable
- Be aligned with DepEd K-12 K to 12 Curriculum Guide standards
- Be achievable within the lesson/unit timeframe

Format:
## Learning Objectives – ${classCtx}

At the end of this lesson/unit, the students are expected to:
1. [Objective – Bloom's Level: Remembering/Understanding/Applying/Analyzing/Evaluating/Creating]
2. [Objective – Bloom's Level]
...

**Curriculum Alignment:**
[Note the relevant DepEd competency codes if identifiable from the materials]

IMPORTANT: Base these objectives on the content actually present in the uploaded materials.`,

    createDiscussion: `Generate ${itemCount || 5} discussion questions for ${classCtx} based ONLY on the uploaded learning materials.

Format:
## Discussion Questions – ${classCtx}
[Introductory sentence encouraging critical thinking]

1. **[Question Topic/Concept]**
   - **Question:** [Thought-provoking discussion question suitable for Grade ${gradeLevel} students]
   - **Facilitation Prompt:** [Teacher instructions on how to guide this discussion]
   - **Expected Student Responses:** [Possible answers or directions students might take]
...

IMPORTANT: Base ALL discussion questions directly on the concepts/topics present in the uploaded materials.`,

    createFlashcards: `Generate ${itemCount || 10} flashcard Q&A pairs for ${classCtx} based ONLY on the uploaded learning materials.

Format:
## Study Flashcards – ${classCtx}
Use these card definitions to review and practice.

---
**Card 1**
**Q:** [Question/Concept prompt]
**A:** [Clear, concise answer/definition from the uploaded materials]

---
**Card 2**
**Q:** [Question/Concept prompt]
**A:** [Clear, concise answer/definition from the uploaded materials]
...

IMPORTANT: Flashcards must be created using ONLY content from the uploaded materials.`,

    // ── Legacy / existing actions (kept for compatibility) ───────
    activity: `Generate a detailed classroom activity for Grade ${gradeLevel} ${subject} in ${langLabel}.
Difficulty: ${diffLabel} | Number of tasks: ${itemCount}

Format:
## Activity Title
**Grade Level:** | **Subject:** | **Duration:**
### Learning Objectives
### Materials Needed
### Instructions (numbered steps)
### Expected Output
### Grading Guide`,

    lessonPlan: `Create a complete Daily Lesson Log (DLL) for Grade ${gradeLevel} ${subject} following the official DepEd DLL format in ${langLabel}.

## Daily Lesson Log (DLL)
**School:** | **Teacher:** | **Grade & Section:** ${classCtx} | **Date:**
### I. Objectives
- Content Standards
- Performance Standards
- Learning Competencies (with LC Code)
### II. Content (Subject Matter)
### III. Learning Resources
### IV. Procedures
**A. Reviewing Previous Lesson (5 mins)**
**B. Establishing Purpose (5 mins)**
**C. Presenting Examples (10 mins)**
**D. Discussing Concepts (15 mins)**
**E. Developing Mastery (10 mins)**
**F. Finding Practical Applications (5 mins)**
**G. Generalization (5 mins)**
**H. Evaluating Learning (5 mins)**
**I. Assignment**
### V. Remarks
### VI. Reflection`,

    rubric: `Create a detailed grading rubric for a ${subject} seatwork for Grade ${gradeLevel} in ${langLabel}.

| Criteria | Excellent (4) | Proficient (3) | Developing (2) | Beginning (1) |
|---|---|---|---|---|
[At least 5 criteria rows]

**Total Score:** __ / 20
**Grading Scale:** 18–20 Outstanding | 14–17 Satisfactory | 10–13 Developing | Below 10 Beginning`,

    parentLetter: `Write a formal parent communication letter in ${langLabel} for Grade ${gradeLevel} ${subject}.

[School Letterhead]
Date: ___________
Dear Parent/Guardian,

[Professional body — warm but formal tone]
[Clear main message]
[Call to action if needed]

Respectfully yours,
[Teacher Name]
[Position]`,

    translate: `Translate the following educational content to ${langLabel === "English" ? "Filipino" : "English"}.
Keep all academic and subject-specific terms accurate.
Maintain age-appropriate language for Grade ${gradeLevel}.
Preserve the original formatting (headers, lists, tables).
After translating, add a glossary of key terms with both English and ${langLabel === "English" ? "Filipino" : "English"} versions.`,

    examQuestions: `Generate ${itemCount} exam questions for Grade ${gradeLevel} ${subject} | Difficulty: ${diffLabel} | Language: ${langLabel}.

Follow Bloom's Taxonomy distribution:
- 30% Remembering & Understanding (Easy)
- 40% Applying & Analyzing (Medium)
- 30% Evaluating & Creating (Hard)

Question types: Multiple Choice, Essay, Problem Solving

Format each question as:
[Item Number]. [Question]
*Bloom's Level: [level] | Difficulty: [Easy/Medium/Hard]*
A) B) C) D) (for multiple choice)

---
## Complete Answer Key
(with full explanations for each answer)`,
  };

  return prompts[action] || "";
};
