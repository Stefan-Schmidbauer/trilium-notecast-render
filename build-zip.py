#!/usr/bin/env python3
"""Build the Trilium import zip.

The note tree is declared once, in TREE, and everything follows from it: the
files that go into the archive and the `!!!meta.json` that gives Trilium each
note's title, type, mime and — the part that matters — its labels.

Both Notecast plugins build the same way; trilium-presenter-plugin has a sibling
of this file. Its earlier arrangement — a meta.json exported from a live Trilium
plus a shell script copying files next to it — meant two places to update per
note, and forgetting the second one shipped a note without its labels. It did:
that meta.json went stale for months. Hence one source.

Note ids are derived from the note path. That loses nothing — Trilium assigns
fresh ids on import anyway, so they only have to be consistent with each other.

Usage:  python3 build-zip.py [version]
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import sys
import zipfile

HERE = pathlib.Path(__file__).parent

MD = "text/x-markdown"
CSS = "text/css"
HTML = "text/html"
JS = "application/javascript;env=frontend"
EXT = {MD: ".mkd", CSS: ".css", HTML: ".html", JS: ".js"}


def theme(title: str, type_id: str, css: str) -> dict:
    """A theme note: shared print base + per-type stylesheet, concatenated.

    Trilium notes cannot @import one another, so each theme note must carry
    complete CSS. Joining here is what keeps every theme from being one more
    copy of the base.
    """
    return dict(title=title, mime=CSS, label={"notecastTheme": type_id}, text=(
        (HERE / "themes/_base-print.css").read_text()
        + "\n\n/* ── type-specific ─────────────────────────────────── */\n\n"
        + (HERE / f"themes/{css}").read_text()))


def type_def(title: str, type_id: str, md: str, **mechanics: str) -> dict:
    """A type definition: the authoring format plus its mechanics labels.

    The note is always markdown so the format reads well in Trilium. The
    mechanics describe what gets *created*, which is a different thing — the
    `letter` definition is markdown but produces HTML notes.
    """
    return dict(title=title, mime=MD, file=f"types/{md}",
                label={"notecastType": type_id, **mechanics})


TREE = dict(title="Notecast Render", mime=HTML, text=(
    "<p><strong>Notecast Render</strong> prints a Trilium note as an A4 document"
    " in a selectable theme.</p>\n<p>Open a note, pick a theme in the render"
    " widget, press Print. See <em>Documentation</em> for details.</p>\n"), kids=[

    dict(title="Widget", mime=JS, file="src/widget.js", label={"widget": ""}),

    dict(title="Documentation", mime=HTML, text=(
        "<p>How the renderer works — start with <em>Getting Started</em>, then"
        " <em>Note Types</em> for what can be printed.</p>\n"), kids=[
        dict(title="Getting Started", mime=MD, file="docs/getting-started.md"),
        dict(title="Note Types", mime=MD, file="docs/note-types.md"),
        dict(title="Themes", mime=MD, file="docs/themes.md"),
        dict(title="About", mime=MD, file="docs/about.md"),
    ]),

    dict(title="Note Types", mime=HTML, text=(
        "<p>The authoring formats this plugin gives a printed form. Each child"
        " carries a <code>#notecastType</code> label; the MCP server reads them"
        " to author notes of that type.</p>\n"), kids=[
        type_def("Note", "note", "note.md", notecastTargetType="text"),
        type_def("Knowledge Base Entry", "kbEntry", "kb-entry.md",
                 notecastTargetType="code", notecastMime=MD),
        type_def("Meeting Note", "meetingNote", "meeting-note.md",
                 notecastTargetType="code", notecastMime=MD),
        type_def("Checklist", "checklist", "checklist.md",
                 notecastTargetType="code", notecastMime=MD),
        type_def("IT Tip", "itTip", "it-tip.md",
                 notecastTargetType="code", notecastMime=MD),
        type_def("Letter", "letter", "letter.md", notecastTargetType="text"),
    ]),

    dict(title="Themes", mime=HTML, text=(
        "<p>Print themes, one note per stylesheet. Each carries"
        " <code>#notecastTheme=&lt;type&gt;</code>, which is how the widget"
        " offers it for a note of that type.</p>\n"), kids=[
        theme("A4 Note", "note", "note.css"),
        theme("A4 Knowledge Base", "kbEntry", "kb-entry.css"),
        theme("A4 Meeting Note", "meetingNote", "meeting-note.css"),
        theme("A4 Checklist", "checklist", "checklist.css"),
        theme("A4 IT Tip", "itTip", "it-tip.css"),
        theme("A4 Letter", "letter", "letter.css"),
        # `slide` belongs to trilium-presenter-plugin; we only add a way to
        # print one. See docs/note-types.md.
        theme("A4 Slide (landscape)", "slide", "slide.css"),
    ]),
])


def safe_name(title: str) -> str:
    """Turn a note title into a file name, the way Trilium's own export does.

    `&` spells out as "and", and characters a file system rejects are dropped.
    The second matters beyond cosmetics — `?` is illegal on Windows, so a zip
    carrying it cannot be unpacked there at all.
    """
    name = title.replace("&", "and")
    for ch in '<>:"/\\|?*':
        name = name.replace(ch, "")
    return " ".join(name.split())


def build(node: dict, zf: zipfile.ZipFile, path: list[str], ids: list[str],
          folder: str, position: int) -> dict:
    """Write one note into the archive; return its meta.json entry."""
    # The id is derived from the note's path, so rebuilding produces the same
    # archive. Trilium assigns fresh ids on import — these only have to be
    # consistent with each other.
    key = "/".join(path + [node["title"]])
    nid = hashlib.sha1(key.encode(), usedforsecurity=False).hexdigest()[:12]
    mime = node["mime"]

    # A note with children must bring content of its own. The archive holds no
    # directory entries, so a parent that contributes no member is one Trilium
    # never creates — it then fails on that note's first child with "Parent note
    # '...' was not found." and aborts the whole import. Both plugins shipped
    # exactly that way; here it was Documentation, Note Types and Themes.
    if "kids" in node and "file" not in node and "text" not in node:
        raise ValueError(f"container note {key!r} has children but no content")

    entry = {
        "isClone": False,
        "noteId": nid,
        "notePath": ids + [nid],
        "title": node["title"],
        "notePosition": position,
        "prefix": None,
        "isExpanded": True,
        "type": "text" if mime == HTML else "code",
        "mime": mime,
        "attributes": [
            {"type": "label", "name": name, "value": value,
             "isInheritable": False, "position": (i + 1) * 10}
            for i, (name, value) in enumerate(node.get("label", {}).items())
        ],
        "attachments": [],
    }

    content = (HERE / node["file"]).read_text() if "file" in node else node.get("text")
    if content is not None:
        filename = safe_name(node["title"]) + EXT[mime]
        entry["dataFileName"] = filename
        if mime == HTML:
            entry["format"] = "html"
        zf.writestr(f"{folder}/{filename}" if folder else filename, content)

    if "kids" in node:
        entry["dirFileName"] = safe_name(node["title"])
        sub = f"{folder}/{entry['dirFileName']}" if folder else entry["dirFileName"]
        entry["children"] = [
            build(kid, zf, path + [node["title"]], ids + [nid], sub, (i + 1) * 10)
            for i, kid in enumerate(node["kids"])
        ]

    return entry


def main() -> None:
    version = sys.argv[1] if len(sys.argv) > 1 else "dev"
    out = HERE / "trilium-notecast-render.zip"

    # Stamp the version onto the root note as #version. Without this the
    # argument only reached the line printed below, so two zips built from
    # different tags were byte-identical and an installed plugin gave no way to
    # tell which release it came from.
    tree = {**TREE, "label": {**TREE.get("label", {}), "version": version}}

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        root = build(tree, zf, [], [], "", 10)
        zf.writestr("!!!meta.json", json.dumps(
            {"formatVersion": 2, "appVersion": "0.102.1", "files": [root]},
            indent=4, ensure_ascii=False))

    def count(node: dict) -> int:
        return 1 + sum(count(c) for c in node.get("children", []))

    print(f"Built {out.name} ({version}) — {count(root)} notes")


if __name__ == "__main__":
    main()
