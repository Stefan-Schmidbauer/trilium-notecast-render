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

Usage:  python3 build-zip.py [version]      build the archive
        python3 build-zip.py --sync-docs    regenerate the type tables in
                                            README.md and docs/note-types.md
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import sys
import zipfile
from typing import Any

HERE = pathlib.Path(__file__).parent

MD = "text/x-markdown"
CSS = "text/css"
HTML = "text/html"
JS = "application/javascript;env=frontend"
EXT = {MD: ".mkd", CSS: ".css", HTML: ".html", JS: ".js"}


# The labels a type definition may carry. Anything else in an `## Attributes`
# table is a typo — a label Trilium stores happily and no consumer ever reads.
# The list is the MCP's authoring contract, `docs/notecast-contract.md` there.
TYPE_LABELS = ("notecastType", "notecastTargetType", "notecastMime",
               "notecastApplyLabels", "notecastParent", "notecastPrefix")

# A value cell is the label's value in backticks, or an em dash for a label
# carried bare — Trilium stores those with an empty value.
ATTRIBUTE_ROW = re.compile(r"^\|\s*`#(\w+)`\s*\|\s*(?:`([^`]*)`|—)\s*\|\s*$")


def attributes(path: pathlib.Path) -> dict[str, str]:
    """The mechanics labels a type declares, read from its own `## Attributes`.

    These labels used to be arguments to `type_def` here, while the type file
    beside it described the same mechanics in prose — so the note someone
    actually copies a definition from was the one place that did not say which
    labels it needs. The table is now the single source, and it costs no
    duplication: the file *is* the note's content, so writing it there ships it
    to Trilium and stamps the labels in one move.

    The table is validated rather than trusted. A label that is misspelt, or a
    mime on a `text` type, is stored by Trilium without complaint and goes
    unnoticed until the MCP creates a note of the wrong kind.
    """
    text = path.read_text()
    section = re.search(r"^## Attributes$(.*?)(?=^## |\Z)", text, re.M | re.S)
    if section is None:
        raise ValueError(f"{path.name}: no '## Attributes' section")

    found: dict[str, str] = {}
    rows = [ln for ln in section.group(1).splitlines() if ln.startswith("|")]
    # The first two are the header and its delimiter — skipped by position, not
    # by their wording, which a translated type file would change.
    for line in rows[2:]:
        row = ATTRIBUTE_ROW.match(line)
        if row is None:
            raise ValueError(f"{path.name}: cannot read attribute row {line!r}")
        name, value = row.group(1), row.group(2) or ""
        if name not in TYPE_LABELS:
            raise ValueError(f"{path.name}: unknown label #{name}")
        if name in found:
            raise ValueError(f"{path.name}: #{name} declared twice")
        found[name] = value

    if "notecastType" not in found:
        raise ValueError(f"{path.name}: no #notecastType — nothing defines the id")
    target = found.setdefault("notecastTargetType", "text")
    if target not in ("text", "code"):
        raise ValueError(f"{path.name}: #notecastTargetType={target!r} is not text|code")
    if target == "text" and "notecastMime" in found:
        raise ValueError(f"{path.name}: #notecastMime on a text type is never read")
    if target == "code" and "notecastMime" not in found:
        raise ValueError(f"{path.name}: a code type needs #notecastMime")
    return found


def theme(title: str, type_id: str, *css: str) -> dict:
    """A theme note: shared print base + per-type stylesheet(s), concatenated.

    Trilium notes cannot @import one another, so each theme note must carry
    complete CSS. Joining here is what keeps every theme from being one more
    copy of the base.

    More than one stylesheet may follow the base, appended in the order given.
    That is how a US Letter variant is built: the same type file, then
    `_page-us-letter.css`, which overrides nothing but the sheet size. Order is
    the whole mechanism — CSS cascades, so a later file wins.
    """
    parts = [(HERE / "themes/_base-print.css").read_text()]
    for name in css:
        parts.append(f"\n\n/* ── {name.removesuffix('.css')} "
                     f"─────────────────────────────────── */\n\n")
        parts.append((HERE / f"themes/{name}").read_text())
    return dict(title=title, mime=CSS, label={"notecastTheme": type_id},
                text="".join(parts))


def type_def(title: str, md: str, summary: str) -> dict:
    """A type definition: the authoring format, and the labels it declares.

    The note is always markdown so the format reads well in Trilium. The labels
    describe what gets *created*, which is a different thing — the `letter`
    definition is markdown but produces HTML notes.

    `summary` is the one-line description of the document. It is not a label and
    never reaches Trilium; it fills the Document column of the type tables that
    `--sync-docs` writes into README.md and docs/note-types.md.
    """
    path = f"types/{md}"
    return dict(title=title, mime=MD, file=path, summary=summary,
                label=attributes(HERE / path))


# Annotated because a node's values are heterogeneous — str, dict and list —
# and an inferred union makes `{**TREE.get("label", {})}` in main() unusable.
TREE: dict[str, Any] = dict(title="Notecast Render", mime=HTML, text=(
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
        type_def("Note", "note.md", "A short captured thought"),
        type_def("Knowledge Base Entry", "kb-entry.md",
                 "A knowledge base article"),
        type_def("Meeting Note", "meeting-note.md", "Minutes of one meeting"),
        type_def("Checklist", "checklist.md", "Steps to tick off on paper"),
        type_def("IT Tip", "it-tip.md", "One problem, one fix, one page"),
        type_def("Letter", "letter.md", "A formal letter for a window envelope"),
        type_def("Handout", "handout.md",
                 "Course material to take home, over several sheets"),
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
        theme("A4 Handout", "handout", "handout.css"),
        # `slide` belongs to trilium-presenter-plugin; we only add a way to
        # print one. See docs/note-types.md.
        theme("A4 Slide (landscape)", "slide", "slide.css"),
        # US Letter variants of the two types whose layout is pure flow, so the
        # sheet can be swapped without re-measuring anything. "US" leads the
        # name because `letter` is also a type here, and "Letter Letter" is not
        # a theme name anyone should have to parse. See themes/_page-us-letter.css.
        theme("US Letter Note", "note", "note.css", "_page-us-letter.css"),
        theme("US Letter Knowledge Base", "kbEntry",
              "kb-entry.css", "_page-us-letter.css"),
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


# ── the type tables in README.md and docs/note-types.md ─────────────────────

# The heading whose table is generated, per file. Both files show the same
# table and both used to be typed by hand — two more places to keep in step
# with the type files, and the two no test could see.
DOC_TABLES = {
    "README.md": "## What it ships",
    "docs/note-types.md": "## What this plugin ships",
}


def walk(node: dict):
    """Every node of the TREE declaration, depth first."""
    yield node
    for kid in node.get("kids", []):
        yield from walk(kid)


def types_table() -> str:
    """The shipped-types table, rendered from the declaration itself.

    Created-as holds the label values, not prose. "markdown code note" is what
    the table said for years, leaving the reader to translate it back into
    `#notecastTargetType` and `#notecastMime` — at the moment they are trying to
    write exactly those labels onto a definition of their own.
    """
    themes: dict[str, list[str]] = {}
    for node in walk(TREE):
        bound = node.get("label", {}).get("notecastTheme")
        if bound:
            themes.setdefault(bound, []).append(node["title"])

    rows = ["| Type id | Document | Created as | Print theme |",
            "|---|---|---|---|"]
    for node in walk(TREE):
        label = node.get("label", {})
        if "notecastType" not in label:
            continue
        type_id = label["notecastType"]
        created = f"`{label['notecastTargetType']}`"
        if "notecastMime" in label:
            created += f" · `{label['notecastMime']}`"
        rows.append(f"| `{type_id}` | {node['summary']} | {created} | "
                    f"{', '.join(themes.get(type_id, [])) or '—'} |")
    return "\n".join(rows)


def sync_docs(write: bool = True) -> list[str]:
    """Rewrite the type table under each heading in DOC_TABLES.

    Returns the files that changed — or, with `write=False`, the ones that would
    change, which is what the test asserts is empty. A generated table nobody
    regenerates is worse than a handwritten one, so the check has to fail loudly
    rather than the build fixing the repo behind the committer's back.
    """
    table = types_table()
    stale = []
    for name, heading in DOC_TABLES.items():
        path = HERE / name
        text = path.read_text()
        section = re.search(rf"^{re.escape(heading)}$.*?(?=^## |\Z)", text, re.M | re.S)
        if section is None:
            raise ValueError(f"{name}: no {heading!r} section to hold the table")
        block = re.search(r"^\|.*(?:\n\|.*)*", section.group(0), re.M)
        if block is None:
            raise ValueError(f"{name}: {heading!r} holds no table to replace")
        updated = (text[:section.start()]
                   + section.group(0).replace(block.group(0), table, 1)
                   + text[section.end():])
        if updated != text:
            stale.append(name)
            if write:
                path.write_text(updated)
    return stale


def main() -> None:
    args = sys.argv[1:]
    if args and args[0] == "--sync-docs":
        changed = sync_docs()
        for name in changed:
            print(f"Rewrote the type table in {name}")
        if not changed:
            print("Type tables already current")
        return

    version = args[0] if args else "dev"
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
