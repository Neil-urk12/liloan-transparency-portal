# The API this portal reads

Everything comes from the public, read-only, CORS-open BetterGov.ph Budget API
(`https://budget.bettergov.ph/api/v1`), FY 2027 House bill section. Reference:
<https://budget.bettergov.ph/docs>; OpenAPI: `/api/v1/openapi.json`.

| Request | Used for |
| --- | --- |
| `GET /api/v1/hgab/2027` | Program names, status wording (label, sub, help), plain terms, the version names, the document list |
| `GET /api/v1/hgab/2027/datasets/dpwh/projects?office=…` | Every DPWH line under one office, plus the office's tier and the districts it serves (`office_lens`) |
| `GET /api/v1/hgab/2027/datasets/{program}/projects?q=…` | Every line in a program whose title names a place |
| `GET /api/v1/hgab/2027/datasets/{program}/projects/{id}` | One project: every version's amount and PDF page, match and reading labels, notes |
| `GET /api/v1/hgab/2027/districts/{id}` | A district card: representative, offices, tiers, 2027 figures |
| `GET /api/v1/hgab/2027/districts` | `npm run setup` only: every district and office, to find names and ids |
| `GET /api/v1/gaa/departments` | The 38 GAA departments, to search each one |
| `GET /api/v1/gaa/departments/{id}/programs?q=…` | Every program family in one department whose name has `q`, with its amount in each year 2020–2026; paged by `cursor`, 500 at a time |
| `…/programs?q=…&year=…&limit=1` | `npm run check` only: `meta.matched_amount`, the API's own total for the search in that year, to reconcile against |

The 2027 project lists are paged at 200 rows; the client fetches every page (`allProjects` in
`src/api/client.ts`), four at a time. A query that matches more than 4,000 rows fails
with an explicit limit error in the portal and in `npm run check`. Partial totals
and CSV downloads are withheld until the configured scope is narrowed.

Every response carries `meta` (with `notice`, the source commit and build date) and
`disclaimers`. The portal prints both as they come.

## Details worth knowing

- The `office` filter matches the office **as the documents publish it**
  ("Bohol 1st District Engineering Office"), not the short card name ("Bohol 1st DEO").
  `npm run setup -- --list-offices` prints the published names; they come from each
  office's FY 2027 `matched_label` on its district page.
- The irrigation list gives no region, so the API's `region` filter would drop every
  irrigation line. The portal applies a place's region itself and keeps lines with no
  region.
- `house_php` is the House bill amount the comparison uses: third reading for DPWH,
  second reading for the other three programs (their lists are the same at both
  readings).
- `delta_php` is null when one version has no such line.

## The enacted budgets (GAA, 2020–2026)

- The GAA has no place or office filter. Places are found by name: every department's
  `programs` list is searched with the place's `q` (`loadGaa` in `src/lib/gaa.ts`), every
  page, and the results merged by `fam_key` (one name in one agency across the years).
- **Use `programs`, not `/gaa/search`.** The search spans departments but returns at most
  100 results with no paging; for a province, DPWH alone fills it and other departments
  disappear.
- **A year counts only where `amount > 0`.** The per-year `count` carries a project's
  lines into later years at ₱0 (a 2020 access road in Ubay still counts two lines in
  2026), so a count alone does not mean that year's GAA funds it.
- `meta.matched` is the same for every `year`; `meta.matched_amount` is that year's
  total. `npm run check` compares it with the sum of the rows, for every department and
  year.
- DPWH money **by office** per year is not in these routes (a DEO's lines are spread
  across thousands of projects). It comes from each office's `years` on its district
  page: GAA 2020–2026 for the whole office, the 2027 NEP for the whole office, and the
  2027 House bill for named projects only.

## Gaps

What a portal would use if the API had it, in order of value:

1. **Where a project is, by city or municipality.** The source workbench's location lens
   places each DPWH line by the place its title names (PSGC), falling back to the office.
   It is imported on the `hgab-project-locations` branch of budget.bettergov.ph, by
   legislative district, but it is not in the API and it does not expose the
   city/municipality code per line. With
   `GET /api/v1/hgab/2027/places/{psgc}/projects` (or `?psgc=` on the projects list), a
   municipality scope would stop depending on title text.
2. **GAA lines by operating unit.** A filter such as
   `/gaa/departments/18/objects?operating_unit=…` would list a DPWH office's own 2020–2026
   lines, instead of only those whose name names the place.
3. **A list of offices.** There is no `/offices` route; setup builds the list from
   `/districts` and reads the published name from each district page (one request per
   office).
4. **The citizen reporting service.** See [reporting.md](reporting.md).
