/**
 * pi-tool-border — pi extension
 *
 * Monkey-patches the rendering layer to add a left-edge side border ▏ (in the
 * theme's accent color) to tool output, without each tool opting in.
 *
 * Reach is bounded by the rendering path: a tool is bordered when its content
 * goes through a Box, which is detected by intercepting Box.setBgFn (only a
 * tool's content Box calls it) and recording the instance in a WeakSet;
 * Box.prototype.render then prepends the border for marked instances. The edit
 * tool, which renders its own framing, is covered the same way because its
 * content lives in such a Box. A tool that renders some other way is untouched.
 */

import { Box } from "@earendil-works/pi-tui";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ── Global state ──────────────────────────────────────────

/** WeakSet of Box instances used as a tool's contentBox. */
const toolBoxes = new WeakSet<Box>();

/** Current theme (any — the exact type is not exported), set in session_start. */
let _theme: any = null;

/** Whether the patches were applied successfully. */
let patchesApplied = false;

// Saved originals, kept for restoration.
const ORIG = {
  setBgFn: Box.prototype.setBgFn,
  boxRender: Box.prototype.render,
};

// ── Monkey-patches ────────────────────────────────────────

function applyPatches(): void {
  // Intercept setBgFn() to mark the "tool" Box instances.
  // Only a tool's contentBox calls setBgFn().
  Box.prototype.setBgFn = function (
    this: Box,
    bgFn?: (text: string) => string,
  ): void {
    toolBoxes.add(this);
    return ORIG.setBgFn.call(this, bgFn);
  };

  // Patch render to add the border to marked Box instances.
  Box.prototype.render = function (
    this: Box,
    width: number,
  ): string[] {
    // Non-tool Box (e.g. UserMessageComponent) → original render.
    if (!toolBoxes.has(this)) {
      return ORIG.boxRender.call(this, width);
    }

    // Reserve 1 column for "▏".
    const innerWidth = Math.max(1, width - 1);
    const lines = ORIG.boxRender.call(this, innerWidth);

    if (lines.length === 0) return lines;

    // Border: accent foreground + the tool's background (visual continuity).
    const borderChar = _theme ? _theme.fg("accent", "▏") : "▏";
    const bgFn = (this as any).bgFn;
    const styledBorder = bgFn ? bgFn(borderChar) : borderChar;

    return lines.map((line) => styledBorder + line);
  };

  patchesApplied = true;
}

function restoreOriginals(): void {
  Box.prototype.setBgFn = ORIG.setBgFn;
  Box.prototype.render = ORIG.boxRender;
  patchesApplied = false;
}

// ── Extension entry point ─────────────────────────────────

export default function (pi: ExtensionAPI): void {
  // Apply the patches at module load.
  try {
    applyPatches();
  } catch (err) {
    restoreOriginals();
    console.error("[pi-tool-border] Failed to apply patches:", err);
    // The notify happens in session_start (no ctx available here).
  }

  // Grab the theme and force a re-render on session start.
  pi.on("session_start", (_event, ctx) => {
    _theme = ctx.ui.theme;

    if (!patchesApplied) {
      ctx.ui.notify(
        "⚠️ [pi-tool-border] Failed to apply patches. " +
          "The originals were restored. Check the console for details.",
        "error",
      );
      return;
    }

    // Force a full re-render so the border shows up with the theme color
    // (plain "▏" fallback before session_start).
    ctx.ui.setWidget("__tb_render", []);
    ctx.ui.setWidget("__tb_render", undefined);
  });

  // Restore the originals before shutdown (avoids stacking patches on reload).
  pi.on("session_shutdown", () => {
    if (patchesApplied) {
      restoreOriginals();
    }
  });
}
