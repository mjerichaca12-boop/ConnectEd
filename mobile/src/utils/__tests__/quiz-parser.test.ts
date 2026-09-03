import { describe, it, expect } from "vitest";
import { parseQuiz } from "../quiz-parser";

describe("parseQuiz", () => {
    it("should return null if instructions is empty or lacks answer key", () => {
        expect(parseQuiz("")).toBeNull();
        expect(parseQuiz("1. Question without answer key")).toBeNull();
    });

    it("should successfully parse a valid quiz with A-D options and Answer Key", () => {
        const quizText = `
General Instructions: Read each question carefully.
        
1. What is 2 + 2?
A) 3
B) 4
C) 5
D) 6

2. What is the capital of Spain?
A. Barcelona
B. Madrid
C. Seville
D. Valencia

Answer Key:
1. B
2. B
`;
        const result = parseQuiz(quizText);
        expect(result).not.toBeNull();
        expect(result?.instructionsHeader).toBe("General Instructions: Read each question carefully.");
        expect(result?.questions).toHaveLength(2);
        
        expect(result?.questions[0]).toEqual({
            questionNumber: 1,
            questionText: "What is 2 + 2?",
            options: [
                { label: "A", text: "3" },
                { label: "B", text: "4" },
                { label: "C", text: "5" },
                { label: "D", text: "6" }
            ],
            correctAnswer: "B"
        });

        expect(result?.questions[1]).toEqual({
            questionNumber: 2,
            questionText: "What is the capital of Spain?",
            options: [
                { label: "A", text: "Barcelona" },
                { label: "B", text: "Madrid" },
                { label: "C", text: "Seville" },
                { label: "D", text: "Valencia" }
            ],
            correctAnswer: "B"
        });
    });

    it("should parse answer keys with lowercase letters and varying delimiters", () => {
        const quizText = `
1: Which element has symbol O?
a) Hydrogen
b) Helium
c) Oxygen
d) Carbon

Answer Key:
1: C
`;
        const result = parseQuiz(quizText);
        expect(result).not.toBeNull();
        expect(result?.questions).toHaveLength(1);
        expect(result?.questions[0].correctAnswer).toBe("C");
    });
});
