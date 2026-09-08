import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteAssignment } from '../delete-assignment';
import { supabase } from '../../../lib/supabase';

// Helper to create a chainable query builder mock
const mockBuilder = () => {
    const builder: any = {
        delete: vi.fn(() => builder),
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    return builder;
};

vi.mock('../../../lib/supabase', () => {
    return {
        supabase: {
            from: vi.fn(() => mockBuilder()),
            storage: {
                from: vi.fn(() => ({
                    remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
                })),
            },
        },
    };
});

describe('deleteAssignment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should throw an error if assignmentId is empty', async () => {
        await expect(deleteAssignment('')).rejects.toThrow('Assignment ID is required for deletion');
    });

    it('should delete from child and parent tables', async () => {
        const testId = 'test-assignment-123';
        await deleteAssignment(testId);

        const tablesCalled = (supabase.from as any).mock.calls.map((call: any[]) => call[0]);
        
        expect(tablesCalled).toContain('lesson_activities');
        expect(tablesCalled).toContain('quiz_questions');
        expect(tablesCalled).toContain('quiz_attempts');
        expect(tablesCalled).toContain('teacher_assessment_grades');
        expect(tablesCalled).toContain('teacher_assessment_submissions');
        expect(tablesCalled).toContain('assignments');
        expect(tablesCalled).toContain('assignments_activity');
        expect(tablesCalled).toContain('quizzes');
        expect(tablesCalled).toContain('class_assignments');
    });

    it('should remove files from storage if options are provided', async () => {
        const removeMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
        (supabase.storage.from as any).mockReturnValue({ remove: removeMock });

        await deleteAssignment('test-id', {
            filePaths: ['assignments/test/file1.pdf'],
            fileUrls: ['https://example.com/storage/v1/object/public/class-materials/assignments/test/file2.png']
        });

        expect(supabase.storage.from).toHaveBeenCalledWith('class-materials');
        expect(removeMock).toHaveBeenCalledWith(
            expect.arrayContaining(['assignments/test/file1.pdf', 'assignments/test/file2.png'])
        );
    });
});
