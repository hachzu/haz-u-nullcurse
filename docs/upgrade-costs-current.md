# Changed and added upgrade base costs

Source: current `js/upgrades.js` catalog. Slash-separated numbers are prices for successive tiers. Group base costs apply to Duo, Party, and Party+ before player scaling.

Final price per tier = ceil(base × sqrt(player count) × discount). Solo uses 1 player; Duo uses 2; Party and Party+ use the actual player count. Discount is 0.85 with Nothing, otherwise 1. Party+ has no separate price discount. Flat-price stackable upgrades use base × tier before rounding. Paycheck starts with one free owned tier in Solo and Duo.

Arrogance or Conceit adds one tier to each stackable upgrade except Defuse Kit. Both active still add only one tier.

| Upgrade | Status | Casual Solo | Casual group | Standard Solo | Standard group | Extreme Solo | Extreme group |
|---|---|---:|---:|---:|---:|---:|---:|
| Better Jump Pads | Changed | 50 | 50 | 50 | 50 | 50 | 50 |
| Paycheck | Changed | 33/66/99/132/165 | 55/110/165/220/275 | 55/110/165/220/275 | 55/110/165/220/275 | 55/110/165/220/275 | 55/110/165/220/275 |
| Business License | Changed | 50/100/1000 | 75/100/1000 | 75/150/1250 | 75/160/1400 | 75/180/1500 | 75/200/2000 |
| Swiftness Ring | Changed | 60/60/60/800 | 70/70/70/1000 | 80/80/80/1000 | 80/80/80/1250 | 80/80/80/1250 | 80/80/80/1500 |
| Grapple Points | Changed | 100 | 100 | 100 | 100 | 100 | 100 |
| Star Marts | Added | 300 | 350 | 400 | 450 | 500 | 550 |
| Altar Boons | Added | 450/1000/2500 | 475/1000/2750 | 525/1001/2750 | 525/1250/3000 | 600/1250/3999 | 600/1500/4500 |
| Health Insurance | Added | Hidden | 3+ players only | Hidden | 3+ players only | Hidden | Hidden |
| Medal | Changed | 100 | 100 | 100 | 100 | 100 | 100 |
| Tria Orbs | Changed | 100 | 100 | 100 | 100 | 100 | 100 |
| Double Jump | Changed | 125 | 150 | 150 | 150 | 150 | 175 |
| Radar | Changed | 100 | 125 | 125 | 150 | 150 | 175 |
| Radar Module: Enemies | Changed | 125 | 150 | 150 | 200 | 200 | 250 |
| Radar Module: Altars | Changed | 200 | 250 | 250 | 300 | 300 | 350 |
| Spring Shoes | Added | 100 | 100 | 100 | 100 | 100 | 100 |
| Fanny Pack | Changed | 250 | 250 | 275 | 300 | 300 | 350 |
| Grace Wings | Changed | Hidden | Hidden | 200 | 300 | 200 | 325 |
| Pocket Bell | Changed | 250 | 275 | 300 | 300 | 325 | 350 |
| Ice Skates | Changed | 250 | 300 | 325 | 350 | 375 | 400 |
| Helmet | Changed | 275 | 300 | 325 | 350 | 375 | 400 |
| Larger Grapple Points | Changed | 250 | 300 | 300 | 400 | 325 | 500 |
| Advanced Gravity Coil | Changed | 500 | 500 | 600 | 650 | 650 | 725 |
| Birthday Pony | Added | 250 | 300 | 300 | 350 | 400 | 450 |
| More Altars | Changed | 400 | 450 | 450 | 500 | 550 | 600 |
| Subspacial Barrier | Changed | 400/1000/2000 | 600/1000/2000 | 500/1250/2750 | 750/1500/3000 | 500/1500/3250 | 1000/1500/3750 |
| Ninja Belt | Changed | 400 | 450 | 500 | 600 | 525 | 750 |
| Soul Tracers | Added | 400 | 800 | 600 | 1000 | Hidden | Hidden |
| Propeller Hat | Added | 550 | 650 | 650 | 750 | 750 | 850 |
| Radar Module: Instruments | Changed | 500 | 600 | 750 | 850 | 900 | 1000 |
| Shark Tail | Changed | 650 | 900 | 1000 | 1200 | 1350 | 1800 |
| Sport Shoes | Changed | 750 | 1000 | 1250 | 1350 | 1401 | 1600 |
| Gift Magnet | Changed | 500/800/1150/3000 | 750/1000/1250/3250 | 1250/1750/2250/5000 | 1500/2000/2500/6000 | 1500/2500/3500/7000 | 1800/2600/3400/7500 |
| Debuff Magnet | Added | 1500 | 1700 | 2500 | 2800 | 3000 | 3500 |
| Aggro Magnet | Added | 1500 | 1700 | 2500 | 2800 | 3000 | 3500 |
| Matrix Tetrahedron | Changed | 1250 | 1500 | 2000 | 2250 | 2750 | 2750 |
| Shadow Cloak | Added | 1500 | 2000 | 2000 | 2500 | 2500 | 3500 |
| Miniature Hourglass | Changed | Hidden | Hidden | 3000 | 3000 | 3000 | 4000 |
| Fleeting Fate | Added | 1500 | 1750 | 2250 | 2500 | 2750 | 3000 |
| Panic Necklace | Changed | 1500 | 1750 | 2250 | 2500 | 2750 | 3000 |
| Gift Idol | Changed | 2000/4000/6000/8000/10000/15000 | 2500/5000/8500/12000/14500/18000 | 3000/6000/9000/12000/15000/22500 | 3500/7000/10500/14000/17500/25000 | 4000/7000/10000/13000/16000/25000 | 5000/8000/12000/16000/22500/28500 |
| Shield | Changed | 1500 | 2000 | 2000 | 4000 | 3500 | 6000 |
| Drowned Ægis | Changed | 3250 | 4000 | 5499 | 6000 | 6000 | 7000 |
| Jet Boosters | Added | 4000 | 4500 | 6000 | 6750 | 7000 | 7000 |
| Magnified Levels | Added | 1500/4500/10000/15000 | 2000/5000/12500/17500 | 2000/5000/12500/17500 | 3000/9000/15000/20000 | 3000/9000/15000/20000 | 3000/9000/15000/25000 |
| Transient Pennon | Added | 25000 | 25000 | 30000 | 30000 | 35000 | 35000 |
| Quixotic Wing | Added | 25000 | 25000 | 30000 | 30000 | 35000 | 35000 |
| Defuse Kit | Changed | Hidden | Hidden | 30/60/90 | 30/60/90 | 30/60/90 | 30/60/90 |
| Adrenaline | Changed | 50 | Duo only | 50 | Duo only | 50 | Duo only |
| Final Stand | Changed | Hidden | 3+ players only | Hidden | 3+ players only | Hidden | 3+ players only |
| Radar Module: Tripmines | Changed | Hidden | Hidden | 300 | 350 | 400 | 450 |

## Arrogance / Conceit bonus tier

These are the extra tier’s base costs. Apply the same player scaling and Nothing discount.

| Upgrade | Casual Solo | Casual group | Standard Solo | Standard group | Extreme Solo | Extreme group |
|---|---:|---:|---:|---:|---:|---:|
| Paycheck | 198 | 330 | 330 | 330 | 330 | 330 |
| Business License | 1000 | 1000 | 1250 | 1400 | 1500 | 2000 |
| Swiftness Ring | 800 | 1000 | 1000 | 1250 | 1250 | 1500 |
| Altar Boons | 2500 | 2750 | 2750 | 3000 | 3999 | 4500 |
| Subspacial Barrier | 2000 | 2000 | 2750 | 3000 | 3250 | 3750 |
| Gift Magnet | 3000 | 3250 | 5000 | 6000 | 7000 | 7500 |
| Gift Idol | 15000 | 18000 | 22500 | 25000 | 25000 | 28500 |
| Magnified Levels | 15000 | 17500 | 17500 | 20000 | 20000 | 25000 |

Availability notes: Final Stand requires more than 2 players; Health Insurance requires more than 2 players and is hidden on Extreme. Adrenaline is available in Duo, but hidden in Party and Party+. These conditions apply to the base-cost table above; the bonus-tier table only contains upgrades eligible for Arrogance / Conceit.
