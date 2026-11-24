# files_readmemd context

The app renders the content of a chosen Markdown, AsciiDoc or HTML file into a
fixed position in a Nextcloud file list. This file records only the domain
terms that the codebase and its reviews use; general programming terms belong
to the architecture glossary, not here.

## Language

**README content file**:
A file in the current directory whose content is rendered into a zone. It may
be visible (`README.md`) or hidden (`.README.md`).
_Avoid_: README, document, source file

**Zone**:
A position relative to the file list where content is rendered. The app has a
header zone before the list and a footer zone after it.
_Avoid_: area, slot, section

**Base name**:
The configured stem used to derive candidate file names for a zone. It excludes
the extension and the optional leading dot.
_Avoid_: filename, file name, path

**Render engine**:
The rule set that turns elected file content into markup: markdown (always
available), asciidoc and html (both opt-in).
_Avoid_: renderer, parser, format

**File election**:
The decision that chooses one candidate file for a zone from the names present
in the current directory. Hidden candidates and later base names currently win.
_Avoid_: file lookup, selection, discovery

**Mount**:
The page-specific wiring that places a zone into private Files or a public
share and keeps its path in sync with the file list.
_Avoid_: integration, embedding

**Support range**:
The minimum and maximum Nextcloud versions declared for the app. It governs
whether the boot hook enables the app and which CI versions expect a rendered
zone.
_Avoid_: version range, compatibility matrix
