# About

**Notecast Render** renders a Trilium note to a print-ready A4 document in a
selectable theme, via the browser's print dialog.

It is the render specialist of the **Notecast** family — three tools that read
and write the same Trilium notes, each doing exactly one job:

| Repo | Role |
|---|---|
| [trilium-notecast-mcp](https://github.com/Stefan-Schmidbauer/trilium-notecast-mcp) | **Authoring** — an AI assistant writes typed notes via the ETAPI |
| [trilium-presenter-plugin](https://github.com/Stefan-Schmidbauer/trilium-presenter-plugin) | **Presenting** — renders a subtree as an on-screen slide deck |
| [trilium-notecast-render](https://github.com/Stefan-Schmidbauer/trilium-notecast-render) | **Rendering** — renders a note to print/PDF in a chosen theme |

They never call each other. The only thing they share is a set of Trilium labels
under the `notecast` prefix — that is the entire contract, and keeping it thin is
the point.

`notecast` is a label namespace and a family name, not a naming rule for repos:
the presenter predates it and keeps its established name and its own
`#presenterTheme` namespace.

## No backend scripting

TriliumNext v0.104 disabled backend scripting (`api.runOnBackend`) by default.
This plugin is frontend-only by design: note access through froca, theme
discovery via `api.searchForNotes`, output through `window.print()`. Nothing here
needs the `[Security] backendScriptingEnabled` toggle.

## Author

**Stefan Schmidbauer** — [GitHub](https://github.com/Stefan-Schmidbauer)

Built with [Claude Code](https://claude.ai/claude-code) as co-author.

## License

MIT.
