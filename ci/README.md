# Firefox visual CI harness

Self-contained browser CI for `files_readmemd`. It runs unchanged from a local
checkout and from a standalone fork of this repository in GitHub Actions
(`.github/workflows/e2e.yml`). No MCP session, hosted visual-diff service or
AI is involved.

## Design

- **Real Firefox, pinned.** `@playwright/test` 1.65.1 drives Firefox inside
  `mcr.microsoft.com/playwright:v1.65.1-noble`. The same pinned browser and
  fonts run locally and in CI, so committed baselines are portable.
- **Setup outside the browser.** Fixtures are uploaded with WebDAV, the public
  link with the OCS API, app settings with `occ`, and the app is enabled by the
  image's `before-starting` hook. Firefox only logs in and observes.
- **Screenshots + structure.** Each visual check has a DOM assertion as well
  as an element-level `toHaveScreenshot()` baseline, so a pixel change and a
  structural change are separate signals.
- **Version- and state-scoped baselines.** `ci/baselines/<nextcloud-version>/<state>/`.
  A missing baseline fails CI; update them deliberately with `UPDATE_BASELINES=1`.

## Compatibility

The app declares support for Nextcloud 33–35 in `appinfo/info.xml`. The boot
hook, `lib/config.sh` and `tests/shell/run.sh` all read that declaration through
`lib/support-range.sh`; the shell tests fail if the docs disagree with it. The
full visual matrix covers all four states on NC 33, 34 and 35.

## Commands

Run from this directory (or use `scripts/ci.sh` from the workspace root):

```sh
./run.sh setup      # app npm ci + webpack build, ci npm ci
./run.sh full       # full visual matrix on NC 33/34/35 (all four states)
./run.sh compat     # render check on NC 33/34/35 where info.xml allows it
./run.sh negative   # unpatched app must be rejected by NC 35
./run.sh all        # setup + all three profiles
./run.sh down       # remove both project stacks, even in a fresh shell
./run.sh shell-test # config and lifecycle tests with a fake docker compose
```

`run.sh` is a thin dispatcher. `lib/config.sh` is the single profile-config
seam; `lib/lifecycle.sh` owns stack commands; `lib/setup.sh` installs
dependencies. Assets rebuild only when the hash of `src/**`, `package.json`,
`package-lock.json` or `webpack.js` changes (cached in `ci/.build-stamp`).
`UPDATE_BASELINES=1` is the only switch that updates PNGs. Cleanup removes the
stacks at exit unless `KEEP_STACK=1`; `all` still frees the full profile's port
before the compatibility run and leaves the final stacks to cleanup.

## States

| state | settings applied with `occ` | verified in Firefox |
| --- | --- | --- |
| `default` | engines off, `HEADER` / `README` | settings page, config initial state, markdown header/footer, subfolder, public share |
| `features` | footer `FEATURES` | headings, table, task lists, emoji, fenced code |
| `engines-on` | `show_asciidoc` + `show_html` on | AsciiDoc header, raw HTML footer |
| `filelist-extra` | extra `VISUALH` / `VISUALF` names | settings list reflects both zones |

The negative control checks out `BASE_SHA` (default: the unpatched upstream
v3.0.2 commit `c31d8a243678b4f04348c40fca1e5a8e587a05aa`) into a temporary git
worktree, mounts that unpatched source on NC 35, and asserts that
`occ app:enable files_readmemd` fails. It then confirms in Firefox that no
`.headermd` / `.footermd` zones appear. Set `BASE_SHA` explicitly if the fork
does not contain that commit.

## Updating baselines

After an intentional visual change:

```sh
UPDATE_BASELINES=1 ./run.sh full
git diff -- ci/baselines
```

Review the PNG diffs like code before committing them. The compatibility
profile shares the `default` baselines of each version.

## Troubleshooting

- `KEEP_STACK=1 ./run.sh negative` leaves the stack up; use `./run.sh down` to
  remove it and its volumes.
- Playwright HTML reports land in `ci/playwright-report`, traces in
  `ci/test-results` (both uploaded by the workflow).
- `NEXTCLOUD_HOST_PORT` (default 8290) and `CI_NEGATIVE_PORT` (default 8291)
  can be changed if those ports are in use.
