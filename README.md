# Things Got Dicey

<div align="center">

[![Part of Outrider's Outpost](https://img.shields.io/badge/Part%20of-Outrider%27s%20Outpost-7000d6?style=for-the-badge)](https://0utrider.github.io/outpost/)
[![Available on Foundry Package Browser](https://img.shields.io/badge/Foundry-Package%20Page-7000d6?style=for-the-badge)](https://foundryvtt.com/packages/dicey)

</div>

An unofficial theme pack for [Dicer](https://github.com/roileaf/dicer): custom dice sets, textures, and roll effects.

Foundry VTT v14. Requires Dicer 1.4.2 or later.

## Install

Paste this manifest URL into **Add-on Modules → Install Module**:

```
https://github.com/0utrider/dicey/releases/latest/download/module.json
```

## Damage type sets

A set of 14 damage type dice themes plus Starry Night, built for readable numbers (every theme uses the blackletter font, including over animated interiors): acid, bleed, cold, electricity, fire, force, mental, physical, poison, precision, sonic, spirit, vitality, void.

They show up in Dicer's theme browser by name (`Fire`, `Cold` and so on) with a **Things Got Dicey** tag, and a landing effect and sound where the matching Dicer built-in has one.

Dicer's **Damage type map** only lists its own looks, so this module lays out the **World choice** and **My override** dropdowns as: Default, then **Things Got Dicey · Damage types**, then Dicer's own choices, then **Things Got Dicey** (every other Dicey set, holiday sets included). Nothing is changed until you pick one: everything stays on Dicer's defaults.

## Holiday dice

Dicey adds two tabs to Dicer's theme browser. **Dicey** has the regular Dicey sets, with any holiday sets in season at the top. **Holidays** has every holiday set, the ones in season first, then the rest in the order they come up.

In the **All** tab, holiday sets show only while their holiday is in season, and Dicey's in-season sets sit just after the sets you already use (your default and any assigned to a slot). Both can be turned off in the settings.

Holidays in season, or starting within 30 days, are loaded when Foundry starts. Holidays further off show as one simple card each (the Dicey logo, no 3D preview) and load when you click them. Holidays still in the works share a single **Coming soon** card.

Each holiday has a featured set and can have more. **Holiday dice** is on by default: your dice switch to a holiday set while one is in season, by default a random holiday in season and then one of its sets, each time you load the game (or the main set of the holiday that started most recently, if you prefer). Each player can turn it off, or leave out holidays they do not want, in the settings (a GM can also set it for everyone). The first time a player loads a world with Dicey on, a small popup shows how it is set for them and opens the settings. When the season ends, or you turn it off, your own dice come back.

Seasons (some overlap on purpose):

| Holiday | Window |
|---|---|
| New Year | Dec 20 to Jan 7 |
| Lunar New Year | two weeks before to one week after |
| Valentine's Day | Feb 1 to Feb 15 |
| Mardi Gras | two weeks up to Fat Tuesday |
| St. Patrick's Day | Mar 1 to Mar 18 |
| Easter | two weeks before Easter Sunday to Easter Monday |
| Earth Day | Apr 15 to Apr 23 |
| Summer Solstice | Jun 14 to Jun 28 |
| Independence Day | Jun 25 to Jul 6 |
| Halloween | Oct 1 to Nov 1 |
| Day of the Dead | Oct 28 to Nov 3 |
| Veterans Day | Nov 4 to Nov 18 |
| Thanksgiving | two weeks before, through the Sunday after |
| Christmas | the day after Thanksgiving to Dec 26 |
| Hanukkah | six days before the first candle through the eighth day (from the Hebrew calendar) |
| Winter Solstice | Dec 14 to Dec 28 |

Dates follow the computer's own calendar. To see the browser as it would look on another day, run `game.modules.get("dicey").api.holidays.preview("2026-12-20")` in the console. `preview()` goes back to today.

On a natural 20 the Christmas sets play a short carol on bells, picked at random from Jingle Bells, Hark! the Herald Angels Sing, Joy to the World, Deck the Halls, Carol of the Bells, We Wish You a Merry Christmas, O Come All Ye Faithful, Angels We Have Heard on High, sleigh bells and ice chimes (everyone at the table hears the same one). Sugar Plum plays the Dance of the Sugar Plum Fairy, Up on the Housetop its own carol, and Silent Night its own music box. Each player can turn them off with the **Jingles** switch on the **Effects** tab; everyone else still hears theirs.

Dicey also draws a few effects of its own, with no extra modules: a pine garland with holly and blinking Christmas lights around the screen on a natural 20 (every Christmas set but Silent Night, which gets snow); the same garland after Krampus got to it, torn and trodden, with dead bulbs and sparking wires, on a natural 1 (every Christmas set but Gingerbread, which crunches); and a menorah holding the candles for that night of Hanukkah (all eight outside Hanukkah), lit one by one on a natural 20 (the shamash first, then left to right), that go out in wisps of smoke on a natural 1 (Menorah). Tinsel and Lights also gets small LEDs blinking inside the dice (Dicer leaves them off on its lowest quality tier, and older Dicer shows the dice without them). Each has its own switch on the **Effects** tab of Dicey settings: **Screen effects**, **Effect sounds** (keeps the pictures, drops the sound), **Jingles** and **Blinking LEDs in dice** (off by default on Low dice quality; takes effect after a reload). A GM can set a default for these but cannot lock them. Thanksgiving and Hanukkah get their own too: leaves drifting down, gravy, cranberry and jelly splatting on the screen and dripping, foil-wrapped gold and silver gelt raining, a four-sided dreidel that spins on its point and falls to show gimel (spilling gelt) or nun, and snow. Many sets also have their own sounds (a wet splat for the gravy, a squelch for the gravy and cranberry, a soft thud for the doughnut and pie, a marimba "dreidel, dreidel, dreidel" on a natural 20, coins, chimes, a music box); those are rule sounds from Dicer and are not controlled by the **Effect sounds** switch. The sounds are synthesised for Dicey, so there is nothing to license.

## Settings

**Game Settings → Configure Settings → Things Got Dicey → Dicey settings** opens Dicey's own window. Each player sets their own. A GM can set any of them for everyone: **Player's choice**, **My value as default** (players get the GM's value until they change it) or **Locked to my value**.

## Macros

Dicey adds three macros, in a **Macros** compendium and copied into your world's Macros tab, in the **Outrider's Mods** folder (the shared folder for Outrider's Outpost modules). The first GM to load a new version copies them in, and every player can see them (Observer). Drag one to the hotbar.

- **Dicey Settings** opens the Dicey settings window.
- **Dice Themes** opens Dicer's Dice Themes window.
- **Dicey Effects Test** (GMs) opens a window for trying the holiday effects. A full roll rolls a d20 fixed to a natural 20, a natural 1 or anything between, with one of the holiday's sets, so the dice, their sounds, the screen effects and the jingles all play as in a game; your own dice set comes back after the roll. The rolls go to chat for you only unless you tick **Everyone sees the rolls**. The window sits under the dice, so the rolls land on top of it.

They are script macros, so Foundry's *Use Script Macros* permission decides who can run them (Trusted Player and above by default). The d20 icon is a [Font Awesome Free](https://fontawesome.com/license/free) icon by Fonticons, Inc. (CC BY 4.0), with the fill colour changed.

## Notes

- Dicer caches how each theme looks. After updating this module, reload Foundry (F5).
- Before disabling this module, set any damage types that use a Things Got Dicey theme back to Default in the damage map.

## Fonts

Dicey bundles these fonts for dice numbers, each with its license in `assets/fonts`:

- [Lexend](https://github.com/googlefonts/lexend) (SIL OFL 1.1)
- [Zilla Slab](https://github.com/mozilla/zilla-slab) (SIL OFL 1.1)
- [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand) (SIL OFL 1.1)
- [Mountains of Christmas](https://fonts.google.com/specimen/Mountains+of+Christmas) (Apache 2.0)
- [Press Start 2P](https://github.com/googlefonts/Press-Start-2P) (SIL OFL 1.1)
- [Cinzel](https://fonts.google.com/specimen/Cinzel), Bold (SIL OFL 1.1)
- [Pirata One](https://fonts.google.com/specimen/Pirata+One) (SIL OFL 1.1)
- [Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch), Bold (SIL OFL 1.1)
- [Grenze Gotisch](https://fonts.google.com/specimen/Grenze+Gotisch), SemiBold (SIL OFL 1.1)
- [Berkshire Swash](https://fonts.google.com/specimen/Berkshire+Swash) (SIL OFL 1.1)
- [Elsie Swash Caps](https://fonts.google.com/specimen/Elsie+Swash+Caps), Black (SIL OFL 1.1)
- [Creepster](https://fonts.google.com/specimen/Creepster) (SIL OFL 1.1)
- [Metal Mania](https://fonts.google.com/specimen/Metal+Mania) (SIL OFL 1.1)
- [Nosifer](https://fonts.google.com/specimen/Nosifer) (SIL OFL 1.1)
- [DynaPuff](https://fonts.google.com/specimen/DynaPuff), SemiBold (SIL OFL 1.1)
- [Alfa Slab One](https://fonts.google.com/specimen/Alfa+Slab+One) (SIL OFL 1.1)
- [Black Ops One](https://fonts.google.com/specimen/Black+Ops+One) (SIL OFL 1.1)

## Credits

The d20 icon of the Dice Themes macro: [Font Awesome Free](https://fontawesome.com) by Fonticons, Inc., [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the fill colour was changed. Fonts are credited above.

## License

GPL-3.0-or-later.
