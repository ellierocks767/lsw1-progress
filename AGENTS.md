# Project constraints

The decomp repository owns the public dataset schema and successful-build publication. Keep `lib/schema.ts` compatible with its `tools/export_progress.py`; reject unknown schema versions.

Do not ship retail binaries, instructions, disassembly, compiler tools or experiment logs. `data/seed.json` contains allowlisted statistics only. Never describe its unrecorded revision as a verified build.

Objdiff scores do not establish strict verification or promotion. Preserve that distinction in labels and tests. Missing sweep results are unavailable, not zero candidates.

Use the checks and Vercel setup in [README.md](README.md). Main changes go through a PR after the initial repository bootstrap.
