import type {ModApi} from '@commandcode/harness';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

const REPORT_TYPE = 'usage-meter/report';

interface Usage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

interface Snapshot extends Usage {
	requests: number;
	runs: number;
	turns: number;
	subagentTokens: number;
	ctxEstimate: number | null;
	lastTurn: Usage | null;
	model: string | null;
	updatedAt: number | null;
	contextWindow: number | null;
}

const zero = (): Usage => ({input: 0, output: 0, cacheRead: 0, cacheWrite: 0});

function readUsage(raw: unknown): Usage | null {
	if (!raw || typeof raw !== 'object') return null;
	const u = raw as Record<string, unknown>;
	const num = (...keys: string[]): number => {
		for (const key of keys) {
			const v = u[key];
			if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
		}
		return 0;
	};
	const usage: Usage = {
		input: num('inputTokens', 'input_tokens', 'promptTokens', 'prompt_tokens'),
		output: num('outputTokens', 'output_tokens', 'completionTokens', 'completion_tokens'),
		cacheRead: num('cacheReadTokens', 'cache_read_input_tokens'),
		cacheWrite: num('cacheWriteTokens', 'cache_creation_input_tokens'),
	};
	if (!usage.input && !usage.output) return null;
	return usage;
}

function compact(n: number): string {
	if (n >= 1e9) return `${Math.round(n / 1e8) / 10}B`;
	if (n >= 1e6) return `${Math.round(n / 1e5) / 10}M`;
	if (n >= 1e3) return `${Math.round(n / 1e2) / 10}k`;
	return String(Math.round(n));
}

function grouped(n: number): string {
	return Math.round(n).toLocaleString('en-US');
}

function bar(percent: number, width = 10): string {
	const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
	return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function renderReport(s: Snapshot): string[] {
	if (!s || s.requests === 0) {
		return [`${DIM}⚡ no usage recorded yet this session${RESET}`];
	}
	const lines: string[] = [
		`${CYAN}⚡ Session usage${RESET} ${DIM}· ${s.runs} run(s) · ${s.turns} turn(s) · ${s.requests} request(s)${RESET}`,
	];
	lines.push(`  ${DIM}input${RESET}         ${BOLD}${grouped(s.input)}${RESET}${DIM} tok${RESET}`);
	lines.push(`  ${DIM}  cache read${RESET}   ${grouped(s.cacheRead)}`);
	lines.push(`  ${DIM}  cache write${RESET}  ${grouped(s.cacheWrite)}`);
	lines.push(`  ${DIM}output${RESET}        ${BOLD}${grouped(s.output)}${RESET}${DIM} tok${RESET}`);
	if (s.subagentTokens > 0) {
		lines.push(`  ${DIM}sub-agents${RESET}     ${grouped(s.subagentTokens)}${DIM} tok${RESET}`);
	}
	if (s.ctxEstimate != null) {
		const ctx = `~${grouped(s.ctxEstimate)}`;
		if (s.contextWindow) {
			const percent = Math.round((s.ctxEstimate / s.contextWindow) * 100);
			const color = percent >= 80 ? YELLOW : GREEN;
			lines.push(`  ${DIM}context est.${RESET}  ${ctx} / ${compact(s.contextWindow)}  ${color}${bar(percent)} ${percent}%${RESET}`);
		} else {
			lines.push(`  ${DIM}context est.${RESET}  ${ctx} tok ${DIM}(set --mod-option contextWindow=<n> for %)${RESET}`);
		}
	}
	if (s.lastTurn) {
		const t = s.lastTurn.input + s.lastTurn.output;
		lines.push(`  ${DIM}last turn${RESET}     ${grouped(t)} tok ${DIM}(in ${compact(s.lastTurn.input)} · out ${compact(s.lastTurn.output)})${RESET}`);
	}
	if (s.model) {
		lines.push(`  ${DIM}model${RESET}         ${s.model}`);
	}
	if (s.updatedAt) {
		lines.push(`  ${DIM}updated${RESET}       ${new Date(s.updatedAt).toLocaleTimeString()}`);
	}
	return lines;
}

export default function usageMeterMod(cmd: ModApi): void {
	const totals = zero();
	let requests = 0;
	let runs = 0;
	let turns = 0;
	let subagentTokens = 0;
	let ctxEstimate: number | null = null;
	let lastTurn: Usage | null = null;
	let model: string | null = null;
	let updatedAt: number | null = null;

	cmd.addFlag('contextWindow', {
		type: 'string',
		default: '',
		description: 'Context window in tokens (e.g. 200000) to show a ctx % bar',
	});

	const contextWindow = (): number | null => {
		const n = Number(String(cmd.getFlag('contextWindow') ?? '').trim());
		return Number.isFinite(n) && n > 0 ? n : null;
	};

	const snapshot = (): Snapshot => ({
		...totals,
		requests,
		runs,
		turns,
		subagentTokens,
		ctxEstimate,
		lastTurn,
		model,
		updatedAt,
		contextWindow: contextWindow(),
	});

	const statusLine = (): string | null => {
		if (requests === 0) return null;
		const window = contextWindow();
		const parts = [
			`⚡${DIM} in ${compact(totals.input)} · out ${compact(totals.output)} · ctx ~${compact(ctxEstimate ?? 0)}${RESET}`,
		];
		if (window && ctxEstimate != null) {
			const percent = Math.round((ctxEstimate / window) * 100);
			const color = percent >= 80 ? YELLOW : GREEN;
			parts.push(`${color}${bar(percent)} ${percent}%${RESET}`);
		}
		return parts.join(' ');
	};

	const refreshStatus = (): void => {
		cmd.ui.setStatus(statusLine());
	};

	cmd.hooks({
		onSessionStart: () => {
			cmd.ui.setStatus(`${DIM}⚡ usage meter ready${RESET}`);
		},
		onSessionEnd: () => {
			cmd.ui.setStatus(null);
		},
	});

	cmd.on('run_start', () => {
		runs += 1;
	});

	cmd.on('turn_start', () => {
		turns += 1;
	});

	cmd.on('model_request_end', event => {
		if (event.type !== 'model_request_end') return;
		const usage = readUsage(event.usage);
		if (!usage) return;
		totals.input += usage.input;
		totals.output += usage.output;
		totals.cacheRead += usage.cacheRead;
		totals.cacheWrite += usage.cacheWrite;
		requests += 1;
		if (typeof event.model === 'string' && event.model) model = event.model;
		const claudeish = /claude|anthropic/i.test(model ?? '');
		ctxEstimate = usage.input + usage.cacheWrite + (claudeish ? usage.cacheRead : 0);
		updatedAt = Date.now();
		refreshStatus();
	});

	cmd.on('turn_end', event => {
		if (event.type !== 'turn_end') return;
		lastTurn = readUsage(event.usage);
	});

	cmd.on('subagent_stop', event => {
		if (event.type !== 'subagent_stop') return;
		if (typeof event.tokensUsed === 'number' && Number.isFinite(event.tokensUsed)) {
			subagentTokens += event.tokensUsed;
		}
	});

	cmd.addRenderer(REPORT_TYPE, data => renderReport(data as Snapshot));

	cmd.addCommand({
		name: 'tokens',
		description: 'Show current session token usage (in/out/context)',
		argumentHint: '[reset]',
		handler: ({args}) => {
			if (args.trim() === 'reset') {
				totals.input = 0;
				totals.output = 0;
				totals.cacheRead = 0;
				totals.cacheWrite = 0;
				requests = 0;
				runs = 0;
				turns = 0;
				subagentTokens = 0;
				ctxEstimate = null;
				lastTurn = null;
				model = null;
				updatedAt = null;
				refreshStatus();
				return {message: 'Usage counters reset.'};
			}
			const s = snapshot();
			cmd.showEntry(REPORT_TYPE, s);
			if (s.requests === 0) {
				return {message: 'No usage recorded yet this session.'};
			}
			const window = s.contextWindow;
			const ctxPart =
				s.ctxEstimate == null
					? ''
					: window
						? ` · ctx ~${compact(s.ctxEstimate)} (${Math.round((s.ctxEstimate / window) * 100)}%)`
						: ` · ctx ~${compact(s.ctxEstimate)}`;
			return {message: `⚡ in ${compact(s.input)} · out ${compact(s.output)}${ctxPart} · ${s.requests} request(s)`};
		},
	});
}
