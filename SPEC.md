# Heard — Product Spec

> Letterboxd for music. Rate and review songs, albums, and artists; see what your
> friends are listening to; and build a music profile that's actually you.

**Status:** Planning → ready to scaffold MVP
**Platform target:** iOS + Android (shippable consumer app)

---

## 1. Vision

Heard is a social music-rating app. The spine of the product is **rating + social**:
people rate music, those ratings build a personal music identity, and friends' ratings
make it social. Everything else (concerts, games, streaks) hangs off that spine.

Closest analogues: Letterboxd (films), Beli (restaurants), Backloggd (games). Heard is
that pattern for music.

**Name:** Heard. Clean pun (heard / herd = your music community), works as a verb
("have you Heard this?"). Locked in.

---

## 2. Scope

### MVP (build first — the complete core loop)

The minimum that is still fun and demonstrates the idea: **connect → rate → see your
taste → see friends' taste.**

1. **Link Spotify** — auth + pull top tracks/artists and recent plays. This is the data
   foundation and the riskiest piece, so build it first to de-risk.
2. **Rate songs** — initial 0–10 rating with side-by-side comparison to break ties
   (see §5). Produces a personal ranked list.
3. **Profile** — top ranked songs, top artists, basic stats.
4. **Follow friends + feed** — activity feed of what friends are rating.

### Fast-follow (after the core loop feels good)

- Album + artist rating (same engine as songs)
- Concert ratings + **concert badge showcase** (a genuine differentiator — nobody does
  concert collecting well)
- "Daily drop" — audio-BeReal: once a day, share what you're currently listening to
- Streaks (logged music N days in a row)
- Comment sections on songs/reviews
- Leaderboards (personal, friends, global)
- Playlist maker

### Later / backlog

- Apple Music integration (requires paid Apple Developer account + MusicKit)
- Games (finish the lyrics, trivia)
- Smarter ranking algorithm (Elo) — see §5

---

## 3. Core screens (MVP)

### Rate
The hero mechanic. User gives a 0–10 rating; if it ties existing songs, a side-by-side
comparison settles the order (see §5). No 1–10 slider clustering problems because ties
are resolved by direct comparison. Escape hatches: "too close" and "haven't heard it."

### Profile
Leads with identity stats (rated count / shows / streak), then top ranked songs, then
concert badges. This is the screen people screenshot and share — it has to look good.

### Feed
"Daily drop" card at top (time-boxed, creates a daily reason to open the app), then
friend activity (rated X, hit a streak, etc.). Every item has hearts + comments so the
social loop closes.

---

## 4. Rating system — design goals

Keep it **simple now, swappable later.** Modeled on Beli:

- The 0–10 number does the **coarse** sorting on its own.
- Side-by-side comparison only fires to **break ties** between songs at the same score.
- Tie groups are tiny (usually 1–3 songs), so it's almost always 0–2 taps.

The displayed score is the **user's own 0–10 number**. We are NOT deriving scores from
position (that was an earlier, more complex idea we rejected for the MVP).

---

## 5. Rating engine — how it works

### Flow

1. **User rates 0–10** (e.g. `8.5`). That number is the headline score and does the
   coarse placement.
2. **If no other song has that score** → done, it slots in. Zero comparisons.
3. **If it ties** one or more existing songs at that score → fire side-by-side
   comparison(s) *only against the tied songs* to decide order within that group.

Example: rate Redbone `8.5`; it ties Nights (8.5) and Sunflower (8.5). One head-to-head
(Redbone vs Nights) settles it → list order Redbone → Nights → Sunflower, all still
showing 8.5.

### What tied songs display

**Decision: keep the same number.** All tied songs show e.g. `8.5`; the list has a
settled order via a hidden tiebreak value. Honest to "I rated it 8.5," simplest to build.
(Rejected alternative: nudging into decimals like 8.53 / 8.50 / 8.47 — more precise-looking
but drifts from the number the user actually gave.)

### Future-proofing (the one decision that matters)

Store **two** things, not one:

1. **The ordered list** — what the simple engine needs to show rankings today.
2. **Every comparison as an event** — `{ winnerId, loserId, timestamp }` — even though
   the simple engine only needs the final order.

The comparison log is banked data. The day we want Elo (or anything smarter), we replay
the log and get real ratings retroactively — without re-asking users anything.

### Swappable interface

```ts
interface RankingEngine {
  // Next pair to show, or null when placement is done.
  // Returns null whenever the new song's score is unique;
  // returns pairs only when there's a tie to settle.
  nextComparison(list: RankedItem[], item: Item): Pair | null

  // Record the user's choice: sets tiebreak + appends to the comparison log.
  recordResult(pair: Pair, winnerId: string): void

  // Produce displayed 0–10 scores. For the MVP engine: just returns the user's scores.
  computeScores(list: RankedItem[]): Map<string, number>
}

// Ship this now:
class RatingTiebreakEngine implements RankingEngine { ... }

// Drop in later, same interface, replay the logged events:
class EloEngine implements RankingEngine { ... }
```

The UI calls `nextComparison` in a loop until it returns `null`, then re-renders. It never
knows which engine is behind it.

---

## 6. Data model

Per rated song:

- `score` — the user's 0–10 number (headline; does the coarse sort)
- `tiebreak` — small ordering value used only to sort within an identical score
  (e.g. an index or fractional offset)

The ranked list is sorted by `score` desc, then `tiebreak`. Comparisons only ever touch
`tiebreak`.

Suggested tables (backend-agnostic):

| Table | Purpose | Key fields |
|---|---|---|
| `users` | Accounts | `id`, `username`, `avatar`, `spotify_id` |
| `items` | Songs/albums/artists (cached from Spotify) | `id`, `type`, `title`, `artist`, `art_url`, `spotify_uri` |
| `ratings` | A user's rating of an item | `id`, `user_id`, `item_id`, `score`, `tiebreak`, `review_text`, `created_at` |
| `comparisons` | The banked comparison log | `id`, `user_id`, `winner_id`, `loser_id`, `created_at` |
| `follows` | Social graph | `follower_id`, `followee_id` |
| `concerts` | Attended shows / badges | `id`, `user_id`, `artist`, `date`, `venue` |
| `feed_events` | Activity feed items | `id`, `user_id`, `type`, `payload`, `created_at` |

---

## 7. Tech stack (recommended)

Fastest credible route for a small team shipping to both app stores:

- **Frontend:** React Native (Expo) — one codebase, iOS + Android.
- **Backend:** Supabase — auth, Postgres database, and real-time (for the feed) out of
  the box.
- **Music data:** Spotify Web API.
  - Free, great for reading data (top tracks, search, audio info) and managing playlists.
  - Playback requires Premium + their SDK.
  - Note: Spotify has been tightening API access for new third-party apps — verify
    current terms before relying on any specific endpoint.
  - **Start Spotify-only**; add Apple Music later (paid Apple Developer account + MusicKit).

---

## 8. Build order

1. **Spotify auth + data pull** — riskiest piece, build first.
2. **Rate-and-tiebreak engine** behind the `RankingEngine` interface, against mock data.
3. **Profile + feed** — mostly straightforward once 1–2 work.
4. Wire to Supabase (auth, persistence, real-time feed).
5. Fast-follow features per §2.

---

## 9. Open questions

- Exact Spotify scopes needed, and current API access terms for new apps.
- Rating granularity: whole numbers, half-steps (8.5), or free decimal entry?
- Do albums/artists use the same tie-break flow, or a simpler one?
- Feed: chronological vs ranked? (Start chronological.)
