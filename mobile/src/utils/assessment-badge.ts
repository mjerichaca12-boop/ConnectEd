export interface AssessmentBadgeConfig {
    label: string;
    iconName: 'document-text-outline' | 'help-circle-outline' | 'bulb-outline';
    bg: string;
    border: string;
    textColor: string;
}

export function getAssessmentBadgeConfig(type?: string | null): AssessmentBadgeConfig {
    const normType = String(type || '').trim().toLowerCase();
    
    if (normType === 'quiz') {
        return {
            label: 'QUIZ',
            iconName: 'help-circle-outline',
            bg: '#EEF2FF', // Indigo 50
            border: '#C7D2FE', // Indigo 200
            textColor: '#4338CA', // Indigo 700
        };
    } else if (normType === 'activity') {
        return {
            label: 'ACTIVITY',
            iconName: 'bulb-outline',
            bg: '#FFFBEB', // Amber 50
            border: '#FDE68A', // Amber 200
            textColor: '#B45309', // Amber 700
        };
    } else {
        // Any assignment type (file upload, essay, task, assignment, etc.)
        return {
            label: 'ASSIGNMENT',
            iconName: 'document-text-outline',
            bg: '#F0FDF4', // Emerald 50
            border: '#BBF7D0', // Emerald 200
            textColor: '#15803D', // Emerald 700
        };
    }
}
