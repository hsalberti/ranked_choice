// Canonical candidate IDs, mirrored from the frontend candidates.js.
// Used to validate /api/vote, /api/ballot, /api/event input.
//
// Roster is frozen at v1 launch (see specs/mission.md, principle 7),
// so the diff between this file and candidates.js should always be
// empty during normal operation. If it isn't, both files need a
// spec-amendment commit.
//
// v2 (smart-matchups-crowd-elo) added PARTY_OF for /api/elo party
// filtering. Two names (`trumpjr`, `pritzker`) were tier-promoted but
// physically still live in EXTENDED_IDS — that's OK, ALL_IDS is what
// /api/vote and /api/ballot validate against.

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

// Used by /api/elo for the party= filter. Mirrored from candidates.js.
export const PARTY_OF: Readonly<Record<string, 'R' | 'D' | 'I'>> = {
  ramaswamy: 'R', booker: 'D', desantis: 'R', buttigieg: 'D', scott: 'R',
  ossoff: 'D', rfk: 'I', cuban: 'I', carlson: 'R', stefanik: 'R',
  mace: 'R', aoc: 'D', vance: 'R', newsom: 'D', gaetz: 'R',
  talarico: 'D', rubio: 'R', harris: 'D', hegseth: 'R', moore: 'D',
  cruz: 'R', shapiro: 'D', greene: 'R', klobuchar: 'D', bannon: 'R',
  pritzker: 'D', sanders_sh: 'R', abbott: 'R', kemp: 'R', youngkin: 'R',
  burgum: 'R', gabbard: 'R', paul: 'R', kelly: 'D', vanhollen: 'D',
  smith_sa: 'D', trumpjr: 'R', emanuel: 'D', raimondo: 'D', landrieu: 'D',
};

export function isHeadlineId(id: unknown): id is string {
  return typeof id === 'string' && HEADLINE_IDS.has(id);
}

export function isCandidateId(id: unknown): id is string {
  return typeof id === 'string' && ALL_IDS.has(id);
}
