import type {ModApi} from '@commandcode/harness';

const CUSTOM_TYPE = 'ponytail/mode';
const RULESET_URL = 'https://raw.githubusercontent.com/DietrichGebert/ponytail/main/AGENTS.md';
const HEADER = 'Ponytail - lazy senior dev mode (always on).';

type Level = 'lite' | 'full' | 'ultra' | 'off';

// Vendored from DietrichGebert/ponytail@main AGENTS.md. Used when the network fetch
// fails or is disabled; refreshed from GitHub once per session when reachable.
const VENDORED_RULESET = `You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

Before writing any code, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here, don't re-write it.
3. Does the standard library already do this? Use it.
4. Does a native platform feature cover it? Use it.
5. Does an already-installed dependency solve it? Use it.
6. Can this be one line? Make it one line.
7. Only then: write the minimum code that works.

The ladder runs after you understand the problem, not instead of it: read the task and the code it touches, trace the real flow end to end, then climb.

Bug fix = root cause, not symptom: a report names a symptom. Grep every caller of the function you touch and fix the shared function once - one guard there is a smaller diff than one per caller, and patching only the path the ticket names leaves a sibling caller still broken.

Rules:

- No abstractions that weren't explicitly requested.
- No new dependency if it can be avoided.
- No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins, but only once you understand the problem. The smallest change in the wrong place isn't lazy, it's a second bug.
- Question complex requests: "Do you actually need X, or does Y cover it?"
- Pick the edge-case-correct option when two stdlib approaches are the same size, lazy means less code, not the flimsier algorithm.
- Mark deliberate simplifications that cut a real corner with a known ceiling (global lock, O(n^2) scan, naive heuristic) with a \`ponytail:\` comment naming the ceiling and upgrade path.

Not lazy about: understanding the problem (read it fully and trace the real flow before picking a rung, a small diff you don't understand is just laziness dressed up as efficiency), input validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs (the platform is never the spec ideal, a clock drifts, a sensor reads off), anything explicitly requested. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind, the smallest thing that fails if the logic breaks (an assert-based demo/self-check or one small test file; no frameworks, no fixtures). Trivial one-liners need no test.`;

const LEVEL_NOTE: Record<Exclude<Level, 'off'>, string> = {
	lite: 'Level: lite. Build what was asked, but name the lazier alternative in one line so the user can pick.',
	full: 'Level: full. The ladder is enforced. Stdlib and native first, shortest diff, shortest explanation. Default.',
	ultra: 'Level: ultra. YAGNI extremist. Deletion before addition. Ship the one-liner and challenge the rest of the requirement in the same breath.',
};

function isLevel(value: unknown, allowOff: boolean): value is Level {
	if (value === 'lite' || value === 'full' || value === 'ultra') return true;
	return allowOff && value === 'off';
}

export default function ponytailMod(cmd: ModApi): void {
	let level: Level = 'full';
	let seeded = false;
	let ruleset: string | undefined;
	let fetchAttempted = false;

	async function loadRuleset(): Promise<string> {
		if (ruleset) return ruleset;
		if (!fetchAttempted) {
			fetchAttempted = true;
			try {
				const response = await fetch(RULESET_URL, {signal: AbortSignal.timeout(2500)});
				if (response.ok) {
					const text = (await response.text()).trim();
					if (text) ruleset = text;
				}
			} catch {
				// Offline or blocked: keep the vendored copy.
			}
		}
		return ruleset ?? VENDORED_RULESET;
	}

	function seedLevel(): void {
		if (seeded) return;
		seeded = true;
		const entries = cmd.session?.getCustomEntries({customType: CUSTOM_TYPE}) as
			| Array<{data?: unknown}>
			| undefined;
		const data = entries?.[entries.length - 1]?.data;
		if (data && typeof data === 'object' && 'level' in data) {
			const stored = (data as {level?: unknown}).level;
			if (isLevel(stored, true)) level = stored;
		}
	}

	cmd.hooks({
		onSessionStart: () => {
			seedLevel();
		},
		appendSystemPrompt: async () => {
			seedLevel();
			if (level === 'off') return undefined;
			const text = await loadRuleset();
			return `${HEADER}\n\n${LEVEL_NOTE[level]}\n\n${text}`;
		},
	});

	cmd.addCommand({
		name: 'ponytail',
		description: 'Set the ponytail intensity, or report it (lite|full|ultra|off)',
		argumentHint: '[lite|full|ultra|off]',
		handler: ({args}) => {
			seedLevel();
			const arg = args.trim().toLowerCase();
			if (!arg) {
				return {message: `ponytail: ${level}. Use /ponytail lite|full|ultra|off.`};
			}
			if (!isLevel(arg, true)) {
				return {message: `ponytail: unknown level "${arg}". Use lite, full, ultra, or off.`};
			}
			level = arg;
			cmd.session?.appendCustomEntry({customType: CUSTOM_TYPE, data: {level}});
			return {message: `ponytail: ${level}`};
		},
	});
}
