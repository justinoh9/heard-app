# Jelli — case study

A social music-rating app. Live at **[myjelli.site](https://myjelli.site)**; the
same codebase builds for iOS and Android.

Solo project. 133 commits, 236 source files, 40 routes, 32 hand-applied database
migrations, 430 unit tests.

---

## 1. The problem

People form strong opinions about music and have nowhere good to put them.

Rating anything on a 1–10 scale sounds easy and isn't. Ask someone to score an
album cold and they stall — is this an 8 or a 9? — and the numbers they do give
drift, so their own list stops meaning anything six months later. Letterboxd
solved this for film with stars plus social proof; music has no real equivalent.
Spotify tells you what you *played*, which is a record of habit, not taste.

So the app never asks for a number in isolation. You give a rough score, then the
app shows you something you already rated at a similar level and asks which you
prefer. A few comparisons place the new album precisely inside your existing
ranking. The score does the coarse sort; the head-to-heads break ties. You end up
with a ranked list that reflects how you actually feel, built from judgments that
are easy to make.

Everything else exists to make that list worth building: friends' activity,
comments and likes, concerts you've been to, a listen diary, shareable cards.

## 2. Who it's for

People who already argue about music — the ones with a "best albums of 2026" note
on their phone. Concretely, listeners in their late teens to late twenties who use
Spotify or Apple Music daily and follow music discourse.

Two design consequences follow from that:

- **Logging has to be a two-tap habit**, or nobody builds a list long enough to be
  interesting. The target is under two minutes from install to first rating.
- **A profile screenshot has to sell the app.** This audience shares. The ranked
  list, the Top 4 showcase, and the export cards are the growth mechanism, so
  every share card carries the wordmark and the URL.

## 3. Technologies

**Client** — Expo SDK 56, React Native 0.85, React 19, TypeScript (strict),
expo-router for file-based routing, React Compiler enabled. Reanimated for
animation, `react-native-svg` for the concert map and hand-drawn empty states,
expo-audio for 30-second previews, `react-native-view-shot` for card export.

**Backend** — Supabase: Postgres with row-level security, PostgREST as the API,
Supabase Auth (email/password + Google OAuth), and Storage for avatars. No custom
server. Business rules that must not be client-enforced live in SQL — RLS
policies, `SECURITY DEFINER` functions, and rate-limit triggers.

**Music data** — the iTunes Search API for catalog search (keyless, real artwork,
working previews, and it reflects CORS origins so the browser can call it
directly). Last.fm supplies a popularity signal iTunes lacks, Deezer supplies
artist photos it also lacks, Photon (OpenStreetMap) geocodes concert venues, and
an Apple RSS chart feeds new releases. Every one was chosen for the same reason:
keyless and CORS-open, so no secret ships in a public bundle and no proxy is
needed.

**Testing & deploy** — `node:test` via `tsx` for unit tests, a Docker harness that
replays all 32 migrations into a throwaway Postgres, and Vercel (static Expo web
export) for the web build.

## 4. How the pieces interact

```
Screens  ──►  Stores (React context)  ──►  Backend seam (interface)
                                              ├── Supabase impl  ──► PostgREST ──► Postgres + RLS
                                              └── AsyncStorage impl (offline / zero-config)
```

**The seam is the core architectural decision.** Screens never import Supabase.
They talk to a store (`useRatings()`, `useSocial()`), and the store talks to an
interface. Which implementation answers is decided by one line per feature, based
on whether the environment is configured. Clone the repo with no keys and the app
still runs on device-local storage.

Two rules keep that honest:

- **Pure logic is separated from I/O.** Ranking math, feed folding, streak
  transitions, and search parsing are pure functions in their own files, unit
  tested with no network and no React. The transport layer stays thin enough to
  eyeball. This is why 430 tests run in about three seconds.
- **Cross-cutting rules live in stores, not screens.** Blocked users are filtered
  in the store, so a new screen cannot forget to hide someone.

**Authentication** is the load-bearing connection. Supabase Auth issues a JWT;
the client attaches it to every PostgREST request; Postgres reads `auth.uid()`
from it inside RLS policies. So authorization isn't a client concern at all — the
client's user id and the database's notion of who you are are the same value, and
a policy like `auth.uid()::text = user_id` is what actually stops you writing as
someone else. Reads are deliberately public (guests can browse ratings, profiles
and comments); writes are owner-scoped. Blocks and reports are the only
private-read tables, because someone who can tell they've been blocked can
retaliate.

**Migrations are applied by hand** through the Supabase SQL editor. That was a
pragmatic choice for a solo project, and it is also the source of the hardest
problem below.

## 5. The hardest technical issue

**Anonymous users could write to the database as anybody, and every check I had
said the system was fine.**

I found it while verifying an unrelated migration. Using only the anon key — which
ships in the public web bundle by design, and is meant to be safe — I could insert
rows with an arbitrary `user_id` into eight tables: feed events, ratings, follows,
profiles, concerts, comparisons, items, and concert tags. Anyone could forge
activity and ratings attributed to any user.

Three things had to be true at once, and each was individually reasonable:

1. **A migration had half-applied.** The hardening migration's first two sections
   took effect on production; everything from the third section down did not — the
   signature of a SQL run that stopped partway. Because migrations were applied by
   hand, nothing recorded that.

2. **PostgreSQL ORs permissive policies together.** This is the part I had wrong.
   I assumed adding a stricter policy tightened the table. It doesn't — permissive
   policies are additive. The original `with check (true)` policies from the early
   migrations survived, so *no* later owner-scoped policy could take anything
   away. The new policies were real, correct, and completely inert.

3. **Both of my safety nets were green for the wrong reason.** The migration test
   suite proves the SQL is *correct* by replaying it into a fresh database — and it
   passed, because the SQL was correct. It cannot see what production actually has.
   The live-schema checker probed for columns, tables, functions and buckets — and
   it passed, because **a policy is not a thing you can probe for**. Correct and
   *in effect* are different claims, and I had no test for the second.

Investigating that surfaced a second, independent bug the first had masked: the
"someone you blocked can't follow you" check had never worked. It queried the
`blocks` table, which is private-read — and a policy expression runs as the
*calling* user. The blocked follower could never see the row meant to stop them,
so the condition was always true. Blocking looked implemented and enforced
nothing.

## 6. How I solved it

**Contained it first.** I audited what the hole could have been used for before
fixing anything — 15 feed events, 37 ratings, every author a recognizable user.
Four junk rows, all written by my own probes. No third-party exploitation. I only
knew that because the audit came before the repair.

**Fixed the policies, in two migrations rather than one.** The repair drops every
legacy permissive policy by name and re-asserts the intended one, so it converges
from any state and is safe to run twice. Splitting the block-enforcement fix into
its own migration mattered: while testing the first one I got a failure saying my
repair had broken blocking — and investigating showed it wasn't my repair at all,
it was the pre-existing bug. Two unrelated problems in one migration would have
been much harder to reason about, and the fix for the second (a `SECURITY DEFINER`
helper that can see past RLS, answering only about the caller) is a different idea
that deserved its own file and its own explanation.

**Then fixed the thing that let it hide**, which is the part I'd actually defend
in review. Two mechanisms:

- Every migration now **self-tests when you run it**, in a `do $$ … $$` block that
  raises if its own behavior is wrong. Critically, these run with `set local role
  authenticated`, because the table owner bypasses RLS — a policy test run as the
  owner passes vacuously and asserts nothing. That convention is what caught the
  blocking bug.
- The live-schema checker now probes **write posture**: it posts an empty object
  as an anonymous user and reads the SQLSTATE. `42501` means RLS refused; a
  not-null violation means the write reached the table and RLS is open. No row is
  written either way, so it's safe against production.

The honest coda: that write probe has a blind spot I documented rather than
papered over. `42501` is also what a table with *no* policy returns, since RLS
denies by default — so "hardened" and "accidentally bricked" look identical from
outside. That bit me within a day. The repair migration dropped the likes policies
and I didn't re-create two of them, so every unlike was silently refused; the
checker stayed green throughout. Proving the *owner* can still write needs a real
session, which is why the self-tests now assert both directions — that the owner
can, and that nobody else can.

**The general lesson**, which I've since applied across the app: *a passing check
is only as good as the question it asks.* The same shape kept recurring — a delete
that removed nothing still reported success, so a like counter drifted to **-13**;
a rating that failed to save looked saved until reload. In every case the code
asked "did this error?" when it should have asked "what did this actually
change?". That distinction is now written into the repo's engineering notes.

## 7. What I'd improve with more time

**Automated migrations.** The root cause of the hardest bug was a human running
SQL by hand. Real migration tooling with a recorded schema version would have made
a half-applied migration impossible. This is the single highest-value change.

**A write-through offline queue.** Failed writes currently revert and tell the
user. That's honest, but the right behavior is to persist the write and retry on
reconnect — a music app gets used on the subway.

**Cheaper reads at scale.** A few queries fetch rows and aggregate in JavaScript;
like counts read every like row for an item to display one number. Fine at current
size, wrong at 10,000 users. These want Postgres aggregates or trigger-maintained
counters. I'd rather ship a working read and know where it breaks than optimize
early, but the ceiling is known.

**Component and integration tests.** Coverage is strong on pure logic and database
behavior, and thin in the middle — the stores. Most of the bugs I've fixed
recently lived exactly there: races between an optimistic update and its response.
That's the gap I'd close first.

**Push notifications**, which are the only real re-engagement channel; in-app
notifications only reach people who already opened the app. Blocked on paid
developer accounts rather than on code.

---

## Things I'd want to be asked about

- Why the ranking engine is an interface with two implementations, and why every
  head-to-head is logged even though the shipped engine doesn't need the history.
- Why blocks and reports are the only private-read tables, and what that costs.
- Why account deletion is a `SECURITY DEFINER` function taking no arguments.
- Why the avatar has to be deleted by the client *before* the account is deleted.
- Why the "new releases" feed goes through a same-origin rewrite when search
  doesn't.
