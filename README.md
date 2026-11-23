# Things Got Dicey

An unofficial theme pack for [Dicer](https://github.com/roileaf/dicer): custom dice sets, textures, and roll effects.

Foundry VTT v14. Requires Dicer 1.4.2 or later.

## Install

Paste this manifest URL into **Add-on Modules → Install Module**:

```
https://github.com/0utrider/dicey/releases/latest/download/module.json
```

## What's in 0.0.1

A set of 14 damage type dice themes plus Starry Night, built for readable numbers (every theme uses the blackletter font, including over animated interiors): acid, bleed, cold, electricity, fire, force, mental, physical, poison, precision, sonic, spirit, vitality, void.

They show up in Dicer's theme browser as `Dicey: Fire`, `Dicey: Cold` and so on, with a landing effect and sound where the matching Dicer built-in has one.

Dicer's **Damage type map** only lists its own looks, so this module also adds a **Things Got Dicey** group to the **World choice** and **My override** dropdowns. Nothing is changed until you pick one: everything stays on Dicer's defaults.

## Notes

- Dicer caches how each theme looks. After updating this module, reload Foundry (F5).
- Before disabling this module, set any damage types that use a `Dicey:` theme back to Default in the damage map.

## License

GPL-3.0-or-later.
