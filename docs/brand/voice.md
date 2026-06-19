# Podium — Voice Guide

One page. The rules that make every string sound like Podium. When in doubt,
read it aloud: if it sounds like a coach who respects your time, it's right.

## The voice in one line

**Punchy, momentum-driven, second-person, sports-aware — never cheesy, and
never at the expense of clarity.**

## The five rules

1. **Punchy.** Short sentences. Lead with the verb. Cut filler ("please",
   "simply", "just", "in order to"). One idea per line.
2. **Momentum.** Every message points forward to the next move. Name the action,
   not the obstacle. "Send a proposal and get the ball rolling" beats "You have
   no deals."
3. **Second person.** Talk to the athlete or brand directly — "you", "your",
   "let's". Never narrate about "the user".
4. **Sports-aware, lightly.** Borrow the energy of competition — "Game on", "make
   your move", "on the radar", "shortlist". One sporting beat per message, max.
   It's seasoning, not the meal.
5. **Clarity wins, always.** If a clever line could confuse someone about what to
   do next, the clever line loses. The reader must always know exactly what
   happened and what to do.

## Never

- **Never cheesy.** No exclamation-mark pileups, no "Woohoo!", no forced puns, no
  "Let's crush it, champ!" Energy comes from verbs and brevity, not hype words.
- **Never sacrifice clarity for personality.** A funny empty state that hides the
  CTA is a failed empty state.
- **Never blame the reader.** "Nothing here yet" — not "You haven't done anything."
- **Never colour-only or icon-only meaning.** Status copy always carries the
  meaning in words; visuals reinforce, they don't replace.

## By surface

- **Toasts** — confirm the win, then close. One short line. Past-tense result +
  a forward beat: _"Proposal sent. Game on."_
- **Empty states** — `title` reframes the gap as opportunity, `body` says why it's
  empty and what filling it gets you, `cta` is the single next move (or `null`
  when there's genuinely nothing to do, e.g. an inbox waiting on others).
- **CTAs** — verb-first, specific. _"Finish my profile"_, _"Send proposal · make
  your move"_. The `·` separates the plain action from the optional spark.
- **Prompts / nudges** — frame the ask around the payoff for the reader: _"Add a
  photo so brands can put a face to the talent."_

## Quick gut-checks

- Could a coach say this in 3 seconds between drills? Keep it.
- Does it tell the reader exactly what to do next? It must.
- Is there more than one joke or one sports metaphor? Cut to one.
- Does removing every adjective still leave the meaning intact? Then the
  adjectives are earning their place; otherwise drop them.

## Locked strings

The exact production strings live in `lib/copy/index.ts` (`copy.*`). Edit copy
there, not in components — this guide explains the _why_, that module is the
_what_.
