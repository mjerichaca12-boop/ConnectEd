import { describe, it, expect } from 'vitest';
import { formatTeacherName, formatFullName } from '../name-formatter';

describe('formatTeacherName', () => {
    it('returns empty string for null or undefined input', () => {
        expect(formatTeacherName(null)).toBe('');
        expect(formatTeacherName(undefined)).toBe('');
        expect(formatTeacherName({})).toBe('');
    });

    it('formats basic first and last name', () => {
        expect(formatTeacherName({ first_name: 'Rosh', last_name: 'Ogad' })).toBe('Rosh Ogad');
    });

    it('appends suffix when provided', () => {
        expect(formatTeacherName({ first_name: 'Rosh', last_name: 'Ogad', suffix: 'Jr.' })).toBe('Rosh Ogad Jr.');
        expect(formatTeacherName({ first_name: 'Juan', last_name: 'dela Cruz', suffix: 'Sr.' })).toBe('Juan dela Cruz Sr.');
        expect(formatTeacherName({ first_name: 'Mario', last_name: 'Santos', suffix: 'III' })).toBe('Mario Santos III');
        expect(formatTeacherName({ first_name: 'Pedro', last_name: 'Penduko', suffix: 'IV' })).toBe('Pedro Penduko IV');
    });

    it('supports name_extension and extension fallback keys', () => {
        expect(formatTeacherName({ first_name: 'Rosh', last_name: 'Ogad', name_extension: 'Jr.' })).toBe('Rosh Ogad Jr.');
        expect(formatTeacherName({ first_name: 'Rosh', last_name: 'Ogad', extension: 'II' })).toBe('Rosh Ogad II');
    });

    it('prevents duplicating suffix if last_name already ends with suffix', () => {
        expect(formatTeacherName({ first_name: 'Rosh', last_name: 'Ogad Jr.', suffix: 'Jr.' })).toBe('Rosh Ogad Jr.');
        expect(formatTeacherName({ first_name: 'Rosh', last_name: 'Ogad, Jr.', suffix: 'Jr.' })).toBe('Rosh Ogad, Jr.');
        expect(formatTeacherName({ first_name: 'Juan', last_name: 'Cruz III', suffix: 'III' })).toBe('Juan Cruz III');
    });

    it('falls back to full_name or name when first and last are missing', () => {
        expect(formatTeacherName({ full_name: 'Prof. John Doe', suffix: 'Jr.' })).toBe('Prof. John Doe Jr.');
        expect(formatTeacherName({ name: 'Jane Smith' })).toBe('Jane Smith');
    });

    it('handles string input directly', () => {
        expect(formatTeacherName('Prof. Rosh Ogad Jr.')).toBe('Prof. Rosh Ogad Jr.');
    });
});

describe('formatFullName', () => {
    it('formats first, middle, last and suffix', () => {
        expect(formatFullName({
            first_name: 'Juan',
            middle_name: 'Mendoza',
            last_name: 'dela Cruz',
            suffix: 'Jr.'
        })).toBe('Juan Mendoza dela Cruz Jr.');
    });

    it('handles missing middle name', () => {
        expect(formatFullName({
            first_name: 'Rosh',
            last_name: 'Ogad',
            suffix: 'Jr.'
        })).toBe('Rosh Ogad Jr.');
    });

    it('prevents duplicate suffix in full name', () => {
        expect(formatFullName({
            first_name: 'Rosh',
            middle_name: 'M.',
            last_name: 'Ogad Jr.',
            suffix: 'Jr.'
        })).toBe('Rosh M. Ogad Jr.');
    });
});
