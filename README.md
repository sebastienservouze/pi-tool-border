# @nerisma/pi-tool-border

Ajoute une **bordure latérale `▏`** (couleur `accent` du thème actif) sur le bord
gauche du rendu de **tous les outils** de [pi](https://pi.dev) — built-in,
extensions, et outils futurs.

![preview](./docs/preview.png)

## Installation

```bash
pi install npm:@nerisma/pi-tool-border
```

Ou via `settings.json` :

```json
{
  "packages": ["npm:@nerisma/pi-tool-border"]
}
```

## Fonctionnement

L'extension applique deux monkey-patches au chargement :

- **Niveau Box** : intercepte `Box.prototype.setBgFn` pour marquer les `Box`
  utilisées comme `contentBox` d'un outil (`WeakSet`), puis patche
  `Box.prototype.render` pour préfixer chaque ligne de la bordure.
- **Niveau `ToolExecutionComponent`** : gère le mode `renderShell: "self"`
  (utilisé par l'outil `edit`).

Le caractère `▏` (Left Eighth Block, U+258F) reste aligné dans sa cellule sans
déborder sur le background, contrairement à `│`.

Les originaux sont restaurés au `session_shutdown` pour éviter l'empilement des
patches lors d'un rechargement.

## Compatibilité

- pi `>= 0.78`
- Compatible avec `@nerisma/pi-input-revamp` (qui agit sur l'éditeur, pas sur
  les outils).

## Licence

MIT © Sébastien SERVOUZE
