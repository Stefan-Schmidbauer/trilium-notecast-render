/**
 * The smallest Trilium the widget needs in order to be require()d.
 *
 * `src/widget.js` is a Trilium frontend note: it resolves `api` at class-
 * definition time (`class … extends api.RightPanelWidget`) and exports an
 * instance, so a bare require() in node throws before a single method exists.
 * A few stubs are enough to get past that — after which every pure helper on
 * the instance is directly callable.
 *
 * Deliberately not a DOM: these tests cover the string-producing helpers, which
 * is where the escaping lives. Anything touching the widget's UI belongs in a
 * browser, and the repo rule already says widget behaviour is verified by
 * running it in Trilium.
 */
const calls = { showError: [], searchForNotes: [], getNote: [] };

globalThis.api = {
    // The real one builds the collapsible card and hands doRenderBody a $body.
    // Here it only has to exist as a base class: these tests never call
    // doRenderBody, so $body is never touched. Its own method names matter
    // though — the shadow test below asserts the widget defines none of them.
    RightPanelWidget: class {
        toggleInt() {}
    },
    NoteContextAwareWidget: class {
        toggleInt() {}
    },
    showError(message) { calls.showError.push(message); },
    async searchForNotes(query) { calls.searchForNotes.push(query); return []; },
    async getNote(id) { calls.getNote.push(id); return null; },
};

// jQuery is only touched inside doRenderBody / loadThemes, which these tests do
// not drive; a callable stub keeps an accidental reference from crashing.
globalThis.$ = () => ({
    find: () => ({ on() {}, prop() {}, empty() {}, append() {}, val: () => '' }),
});

// renderContent reads window.location.origin to make attachment URLs absolute —
// relative ones would resolve against the blob: URL the print document opens
// from. A distinctive origin makes it obvious in an assertion which one was used.
globalThis.window = { location: { origin: 'https://trilium.example' } };

/**
 * A froca-shaped note stub: what renderContent and the subtree walk touch.
 *
 * `children` are note stubs. Branch positions are given separately as
 * `positions` (noteId → notePosition) so a test can hand the walk children in
 * one order and tree positions in another — which is the case getSortedChildren
 * exists for, and the only way to catch it silently trusting froca's order.
 */
function fakeNote({ noteId = 'n1', type = 'code', mime = 'text/x-markdown',
                    content = '', attachments = [], children = [],
                    positions = null } = {}) {
    return {
        noteId,
        type,
        mime,
        async getContent() { return content; },
        async getAttachments() { return attachments; },
        hasChildren() { return children.length > 0; },
        async getChildNotes() { return children; },
        getChildBranches() {
            return children.map((c, i) => ({
                noteId: c.noteId,
                notePosition: positions ? positions[c.noteId] : i,
            }));
        },
    };
}

module.exports = { calls, fakeNote };
