import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY || "dummy",
  dangerouslyAllowBrowser: true,
});

const MODEL_PRIMARY  = "llama-3.3-70b-versatile";
const MODEL_FALLBACK = "llama-3.1-8b-instant";
const MAX_TOKENS     = 4096;

// ── System Prompt ──────────────────────────────────────────
const buildSystemPrompt = (fileContents = []) => {
  const base = `
You are an expert AI Teaching Assistant for DepEd public school 
teachers in Dasmariñas, Cavite, Philippines. You help teachers 
create high-quality educational materials aligned with the K-12 
curriculum of the Department of Education (DepEd).

YOUR CAPABILITIES:
- Generate activities, quizzes, and exams from uploaded materials
- Create detailed lesson plans in DepEd DLL/DLP format
- Design rubrics for various assessment types
- Summarize and simplify complex materials
- Suggest differentiated instruction strategies
- Write parent communication letters in Filipino or English
- Translate educational content between English and Filipino
- Align all content with DepEd K-12 curriculum competencies
- Generate exam items following Bloom's Taxonomy levels

YOUR RULES:
- Always follow DepEd K-12 curriculum standards
- Use age-appropriate language for the specified grade level
- Format quizzes and activities clearly with numbered items
- Always include complete answer keys for quizzes and exams
- For lesson plans, always use the standard DepEd DLL format
- Be encouraging, professional, and supportive in tone
- When materials are uploaded, base your output on them strictly
- If no materials are uploaded, generate from your knowledge
- Respond in the language specified (English or Filipino)
- Keep all outputs practical and immediately usable in class
- Label Bloom's Taxonomy level for each exam/quiz question
- For activities, always include objectives, materials, and steps

OUTPUT FORMAT:
- Use markdown formatting for all responses
- Use ## for main headers, ### for sub-headers
- Use numbered lists for quiz/exam items
- Use tables for rubrics (properly formatted markdown tables)
- Use bold (**text**) for important terms and labels
- Always clearly separate Answer Keys with a divider (---)
- Add point values for each quiz/exam section
`;

  if (fileContents.length > 0) {
    return base + `\n\nUPLOADED CLASS MATERIALS:\nThe teacher has uploaded the following materials.\nBase your outputs strictly on this content:\n\n${fileContents.map((f, i) => `--- Material ${i + 1} ---\n${f.content}`).join("\n\n")}\n`;
  }

  return base;
};

// ── Streaming message sender ────────────────────────────────
export const streamMessage = async ({
  messages,
  fileContents = [],
  onChunk,
  onDone,
  onError,
}) => {
  try {
    const stream = await groq.chat.completions.create({
      model: MODEL_PRIMARY,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      stream: true,
      messages: [
        { role: "system", content: buildSystemPrompt(fileContents) },
        ...messages,
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
    // Fallback to smaller model if rate limited
    if (error?.status === 429) {
      try {
        const fallbackStream = await groq.chat.completions.create({
          model: MODEL_FALLBACK,
          max_tokens: MAX_TOKENS,
          temperature: 0.7,
          stream: true,
          messages: [
            { role: "system", content: buildSystemPrompt(fileContents) },
            ...messages,
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
