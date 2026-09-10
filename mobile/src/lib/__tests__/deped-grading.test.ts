import { describe, it, expect } from 'vitest';
import {
    normalizeSubjectCategory,
    getDepedCategorySettings,
    inferAssessmentComponent,
    resolveQuarterFromTerm,
    transmuteDepEdQuarterGrade,
    getGradeRemarks,
    computeDepEdQuarterSummary,
    computeDepEdStudentComputation,
} from '../deped-grading';

describe('DepEd Grading System Logic', () => {
    describe('normalizeSubjectCategory', () => {
        it('normalizes category strings correctly', () => {
            expect(normalizeSubjectCategory('Languages / AP / EsP')).toBe('Languages / AP / EsP');
            expect(normalizeSubjectCategory('Science / Mathematics')).toBe('Science / Mathematics');
            expect(normalizeSubjectCategory('MAPEH / EPP / TLE')).toBe('MAPEH / EPP / TLE');
        });

        it('infers category from subject name when category is unspecified or generic', () => {
            expect(normalizeSubjectCategory('General', 'English 10')).toBe('Languages / AP / EsP');
            expect(normalizeSubjectCategory('General', 'Filipino 9')).toBe('Languages / AP / EsP');
            expect(normalizeSubjectCategory('General', 'Araling Panlipunan')).toBe('Languages / AP / EsP');
            expect(normalizeSubjectCategory('General', 'General Mathematics')).toBe('Science / Mathematics');
            expect(normalizeSubjectCategory('General', 'Biology & Science')).toBe('Science / Mathematics');
            expect(normalizeSubjectCategory('General', 'Music & Arts (MAPEH)')).toBe('MAPEH / EPP / TLE');
            expect(normalizeSubjectCategory('General', 'TLE / Cookery')).toBe('MAPEH / EPP / TLE');
        });
    });

    describe('getDepedCategorySettings & Weights', () => {
        it('provides standard DepEd weight splits', () => {
            const lang = getDepedCategorySettings('Languages / AP / EsP');
            expect(lang.writtenWorksWeight).toBe(40);
            expect(lang.performanceTasksWeight).toBe(60);

            const sci = getDepedCategorySettings('Science / Mathematics');
            expect(sci.writtenWorksWeight).toBe(50);
            expect(sci.performanceTasksWeight).toBe(50);

            const mapeh = getDepedCategorySettings('MAPEH / EPP / TLE');
            expect(mapeh.writtenWorksWeight).toBe(30);
            expect(mapeh.performanceTasksWeight).toBe(70);
        });
    });

    describe('inferAssessmentComponent', () => {
        it('classifies quizzes, exams, assignments as Written Works', () => {
            expect(inferAssessmentComponent({ title: 'Quiz 1' })).toBe('writtenWorks');
            expect(inferAssessmentComponent({ type: 'Quiz' })).toBe('writtenWorks');
            expect(inferAssessmentComponent({ title: 'Midterm Exam' })).toBe('writtenWorks');
            expect(inferAssessmentComponent({ assignment_type: 'Assignment' })).toBe('writtenWorks');
            expect(inferAssessmentComponent({ title: 'Worksheet 3' })).toBe('writtenWorks');
        });

        it('classifies activities, seatwork, practicals as Performance Tasks', () => {
            expect(inferAssessmentComponent({ title: 'Lab Activity 1' })).toBe('performanceTasks');
            expect(inferAssessmentComponent({ assessment_type: 'Activity' })).toBe('performanceTasks');
            expect(inferAssessmentComponent({ title: 'Seatwork #2' })).toBe('performanceTasks');
            expect(inferAssessmentComponent({ title: 'Group Project' })).toBe('performanceTasks');
        });
    });

    describe('resolveQuarterFromTerm', () => {
        it('resolves various term notations to quarter integer (1-4)', () => {
            expect(resolveQuarterFromTerm('Q1')).toBe(1);
            expect(resolveQuarterFromTerm('1st Quarter')).toBe(1);
            expect(resolveQuarterFromTerm('Term 1')).toBe(1);
            expect(resolveQuarterFromTerm('Q2')).toBe(2);
            expect(resolveQuarterFromTerm('2nd Quarter')).toBe(2);
            expect(resolveQuarterFromTerm('Q3')).toBe(3);
            expect(resolveQuarterFromTerm('Q4')).toBe(4);
            expect(resolveQuarterFromTerm('4th Quarter')).toBe(4);
        });
    });

    describe('transmuteDepEdQuarterGrade', () => {
        it('calculates official DepEd transmutation formula: 37.5 + (initialGrade * 0.625)', () => {
            // Perfect score: initial 100 -> 100
            expect(transmuteDepEdQuarterGrade(100)).toBe(100);

            // Minimum passing score: initial 60 -> 37.5 + 37.5 = 75
            expect(transmuteDepEdQuarterGrade(60)).toBe(75);

            // Initial 80 -> 37.5 + 50 = 87.5 -> 88
            expect(transmuteDepEdQuarterGrade(80)).toBe(88);

            // Initial 90 -> 37.5 + 56.25 = 93.75 -> 94
            expect(transmuteDepEdQuarterGrade(90)).toBe(94);

            // Zero or negative
            expect(transmuteDepEdQuarterGrade(0)).toBe(0);
        });
    });

    describe('getGradeRemarks', () => {
        it('returns appropriate DepEd remarks', () => {
            expect(getGradeRemarks(95)).toBe('Outstanding');
            expect(getGradeRemarks(88)).toBe('Very Satisfactory');
            expect(getGradeRemarks(82)).toBe('Satisfactory');
            expect(getGradeRemarks(76)).toBe('Passed');
            expect(getGradeRemarks(72)).toBe('Needs Improvement');
        });
    });

    describe('computeDepEdQuarterSummary & computeDepEdStudentComputation', () => {
        it('computes 5-step DepEd grade for Science / Mathematics (50/50)', () => {
            const studentId = 'student-123';
            const assessments = [
                // Written Works (Quizzes/Assignments): Total max = 100, student got 80 (80%)
                { id: 'q1', title: 'Quiz 1', maxPoints: 50, term: 'Q1' },
                { id: 'q2', title: 'Quiz 2', maxPoints: 50, term: 'Q1' },
                // Performance Tasks (Activities): Total max = 100, student got 90 (90%)
                { id: 'act1', title: 'Lab Activity 1', maxPoints: 50, term: 'Q1' },
                { id: 'act2', title: 'Seatwork 1', maxPoints: 50, term: 'Q1' },
            ];

            const gradesMap = {
                q1: { [studentId]: 40 }, // 40/50
                q2: { [studentId]: 40 }, // 40/50 -> WW PS = (80/100)*100 = 80%. WS = 80 * 0.50 = 40.0
                act1: { [studentId]: 45 }, // 45/50
                act2: { [studentId]: 45 }, // 45/50 -> PT PS = (90/100)*100 = 90%. WS = 90 * 0.50 = 45.0
            };

            const quarter1 = computeDepEdQuarterSummary({
                assessmentItems: assessments,
                assessmentGradesMap: gradesMap,
                studentId,
                subjectCategory: 'Science / Mathematics',
                quarter: 1,
            });

            expect(quarter1.writtenWorks.percentageScore).toBe(80);
            expect(quarter1.writtenWorks.weightedScore).toBe(40);
            expect(quarter1.performanceTasks.percentageScore).toBe(90);
            expect(quarter1.performanceTasks.weightedScore).toBe(45);
            // Initial Grade = 40 + 45 = 85
            expect(quarter1.initialGrade).toBe(85);
            // Transmuted Grade = 37.5 + (85 * 0.625) = 37.5 + 53.125 = 90.625 -> 91
            expect(quarter1.quarterlyGrade).toBe(91);
        });

        it('computes full student year computation across all quarters and computes final grade', () => {
            const studentId = 'student-456';
            const assessments = [
                { id: 'a1', title: 'Quiz Q1', maxPoints: 100, term: 'Q1' },
                { id: 'a2', title: 'Activity Q1', maxPoints: 100, term: 'Q1' },
                { id: 'a3', title: 'Quiz Q2', maxPoints: 100, term: 'Q2' },
                { id: 'a4', title: 'Activity Q2', maxPoints: 100, term: 'Q2' },
            ];

            const gradesMap = {
                a1: { [studentId]: 80 },
                a2: { [studentId]: 80 },
                a3: { [studentId]: 90 },
                a4: { [studentId]: 90 },
            };

            const computation = computeDepEdStudentComputation({
                assessmentItems: assessments,
                assessmentGradesMap: gradesMap,
                studentId,
                subjectCategory: 'Languages / AP / EsP',
            });

            expect(computation.quarters.quarter1.quarterlyGrade).toBeGreaterThan(0);
            expect(computation.quarters.quarter2.quarterlyGrade).toBeGreaterThan(0);
            expect(computation.quarters.quarter3.quarterlyGrade).toBe(0); // Not yet graded
            expect(computation.quarters.quarter4.quarterlyGrade).toBe(0); // Not yet graded

            // Final grade should be average of Q1 and Q2
            const expectedAvg = Math.round(
                (computation.quarters.quarter1.quarterlyGrade + computation.quarters.quarter2.quarterlyGrade) / 2
            );
            expect(computation.finalGrade).toBe(expectedAvg);
            expect(computation.remarks).toBe(getGradeRemarks(computation.finalGrade));
        });
    });
});
