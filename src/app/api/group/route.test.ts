import { describe, it, expect } from 'vitest';
import {
  groupByCompany,
  groupByCategory,
  groupBySession,
  getDeterministicGroups,
  GroupSuggestion,
} from './route';

function makeContact(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id as string ?? crypto.randomUUID(),
    sessionId: (overrides.sessionId as string | null) ?? null,
    name: (overrides.name as string | null) ?? 'Test Person',
    company: (overrides.company as string | null) ?? null,
    role: (overrides.role as string | null) ?? null,
    category: (overrides.category as string) ?? 'other',
    summary: (overrides.summary as string | null) ?? null,
    linkedInUrl: null,
    actionItems: [],
    createdAt: new Date(),
  } as Parameters<typeof groupByCompany>[0][number];
}

describe('groupByCompany', () => {
  it('groups contacts sharing the same company', () => {
    const contacts = [
      makeContact({ id: 'a', company: 'Acme Corp' }),
      makeContact({ id: 'b', company: 'Acme Corp' }),
      makeContact({ id: 'c', company: 'Other Inc' }),
    ];
    const groups = groupByCompany(contacts);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Acme Corp');
    expect(groups[0].type).toBe('company');
    expect(groups[0].cardIds).toEqual(['a', 'b']);
    expect(groups[0].count).toBe(2);
  });

  it('is case-insensitive when matching companies', () => {
    const contacts = [
      makeContact({ id: 'a', company: 'acme corp' }),
      makeContact({ id: 'b', company: 'Acme Corp' }),
    ];
    const groups = groupByCompany(contacts);
    expect(groups).toHaveLength(1);
    expect(groups[0].cardIds).toEqual(['a', 'b']);
  });

  it('ignores contacts with null company', () => {
    const contacts = [
      makeContact({ id: 'a', company: null }),
      makeContact({ id: 'b', company: null }),
    ];
    const groups = groupByCompany(contacts);
    expect(groups).toHaveLength(0);
  });

  it('does not create a group for a single contact at a company', () => {
    const contacts = [
      makeContact({ id: 'a', company: 'Solo Inc' }),
      makeContact({ id: 'b', company: 'Other Inc' }),
    ];
    const groups = groupByCompany(contacts);
    expect(groups).toHaveLength(0);
  });

  it('returns empty array for empty contacts', () => {
    expect(groupByCompany([])).toEqual([]);
  });
});

describe('groupByCategory', () => {
  it('groups contacts sharing the same category', () => {
    const contacts = [
      makeContact({ id: 'a', category: 'developer' }),
      makeContact({ id: 'b', category: 'developer' }),
      makeContact({ id: 'c', category: 'founder' }),
    ];
    const groups = groupByCategory(contacts);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Developers');
    expect(groups[0].type).toBe('category');
    expect(groups[0].cardIds).toEqual(['a', 'b']);
    expect(groups[0].count).toBe(2);
  });

  it('creates multiple category groups when applicable', () => {
    const contacts = [
      makeContact({ id: 'a', category: 'developer' }),
      makeContact({ id: 'b', category: 'developer' }),
      makeContact({ id: 'c', category: 'vc' }),
      makeContact({ id: 'd', category: 'vc' }),
    ];
    const groups = groupByCategory(contacts);
    expect(groups).toHaveLength(2);
    const labels = groups.map((g) => g.label).sort();
    expect(labels).toEqual(['Developers', 'Investors']);
  });

  it('does not create a group for a single contact in a category', () => {
    const contacts = [
      makeContact({ id: 'a', category: 'founder' }),
      makeContact({ id: 'b', category: 'vc' }),
      makeContact({ id: 'c', category: 'developer' }),
    ];
    const groups = groupByCategory(contacts);
    expect(groups).toHaveLength(0);
  });
});

describe('groupBySession', () => {
  it('groups contacts sharing the same session', () => {
    const contacts = [
      makeContact({ id: 'a', sessionId: 'session-1' }),
      makeContact({ id: 'b', sessionId: 'session-1' }),
      makeContact({ id: 'c', sessionId: 'session-2' }),
    ];
    const groups = groupBySession(contacts);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('event');
    expect(groups[0].cardIds).toEqual(['a', 'b']);
    expect(groups[0].count).toBe(2);
  });

  it('ignores contacts with null sessionId', () => {
    const contacts = [
      makeContact({ id: 'a', sessionId: null }),
      makeContact({ id: 'b', sessionId: null }),
    ];
    const groups = groupBySession(contacts);
    expect(groups).toHaveLength(0);
  });

  it('creates multiple session groups', () => {
    const contacts = [
      makeContact({ id: 'a', sessionId: 's1' }),
      makeContact({ id: 'b', sessionId: 's1' }),
      makeContact({ id: 'c', sessionId: 's2' }),
      makeContact({ id: 'd', sessionId: 's2' }),
    ];
    const groups = groupBySession(contacts);
    expect(groups).toHaveLength(2);
  });
});

describe('getDeterministicGroups', () => {
  it('combines company, category, and session groups', () => {
    const contacts = [
      makeContact({ id: 'a', company: 'Acme', category: 'developer', sessionId: 's1' }),
      makeContact({ id: 'b', company: 'Acme', category: 'developer', sessionId: 's1' }),
      makeContact({ id: 'c', company: 'Other', category: 'vc', sessionId: 's2' }),
    ];
    const groups = getDeterministicGroups(contacts);
    // Should have: 1 company group (Acme), 1 category group (developer), 1 session group (s1)
    expect(groups).toHaveLength(3);
    const types = groups.map((g) => g.type).sort();
    expect(types).toEqual(['category', 'company', 'event']);
  });

  it('returns empty for contacts with no shared attributes', () => {
    const contacts = [
      makeContact({ id: 'a', company: 'A', category: 'developer', sessionId: 's1' }),
      makeContact({ id: 'b', company: 'B', category: 'vc', sessionId: 's2' }),
    ];
    const groups = getDeterministicGroups(contacts);
    expect(groups).toHaveLength(0);
  });
});
