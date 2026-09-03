export interface QuizQuestion {
    questionNumber: number;
    questionText: string;
    options: { label: string; text: string }[];
    correctAnswer: string;
    questionType?: string;
    points?: number;
}

export interface ParsedQuiz {
    instructionsHeader: string;
    questions: QuizQuestion[];
}

export function parseQuiz(instructions: string): ParsedQuiz | null {
    if (!instructions || typeof instructions !== 'string') return null;
    const trimmedStr = instructions.trim();
    if (!trimmedStr) return null;

    // 1. Check if it's JSON formatted e.g. DATA_JSON: or QUIZ_JSON: or raw JSON {"questions":[...]}
    let jsonContent = trimmedStr;
    if (jsonContent.startsWith("DATA_JSON:")) jsonContent = jsonContent.substring(10).trim();
    if (jsonContent.startsWith("QUIZ_JSON:")) jsonContent = jsonContent.substring(10).trim();

    if (jsonContent.startsWith("{") || jsonContent.startsWith("[")) {
        try {
            const parsed = JSON.parse(jsonContent);
            const rawQuestions = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.questions) ? parsed.questions : null);
            if (rawQuestions && rawQuestions.length > 0) {
                return {
                    instructionsHeader: (parsed && parsed.instructionsHeader) || "Please select the correct answer for each question.",
                    questions: rawQuestions.map((q: any, idx: number) => {
                        let parsedOptions: { label: string; text: string }[] = [];
                        if (Array.isArray(q.options)) {
                            parsedOptions = q.options.map((opt: any, oIdx: number) => {
                                if (typeof opt === 'string') {
                                    const m = opt.match(/^([A-D])[\.\)\:\-\s]+(.+)$/i);
                                    return m ? { label: m[1].toUpperCase(), text: m[2].trim() } : { label: String.fromCharCode(65 + oIdx), text: opt };
                                }
                                return { label: String(opt.label || String.fromCharCode(65 + oIdx)).toUpperCase(), text: String(opt.text || opt) };
                            });
                        } else if (q.options && typeof q.options === 'object') {
                            parsedOptions = Object.entries(q.options).map(([k, v]) => ({
                                label: k.toUpperCase(),
                                text: String(v)
                            }));
                        } else {
                            parsedOptions = [
                                { label: 'A', text: 'Option A' },
                                { label: 'B', text: 'Option B' },
                                { label: 'C', text: 'Option C' },
                                { label: 'D', text: 'Option D' }
                            ];
                        }
                        return {
                            questionNumber: q.questionNumber || q.id || idx + 1,
                            questionText: q.questionText || q.question || q.text || `Question ${idx + 1}`,
                            options: parsedOptions,
                            correctAnswer: String(q.correctAnswer || q.correct_answer || q.answer || 'A').toUpperCase()
                        };
                    })
                };
            }
        } catch (e) {
            // Fallback to text parsing
        }
    }

    // 2. Text-based quiz parsing
    const answerKeyRegex = /(?:Answer Key|Answers|Correct Answers|Key):/i;
    const parts = trimmedStr.split(answerKeyRegex);
    const mainBody = parts[0];
    const answerKeyPart = parts.length > 1 ? parts.slice(1).join('\n') : "";

    const answerMap: Record<number, string> = {};
    if (answerKeyPart) {
        const answerRegex = /\b(\d+)\s*[\.\:\-\)]?\s*([A-D])\b/gi;
        let match;
        while ((match = answerRegex.exec(answerKeyPart)) !== null) {
            answerMap[parseInt(match[1], 10)] = match[2].toUpperCase();
        }
    }

    const lines = mainBody.split('\n');
    const rawQuestions: {
        questionNumber: number;
        questionText: string;
        options: { label: string; text: string }[];
        detectedAnswer?: string;
    }[] = [];

    let currentQuestion: {
        questionNumber: number;
        questionText: string;
        options: { label: string; text: string }[];
        detectedAnswer?: string;
    } | null = null;

    let instructionsHeader = "";
    let foundFirstQuestion = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            if (!foundFirstQuestion) instructionsHeader += "\n";
            continue;
        }

        const qMatch = line.match(/^(?:Q|Question\s*)?(\d+)(?:[\.\)\:\-\s]+)(.+)$/i);
        if (qMatch) {
            foundFirstQuestion = true;
            if (currentQuestion) {
                rawQuestions.push(currentQuestion);
            }
            currentQuestion = {
                questionNumber: parseInt(qMatch[1], 10),
                questionText: qMatch[2].trim(),
                options: []
            };
            continue;
        }

        const optMatch = line.match(/^(?:\(?([A-D])\)?[\.\)\:\-\s]+)(.+)$/i);
        if (optMatch && currentQuestion) {
            const label = optMatch[1].toUpperCase();
            let text = optMatch[2].trim();
            if (text.toLowerCase().includes('(correct)') || text.toLowerCase().includes('*correct*') || text.endsWith('*')) {
                currentQuestion.detectedAnswer = label;
                text = text.replace(/\(correct\)/gi, '').replace(/\*correct\*/gi, '').replace(/\*$/, '').trim();
            }
            currentQuestion.options.push({ label, text });
            continue;
        }

        const ansMatch = line.match(/^(?:Correct\s*)?Answer\s*[\:\-\=]\s*([A-D])\b/i);
        if (ansMatch && currentQuestion) {
            currentQuestion.detectedAnswer = ansMatch[1].toUpperCase();
            continue;
        }

        if (!foundFirstQuestion) {
            instructionsHeader += (instructionsHeader ? "\n" : "") + line;
        } else if (currentQuestion) {
            if (currentQuestion.options.length > 0) {
                const lastIdx = currentQuestion.options.length - 1;
                currentQuestion.options[lastIdx].text += " " + line;
            } else {
                currentQuestion.questionText += "\n" + line;
            }
        }
    }

    if (currentQuestion) {
        rawQuestions.push(currentQuestion);
    }

    if (rawQuestions.length === 0) {
        return null;
    }

    const hasAnswers = Object.keys(answerMap).length > 0 || rawQuestions.some(q => q.detectedAnswer);
    if (!hasAnswers) {
        return null;
    }

    const questions: QuizQuestion[] = rawQuestions.map((q, idx) => {
        let opts = q.options;
        if (opts.length === 0) {
            opts = [
                { label: 'A', text: 'Option A' },
                { label: 'B', text: 'Option B' },
                { label: 'C', text: 'Option C' },
                { label: 'D', text: 'Option D' }
            ];
        }
        const correct = q.detectedAnswer || answerMap[q.questionNumber] || answerMap[idx + 1] || (opts[0]?.label || 'A');
        return {
            questionNumber: q.questionNumber || idx + 1,
            questionText: q.questionText,
            options: opts,
            correctAnswer: correct
        };
    });

    return {
        instructionsHeader: instructionsHeader.trim() || "Please select the correct answer for each question.",
        questions
    };
}

function createDefaultQuiz(): ParsedQuiz {
    return {
        instructionsHeader: "Please answer items 1 to 5 by selecting the correct option for each question.",
        questions: [1, 2, 3, 4, 5].map((num) => ({
            questionNumber: num,
            questionText: `Item ${num}`,
            options: [
                { label: 'A', text: 'Option A' },
                { label: 'B', text: 'Option B' },
                { label: 'C', text: 'Option C' },
                { label: 'D', text: 'Option D' }
            ],
            correctAnswer: 'A'
        }))
    };
}
