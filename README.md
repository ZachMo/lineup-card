# Lineup Card

A lineup builder for youth baseball coaches. Innings across the top, positions down
the side, a bench row, and a chart that prints.

Live: <https://lineup-card.pages.dev>

## What it does

Enter the team once. The list is the batting order, and a player moves by dragging
the dots beside their name. A player can be marked out for the day, or kept off the
mound, out from behind the plate, or off the bench.

Set any spot by hand and it turns yellow. **Build lineup** keeps those spots and
fills the rest, so a coach can set the first inning or two and let the tool do the
others. **Keep** holds a whole inning. Press Build again for a different lineup.

Build follows these rules, in order of weight:

1. Every player plays an infield position in the first four innings. The inning is a
   setting, and so is whether pitcher and catcher count as infield.
2. Nobody sits two innings in a row, and nobody sits twice before everyone sits once.
3. Infield innings spread evenly across the team.
4. No player repeats a position if it can be avoided.

It runs simulated annealing over the open spots, which takes about a tenth of a
second. **Check** lists anything that breaks a rule. It runs only when pressed, so
setting spots by hand stays quiet.

## How it is built

Three files, no build step, no framework.

| File | What it holds |
| --- | --- |
| `public/index.html` | The whole tool: chart, roster, the lineup builder, print layout |
| `public/auth.js` | Sign-in and cloud save. Does nothing until a project is configured |
| `public/supabase-config.js` | Your Supabase address and public key |

The tool works with no account and no network. Everything saves in the browser,
which is what a coach needs at a field with bad signal. Signing in adds a copy in
Supabase so the same team opens on another device. The browser copy stays the
working one, and the cloud copy follows it a second or two after each edit.

**Copy team link** puts a roster in the URL fragment. That still works, and it needs
no account. The fragment never reaches a server.

## Running it locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Sign-in works locally once
`http://localhost:8000/**` is in the Supabase redirect list.

## Setting up your own copy

See [SETUP.md](SETUP.md). The database tables and access rules are in
[schema.sql](schema.sql).

## Next

- Saved games, so a coach keeps a season of cards. The `lineups` table is ready.
- CSV roster import for coaches with several teams.
- A sponsor line on the printed card.
