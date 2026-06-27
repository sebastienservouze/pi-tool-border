# @nerisma/pi-tool-border

Adds a **left-edge side border `▏`** (in the active theme's `accent` color) to
tool output in [pi](https://pi.dev) — built-in tools and extensions alike,
without each tool opting in.

It works at the rendering layer, so it only borders tools whose content goes
through a `Box` (the standard rendering path). A tool that renders its output
some other way is left untouched.

## Installation

```bash
pi install npm:@nerisma/pi-tool-border
```

Or via `settings.json`:

```json
{
  "packages": ["npm:@nerisma/pi-tool-border"]
}
```

## How it works

pi renders tool output through TUI components; none of them expose a hook for a
side border, so the extension monkey-patches the `Box` component at module load
and restores it at `session_shutdown` (so reloading does not stack patches).

A tool's content is rendered inside a `Box` whose background is set through
`Box.prototype.setBgFn`. The extension wraps that method to record each such
`Box` in a `WeakSet`, which marks exactly the boxes that belong to a tool. It
then wraps `Box.prototype.render`: for a marked box it renders into `width - 1`
columns and prefixes every line with `▏`, reusing the box's own background
function so the border blends with the tool's background. Unmarked boxes (user
messages, etc.) fall through to the original render untouched.

The `edit` tool draws its own framing (`renderShell: "self"`) but its content
still lives in such a `Box`, so it is bordered by the same mechanism — a single
border, consistent with every other tool.

The border glyph is `▏` (Left Eighth Block, U+258F): a thin stroke aligned to
the left of its cell, so it does not bleed the cell background the way `│` does.
The color comes from `ctx.ui.theme.fg("accent", …)`, resolved on
`session_start`; before the theme is available the extension falls back to a
plain, uncolored `▏`.

## Compatibility

- pi `>= 0.78`

## License

MIT © Sébastien SERVOUZE
