// Canonical candidate IDs, mirrored from the frontend candidates.js.
// Used to validate /api/vote, /api/ballot, /api/event input.
//
// Roster is frozen at v1 launch (see specs/mission.md, principle 7),
// so the diff between this file and candidates.js should always be
// empty during normal operation. If it isn't, both files need a
// spec-amendment commit.

export const HEADLINE_IDS: ReadonlySet<string> = new Set([
  'ramaswamy', 'booker', 'desantis', 'buttigieg', 'scott',
  'ossoff', 'rfk', 'cuban', 'carlson', 'stefanik',
  'mace', 'aoc', 'vance', 'newsom', 'gaetz',
  'talarico', 'rubio', 'harris', 'hegseth', 'moore',
  'cruz', 'shapiro', 'greene', 'klobuchar', 'bannon',
]);

export const EXTENDED_IDS: ReadonlySet<string> = new Set([
  'pritzker', 'sanders_sh', 'abbott', 'kemp', 'youngkin',
  'burgum', 'gabbard', 'paul', 'kelly', 'vanhollen',
  'smith_sa', 'trumpjr', 'emanuel', 'raimondo', 'landrieu',
]);

export const ALL_IDS: ReadonlySet<string> = new Set([
  ...HEADLINE_IDS,
  ...EXTENDED_IDS,
]);

export function isHeadlineId(id: unknown): id is string {
  return typeof id === 'string' && HEADLINE_IDS.has(id);
}

export function isCandidateId(id: unknown): id is string {
  return typeof id === 'string' && ALL_IDS.has(id);
}
