import { describe, it, expect } from 'vitest';

// Simulating the logic used in home.tsx
const calculateTaskSummary = (assignments: any[]) => {
    return {
        upcoming: assignments.filter(a => a.status === 'pending').length,
        submitted: assignments.filter(a => a.status === 'submitted' || a.status === 'graded' || a.status === 'returned').length,
        late: assignments.filter(a => a.status === 'late').length
    };
};

describe('Task Summary Calculation', () => {
    it('should correctly count assignments by status', () => {
        const mockAssignments = [
            { id: '1', status: 'pending' },
            { id: '2', status: 'pending' },
            { id: '3', status: 'submitted' },
            { id: '4', status: 'graded' },
            { id: '5', status: 'returned' },
            { id: '6', status: 'late' },
        ];

        const summary = calculateTaskSummary(mockAssignments);

        expect(summary.upcoming).toBe(2);
        expect(summary.submitted).toBe(3); // submitted + graded + returned
        expect(summary.late).toBe(1);
    });

    it('should return zeros for empty list', () => {
        const summary = calculateTaskSummary([]);

        expect(summary.upcoming).toBe(0);
        expect(summary.submitted).toBe(0);
        expect(summary.late).toBe(0);
    });

    it('should handle missing statuses gracefully', () => {
        const mockAssignments = [
            { id: '1', status: 'pending' },
            { id: '2', status: 'unknown' },
        ];

        const summary = calculateTaskSummary(mockAssignments);

        expect(summary.upcoming).toBe(1);
        expect(summary.submitted).toBe(0);
        expect(summary.late).toBe(0);
    });
});
