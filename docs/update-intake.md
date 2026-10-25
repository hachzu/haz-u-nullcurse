# Game update intake

Send one item at a time, or a small related batch. Copy the relevant template below into chat. You do not need to write code or fill everything in before sending it.

Use **unknown** for unverified information, **none** for a confirmed lack of a requirement, and **unchanged** for a confirmed old rule. Missing information is not treated as zero or no restriction. Keep exact in-game spellings and say whether an item is new, renamed, changed, or removed. When something is renamed, include its old name so saved runs and dependencies can be migrated.

For every observation, include the patch, difficulty (Casual / Standard / Extreme), mode (Solo / Duo / Party / Party+), player count, and level. Describe ALL versus ANY prerequisites explicitly. Screenshots of prices, descriptions, and locked states are especially useful. An observed first appearance is not necessarily the earliest possible unlock level.

## Enemy

```text
TYPE: Enemy
Change: New / Changed / Renamed / Removed
Exact name:
Old name, if renamed:
Patch and evidence (screenshot / patch note / tested in game):
Description / behavior:
Icon or image file:

Earliest unlock level:
Required enemies and minimum counts:
Required curses, upgrades, delusions, or other conditions:
Requirement logic: ALL / ANY / explain combinations
Unavailable when / conflicts with:

Maximum selectable copies in the enemy POOL:
Maximum count in the enemy TRACKER:
Casual cap:
Standard cap:
Extreme cap:
Does Party+ multiply the cap? If so, by how much?
Any other mode/player-count differences:
Does it replace/consume another enemy or coexist with it?
What happens if a prerequisite is removed?

Related curses / greater curses / upgrades (names):
Example allowed state (level + difficulty + mode + prerequisites):
Example blocked state and reason:
Unknowns:
```

The current site separates pool selection counts from live tracker counts. For example, its data requires two Baby selections for Voidbound Baby. Some tracker caps scale with Extreme and Party+, while others have fixed caps; please specify rather than assuming all new enemies double.

## Upgrade

```text
TYPE: Upgrade
Change: New / Changed / Renamed / Removed
Exact name:
Old name, if renamed:
Patch and evidence:
Category: Economy / Movement / Environment / Survival / Class / New category
Description and effect at each tier:
Icon or image file:

Earliest shop/unlock level:
Maximum stacks/tiers:
Required upgrades and minimum stacks:
Required active enemies and minimum counts:
Required curses, delusions, or other conditions:
Requirement logic: ALL / ANY / explain combinations
Conflicts / unavailable modes or difficulties:
Automatically owned/free? Which modes and how many stacks?

Currency:
Prices listed are: EACH purchase / TOTAL cost to own that tier
Solo prices by tier:
Non-Solo base prices by tier (only if known):
Observed price examples (repeat as needed):
  Difficulty:
  Mode:
  Player count:
  Level:
  Already-owned stacks -> target stacks:
  Active discounts/curses/delusions:
  Price displayed in game:
Casual changes (price, level, requirements, availability):
Extreme changes:
Party / Party+ scaling changes:
Discounts and rounding rules, if known:
What happens if a prerequisite is removed?

Example allowed state:
Example blocked state and reason:
Unknowns:
```

Important: the existing calculator treats a tier table like `[100, 250, 450]` as total costs, so the added costs would be 100, 150, and 200. If the game charges 100, 250, and 450 for successive purchases, label those as EACH purchase instead. Do not reverse-engineer a base price from a multiplayer screenshot; give the observed price and context.

The current code also applies player scaling, Party+ pricing, difficulty overrides, free starting upgrades, and the Nothing discount. These are old implementation rules to verify against the update, not assumed facts about the new patch.

## Curse (including greater and Chaos curses)

```text
TYPE: Curse
Change: New / Changed / Renamed / Removed
Exact name:
Old name, if renamed:
Patch and evidence:
Pool: Global / Enemy / Greater Global / Greater Enemy / Chaos / New pool
Description and effect per stack:
Icon or image file:

Earliest unlock level:
Maximum stacks:
Associated enemy and required count:
Other required enemies and minimum counts:
Required curses (ALL):
Alternative curses (ANY one):
Required upgrades, delusions, or other conditions:
More complex requirement logic, if any:
Mutually exclusive curses (cannot coexist):
Unavailable modes:
Casual differences:
Standard differences:
Extreme differences:
Chaos differences:

Medal curse? Yes / No / Unknown
Base curse value (if known):
Medal payout observed (include full run context):
Purifiable? Yes / No / Unknown
Purification price observed (level, players, mode, difficulty):
Does value/reward scale with stacks? How?
Does selecting it grant/remove/replace another item?
What happens if a prerequisite is removed?

Example allowed state:
Example blocked state and reason:
Unknowns:
```

The base curse value, Medal payout, and purification price are different numbers. Label which one you measured. The old site supports enemy counts, ALL curse requirements, ANY curse requirements, mutual exclusions, and mode restrictions. Greater curses currently default to level 10 when no level is specified; explicitly report the new unlock level so an old default is not silently reused.

## Delusion

```text
TYPE: Delusion
Change: New / Changed / Renamed / Removed
Exact name:
Old name, if renamed:
Patch and evidence:
Is this a separate system, a curse, an enemy variant, or something else?
Where/how does the player obtain or select it?
Altar of Duality activation requirements / price / uses:
When does the choice appear (next shop or another time)?
Number of choices offered / can you skip or reroll?
Does another activation add a delusion, replace one, or do something else?
Description / exact in-game text:
Icon or image file:

Unlock level / trigger:
Required enemies and counts:
Required curses and stacks:
Required upgrades and tiers:
Required other delusions:
Requirement logic: ALL / ANY / explain combinations
Cost / currency, if any:
Maximum stacks / simultaneous delusions:
Duration / expiry / reset condition:
Can it be removed, purified, or replaced? How?
Conflicts with:
Difficulty / mode / player-count differences:

Effects on enemy counts or availability:
Effects on curse pools or values:
Effects on upgrade availability, tiers, or prices:
Effects on Medal, gifts, altars, deaths, or other calculations:
Order of operations when multiple effects apply:
What happens when it ends or its prerequisites are removed?
Where should it appear in the toolkit?

Example before -> after, with numbers and run context:
Unknowns:
```

The user confirms that delusions involve the Altar of Duality. The sibling `patch-5-1-preview/data/patch-5-1.json` documents a choice at the next shop and eight delusions from the trailer: Arrogance, Conceit, Assurance, Dependence, Corrosion, Hope, Gambling, and Vandalism. These are a starting reference, not verified released-game rules. See `docs/delusion-comparison.md` for the effects already recorded and missing details. You only need to correct or complete those details.

In the working toolkit, `Delusion` is still just one name in the Chaos curse list. There is no separate delusion state or calculator. The new altar-based system needs separate state and interactions; the existing Chaos curse should not be renamed or removed unless the released game confirms that change.

## Other rule or feature

Use this for altars, Medal rewards, gifts, shop schedules, deaths, lobby formatting, difficulty rules, or a new system.

```text
TYPE: Rule / Feature
Name and affected tool:
Patch and evidence:
Old behavior (if changing):
New behavior:
Inputs needed:
Output / result:
Formula or exact steps (if known):
Units / currency:
Minimums, maximums, caps, and rounding:
Difficulty / mode / player-count differences:
Enemy / curse / upgrade / delusion interactions:
When it applies and when it resets:
Example 1: complete inputs -> observed result
Example 2: different complete inputs -> observed result
Unknowns:
```

## Slow update workflow

1. Send one template with what you know. Mark uncertainty rather than guessing.
2. We check dependencies and identify any missing facts needed for correct calculations.
3. Implement the confirmed change and check its unlock, blocked, maximum-stack, and pricing cases.
4. Review it in your private local preview. Save changes and the preview refreshes automatically.
5. Keep the public maintenance screen until you explicitly want to reopen it. Local edits do not publish themselves; pushing to a deployment branch may publish through your hosting setup.

Start with shared rule changes (modes, difficulty, scaling, shop levels), then enemies, curses/delusions, and upgrades. A small dependency group can be sent together. Existing saved selections may need migration when names, caps, or dependencies change.
