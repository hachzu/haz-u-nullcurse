# Delusions: saved preview versus working toolkit

Compared with the sibling folder `../patch-5-1-preview`, especially its `data/patch-5-1.json`, README, and asset provenance. This comparison describes the saved trailer notes, not independently verified release behavior. The user confirms the Altar of Duality is involved.

## Acquisition

The saved notes say the **Altar of Duality sets up a delusion choice at the next shop**. That means pending altar activation and an active delusion are potentially separate run states. The current toolkit has neither. Before implementing, confirm the altar's unlock conditions, cost, repeat-use rules, number of choices, whether choices can be skipped/rerolled, and whether multiple delusions coexist or replace one another. Also confirm whether selection applies to the whole team or an individual player.

## Recorded effects and required toolkit changes

| Delusion | Saved trailer description | Toolkit impact / details to confirm |
| --- | --- | --- |
| Arrogance | Most stackable upgrades gain one extra stack; an enemy becomes permanent at four temporary stacks. | Need an explicit eligible-upgrade list and extra-tier prices. Track temporary versus permanent enemies, threshold behavior, and whether delusion removal reverses either effect. Current enemy counts do not model that distinction. |
| Conceit | Most stackable upgrades gain one extra stack; selecting enemies and curses rerolls them. | Same cap and pricing questions. Confirm which selection is rerolled, whether it still applies, reroll timing, and exceptions. Current selection adds the chosen item directly. |
| Assurance | Grants shop rerolls and doubles future reroll gains; adds a “Random” every eighth level. | Need initial reroll amount, what “Random” means, and whether the interval is absolute levels or levels since activation. No dedicated shop-reroll balance exists in the current upgrade calculator. |
| Dependence | Protection altars cost less and give two shields; Shield upgrade disabled. | Need exact discount and rounding, discount order, whether two shields means added/set/capped, and handling of an already-owned Shield. Current protection calculation has no delusion modifier. |
| Corrosion | Fanny Pack tiles are worth four times as much and last longer; inverted collapse is faster and tile value decays. | Need lifetime, decay and collapse numbers if calculating them. Current toolkit tracks Fanny Pack ownership/cost, not tile-by-tile lifetime or income. |
| Hope | Gives one extra life and cannot be removed. | Confirm per-player versus team scope, one-time grant versus recurring allowance, consumption/reset behavior, and how it interacts with death tracking. Current death tracker counts deaths; it is not a remaining-lives system. |
| Gambling | More altars appear, all as chance altars; each triggers a random altar effect. | Need spawn multiplier, outcome pool/probabilities if displaying odds, and interactions with Duality, Wishes and other altar modifiers. Do not invent random outcomes. |
| Vandalism | Passage biome every level, Passage altars removed, Guardian always enraged. | Needs active-effect information and possibly altar/enemy availability changes. Confirm whether it requires or spawns Guardian versus only modifying an existing Guardian. |

## Other differences found in the preview

The sibling folder also records seven upgrades, eight regular curses, four greater-curse entries, Altar of Wishes and its Purgatory interaction, class changes, Voidbound ICBM, Fast Track, and Celestial Practice. They are descriptive preview cards rather than data wired into the calculators. Some entries overlap old names (such as Water Planet); one greater curse is explicitly unnamed. Review each item's identity and released rules before importing it.

**Beacon Imp is listed as a regular curse, not a delusion.** Keep it in the curse intake.

Images already exist under the sibling folder's `assets/patch-5-1/icons/`. Its provenance identifies them as AI-assisted trailer cutouts/recreations, not official game exports. They can be reviewed as candidate icons instead of creating another set immediately.

## First useful information to supply

1. Altar of Duality: how to activate it, when the choice arrives, personal versus team scope, number of choices, and whether delusions can coexist/replace each other.
2. Confirm or correct the eight saved descriptions against the released game.
3. For Dependence: observed altar prices with full level/mode/player/balance context and what happens to Shield ownership.
4. For Arrogance and Conceit: eligible upgrades, new caps, extra-tier prices and what happens to excess stacks after a delusion ends.

Keep unknowns explicit. This reference does not alter public maintenance mode or enable unverified mechanics in the toolkit.
