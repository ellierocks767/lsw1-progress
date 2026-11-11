# LSW1 progress

A read-only dashboard for the GameCube decompilation of LEGO Star Wars: The Video Game (`GL5E4F`).

The home page shows code and function matching, subsystem coverage, build history and remaining work. Unit pages list objdiff function scores. The candidate page shows sweep results when a sweep was explicitly exported.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Run `npm run check` before pushing. It runs ESLint, TypeScript, dataset/statistics tests and the production build.

## Data

The decomp repository owns the exporter and the publication workflow. After its main build passes retail comparison and verifier tests, it publishes `progress.json` on its `progress-data` branch. The branch contains public statistics only. No retail binaries, instructions, compiler tools or experiment logs are deployed here.

The server fetches the dataset over HTTPS and validates schema version 1. It caches it for 60 seconds. Open pages poll `/api/progress` once a minute without reloading or resetting filters and scroll position. Updates require no Vercel redeployment.

The default feed is:

```text
https://raw.githubusercontent.com/ellierocks767/lsw1-decomp/progress-data/progress.json
```

Override it with `PROGRESS_DATA_URL`. There is no database or GitHub token. The server handles upstream errors by returning the bundled snapshot with a visible warning. A page that has already received published data retains that data if a later refresh fails.

`data/seed.json` is an explicitly dated local snapshot. Its revision is unknown; it is not presented as evidence of a successful CI build. Its optional sweep is older than the report and includes no ownership guarantees. Normal CI builds do not run a sweep, so their candidate page honestly shows that no sweep was published.

History has one point per source revision. Rerunning a revision replaces its point. Gains compare consecutive reports only when code and function totals agree. Changed split boundaries or classifications can otherwise make a percentage change misleading. Objdiff matches, strict verification and whole-unit promotion are different measures; the site does not infer promotion from function scores.

To refresh the bundled snapshot from a local decomp checkout:

```sh
python3 tools/export_progress.py --output ../lsw1-progress/data/seed.json
```

Add `--sweep work/sweep/results.json` to include local candidates. Supply `--revision` only if that report was built from the exact revision.

## Deploy on Vercel

1. Import this repository as a new Vercel project. Use the Next.js preset, the repository root, Node.js 22, `npm ci`, and `npm run build`.
2. Leave environment variables empty to use the default public feed. Set `PROGRESS_DATA_URL` if the data branch lives elsewhere.
3. Deploy. Vercel deploys frontend changes through its Git integration; new statistics are fetched at runtime.

Until the decomp publication PR is merged and a successful main build creates `progress-data`, the site displays the bundled snapshot warning. No Vercel deploy hook, token or cross-repository write access is needed in decomp CI.

Preview deployments use the same read-only dataset. Vercel project creation, domain configuration and account authorization are account setup steps, not part of the source tree.
