import { describe, it, expect } from 'vitest';
import { getAssessmentBadgeConfig } from '../assessment-badge';

describe('getAssessmentBadgeConfig', () => {
    it('should map "file upload" to ASSIGNMENT with emerald theme', () => {
        const config = getAssessmentBadgeConfig('file upload');
        expect(config.label).toBe('ASSIGNMENT');
        expect(config.iconName).toBe('document-text-outline');
        expect(config.textColor).toBe('#15803D');
        expect(config.bg).toBe('#F0FDF4');
        expect(config.border).toBe('#BBF7D0');
    });

    it('should map "file_upload" to ASSIGNMENT', () => {
        const config = getAssessmentBadgeConfig('file_upload');
        expect(config.label).toBe('ASSIGNMENT');
    });

    it('should map "essay" to ASSIGNMENT', () => {
        const config = getAssessmentBadgeConfig('essay');
        expect(config.label).toBe('ASSIGNMENT');
    });

    it('should map "assignment" to ASSIGNMENT', () => {
        const config = getAssessmentBadgeConfig('assignment');
        expect(config.label).toBe('ASSIGNMENT');
    });

    it('should map "quiz" to QUIZ with indigo theme', () => {
        const config = getAssessmentBadgeConfig('quiz');
        expect(config.label).toBe('QUIZ');
        expect(config.iconName).toBe('help-circle-outline');
        expect(config.textColor).toBe('#4338CA');
    });

    it('should map "activity" to ACTIVITY with amber theme', () => {
        const config = getAssessmentBadgeConfig('activity');
        expect(config.label).toBe('ACTIVITY');
        expect(config.iconName).toBe('bulb-outline');
        expect(config.textColor).toBe('#B45309');
    });

    it('should default null or undefined to ASSIGNMENT', () => {
        expect(getAssessmentBadgeConfig(null).label).toBe('ASSIGNMENT');
        expect(getAssessmentBadgeConfig(undefined).label).toBe('ASSIGNMENT');
    });
});
