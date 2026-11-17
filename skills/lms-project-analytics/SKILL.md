---
name: lms-project-analytics
description: Orchestrate a local LM Studio project analytics scan via the existing MCP tools.
---

# LM Studio project analytics

Run the scan, do not duplicate the prompt. Evidence rules, sub-shapes,
and enums live in `src/laya_mcp_control/prompts/project_analytics.md` and
`docs/schemas/project-analytics.v1.json`; this skill only orchestrates.
Treat every edge and node id in the artifacts as evidence-backed; do
not infer extra relationships beyond what the prompt already demands.

1. `local_ai_status`. Both `nomic` and `lms` must be loaded.
2. `project_add` / `project_index` if the project is missing or stale.
3. `lms_project_scan(project_id)` once. Never re-issue while a run is active.
4. Poll `lms_project_scan_status(project_id, run_id)` at bounded intervals.
5. On `completed`: read coverage. Require `coverage.eligible_files ==
   coverage.represented_files` and that every gap is explicit. Return the
   two artifact paths: `docs/analytics/project-map.json` and
   `docs/analytics/PROJECT_ANALYTICS.md`.
6. On `failed`: surface the error message and the failing phase; do not
   read stale `latest.json` unless the user explicitly asks.
7. For later project questions, prefer
   `lms_project_analytics_query(project_id, query, limit=20)`.
8. Verify change-sensitive claims against the cited source paths under
   `docs/analytics/` before quoting.