import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

const MODEL_PRIMARY  = "llama-3.3-70b-versatile";
const MODEL_FALLBACK = "llama-3.1-8b-instant";
const MAX_TOKENS     = 4096;

const buildAdminSystemPrompt = (platformData = {}) => {
  const {
    totalStudents = 0,
    totalTeachers = 0,
    totalSubjects = 0,
    pendingRequests = 0,
    recentActivity = [],
    announcements = [],
  } = platformData;

  return `You are an expert AI Administrative Assistant for the ConnectEd 
platform, a Learning Management System used by DepEd public schools 
in Dasmariñas, Cavite, Philippines.

You assist the System Administrator in managing the ConnectEd 
platform efficiently and professionally.

CURRENT PLATFORM DATA (live snapshot):
- Total Students enrolled: ${totalStudents}
- Total Teachers registered: ${totalTeachers}
- Total Subjects available: ${totalSubjects}
- Pending Access Requests: ${pendingRequests}
- Recent Activity: ${JSON.stringify(recentActivity.slice(0, 5))}
- Recent Announcements: ${JSON.stringify(announcements.slice(0, 3))}

YOUR CAPABILITIES:
- Answer questions about platform statistics and data
- Generate professional school announcements and notices
- Draft teacher access approval/rejection messages
- Create enrollment and academic summary reports
- Suggest action items based on pending requests
- Draft school calendar event descriptions
- Generate subject management recommendations
- Write parent/guardian communication letters
- Create teacher evaluation templates
- Provide data-driven insights and recommendations
- Help interpret platform activity and trends
- Draft official DepEd-format documents and letters

YOUR RULES:
- Always be professional, formal, and respectful in tone
- Base data-related answers on the platform snapshot provided
- For document drafting, follow official DepEd formats
- Respond in English unless Filipino/Tagalog is requested
- Always clarify if data is from the live snapshot or general knowledge
- Never make up student or teacher names — use placeholders
- For reports, always include date, school name placeholder, 
  and proper headings
- Suggest practical, actionable recommendations only
- Flag any data inconsistencies you notice in the platform snapshot
- Never reveal raw database credentials or API keys
- Never generate content that discriminates against students, teachers, or staff
- If asked about non-admin topics, redirect: "I'm specialized for school administration tasks. I can help with reports, announcements, access requests, and platform management. What do you need help with?"

OUTPUT FORMAT:
- Use markdown formatting for all responses
- Use ## for main headers, ### for sub-headers
- Use tables for data summaries and comparisons
- Use numbered lists for action items and steps
- Use bold for important values and key terms
- Always include a "Summary" section for long outputs
- For official documents, include proper letterhead placeholders`;
};

export const streamAdminMessage = async ({
  messages,
  platformData = {},
  onChunk,
  onDone,
  onError,
}) => {
  try {
    const stream = await groq.chat.completions.create({
      model: MODEL_PRIMARY,
      max_tokens: MAX_TOKENS,
      temperature: 0.5,
      stream: true,
      messages: [
        { role: "system", content: buildAdminSystemPrompt(platformData) },
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
    if (error?.status === 429) {
      try {
        const fallbackStream = await groq.chat.completions.create({
          model: MODEL_FALLBACK,
          max_tokens: MAX_TOKENS,
          temperature: 0.5,
          stream: true,
          messages: [
            { role: "system", content: buildAdminSystemPrompt(platformData) },
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

export const buildAdminQuickPrompt = (action, platformData) => {
  const { totalStudents, totalTeachers, totalSubjects, pendingRequests } = platformData;

  const prompts = {
    systemSummary: `Generate a comprehensive system status report for ConnectEd.
Use this live data:
- Total Students: ${totalStudents}
- Total Teachers: ${totalTeachers}
- Total Subjects: ${totalSubjects}
- Pending Access Requests: ${pendingRequests}

Format as:
## ConnectEd System Status Report
**Date:** [Today's Date] | **School:** [School Name]
### Platform Overview
### User Statistics (table format)
### Subject & Enrollment Summary
### Pending Actions Required
### Recommendations\n`,
    draftAnnouncement: `Help me draft a professional school-wide announcement for ConnectEd. 

Format as:
## ANNOUNCEMENT
**Date:** | **From:** System Administrator | **To:** All Users
**Priority:** [High/Medium/Low]

[Body of announcement — professional, clear, and concise]

[Closing]
System Administrator
ConnectEd Platform

Ask me: What is the announcement about?\n`,
    accessRequestTemplate: `Generate professional email templates for handling teacher access requests on ConnectEd.

Create 3 templates:

## Template 1: APPROVAL
Subject: ConnectEd Access Request — Approved
[Professional approval message with login instructions]

## Template 2: REJECTION  
Subject: ConnectEd Access Request — Not Approved
[Professional rejection with reason placeholder and next steps]

## Template 3: ADDITIONAL INFO NEEDED
Subject: ConnectEd Access Request — Additional Information Required
[Professional request for more information]\n`,
    enrollmentReport: `Generate an enrollment summary report based on current data:
- Total Students: ${totalStudents}
- Total Teachers: ${totalTeachers}
- Total Subjects: ${totalSubjects}

Format as:
## Enrollment Summary Report
**Academic Year:** | **Date Generated:** | **Prepared by:** Admin

### Student Enrollment Statistics
| Metric | Count | Status |
(fill table with available data)

### Subject Enrollment Breakdown
### Teacher-to-Student Ratio Analysis
### Recommendations for Next Enrollment Period\n`,
    calendarEvent: `Help me create a school calendar event description for ConnectEd.
The event will appear on both Teacher and Student dashboards.

Format:
## Event Details
**Event Title:**
**Event Type:** [Holiday / Exam / School Event / Activity]
**Target Audience:** [All / Teachers / Students / School-wide]
**Date & Time:**
**Venue/Location:**
**Description:**
**Important Reminders:**

Ask me: What type of event would you like to add?\n`,
    teacherEvaluation: `Generate a teacher performance evaluation template that can be used for annual review of ConnectEd teachers.

Format:
## Teacher Performance Evaluation Form
**School Year:** | **Teacher Name:** | **Subject/s:** 
**Grade Level:** | **Evaluated by:** System Administrator

### I. Teaching Performance
| Criteria | Excellent (5) | Good (4) | Satisfactory (3) | Needs Improvement (2) | Unsatisfactory (1) |

### II. Platform Usage (ConnectEd specific)
(Grade submission, attendance tracking, announcement posting, material uploads, parent communication)

### III. Professional Responsibilities
### IV. Summary & Recommendations
### V. Administrator Signature\n`,
    parentLetter: `Draft a professional parent/guardian communication letter from the school administrator.

Format:
[School Letterhead]
Date: ___________

Dear Parent/Guardian of [Student Name],

[Professional body in English or Filipino as requested]

[Clear main message]
[Action required from parents if any]
[Contact information]

Respectfully yours,
[Administrator Name]
System Administrator
ConnectEd Platform

Ask me: What is the purpose of this letter?\n`,
    dataInsights: `Analyze the current ConnectEd platform data and provide actionable insights and recommendations.

Current Data:
- Students: ${totalStudents}
- Teachers: ${totalTeachers}  
- Subjects: ${totalSubjects}
- Pending Requests: ${pendingRequests}

Format as:
## Platform Data Insights & Recommendations

### Key Observations
(bullet points of notable data points)

### Potential Issues Detected
(flag any ratios or numbers that seem unusual)

### Action Items (Priority Order)
| Priority | Action | Reason | Timeline |

### Long-term Recommendations
### Data Health Score: [X/10]\n`,
    subjectReport: `Generate a subject management report for ConnectEd.

Current data:
- Total Subjects: ${totalSubjects}
- Total Teachers: ${totalTeachers}
- Total Students: ${totalStudents}

Format as:
## Subject Management Report
**Date:** | **Prepared by:** Administrator

### Subject Overview
### Teacher-Subject Assignment Status
### Enrollment Distribution Analysis
### Unassigned or Underserved Subjects
### Recommendations for Subject Management\n`,
  };

  return prompts[action] || "";
};
