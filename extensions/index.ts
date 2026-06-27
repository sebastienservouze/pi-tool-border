/**
 * tool-border-global — Extension PI.dev
 *
 * Monkey-patch le rendu de TOUS les tools (built-in, extensions, futurs)
 * pour ajouter une bordure latérale │ sur le bord gauche, couleur accent.
 *
 * Stratégie :
 * - Niveau 1 (Box) : patch de Box.prototype.render pour border les Box
 *   marqués via WeakSet (marquage par interception de setBgFn)
 * - Niveau 2 (ToolExecutionComponent) : patch pour le mode renderShell: "self"
 *   (utilisé par le tool edit)
 *
 * Voir ~/brainstorming-sessions/pidev-tool-border-global.html
 */

import { Box } from "@earendil-works/pi-tui";
import {
  ToolExecutionComponent,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

// ── Variables globales ────────────────────────────────────

/** WeakSet des instances de Box utilisées comme contentBox d'un outil */
const toolBoxes = new WeakSet<Box>();

/** Thème courant (any — le type exact n'est pas exporté), initialisé dans session_start */
let _theme: any = null;

/** Indique si les patches ont été appliqués avec succès */
let patchesApplied = false;

// Sauvegardes des originaux pour restauration
const ORIG = {
  setBgFn: Box.prototype.setBgFn,
  boxRender: Box.prototype.render,
  teRender: ToolExecutionComponent.prototype.render,
};

// ── Helper ────────────────────────────────────────────────

/**
 * Retourne la bordure latérale avec ou sans couleur selon la
 * disponibilité du thème.
 *
 * ▏ (Left Eighth Block, U+258F) : trait fin aligné à gauche dans la
 * cellule — pas de débordement du background contrairement à │.
 */
function getBorder(): string {
  return _theme ? _theme.fg("accent", "▏") : "▏";
}

// ── Monkey-patches ────────────────────────────────────────

function applyPatches(): void {
  // ── Niveau 1 : Box ───────────────────────────────────────

  // Interception de setBgFn() pour marquer les Box « outils ».
  // Seul le contentBox des outils appelle setBgFn().
  Box.prototype.setBgFn = function (
    this: Box,
    bgFn?: (text: string) => string,
  ): void {
    toolBoxes.add(this);
    return ORIG.setBgFn.call(this, bgFn);
  };

  // Patch du render pour ajouter la bordure aux Box marqués.
  Box.prototype.render = function (
    this: Box,
    width: number,
  ): string[] {
    // Box non-outil (ex: UserMessageComponent) → render original
    if (!toolBoxes.has(this)) {
      return ORIG.boxRender.call(this, width);
    }

    // Réserve 1 caractère pour "▏"
    const innerWidth = Math.max(1, width - 1);
    const lines = ORIG.boxRender.call(this, innerWidth);

    if (lines.length === 0) return lines;

    // Bordure : foreground accent + background du tool (continuité visuelle)
    const borderChar = _theme ? _theme.fg("accent", "▏") : "▏";
    const bgFn = (this as any).bgFn;
    const styledBorder = bgFn ? bgFn(borderChar) : borderChar;

    return lines.map((line) => styledBorder + line);
  };

  // ── Niveau 2 : ToolExecutionComponent (mode "self") ──────

  // Patch du render pour border le mode renderShell: "self"
  // (utilisé par edit.ts). Les propriétés builtInToolDefinition
  // et toolDefinition sont privées en TS — on y accède via (this as any).
  ToolExecutionComponent.prototype.render = function (
    this: ToolExecutionComponent,
    width: number,
  ): string[] {
    const self = this as any;
    const hasDef =
      self.builtInToolDefinition !== undefined ||
      self.toolDefinition !== undefined;

    if (hasDef && !self.hideComponent) {
      const shell =
        self.toolDefinition?.renderShell ??
        self.builtInToolDefinition?.renderShell ??
        "default";

      if (shell === "self") {
        const innerWidth = Math.max(1, width - 1);
        const lines = ORIG.teRender.call(this, innerWidth);
        if (lines.length === 0) return lines;
        const border = getBorder();
        return lines.map((line) => border + line);
      }
    }

    return ORIG.teRender.call(this, width);
  };

  patchesApplied = true;
}

function restoreOriginals(): void {
  Box.prototype.setBgFn = ORIG.setBgFn;
  Box.prototype.render = ORIG.boxRender;
  ToolExecutionComponent.prototype.render = ORIG.teRender;
  patchesApplied = false;
}

// ── Point d'entrée de l'extension ─────────────────────────

export default function (pi: ExtensionAPI): void {
  // Application des patches au chargement du module
  try {
    applyPatches();
  } catch (err) {
    restoreOriginals();
    console.error("[tool-border-global] Erreur d'application des patches:", err);
    // Le notify sera fait dans session_start (pas de ctx ici)
  }

  // Récupération du thème et re-render au démarrage de la session
  pi.on("session_start", (_event, ctx) => {
    _theme = ctx.ui.theme;

    if (!patchesApplied) {
      ctx.ui.notify(
        "⚠️ [tool-border-global] L'application des patches a échoué. " +
          "Les originaux ont été restaurés. Consulte la console pour les détails.",
        "error",
      );
      return;
    }

    // Force un re-render complet pour que la bordure apparaisse
    // avec la couleur du thème (fallback "▏" brut avant session_start)
    ctx.ui.setWidget("__tb_render", []);
    ctx.ui.setWidget("__tb_render", undefined);
  });

  // Restauration des originaux avant shutdown (évite l'empilement des patches au reload)
  pi.on("session_shutdown", () => {
    if (patchesApplied) {
      restoreOriginals();
    }
  });
}
