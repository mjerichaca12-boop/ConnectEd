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
const MAX_FILE_CHARS = 50000;

// ── System Prompt ──────────────────────────────────────────
const buildSystemPrompt = (fileContents = [], role = "teacher") => {
  const isStudent = role === "student";
  
  const base = `
You are an expert AI ${isStudent ? "Study" : "Teaching"} Assistant for DepEd public school 
${isStudent ? "students" : "teachers"} in Dasmariñas, Cavite, Philippines. You help ${isStudent ? "students excel in their studies" : "teachers create high-quality educational materials"} aligned with the K-12 
curriculum of the Department of Education (DepEd).

YOUR CAPABILITIES:
${isStudent ? `
- Explain complex topics from uploaded materials in simple terms
- Generate practice quizzes and flashcards for review
- Summarize and simplify long readings or class materials
- Provide step-by-step guides for assignments
- Help with translations between Filipino and English
- Offer study tips and time management advice
` : `
- Generate activities, quizzes, and exams from uploaded materials
- Create detailed lesson plans in DepEd DLL/DLP format
- Design rubrics for various assessment types
- Summarize and simplify complex materials
- Suggest differentiated instruction strategies
- Write parent communication letters in Filipino or English
- Translate educational content between English and Filipino
- Align all content with DepEd K-12 curriculum competencies
- Generate exam items following Bloom's Taxonomy levels
`}

YOUR RULES:
- Always follow DepEd K-12 curriculum standards
- Use age-appropriate language for the specified grade level
- Format ${isStudent ? "explanations and practice items" : "quizzes and activities"} clearly with numbered items
${isStudent ? "- Provide hints before giving full answers when asked for help" : "- Always include complete answer keys for quizzes and exams"}
${!isStudent ? "- For lesson plans, always use the standard DepEd DLL format" : ""}
- Be encouraging, professional, and supportive in tone
- **CRITICAL: When materials are uploaded, you MUST base your outputs strictly on them**
- **ALWAYS reference specific content from the uploaded materials in your responses**
- **If you cannot find relevant information in the uploaded materials, explicitly state that**
- If no materials are uploaded, generate from your knowledge
- Respond in the language specified (English or Filipino)
- Keep all outputs practical and immediately usable
${!isStudent ? "- Label Bloom's Taxonomy level for each exam/quiz question" : ""}
${!isStudent ? "- For activities, always include objectives, materials, and steps" : ""}

OUTPUT FORMAT:
- Use markdown formatting for all responses
- Use ## for main headers, ### for sub-headers
- Use numbered lists for ${isStudent ? "steps or items" : "quiz/exam items"}
- Use tables for ${isStudent ? "comparisons or summaries" : "rubrics"}
- Use bold (**text**) for important terms and labels
${!isStudent ? "- Always clearly separate Answer Keys with a divider (---)" : ""}
`;

  if (fileContents.length > 0) {
    console.log("Processing file contents:", fileContents.map(f => ({ name: f.name, contentLength: f.content?.length || 0 })));
    
    const truncatedContents = fileContents.map((f, i) => {
      let content = f.content || "";
      if (content.length > MAX_FILE_CHARS) {
        content = content.substring(0, MAX_FILE_CHARS) + "\n\n[... Content truncated due to length limit ...]";
      }
      return `--- Material ${i + 1}: ${f.name} ---\n${content}`;
    }).join("\n\n");
    
    return base + `\n\nUPLOADED CLASS MATERIALS:\nThe ${isStudent ? "student" : "teacher"} has uploaded the following materials.\nBase your outputs strictly on this content:\n\n${truncatedContents}\n`;
  }

  return base;
};

// ── Streaming message sender ────────────────────────────────
export const streamMessage = async ({
  messages,
  fileContents = [],
  role = "teacher",
  onChunk,
  onDone,
  onError,
}) => {
  if (!groq) {
    onError?.(new Error("Groq API key not configured. Add VITE_GROQ_API_KEY to .env"));
    return;
  }

  // Sanitize and validate messages
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

  const systemPrompt = buildSystemPrompt(fileContents, role);

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL_PRIMARY,
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

  } catch (error) {
    console.error(`Groq Primary Model Error (${MODEL_PRIMARY}):`, error);

    // Fallback to smaller model if rate limited or other common errors
    const isRateLimit = error?.status === 429 || (error?.message && error.message.includes("rate limit"));
    const isOverloaded = error?.status === 503 || (error?.message && error.message.includes("overloaded"));
    
    if (isRateLimit || isOverloaded || error?.status === 400) {
      console.log(`Attempting fallback to ${MODEL_FALLBACK}...`);
      try {
        const fallbackStream = await groq.chat.completions.create({
          model: MODEL_FALLBACK,
          max_tokens: MAX_TOKENS,
          temperature: 0.7,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            ...validatedMessages,
          ],
        });

        let fullText = "";
        for await (const chunk of fallbackStream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        }
        onDone?.(fullText);

      } catch (fallbackError) {
        console.error(`Groq Fallback Model Error (${MODEL_FALLBACK}):`, fallbackError);
        onError?.(fallbackError);
      }
    } else {
      onError?.(error);
    }
  }
};

// ── Quick action prompt builder ─────────────────────────────
export const buildQuickPrompt = (action, settings) => {
  const { gradeLevel, subject, difficulty, language, itemCount } = settings;
  const context = `Grade ${gradeLevel} ${subject} | Difficulty: ${difficulty} | Language: ${language}`;

  const prompts = {
    activity: `Generate a detailed classroom activity for ${context}.\nNumber of tasks: ${itemCount}.\nFormat your response as:\n## Activity Title\n**Grade Level:** | **Subject:** | **Duration:**\n### Learning Objectives\n### Materials Needed\n### Instructions (numbered steps)\n### Expected Output\n### Grading Guide\n`,
    quiz: `Create a ${itemCount}-item quiz for ${context}.\nFormat your response as:\n## Quiz Title\n**Grade Level:** | **Subject:** | **Total Points:**\n### Part I – Multiple Choice (items 1-${Math.ceil(itemCount*0.4)})\n### Part II – True or False (items)\n### Part III – Identification (items)\n---\n## Answer Key\n(complete answers with explanations)\n`,
    lessonPlan: `Create a complete Daily Lesson Log (DLL) for ${context}.\nFollow the official DepEd DLL format:\n## Daily Lesson Log (DLL)\n**School:** | **Teacher:** | **Grade & Section:** | **Date:**\n### I. Objectives\n- Content Standards\n- Performance Standards  \n- Learning Competencies (with LC Code)\n### II. Content (Subject Matter)\n### III. Learning Resources\n### IV. Procedures\n**A. Reviewing Previous Lesson (5 mins)**\n**B. Establishing Purpose (5 mins)**\n**C. Presenting Examples (10 mins)**\n**D. Discussing Concepts (15 mins)**\n**E. Developing Mastery (10 mins)**\n**F. Finding Practical Applications (5 mins)**\n**G. Generalization (5 mins)**\n**H. Evaluating Learning (5 mins)**\n**I. Assignment**\n### V. Remarks\n### VI. Reflection\n`,
    rubric: `Create a detailed grading rubric for a ${subject} assessment for ${context}.\nFormat as a markdown table:\n| Criteria | Excellent (4) | Proficient (3) | Developing (2) | Beginning (1) |\nInclude at least 5 criteria rows.\nAdd a Total Score row and grading scale at the bottom.\n`,
    summarize: `Summarize the uploaded class material for ${context}.\nFormat your response as:\n## Material Summary\n**Subject:** | **Grade Level:**\n### Main Topic\n### Key Concepts (bulleted list)\n### Important Terms & Definitions (table format)\n### Key Takeaways (numbered)\n### Review Questions (${itemCount} questions with answers)\n`,
    parentLetter: `Write a formal parent communication letter in ${language} for Grade ${gradeLevel} ${subject} class.\nFormat:\n[School Letterhead]\nDate: ___________\nDear Parent/Guardian,\n[Professional body — warm but formal tone]\n[Clear main message]\n[Call to action if needed]\nRespectfully yours,\n[Teacher Name]\n[Position]\n`,
    translate: `Translate the following educational content to ${language}.\nKeep all academic and subject-specific terms accurate.\nMaintain age-appropriate language for Grade ${gradeLevel}.\nPreserve the original formatting (headers, lists, tables).\nAfter translating, add a glossary of key terms with both English and ${language} versions.\n`,
    examQuestions: `Generate ${itemCount} exam questions for ${context}.\nFollow Bloom's Taxonomy distribution:\n- 30% Remembering & Understanding (Easy)\n- 40% Applying & Analyzing (Medium)\n- 30% Evaluating & Creating (Hard)\n\nQuestion types: Multiple Choice, Essay, Problem Solving\n\nFormat each question as:\n[Item Number]. [Question]\n*Bloom's Level: [level] | Difficulty: [Easy/Medium/Hard]*\nA) B) C) D) (for multiple choice)\n\n---\n## Complete Answer Key\n(with full explanations for each answer)\n`,
  };

  return prompts[action] || "";
};
