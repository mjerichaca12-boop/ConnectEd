import { describe, it, expect } from 'vitest';
import {
    normalizeSection,
    isSectionMatch,
    normalizeGradeLevel,
    isGradeLevelMatch,
    isUniversalOrUnassignedSection,
} from '../section-matcher';

describe('section-matcher utility', () => {
    describe('normalizeSection', () => {
        it('normalizes simple section strings', () => {
            expect(normalizeSection('Diamond')).toBe('diamond');
            expect(normalizeSection('  Emerald  ')).toBe('emerald');
            expect(normalizeSection('Section A')).toBe('sectiona');
        });

        it('strips grade and year prefixes', () => {
            expect(normalizeSection('Grade 7 - Diamond')).toBe('diamond');
            expect(normalizeSection('Year 8 - Emerald')).toBe('emerald');
            expect(normalizeSection('7-Ruby')).toBe('ruby');
            expect(normalizeSection('G10 : Rizal')).toBe('rizal');
        });

        it('handles null, undefined, empty', () => {
            expect(normalizeSection(null)).toBe('');
            expect(normalizeSection(undefined)).toBe('');
            expect(normalizeSection('')).toBe('');
        });
    });

    describe('isUniversalOrUnassignedSection', () => {
        it('identifies unassigned or universal values', () => {
            expect(isUniversalOrUnassignedSection(null)).toBe(true);
            expect(isUniversalOrUnassignedSection(undefined)).toBe(true);
            expect(isUniversalOrUnassignedSection('')).toBe(true);
            expect(isUniversalOrUnassignedSection('all')).toBe(true);
            expect(isUniversalOrUnassignedSection('All Sections')).toBe(true);
            expect(isUniversalOrUnassignedSection('unassigned')).toBe(true);
            expect(isUniversalOrUnassignedSection('none')).toBe(true);
            expect(isUniversalOrUnassignedSection('N/A')).toBe(true);
        });

        it('returns false for concrete sections', () => {
            expect(isUniversalOrUnassignedSection('Diamond')).toBe(false);
            expect(isUniversalOrUnassignedSection('Section A')).toBe(false);
        });
    });

    describe('isSectionMatch', () => {
        it('returns true when student section equals subject section', () => {
            expect(isSectionMatch('Diamond', 'Diamond')).toBe(true);
            expect(isSectionMatch('emerald', 'Emerald')).toBe(true);
            expect(isSectionMatch('Section A', 'Section A')).toBe(true);
        });

        it('returns true when subject has prefix and student does not', () => {
            expect(isSectionMatch('Diamond', 'Grade 7 - Diamond')).toBe(true);
            expect(isSectionMatch('Grade 7 - Diamond', 'Diamond')).toBe(true);
            expect(isSectionMatch('Ruby', '7-Ruby')).toBe(true);
        });

        it('returns false when sections are different', () => {
            expect(isSectionMatch('Diamond', 'Emerald')).toBe(false);
            expect(isSectionMatch('Section A', 'Section B')).toBe(false);
            expect(isSectionMatch('Grade 7 - Diamond', 'Grade 7 - Emerald')).toBe(false);
            expect(isSectionMatch('Ruby', 'Diamond')).toBe(false);
        });

        it('allows access to subjects with no specific section restriction', () => {
            expect(isSectionMatch('Diamond', null)).toBe(true);
            expect(isSectionMatch('Diamond', '')).toBe(true);
            expect(isSectionMatch('Diamond', 'all')).toBe(true);
            expect(isSectionMatch('Diamond', 'All Sections')).toBe(true);
            expect(isSectionMatch('Diamond', 'unassigned')).toBe(true);
        });

        it('blocks students without a section from accessing section-specific subjects', () => {
            expect(isSectionMatch(null, 'Diamond')).toBe(false);
            expect(isSectionMatch('', 'Diamond')).toBe(false);
            expect(isSectionMatch('unassigned', 'Diamond')).toBe(false);
        });
    });

    describe('normalizeGradeLevel & isGradeLevelMatch', () => {
        it('normalizes grade levels with digits', () => {
            expect(normalizeGradeLevel('Grade 7')).toBe('7');
            expect(normalizeGradeLevel('Year 10')).toBe('10');
            expect(normalizeGradeLevel('7')).toBe('7');
        });

        it('matches identical grade levels', () => {
            expect(isGradeLevelMatch('Grade 7', '7')).toBe(true);
            expect(isGradeLevelMatch('Grade 8', 'Grade 8')).toBe(true);
        });

        it('rejects different grade levels', () => {
            expect(isGradeLevelMatch('Grade 7', 'Grade 8')).toBe(false);
            expect(isGradeLevelMatch('7', '9')).toBe(false);
        });

        it('allows when either grade level is unspecified', () => {
            expect(isGradeLevelMatch(null, 'Grade 7')).toBe(true);
            expect(isGradeLevelMatch('Grade 7', null)).toBe(true);
            expect(isGradeLevelMatch(null, null)).toBe(true);
        });
    });
});
