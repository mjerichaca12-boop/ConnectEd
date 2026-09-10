import { describe, it, expect } from 'vitest';
import { getAssessmentBadgeConfig, classifyAssessment } from '../assessment-badge';

describe('classifyAssessment', () => {
    it('classifies quizzes correctly', () => {
        expect(classifyAssessment('quiz')).toBe('quiz');
        expect(classifyAssessment({ assessment_type: 'quiz' })).toBe('quiz');
        expect(classifyAssessment({ activity_type: 'Quiz' })).toBe('quiz');
        expect(classifyAssessment({ title: 'Quiz 1: Fractions' })).toBe('quiz');
        expect(classifyAssessment({ title: '1st Periodical Exam in Science' })).toBe('quiz');
        expect(classifyAssessment({ questions: [{ question: 'What is 2+2?' }] })).toBe('quiz');
    });

    it('classifies seatworks correctly', () => {
        expect(classifyAssessment('seatwork')).toBe('seatwork');
        expect(classifyAssessment('activity')).toBe('seatwork');
        expect(classifyAssessment({ assessment_type: 'seatwork' })).toBe('seatwork');
        expect(classifyAssessment({ assessment_type: 'activity' })).toBe('seatwork');
        expect(classifyAssessment({ task_category: 'Assessment' })).toBe('seatwork');
        expect(classifyAssessment({ activity_type: 'Seatwork' })).toBe('seatwork');
        expect(classifyAssessment({ title: 'Seatwork 2: Cell Division' })).toBe('seatwork');
        expect(classifyAssessment({ title: 'Activity 3: Chemical Reactions' })).toBe('seatwork');
    });

    it('classifies assignments correctly', () => {
        expect(classifyAssessment('assignment')).toBe('assignment');
        expect(classifyAssessment('file upload')).toBe('assignment');
        expect(classifyAssessment('essay')).toBe('assignment');
        expect(classifyAssessment({ assessment_type: 'assignment' })).toBe('assignment');
        expect(classifyAssessment({ title: 'Homework Chapter 4' })).toBe('assignment');
        expect(classifyAssessment(null)).toBe('assignment');
        expect(classifyAssessment(undefined)).toBe('assignment');
    });
});

describe('getAssessmentBadgeConfig', () => {
    it('should map "assignment" to ASSIGNMENT with blue theme', () => {
        const config = getAssessmentBadgeConfig('assignment');
        expect(config.label).toBe('ASSIGNMENT');
        expect(config.iconName).toBe('document-text-outline');
        expect(config.textColor).toBe('#1D4ED8');
        expect(config.bg).toBe('#EFF6FF');
        expect(config.border).toBe('#BFDBFE');
    });

    it('should map "quiz" to QUIZ with indigo theme', () => {
        const config = getAssessmentBadgeConfig('quiz');
        expect(config.label).toBe('QUIZ');
        expect(config.iconName).toBe('help-circle-outline');
        expect(config.textColor).toBe('#4338CA');
    });

    it('should map "seatwork" / "activity" to SEATWORK with amber theme', () => {
        const configSeatwork = getAssessmentBadgeConfig('seatwork');
        expect(configSeatwork.label).toBe('SEATWORK');
        expect(configSeatwork.iconName).toBe('create-outline');
        expect(configSeatwork.textColor).toBe('#B45309');

        const configActivity = getAssessmentBadgeConfig('activity');
        expect(configActivity.label).toBe('SEATWORK');
    });

    it('should default null or undefined to ASSIGNMENT', () => {
        expect(getAssessmentBadgeConfig(null).label).toBe('ASSIGNMENT');
        expect(getAssessmentBadgeConfig(undefined).label).toBe('ASSIGNMENT');
    });
});
