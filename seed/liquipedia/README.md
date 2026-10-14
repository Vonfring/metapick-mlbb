# Liquipedia catalog

The JSON files in this folder (`items.json`, `emblems.json`, `talents.json`, `spells.json`) are adapted from the [Liquipedia Mobile Legends wiki](https://liquipedia.net/mobilelegends) by Liquipedia contributors, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). They are distributed under the same license.

Changes from the original: the wiki pages were parsed into JSON (item infoboxes, ability cards, the battle spell navbox, and the emblem portal); markup was removed; removed items and battle spells no longer in the game were left out. `meta.json` records when the pages were downloaded and the newest revision used.

Regenerate with `pnpm seed:catalog` (see `scripts/seed/fetch-liquipedia.ts`). Corrections go in `seed/overrides/items.json`, not here: this folder is overwritten on every import.
