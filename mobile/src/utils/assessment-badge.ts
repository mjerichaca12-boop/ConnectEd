export interface AssessmentBadgeConfig {
    label: string;
    iconName: 'document-text-outline' | 'help-circle-outline' | 'create-outline' | 'bulb-outline';
    bg: string;
    border: string;
    textColor: string;
}

export type AssessmentClassification = 'quiz' | 'seatwork' | 'assignment';

/**
 * Classifies any task/assessment record into one of three standard categories:
 * 1. 'quiz' - Quizzes, Periodical / Quarterly Exams, Tests, Multiple Choice / Structured Question sheets
 * 2. 'seatwork' - In-class Activities, Seatworks, Practice Drills, Assessments, Exercises
 * 3. 'assignment' - Homework, Take-home Projects, File Uploads, Essays, General Assignments
 */
export function classifyAssessment(item?: any): AssessmentClassification {
    if (!item) return 'assignment';

    // If string is passed directly
    if (typeof item === 'string') {
        const str = item.trim().toLowerCase();
        if (str === 'quiz' || str.includes('quiz') || str.includes('exam') || str.includes('test')) {
            return 'quiz';
        }
        if (str === 'seatwork' || str === 'activity' || str === 'assessment' || str.includes('seatwork') || str.includes('activity') || str.includes('drill') || str.includes('exercise')) {
            return 'seatwork';
        }
        return 'assignment';
    }

    // 1. Check for Quiz Indicators (questions payload, quiz data, assessment_type, activity_type, etc.)
    const rawType = String(item.assessment_type || item.activity_type || item.task_category || item.type || item.assignment_type || item.category || '').trim().toLowerCase();
    const title = String(item.title || item.name || '').trim().toLowerCase();
    const questions = item.questions || item.quiz_data;

    const hasExplicitQuestions = Array.isArray(questions) ? questions.length > 0 : (typeof questions === 'string' && questions.trim().length > 0 && questions.trim().toUpperCase() !== 'EMPTY');
    const isQuizType = rawType === 'quiz' || rawType.includes('quiz') || rawType.includes('exam') || rawType.includes('periodical') || rawType.includes('test');
    const isQuizTitle = /\b(quiz|periodical exam|quarterly exam|quarter exam|unit test|pre-test|post-test)\b/i.test(title) || /^quiz\b/i.test(title);

    if (isQuizType || isQuizTitle || hasExplicitQuestions) {
        return 'quiz';
    }

    // 2. Check for Seatwork Indicators (Assessment/Seatwork task_category, activity_type, seatwork titles)
    const isSeatworkType = rawType === 'seatwork' || rawType === 'assessment' || rawType === 'activity' || rawType.includes('seatwork') || rawType.includes('activity') || rawType.includes('drill') || rawType.includes('exercise') || rawType.includes('pagsasanay') || rawType.includes('gawain');
    const isSeatworkTitle = /\b(seatwork|activity|performance task|drill|exercise|pagsasanay|gawain)\b/i.test(title) || /^(seatwork|activity|task)\b/i.test(title);

    if (isSeatworkType || isSeatworkTitle) {
        return 'seatwork';
    }

    // 3. Default to Assignment (Homework, Projects, Essays, File Uploads)
    return 'assignment';
}

/**
 * Returns UI styling and label for the assessment type badge.
 */
export function getAssessmentBadgeConfig(typeOrItem?: any): AssessmentBadgeConfig {
    const classification = classifyAssessment(typeOrItem);

    if (classification === 'quiz') {
        return {
            label: 'QUIZ',
            iconName: 'help-circle-outline',
            bg: '#EEF2FF', // Indigo 50
            border: '#C7D2FE', // Indigo 200
            textColor: '#4338CA', // Indigo 700
        };
    } else if (classification === 'seatwork') {
        return {
            label: 'SEATWORK',
            iconName: 'create-outline',
            bg: '#FFFBEB', // Amber 50
            border: '#FDE68A', // Amber 200
            textColor: '#B45309', // Amber 700
        };
    } else {
        return {
            label: 'ASSIGNMENT',
            iconName: 'document-text-outline',
            bg: '#EFF6FF', // Blue 50
            border: '#BFDBFE', // Blue 200
            textColor: '#1D4ED8', // Blue 700
        };
    }
}
