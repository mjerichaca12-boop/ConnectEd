import { describe, it, expect } from 'vitest';
import { matchesSearchQuery } from '../search-profiles-matcher';

describe('matchesSearchQuery', () => {
    const adminUser = {
        id: '1',
        full_name: 'Administrator Chief',
        base_name: 'Administrator Chief',
        email: 'admin@connected.edu',
        username: 'sysadmin',
        role: 'admin',
    };

    const superAdminUser = {
        id: '2',
        full_name: 'Super Admin',
        base_name: 'Super Admin',
        email: 'super@connected.edu',
        username: 'superadmin',
        role: 'super_admin',
    };

    const teacherUser = {
        id: '3',
        full_name: 'Professor John Smith',
        base_name: 'John Smith',
        email: 'jsmith@school.edu',
        username: 'prof_john',
        role: 'teacher',
    };

    const studentUser = {
        id: '4',
        full_name: 'Alice Cooper',
        base_name: 'Alice Cooper',
        email: 'alice@student.edu',
        username: 'alice_c',
        role: 'student',
    };

    const chatItem = {
        id: '5',
        partner_name: 'Bob Johnson',
        partner_role: 'teacher',
        content: 'Please submit your homework by Friday',
    };

    it('returns true when search query is empty or whitespace', () => {
        expect(matchesSearchQuery(adminUser, '')).toBe(true);
        expect(matchesSearchQuery(teacherUser, '   ')).toBe(true);
        expect(matchesSearchQuery(studentUser, undefined)).toBe(true);
    });

    it('matches by exact and partial names (case-insensitive)', () => {
        expect(matchesSearchQuery(teacherUser, 'john')).toBe(true);
        expect(matchesSearchQuery(teacherUser, 'SMITH')).toBe(true);
        expect(matchesSearchQuery(teacherUser, 'prof')).toBe(true);
        expect(matchesSearchQuery(studentUser, 'alice')).toBe(true);
        expect(matchesSearchQuery(studentUser, 'cooper')).toBe(true);
    });

    it('matches by email', () => {
        expect(matchesSearchQuery(adminUser, 'admin@connected.edu')).toBe(true);
        expect(matchesSearchQuery(adminUser, '@connected.edu')).toBe(true);
        expect(matchesSearchQuery(studentUser, 'alice@student')).toBe(true);
    });

    it('matches by username', () => {
        expect(matchesSearchQuery(adminUser, 'sysadmin')).toBe(true);
        expect(matchesSearchQuery(teacherUser, 'prof_john')).toBe(true);
        expect(matchesSearchQuery(studentUser, 'alice_c')).toBe(true);
    });

    it('matches role queries and role aliases for admin', () => {
        expect(matchesSearchQuery(adminUser, 'admin')).toBe(true);
        expect(matchesSearchQuery(adminUser, 'admins')).toBe(true);
        expect(matchesSearchQuery(adminUser, 'administrator')).toBe(true);
        expect(matchesSearchQuery(adminUser, 'super_admin')).toBe(true);
        expect(matchesSearchQuery(superAdminUser, 'admin')).toBe(true);
        expect(matchesSearchQuery(superAdminUser, 'admins')).toBe(true);
    });

    it('matches role queries and role aliases for teacher', () => {
        expect(matchesSearchQuery(teacherUser, 'teacher')).toBe(true);
        expect(matchesSearchQuery(teacherUser, 'teachers')).toBe(true);
        expect(matchesSearchQuery(teacherUser, 'faculty')).toBe(true);
        expect(matchesSearchQuery(teacherUser, 'instructor')).toBe(true);
    });

    it('matches role queries and role aliases for student', () => {
        expect(matchesSearchQuery(studentUser, 'student')).toBe(true);
        expect(matchesSearchQuery(studentUser, 'students')).toBe(true);
        expect(matchesSearchQuery(studentUser, 'learner')).toBe(true);
    });

    it('matches wildcard queries for all users ("user", "users", "all", "everyone", "people")', () => {
        expect(matchesSearchQuery(adminUser, 'user')).toBe(true);
        expect(matchesSearchQuery(adminUser, 'users')).toBe(true);
        expect(matchesSearchQuery(teacherUser, 'users')).toBe(true);
        expect(matchesSearchQuery(studentUser, 'all')).toBe(true);
        expect(matchesSearchQuery(studentUser, 'people')).toBe(true);
    });

    it('matches multi-token queries combining role and name', () => {
        expect(matchesSearchQuery(teacherUser, 'teacher john')).toBe(true);
        expect(matchesSearchQuery(teacherUser, 'faculty smith')).toBe(true);
        expect(matchesSearchQuery(adminUser, 'admin chief')).toBe(true);
        expect(matchesSearchQuery(studentUser, 'student alice')).toBe(true);
    });

    it('matches chat message content', () => {
        expect(matchesSearchQuery(chatItem, 'homework')).toBe(true);
        expect(matchesSearchQuery(chatItem, 'friday')).toBe(true);
        expect(matchesSearchQuery(chatItem, 'Bob')).toBe(true);
    });

    it('matches grade level and year level tokens', () => {
        const studentGrade10 = {
            id: '6',
            full_name: 'David Lee',
            role: 'student',
            year_level: '10',
            grade_level: 'Grade 10',
        };

        expect(matchesSearchQuery(studentGrade10, 'Grade 10')).toBe(true);
        expect(matchesSearchQuery(studentGrade10, 'grade 10')).toBe(true);
        expect(matchesSearchQuery(studentGrade10, '10')).toBe(true);
        expect(matchesSearchQuery(studentGrade10, 'g10')).toBe(true);
        expect(matchesSearchQuery(studentGrade10, 'Grade10')).toBe(true);
        expect(matchesSearchQuery(studentGrade10, 'Grade 9')).toBe(false);
        expect(matchesSearchQuery(studentGrade10, 'David 10')).toBe(true);
    });

    it('returns false when tokens do not match', () => {
        expect(matchesSearchQuery(studentUser, 'nonexistentxyz')).toBe(false);
        expect(matchesSearchQuery(adminUser, 'teacher')).toBe(false);
        expect(matchesSearchQuery(teacherUser, 'admin smith')).toBe(false);
    });
});
