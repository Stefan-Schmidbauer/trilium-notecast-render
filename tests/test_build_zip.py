"""The import zip must match the note tree it declares.

This exists because of a bug that actually shipped. While `meta.json` was
exported from a live Trilium and the files were copied next to it by a separate
script, the two drifted for months, and a release archive went out carrying a
note without its labels — leaving the MCP server unable to author that type on a
fresh install. `build-zip.py` collapsed that into one source; these tests keep it
honest, because nothing about a zip fails loudly on its own.

Two of them carry most of the weight:

* `test_every_declared_data_file_exists_in_the_archive` validates the archive
  against its own manifest — the check Trilium performs on import;
* `test_every_declared_label_survives_into_the_manifest` compares the TREE
  declaration against what was emitted, which is the drift that shipped.
"""
import io
import json
import zipfile

import pytest
from conftest import ZIP_NAME, build, bz, labels, walk, walk_paths, walk_tree, walk_tree_paths

# ── the archive matches its manifest ─────────────────────────────────────────


def test_meta_json_is_present_and_well_formed(archive):
    meta, names, _contents = archive
    assert "!!!meta.json" in names
    assert meta["formatVersion"] == 2
    assert len(meta["files"]) == 1


def test_every_declared_data_file_exists_in_the_archive(archive, root):
    """Trilium reads dataFileName from the manifest; a member that is not there
    is a note that imports empty."""
    _meta, names, _contents = archive
    basenames = {n.rsplit("/", 1)[-1] for n in names}
    missing = [
        (node["title"], node["dataFileName"])
        for node in walk(root)
        if "dataFileName" in node and node["dataFileName"] not in basenames
    ]
    assert missing == []


def test_no_archive_member_is_orphaned(archive, root):
    """The reverse direction: a file nobody declares is dead weight, and usually
    a sign that a note was removed from TREE but its source file was not."""
    _meta, names, _contents = archive
    declared = {node["dataFileName"] for node in walk(root) if "dataFileName" in node}
    orphans = [
        n for n in names
        if not n.endswith("/") and n != "!!!meta.json" and n.rsplit("/", 1)[-1] not in declared
    ]
    assert orphans == []


def test_every_note_with_children_ships_content(root):
    """A parent that contributes no archive member is a parent Trilium never
    creates.

    This one shipped: the archive holds no directory entries, so a note is only
    created from its `dataFileName`. **Documentation**, **Note Types** and
    **Themes** had children but no content of their own, and the import died on
    their first child with `Parent note '<id>' was not found.` — a fresh,
    Trilium-generated id every attempt, which is what made it look like a
    problem with the target note rather than with the zip.
    """
    contentless = [
        node["title"] for node in walk(root)
        if node.get("children") and "dataFileName" not in node
    ]
    assert contentless == []


def test_the_builder_refuses_a_container_without_content():
    """Guards the rule at its source, so a new TREE entry cannot reintroduce it."""
    broken = {"title": "Orphan Maker", "mime": bz.HTML,
              "kids": [{"title": "Kid", "mime": bz.HTML, "text": "<p>hi</p>"}]}
    with zipfile.ZipFile(io.BytesIO(), "w") as zf, pytest.raises(ValueError, match="Orphan Maker"):
        bz.build(broken, zf, [], [], "", 10)


def test_every_source_file_referenced_by_the_tree_exists():
    """Catches a renamed or deleted source file before a build drops its note."""
    from conftest import REPO
    missing = [
        node["file"] for node in walk_tree(bz.TREE)
        if "file" in node and not (REPO / node["file"]).exists()
    ]
    assert missing == []


def test_note_count_matches_the_declaration(root):
    assert len(list(walk(root))) == len(list(walk_tree(bz.TREE)))


# ── labels survive into the manifest — the bug this file exists for ──────────

def test_every_declared_label_survives_into_the_manifest(root):
    """Compare TREE against the emitted manifest, note by note.

    A label declared and not emitted is exactly what shipped before: the note
    arrives, looks right in the tree, and is invisible to the tool that resolves
    it by label.
    """
    emitted = {path: labels(node) for path, node in walk_paths(root)}
    for path, declared in walk_tree_paths(bz.TREE):
        where = " → ".join(path)
        assert path in emitted, f"note declared but not emitted: {where}"
        for name, value in declared.get("label", {}).items():
            assert name in emitted[path], f"{where}: label #{name} was lost"
            assert emitted[path][name] == value, f"{where}: #{name} value changed"


def test_the_widget_note_carries_the_widget_label(root):
    widget = next(n for n in walk(root) if n["title"] == "Widget")
    assert "widget" in labels(widget)
    assert widget["mime"] == "application/javascript;env=frontend"
    assert widget["type"] == "code"


@pytest.mark.parametrize("type_id,target,mime", [
    ("note", "text", None),
    ("kbEntry", "code", "text/x-markdown"),
    ("meetingNote", "code", "text/x-markdown"),
    ("checklist", "code", "text/x-markdown"),
    ("itTip", "code", "text/x-markdown"),
    ("letter", "text", None),
    ("handout", "code", "text/x-markdown"),
])
def test_each_shipped_type_carries_its_mechanics(root, type_id, target, mime):
    """A type note without its mechanics is the precise shape of the shipped bug:
    the MCP resolves the type, then creates a note of the wrong kind."""
    note = next(n for n in walk(root) if labels(n).get("notecastType") == type_id)
    assert labels(note)["notecastTargetType"] == target
    if mime:
        assert labels(note)["notecastMime"] == mime


def test_every_theme_note_is_bound_to_a_type(root):
    themes = [n for n in walk(root) if "notecastTheme" in labels(n)]
    assert themes, "the plugin ships themes; finding none means the label was lost"
    for theme in themes:
        assert labels(theme)["notecastTheme"], theme["title"]
        assert theme["mime"] == "text/css"


def test_every_shipped_type_has_a_print_theme(root):
    types = {labels(n)["notecastType"] for n in walk(root) if "notecastType" in labels(n)}
    themed = {labels(n)["notecastTheme"] for n in walk(root) if "notecastTheme" in labels(n)}
    assert types <= themed, f"types shipped without a print theme: {types - themed}"


def test_themes_carry_the_print_base_inline(archive):
    """Trilium notes cannot @import one another, so every theme note has to carry
    the shared base itself — that concatenation is the only thing keeping every
    theme from being one more copy of the base."""
    from conftest import REPO
    _meta, names, contents = archive
    marker = (REPO / "themes/_base-print.css").read_text().strip().splitlines()[0]
    css_members = [n for n in names if n.endswith(".css")]
    assert css_members
    for member in css_members:
        assert marker in contents[member].decode(), member


def test_the_print_base_is_not_shipped_as_a_theme_of_its_own(root):
    assert not any("_base-print" in n["title"] for n in walk(root))


def test_the_page_size_fragment_is_not_shipped_as_a_theme_of_its_own(root):
    """`_page-us-letter.css` is an override appended to a type file, not a
    stylesheet anyone would print with — on its own it is a bare @page rule."""
    assert not any("_page-us-letter" in n["title"] for n in walk(root))


def test_us_letter_themes_end_on_the_letter_page_size(root, archive):
    """The variant is built by appending a `size` override to an A4 type file,
    so it only works while the override comes *last*. Reorder the fragments —
    or move a type file's own @page below them — and the theme silently prints
    A4 again, which no test of labels or titles would notice."""
    import re
    _meta, _names, contents = archive
    variants = [n for n in walk(root) if n["title"].startswith("US Letter")]
    assert variants, "the US Letter themes are shipped; finding none means they were dropped"
    for note in variants:
        member = next(k for k in contents if k.endswith(note["dataFileName"]))
        sizes = re.findall(r"size:\s*([^;]+);", contents[member].decode())
        assert sizes, note["title"]
        assert sizes[-1].strip().lower() == "letter portrait", (note["title"], sizes)


# ── version stamping ─────────────────────────────────────────────────────────

def test_root_note_carries_the_build_version(root):
    from conftest import TEST_VERSION
    assert labels(root)["version"] == TEST_VERSION


def test_version_defaults_to_dev():
    with zipfile.ZipFile(build("dev")) as zf:
        meta = json.loads(zf.read("!!!meta.json"))
    assert labels(meta["files"][0])["version"] == "dev"


# ── file naming ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("title,expected", [
    ("Simple", "Simple"),
    ("A & B", "A and B"),
    # `?` is illegal on Windows, so a zip carrying it cannot be unpacked there.
    ("What?", "What"),
    ("a/b", "ab"),
    ('q"uote', "quote"),
    ("a<b>c:d|e*f", "abcdef"),
    ("  spaced   out  ", "spaced out"),
])
def test_safe_name(title, expected):
    assert bz.safe_name(title) == expected


def test_no_two_siblings_collide_into_one_file_name():
    """Two titles differing only in stripped characters would overwrite each
    other inside the archive, silently losing a note."""
    def check(node, path="root"):
        kids = node.get("kids", [])
        names = [bz.safe_name(k["title"]) for k in kids]
        assert len(names) == len(set(names)), f"collision under {path}: {names}"
        for kid in kids:
            check(kid, f"{path}/{kid['title']}")

    check(bz.TREE)


def test_archive_holds_no_windows_hostile_paths(archive):
    _meta, names, _contents = archive
    for name in names:
        assert not set(name) & set('<>:"\\|?*'), name


# ── determinism ──────────────────────────────────────────────────────────────

def test_note_ids_are_stable_and_unique(root):
    """Ids are derived from the note path, so a rebuild must not churn them."""
    with zipfile.ZipFile(build("v1")) as zf:
        ids_a = [n["noteId"] for n in walk(json.loads(zf.read("!!!meta.json"))["files"][0])]
    with zipfile.ZipFile(build("v2")) as zf:
        ids_b = [n["noteId"] for n in walk(json.loads(zf.read("!!!meta.json"))["files"][0])]

    assert ids_a == ids_b
    assert len(ids_a) == len(set(ids_a)), "note ids must be unique within the tree"


def test_build_is_reproducible_apart_from_the_version(tmp_path):
    """Same inputs, same manifest — otherwise a release diff is unreadable."""
    def manifest():
        with zipfile.ZipFile(build("same")) as zf:
            return zf.read("!!!meta.json")

    assert manifest() == manifest()
    assert ZIP_NAME.endswith(".zip")
