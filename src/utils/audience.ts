// Who a post is for. The server decides (backend src/utils/postAudience.js); this file only names the choices
// for the screens. A post with no audience is a post from before audiences existed: it is for the author's university.

export type AudienceKind = 'everyone' | 'university' | 'universities' | 'followers' | 'friends' | 'people';

export interface AudienceOption {
  kind: AudienceKind;
  icon: string;
  label: string;
  hint: string;
}

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  { kind: 'everyone', icon: '🌍', label: 'Everyone', hint: 'Anyone on UniLink, at any university' },
  { kind: 'university', icon: '🎓', label: 'My university', hint: 'Only people at your university' },
  { kind: 'universities', icon: '🏛️', label: 'Chosen universities', hint: 'Pick the universities that can see it' },
  { kind: 'followers', icon: '👥', label: 'Followers', hint: 'People who follow you' },
  { kind: 'friends', icon: '🤝', label: 'Friends', hint: 'People you follow who follow you back' },
  { kind: 'people', icon: '🔒', label: 'Specific people', hint: 'Only the people you pick' },
];

export interface PickedUniversity { _id: string; name: string }
export interface PickedPerson { _id: string; name: string; username?: string | null }

export interface AudienceValue {
  kind: AudienceKind;
  universities: PickedUniversity[];
  people: PickedPerson[];
}

export const DEFAULT_AUDIENCE: AudienceValue = { kind: 'university', universities: [], people: [] };

export function audienceOption(kind?: string | null): AudienceOption {
  return AUDIENCE_OPTIONS.find((o) => o.kind === kind) ?? AUDIENCE_OPTIONS[1];
}

// A short line for the composer button, e.g. "Chosen universities (2)".
export function describeAudience(value: AudienceValue): string {
  const option = audienceOption(value.kind);
  if (value.kind === 'universities') return `${option.label} (${value.universities.length})`;
  if (value.kind === 'people') return `${option.label} (${value.people.length})`;
  return option.label;
}

// Whether the value can be posted: the two list audiences need at least one pick.
export function audienceIsComplete(value: AudienceValue): boolean {
  if (value.kind === 'universities') return value.universities.length > 0;
  if (value.kind === 'people') return value.people.length > 0;
  return true;
}

// What the server wants. Lists travel as JSON text so the same fields work in a JSON body and in a multipart form.
export function audienceFields(value: AudienceValue): Record<string, string> {
  const fields: Record<string, string> = { audience: value.kind };
  if (value.kind === 'universities') fields.audienceUniversityIds = JSON.stringify(value.universities.map((u) => u._id));
  if (value.kind === 'people') fields.audienceUserIds = JSON.stringify(value.people.map((p) => p._id));
  return fields;
}

// Only posts for everyone, or for the author's university, can be reshared (the server enforces the same rule).
export function canReshare(audience?: string | null): boolean {
  return !audience || audience === 'everyone' || audience === 'university';
}

// The small label under an author's name. The default (university) says nothing, because most posts are that.
export function audienceBadge(audience?: string | null): string | null {
  if (!audience || audience === 'university') return null;
  const o = audienceOption(audience);
  return `${o.icon} ${o.label}`;
}
