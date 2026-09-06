# Verification and secret scanning

## Local checks

Run `npm ci`, then `npm run check` for lint, Node regression tests, public path checks, and the production build. Existing browser/manual acceptance remains separate from these checks.

`npm run lint` examines tracked and nonignored new JavaScript/TypeScript source, including Electron and scripts, using the existing ESLint rules. Errors fail. Warnings are compared by file, rule and message to `scripts/lint-baseline.json`; fixing warnings requires reducing the matching entries. Increasing the baseline relative to the PR base (or local HEAD) fails too. The initial baseline contains 60 warnings. Fix them in small batches: effect dependencies and render/ref behavior need interaction tests; image optimization requires checking local/blob images and desktop behavior. Do not disable rules to reduce the count.

## Separate secret scan scopes

| Command | Scope |
| --- | --- |
| `npm run check:secrets` | Current contents of tracked files and nonignored new files; respects Git ignores only for untracked files |
| `npm run check:secrets:history` | Every commit reachable from all fetched Git refs, including merged history; rejects shallow checkouts |
| `npm run check:secrets:artifact -- DIRECTORY` | A retained snapshot of an existing unpacked build directory, including dependency code, lockfiles, configuration and generated assets |
| `npm run check:secrets:docker -- IMAGE` | The final image's `/app` filesystem and image configuration, copied from an unstarted inspection container |
| `npm run check:secrets:electron -- dist/win-unpacked` | Explicitly extracted `resources/app.asar` contents, then all other packaged resources; the already scanned ASAR is not scanned again as raw text |

Gitleaks 8.30.1 is downloaded from its [official release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1). Archive SHA-256 values are pinned in `scripts/security/gitleaks-version.json`; the cached executable is checked against that archive on every run. No global installation or Gitleaks Action license is needed. The scripts use Node 24, Git and `tar` (included on the Windows and Linux CI runners); Docker/ASAR checks also require their respective local tools/dependencies.

All default Gitleaks detection rules remain enabled. Artifact scans also download the matching official default configuration, verify its pinned SHA-256 on every use, and remove its global directory/config/lockfile exclusions, including `node_modules`. The default image, font and binary/document extension exclusions remain; artifact scanning is not a byte-for-byte inspection of those formats. Source/history scans retain their existing upstream default path policy. Inline `gitleaks:allow` comments and local `.gitleaksignore` files cannot bypass the scan.

Archive traversal and decoding are each limited to two levels. Gitleaks 8.30.1 uses an archive library whose [Brotli filename check](https://github.com/mholt/archives/blob/v0.1.2/brotli.go) also matches `.browser.js`. Artifact snapshots rename misleading `.br` substrings only in their retained copies, preserve actual `.br` files, and map findings back to original paths. An `artifact-files.json` manifest records every copied file and name change. Symlinks are scanned as link text without following external targets. The packaged application remains unchanged.

Findings contain only rule, file, line/column and commit metadata; secret text, matching lines, commit messages, identities and scanner logs are not printed or uploaded by the check commands. Scanner failures, error output even with exit code zero, and timeouts fail the check. Synthetic canary tests prove current files, old commits, nested archives, ASAR payloads, loose resources and dependency browser files are inspected; malformed ASAR/Brotli inputs cannot pass.

Next.js generates internal encryption/signing keys in build output, as described in its [self-hosting documentation](https://nextjs.org/docs/app/guides/self-hosting). Artifact reports retain these hits and classify only exact `previewModeSigningKey`, `previewModeEncryptionKey` and `encryptionKey` fields in the expected Next.js manifests, with their expected encodings and an empty Server Actions manifest. This does not exempt whole files, other fields, provider tokens, source or history. Enabling Server Actions or preview features requires reviewing the key distribution policy; these runtime keys are not evidence that a build contains no sensitive bytes.

`scripts/security/reviewed-dependency-findings.json` records reviewed public Firebase VAPID constants, incomplete Next.js documentation key placeholders, JavaScript assignments and source-map symbol names. Artifact reports retain them in both `findings` and `reviewedDependencyFindings`, with a reason. Classification requires the pinned scanner version, exact dependency path suffix, full file SHA-256, rule and start/end location. Changing even one byte in a reviewed file invalidates its classification; putting the same content at another path does not inherit it. New credentials in the same file remain blocking, as verified with synthetic tokens. These classifications never apply to source/history scans. Dependency upgrades may require reviewing new fingerprints.

Reports, source snapshots, extracted artifacts and inspection containers are retained locally under `.tmp/secret-scans` (containers are listed in each Docker scope report). These copies may include sensitive contents if a scan finds a real credential: keep them local and do not commit or upload them. The default CI prints only metadata report locations. There is no cleanup, credential rotation or history rewrite in these commands.

Passing is bounded by the scanner's rules and the selected scope. It does not prove absence of every secret. History scanning does not cover inaccessible/deleted remote refs, unreachable objects or Git LFS contents that were not fetched. Docker scanning does not cover the base OS filesystem or files deleted in older image layers. Electron scanning checks application resources, not signatures, executable machine code or the installer download after publication.

## CI and main branch rules

CI uses unique check names: `author-verify`, `author-secret-scan`, `author-docker-smoke`, and `author-required`. The final check runs even when a dependency fails or is skipped, and succeeds only when all three dependencies succeed. It covers the existing regression suite, Linux packaged runtime smoke tests and final Docker application scan. No path filters skip the required workflow. PR, push and merge-group events are supported. All Actions remain pinned to full commit SHAs and permissions are explicit.

Docker publishing scans source/history and the tested final image before registry login/push. Electron release checks source/history before building and scans actual packaged resources before the release upload. A local passing check is not proof that GitHub has run this workflow or that branch protection is active.

`.github/rulesets/main.json` is a **proposal**, not an automatically applied setting. It preserves deletion/force-push protection, requires PRs and resolved conversations, and requires `author-required` from the GitHub Actions app (15368), tested against the latest main. It adds no bypass and requires zero outside approvals so a solo maintainer can merge after checks pass.

Apply the proposal only after these workflow changes are published, `author-required` has actually succeeded for the intended commit, and the owner authorizes changing the remote rules. Before applying, read the current ruleset again and preserve any intervening changes. Then verify the remote rule and a test PR. The proposal alone does not protect main. For Author, the existing ruleset is `protect-main` (ID 18371920); the API update body is `.github/rulesets/main.json`.
