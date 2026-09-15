<div align="center">

[Русский](README.md) · **English**

<img src="docs/screenshots/logo.png" alt="C++ Docs logo: an open book and the VS Code mark" width="120">

# C++ Docs

### Your whole project reference inside VS Code — a floating reader window over the editor and a sidebar panel

Floating window (drag & resize) · read with C++ highlighting right in the window<br>
full-text search · table of contents and internal-link jumps · study progress · zero dependencies

[![CI](https://github.com/moonlivedt-oss/cpp-panel-Moon/actions/workflows/ci.yml/badge.svg)](https://github.com/moonlivedt-oss/cpp-panel-Moon/actions/workflows/ci.yml)
![version](https://img.shields.io/badge/version-3.0.0-cba6f7)
![vscode](https://img.shields.io/badge/VS%20Code-%5E1.75-007ACC?logo=visualstudiocode&logoColor=white)
![tests](https://img.shields.io/badge/tests-131%20ok-a6e3a1)
![deps](https://img.shields.io/badge/dependencies-0-brightgreen)
![license](https://img.shields.io/badge/license-MIT-green)

<img src="docs/screenshots/hero.png" alt="Floating C++ docs window over code: navigator on the left, highlighted text on the right" width="880">

<sub>One extension file · custom .vsix packer · install with one command</sub>

</div>

---

## Quick start

```bash
npm run install:vsix     # build the package and install it into VS Code
```

Then restart the editor — a book icon appears in the activity bar and a **"C++"** button in the
status bar.

Separately:

```bash
npm run package          # only build dist/cpp-docs-panel-<version>.vsix
npm test                 # smoke test (131 checks, no VS Code needed)
npm run check            # syntax + tests
npm run preview:window   # build build/preview-window.html — see the window in a browser
```

Uninstall: `Ctrl+Shift+X` → "Документация C++" → Uninstall.

> The extension ships as its own `.vsix`; it is not on the Marketplace yet. To update, run
> `npm run install:vsix` again.

## What it is

A project's C++ documentation grows fast: a 12-file reference, nine example programs, a cheat
sheet, recipes, an index. Keeping all that in the file tree is awkward — names like
`06-konteynery.md` say nothing, and you keep hunting for where things are.

**C++ Docs** shows the same content in plain language: each file's title and description, grouped
by meaning, with search across the full text — and opens a document in a **floating reader
window** over the editor, with syntax highlighting and internal-link jumps.

| | File tree | Plain Markdown preview | C++ Docs |
|---|---|---|---|
| Readable labels | no (`06-konteynery.md`) | no | **yes — title and description from the file itself** |
| Grouping by meaning | no | no | **yes — reference / examples / tools, own markers** |
| Full-text search | no | no | **yes — title, description and content, multi-word, ё/е** |
| Reading time and size | no | no | **yes — "~N min" and section count per document** |
| Study progress | no | no | **yes — "read N of M · %" + a "Continue" button** |
| File table of contents | no | partial | **yes — `##`/`###` sections, jump to the right line** |
| Internal-link jumps | no | no | **yes — across files, jumping to the anchor** |
| Reading over the editor | no | separate tab | **yes — a floating window, drag & resize** |
| Project tasks | no | no | **yes — "run tests" / "check docs" from `tasks.json`** |
| External dependencies | — | — | **none (0 npm packages)** |

---

## Features

| Feature | Details |
|---|---|
| **Document list** | groups "Pinned", "Recent", "Main", "Topic reference", "Example programs", "One tool — many tasks", each with its own color marker and count |
| **Live labels** | the title comes from the file's first `#`, the description from the first `>` quote line; new files show up on their own, no code edits needed |
| **Reading time** | each document shows an estimated "~N min" and a section count: size at a glance |
| **Search** | over title, description **and file text**; **multiple words** (`map vector` — both); case-insensitive **and ё/е**; matches are highlighted, exact ones on top, text hits show a context snippet; on empty results it shows what you searched for |
| **Progress and "Continue"** | a "read N of M · %" bar; the **"Continue"** button opens the next unread document in order; the "read" mark can be toggled by hand (circle / check on hover) |
| **Always fresh** | the panel watches `*.md` and refreshes itself; a green dot marks files changed within a day |
| **Keyboard** | `↑` `↓` `PageUp` `PageDown` select · `Enter` open · `Esc` clear · `/` or `Ctrl+K` focus search · `Ctrl+Alt+D` open the panel and focus search |
| **Collapsible groups** | click a header; state and search text survive tab switches |
| **Pinned** | a star on hover pins a document to the top group; kept across sessions |
| **Table of contents** | an item expands its sections (`##`/`###`); a click opens the file at the right line |
| **You are here** | the item for the file currently open in the editor is highlighted in the list |
| **Opening** | click — reading mode (Markdown preview); right click — as plain text |
| **Recent at hand** | recently opened on top; clear with the cross in the group header |
| **Task buttons** | "Run tests" and "Check docs" launch VS Code tasks from `tasks.json` |
| **Colors and accessibility** | colors from the active theme (`--vscode-*`); the active item is announced to screen readers (combobox + `aria-activedescendant`); animations are disabled under the system "reduce motion" |

---

## Floating window (headline of 3.0)

Besides the sidebar panel there is a **floating reader window** over the editor. You can **drag it
by the title bar** and **resize it by the edges**; position and size are remembered. On the left —
a navigator over all documents (groups, search, progress, bookmarks); on the right — the text
itself: clean typography, **C++/bash highlighting**, **"copy code"** buttons, tables, callouts, a
**file table of contents** and **internal-link jumps** across files with a jump to the right
section. The theme (light / dark) comes from VS Code.

**How to enable.** The window is drawn by `cpp-docs-runtime.js`, injected into the VS Code shell by
a loader — **Custom UI Style** (`subframe7536.custom-ui-style`, resilient, survives editor
updates) or **Custom CSS and JS** (`be5invis.vscode-custom-css`). Install the loader, then:

1. Command palette → **"Документация C++: подключить плавающее окно"** (or the window button in the
   panel header) → "Apply" / "Enable Custom CSS".
2. After the window reloads, click the floating **"C++"** pill at the bottom right of the editor.

To disable — the **"Документация C++: отключить плавающее окно"** command; to check state —
**"…проверить плавающее окно"**. The sidebar panel remains available as a fallback.

<div align="center">
<img src="docs/screenshots/window.png" alt="Floating window: navigator on the left, C++-highlighted text with a copy-code button on the right" width="720">
</div>

## Recommended companion: MoonLight custom-bg

Optional, but nicer with it. **MoonLight custom-bg** (id `moonlivedt.moonlight-custom-bg-setup`) is
a live background and themes for VS Code. When it is installed, the floating window picks up its
**live accent** (`--mlbg-accent`, usually derived from the wallpaper): the window matches the rest
of the UI and follows wallpaper / slideshow changes on its own.

This is purely a visual bonus, not a requirement. Without custom-bg everything works: the accent
comes from the active VS Code theme (`--vscode-focusBorder` etc.), and if that is missing — a
fallback blue. There is no need to install or update custom-bg together with the panel; they are
independent.

custom-bg currently ships as a local `.vsix` (not on the Marketplace) — installed the same way as
this panel.

---

## How to use

A document opens three ways — pick one to fit the moment:

- **Floating window** (headline) — the **"C++"** pill at the bottom right of the editor (needs the
  loader, see above). A reader over the code that takes no room in the layout.
- **Sidebar panel** — the book icon in the activity bar on the left. Narrow, always at hand.
- **Standalone panel** — full editor width: the **"C++"** status-bar button, the arrow in the
  sidebar view header, or the **"Документация C++: открыть меню отдельной панелью"** command
  (`Ctrl+Alt+M`). Handy when the sidebar is cramped.

All three show the same list and stay in sync: bookmarks, "recent" and the open-file highlight are
shared.

<div align="center">
<img src="docs/screenshots/panel-sidebar.png" alt="Sidebar panel: document groups, search, progress bar" width="320">
</div>

### Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl+Alt+D` | Open the panel and focus search |
| `Ctrl+Alt+M` | Open the menu as a standalone panel (full width) |
| `/` or `Ctrl+K` | Focus search (when the panel is focused) |
| `↑` `↓` `PageUp` `PageDown` | Select a document |
| `Enter` | Open the selected · `Esc` — clear search |

---

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `cppDocs.path` | *(empty)* | where to look for docs if the project is opened outside its own folder |
| `cppDocs.openInPreview` | `true` | open files in reading mode; `false` — as text |

The folder is searched in this order: `docs` inside the open project → the open project root →
the `cppDocs.path` value. If nothing is found, the panel shows a hint rather than blank space.

---

## FAQ / Troubleshooting

**The floating "C++" pill does not appear.**
The window is drawn by the custom-css loader. Make sure **Custom UI Style** or **Custom CSS and
JS** is installed, the **"…подключить плавающее окно"** command has run, and the window was
reloaded. The **"Документация C++: проверить плавающее окно"** command reports the state.

**The window disappeared after a VS Code update.**
That is a limitation of the custom-css mechanism, not the extension. With **Custom UI Style** the
patch survives updates; with **Custom CSS and JS** you re-enable it (**Enable Custom CSS and JS** +
restart). The sidebar panel always works, without a loader.

**The panel is empty / "documentation not found".**
Docs are looked up in the open project's `docs/`, then its root, then `cppDocs.path`. Open the docs
folder as a project or set the `cppDocs.path` setting.

**The "Run tests" / "Check docs" buttons do nothing.**
They launch VS Code tasks named "C++: прогнать тесты" and "Документация: проверить" from the
project's `tasks.json`. If those tasks are absent, VS Code will say so.

**Found a bug or have an idea.**
Open an [issue](https://github.com/moonlivedt-oss/cpp-panel-Moon/issues) (attach the version and OS)
or drop by [Discussions](https://github.com/moonlivedt-oss/cpp-panel-Moon/discussions).

---

## Project layout

<details>
<summary><b>Expand the file tree and module roles</b></summary>

```
cpp-docs-panel/
├── extension/                  extension sources
│   ├── extension.js            logic: find the folder, build the list, webview, wire the window
│   ├── cpp-docs-runtime.js     floating-window runtime (MD render, highlight, drag/resize)
│   ├── package.json            extension manifest
│   ├── README.md               short description (shown on the extension page)
│   └── icon.svg                activity-bar icon
├── scripts/
│   ├── package-extension.js    .vsix build (own ZIP writer over zlib)
│   ├── preview.js              sidebar preview → build/preview.html
│   └── preview-window.js       floating-window preview → build/preview-window.html
├── test/
│   └── smoke.js                131 checks without launching the editor
├── docs/                       hand-written C++ docs (what the panel shows)
├── build/                      generated previews (in .gitignore)
└── dist/                       built packages
```

</details>

### Why a custom packer

A `.vsix` is a plain ZIP with two service files at the root. The standard `@vscode/vsce` route
pulls in npm dependencies for a single operation, so the ZIP is written by hand over the built-in
`zlib`: the project has zero dependencies and builds right after cloning. Package integrity was
verified with a third-party archiver; installation uses VS Code's own command.

### Why search is two-tier

Matches are first sought in the title and description — those are exact hits. If empty, the file
text is scanned (first 6 KB, code blocks skipped: too much noise there). Such items show a snippet
around the matched word so you can see why it matched. A multi-word query is an "AND": an item
matches if each word is found somewhere, so `map vector` finds the containers file even when the
words are far apart.

---

## Build

No dependencies, no `npm install` needed — the scripts just call `node`.

```bash
npm run package          # build dist/cpp-docs-panel-<version>.vsix
npm run install:vsix     # build and install into VS Code
npm test                 # smoke test (131 checks, no VS Code needed)
npm run check            # node --check + smoke test in one command
npm run preview          # build/preview.html — sidebar in a browser
npm run preview:window   # build/preview-window.html — floating window in a browser
```

The extension cannot run outside the editor: the `vscode` module does not exist. The smoke test
supplies a stub, activates the extension and inspects the built HTML — whether search, groups and
buttons are there, whether labels come from real files, whether quotes and angle brackets in titles
are escaped, and what shows when there are no docs. Run it after every change in `extension/**`.

On every `push` / `pull request` to `main`, GitHub Actions runs the same `npm run check`.

---

## Privacy

The extension **does not go online** and collects no telemetry: it reads only local `*.md` files
from the docs folder and renders them in a webview / floating window. File paths are opened through
VS Code's own API; the window loads no external resources. Window position and size, "read" marks
and bookmarks live in this machine's `localStorage`.

The floating window runs inside the VS Code shell through the custom-css loader — the same
mechanism as theming extensions. That is what makes the window possible, but it also means the
patch may drop after an editor update (see FAQ). The Markdown itself is rendered without executing
embedded scripts.

---

## Limitations

- The panel assumes a `docs/` layout (`ref`, `examples`, `situacii` folders); other structures land
  in the "Main" group.
- The task buttons expect tasks "C++: прогнать тесты" and "Документация: проверить" in `tasks.json`.
- Installed via its own `.vsix`: not on the Marketplace yet; to update, re-run `npm run install:vsix`.

---

## History

All changes are in [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE). The docs in `docs/` are part of the project; use, change and share.

---

<div align="center">
  <sub><b>C++ Docs</b> — the whole project reference in one draggable window, zero dependencies.</sub>
  <br>
  <sub>Found a bug or have an idea? — <a href="https://github.com/moonlivedt-oss/cpp-panel-Moon/issues">Issues</a> · <a href="https://github.com/moonlivedt-oss/cpp-panel-Moon/discussions">Discussions</a></sub>
</div>
