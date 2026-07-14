/**
 * Curated genre landing pages (ROADMAP G2 follow-up): the fixed set of genres
 * that get a crawlable /browse/genre/[slug] route in the static export. Each
 * carries the iTunes `primaryGenreName` labels it groups (items are tagged
 * with those exact strings via the genre pipeline) and a unique intro blurb —
 * that copy is what makes each exported page real content for search engines
 * instead of a bare app shell.
 *
 * Pure data (no React/Supabase imports) so tests can load it under node.
 */

export interface CuratedGenre {
  /** URL slug — /browse/genre/<slug>. Lowercase, hyphenated, stable. */
  slug: string;
  /** Display name for headings and chips. */
  label: string;
  /** iTunes primaryGenreName values folded into this page (case-insensitive). */
  itunes: string[];
  /** Unique, crawlable intro copy for the page. */
  blurb: string;
}

export const CURATED_GENRES: CuratedGenre[] = [
  {
    slug: 'hip-hop',
    label: 'Hip-Hop',
    itunes: ['Hip-Hop/Rap', 'Hip-Hop', 'Rap'],
    blurb:
      'The hip-hop albums and songs the Jelli community rates highest — from classic boom bap to new drill and everything the culture argues about in between. Rankings come from real head-to-head matchups, not star averages, so the order actually means something.',
  },
  {
    slug: 'pop',
    label: 'Pop',
    itunes: ['Pop', 'K-Pop', 'Dance Pop'],
    blurb:
      'The best pop music according to people who rank every song they hear. Chart hits, K-pop, and the album cuts that outlive the singles — ordered by the Jelli community’s head-to-head ratings.',
  },
  {
    slug: 'rock',
    label: 'Rock',
    itunes: ['Rock', 'Hard Rock', 'Classic Rock'],
    blurb:
      'Rock, ranked. From classic records that built the canon to whatever your friends are calling a revival this year, these are the rock albums and songs the Jelli community scores highest in head-to-head matchups.',
  },
  {
    slug: 'r-and-b',
    label: 'R&B',
    itunes: ['R&B/Soul', 'Soul', 'Neo-Soul'],
    blurb:
      'The R&B and soul the Jelli community keeps coming back to — slow jams, neo-soul, and the modern records that blur every line. Ranked by real listener matchups, so a 9 here had to beat something to earn it.',
  },
  {
    slug: 'indie',
    label: 'Indie & Alternative',
    itunes: ['Alternative', 'Indie Rock', 'Indie Pop', 'Singer/Songwriter'],
    blurb:
      'Indie and alternative music ranked by people with opinions: bedroom pop, festival headliners, and the singer-songwriters your group chat won’t stop quoting. The order comes from head-to-head community matchups on Jelli.',
  },
  {
    slug: 'electronic',
    label: 'Electronic',
    itunes: ['Electronic', 'Dance', 'House', 'Techno'],
    blurb:
      'The electronic and dance music the Jelli community rates highest — house, techno, and the albums that work both at 2am and on headphones. Rankings are built from real head-to-head comparisons, not algorithmic hype.',
  },
  {
    slug: 'country',
    label: 'Country',
    itunes: ['Country', 'Americana'],
    blurb:
      'Country and Americana, ranked by listeners who log every record they hear. From outlaw classics to the new class crossing every genre line, these are the community’s highest-rated country albums and songs on Jelli.',
  },
  {
    slug: 'jazz',
    label: 'Jazz',
    itunes: ['Jazz', 'Vocal Jazz'],
    blurb:
      'The jazz records the Jelli community rates highest — canonical sessions, vocal standards, and the new players keeping the form alive. Every ranking is earned through head-to-head matchups against other beloved records.',
  },
  {
    slug: 'metal',
    label: 'Metal',
    itunes: ['Metal', 'Heavy Metal', 'Hardcore'],
    blurb:
      'Metal, ranked without mercy. The heaviest records the Jelli community scores highest across metal, hardcore, and everything adjacent — ordered by real head-to-head listener matchups.',
  },
  {
    slug: 'latin',
    label: 'Latin',
    itunes: ['Latin', 'Latin Urbano', 'Reggaeton'],
    blurb:
      'The Latin music the Jelli community rates highest — reggaeton, urbano, and the albums crossing over everywhere. Rankings come from head-to-head matchups by listeners who log everything they hear.',
  },
];

/** Look up a curated genre by its URL slug (case-insensitive). */
export function genreBySlug(slug: string | undefined): CuratedGenre | null {
  if (!slug) return null;
  const s = slug.toLowerCase();
  return CURATED_GENRES.find((g) => g.slug === s) ?? null;
}
