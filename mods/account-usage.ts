import fs from 'node:fs';
import type {ModApi} from '@commandcode/harness';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

const REPORT_TYPE = 'account-usage/report';
const API_BASE = process.env.COMMANDCODE_API_BASE_URL || 'https://api.commandcode.ai';
const AUTH_FILE = `${process.env.HOME ?? ''}/.commandcode/auth.json`;
const FETCH_TIMEOUT_MS = 10_000;
const AUTO_REFRESH_MIN_GAP_MS = 60_000;
const TURN_REFRESH_MIN_GAP_MS = 300_000;

interface WindowLimit {
	used: number | null;
	cap: number | null;
	exceeded?: boolean | null;
	resetAt?: number | null;
}

interface AccountUsage {
	planName: string | null;
	planId: string | null;
	monthlyRemaining: number;
	purchasedRemaining: number;
	freeRemaining: number;
	fiveHour: WindowLimit | null;
	weekly: WindowLimit | null;
	monthUsed: number | null;
	monthCap: number | null;
	periodStart: string | null;
	fetchedAt: number;
	error: string | null;
}

const PLAN_NAMES: Record<string, string> = {'individual-goat': 'GOAT'};

function readApiKey(): string | null {
	try {
		const raw = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) as Record<string, unknown>;
		const key = raw.apiKey;
		return typeof key === 'string' && key ? key : null;
	} catch {
		return null;
	}
}

async function apiGet(
	path: string,
	apiKey: string
): Promise<{ok: true; data: unknown} | {ok: false; error: string}> {
	try {
		const res = await fetch(`${API_BASE}${path}`, {
			headers: {'x-api-key': apiKey, accept: 'application/json'},
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!res.ok) return {ok: false, error: `HTTP ${res.status}`};
		return {ok: true, data: await res.json()};
	} catch (error) {
		return {ok: false, error: error instanceof Error ? error.message : String(error)};
	}
}

function num(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readWindowLimit(raw: unknown): WindowLimit | null {
	if (!raw || typeof raw !== 'object') return null;
	const w = raw as Record<string, unknown>;
	return {
		used: num(w.used),
		cap: num(w.cap),
		exceeded: typeof w.exceeded === 'boolean' ? w.exceeded : null,
		resetAt: num(w.resetAt),
	};
}

function dollars(n: number | null): string {
	return n == null ? 'n/a' : `$${n.toFixed(2)}`;
}

function compact(n: number | null): string {
	if (n == null) return 'n/a';
	if (n >= 1e6) return `${Math.round(n / 1e5) / 10}M`;
	if (n >= 1e4) return `${Math.round(n / 1e3) / 10}k`;
	return n.toFixed(n < 10 && n % 1 !== 0 ? 2 : n % 1 !== 0 ? 1 : 0);
}

function bar(percent: number, width = 10): string {
	const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
	return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function meter(used: number | null, cap: number | null, width = 10): string {
	if (cap == null || cap <= 0 || used == null) return `${DIM}${'─'.repeat(width)} n/a${RESET}`;
	const percent = Math.min(100, Math.round((used / cap) * 100));
	const color = percent >= 95 ? RED : percent >= 80 ? YELLOW : GREEN;
	return `${color}${bar(percent, width)} ${percent}%${RESET}`;
}

function humanizeDuration(ms: number): string {
	if (!Number.isFinite(ms) || ms <= 0) return 'now';
	const m = Math.max(1, Math.round(ms / 60_000));
	const h = Math.floor(m / 60);
	const rm = m % 60;
	if (h < 24) return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
	const d = Math.floor(h / 24);
	const rh = h % 24;
	return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

function renderReport(s: AccountUsage | null): string[] {
	if (!s) return [`${DIM}⚡ account usage — no data yet${RESET}`];
	if (s.error && s.monthUsed == null && s.fiveHour == null) {
		return [`${DIM}⚡ account usage unavailable — ${s.error}${RESET}`];
	}
	const lines: string[] = [
		`${CYAN}⚡ Account usage${RESET} ${DIM}· plan ${s.planName ?? s.planId ?? 'unknown'}${RESET}`,
	];
	if (s.fiveHour) {
		const reset =
			s.fiveHour.resetAt != null ? ` ${DIM}resets in ${humanizeDuration(s.fiveHour.resetAt - Date.now())}${RESET}` : '';
		lines.push(`  ${DIM}5-hour${RESET}   ${dollars(s.fiveHour.used)} / ${dollars(s.fiveHour.cap)}  ${meter(s.fiveHour.used, s.fiveHour.cap)}${reset}`);
	}
	if (s.weekly) {
		const reset =
			s.weekly.resetAt != null ? ` ${DIM}resets in ${humanizeDuration(s.weekly.resetAt - Date.now())}${RESET}` : '';
		lines.push(`  ${DIM}weekly${RESET}   ${dollars(s.weekly.used)} / ${dollars(s.weekly.cap)}  ${meter(s.weekly.used, s.weekly.cap)}${reset}`);
	}
	if (s.monthUsed != null) {
		const since = s.periodStart ? ` ${DIM}since ${new Date(s.periodStart).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}${RESET}` : '';
		lines.push(`  ${DIM}monthly${RESET}  ${dollars(s.monthUsed)} / ${dollars(s.monthCap)}  ${meter(s.monthUsed, s.monthCap)}${since}`);
	}
	const spare =
		s.monthlyRemaining + s.purchasedRemaining + s.freeRemaining > 0
			? `${dollars(s.monthlyRemaining)} monthly · ${dollars(s.purchasedRemaining)} purchased · ${dollars(s.freeRemaining)} free`
			: '—';
	lines.push(`  ${DIM}remaining${RESET} ${spare}`);
	const age = s.fetchedAt ? ` ${DIM}· as of ${new Date(s.fetchedAt).toLocaleTimeString()}${RESET}` : '';
	const stale = s.error ? ` ${DIM}(partial — ${s.error})${RESET}` : '';
	lines.push(`${DIM}${age}${stale}${RESET}`);
	return lines;
}

export default function accountUsageMod(cmd: ModApi): void {
	let cache: AccountUsage | null = null;
	let inflight: Promise<void> | null = null;
	let lastFetch = 0;

	const fetchAccountUsage = async (): Promise<void> => {
		const apiKey = readApiKey();
		if (!apiKey) {
			cache = {fetchedAt: Date.now(), error: 'not logged in (no auth.json apiKey)'} as unknown as AccountUsage;
			return;
		}
		const partial: AccountUsage = {
			planName: null,
			planId: null,
			monthlyRemaining: 0,
			purchasedRemaining: 0,
			freeRemaining: 0,
			fiveHour: null,
			weekly: null,
			monthUsed: null,
			monthCap: null,
			periodStart: null,
			fetchedAt: Date.now(),
			error: null,
		};
		const errors: string[] = [];
		const [creditsRes, subsRes] = await Promise.all([
			apiGet('/alpha/billing/credits', apiKey),
			apiGet('/alpha/billing/subscriptions', apiKey),
		]);
		if (creditsRes.ok) {
			const data = (creditsRes.data ?? {}) as Record<string, unknown>;
			const credits = ((data.credits ?? {}) as Record<string, unknown>) ?? {};
			const wins = (data.windowLimits ?? {}) as Record<string, unknown>;
			partial.fiveHour = readWindowLimit(wins.fiveHour);
			partial.weekly = readWindowLimit(wins.weekly);
			partial.monthlyRemaining = num(credits.monthlyCredits) ?? 0;
			partial.purchasedRemaining = num(credits.purchasedCredits) ?? 0;
			partial.freeRemaining = num(credits.freeCredits) ?? 0;
		} else {
			errors.push(`credits: ${creditsRes.error}`);
		}
		if (subsRes.ok) {
			const data = ((subsRes.data ?? {}) as Record<string, unknown>) ?? {};
			const sub = ((data.data ?? {}) as Record<string, unknown>) ?? {};
			partial.planId = typeof sub.planId === 'string' ? sub.planId : null;
			partial.planName = PLAN_NAMES[partial.planId ?? ''] ?? partial.planId;
			partial.periodStart = typeof sub.currentPeriodStart === 'string' ? sub.currentPeriodStart : null;
		} else {
			errors.push(`subscription: ${subsRes.error}`);
		}
		const since = partial.periodStart ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
		const summaryRes = await apiGet(`/alpha/usage/summary?since=${encodeURIComponent(since)}`, apiKey);
		if (summaryRes.ok) {
			const summary = ((summaryRes.data ?? {}) as Record<string, unknown>) ?? {};
			partial.monthUsed = num(summary.totalCredits);
			const monthlyRemaining = partial.monthlyRemaining;
			const usedMonthly = num(summary.totalMonthlyCredits) ?? 0;
			if (monthlyRemaining > 0 || usedMonthly > 0) {
				partial.monthCap = Math.round(monthlyRemaining + usedMonthly);
			}
		} else {
			errors.push(`summary: ${summaryRes.error}`);
		}
		partial.error = errors.length > 0 ? errors.join('; ') : null;
		cache = partial;
	};

	const refresh = async (minGapMs: number): Promise<void> => {
		if (inflight) return inflight;
		const age = Date.now() - lastFetch;
		if (cache && age < minGapMs) return;
		inflight = fetchAccountUsage()
			.then(() => {
				lastFetch = Date.now();
				refreshStatus();
			})
			.catch(error => {
				cache = {
					...(cache ?? {planName: null, planId: null, monthlyRemaining: 0, purchasedRemaining: 0, freeRemaining: 0, fiveHour: null, weekly: null, monthUsed: null, monthCap: null}),
					fetchedAt: Date.now(),
					error: error instanceof Error ? error.message : String(error),
				};
			})
			.finally(() => {
				inflight = null;
			});
		return inflight;
	};

	const statusLine = (): string | null => {
		if (!cache || cache.error && cache.fiveHour == null) {
			return cache ? `${DIM}⚡ account usage — ${cache.error ?? 'loading…'}${RESET}` : `${DIM}⚡ account usage — loading…${RESET}`;
		}
		const pct = (used: number | null, cap: number | null): string => {
			if (cap == null || cap <= 0 || used == null) return '--';
			return `${Math.min(100, Math.round((used / cap) * 100))}%`;
		};
		const seg = (label: string, used: number | null, cap: number | null): string => {
			const percent = cap == null || cap <= 0 || used == null ? 0 : (used / cap) * 100;
			const color = percent >= 95 ? RED : percent >= 80 ? YELLOW : '';
			const body = `${label} ${compact(used)}/${compact(cap)} ${pct(used, cap)}`;
			return color ? `${color}${body}${RESET}` : body;
		};
		const parts: string[] = [];
		if (cache.fiveHour) parts.push(seg('5h', cache.fiveHour.used, cache.fiveHour.cap));
		if (cache.weekly) parts.push(seg('wk', cache.weekly.used, cache.weekly.cap));
		if (cache.monthUsed != null) parts.push(seg('mo', cache.monthUsed, cache.monthCap));
		if (parts.length === 0) return `${DIM}⚡ account usage — no window data${RESET}`;
		return `⚡ ${parts.join(DIM + ' · ' + RESET)}`;
	};

	const refreshStatus = (): void => {
		cmd.ui.setStatus(statusLine() ?? `${DIM}⚡ account usage — loading…${RESET}`);
	};

	cmd.hooks({
		onSessionStart: () => {
			cmd.ui.setStatus(`${DIM}⚡ account usage — fetching…${RESET}`);
			void refresh(0);
		},
		onSessionEnd: () => {
			cmd.ui.setStatus(null);
		},
		onTurnStart: ({state}) => {
			void refresh(TURN_REFRESH_MIN_GAP_MS);
			return state;
		},
	});

	cmd.addRenderer(REPORT_TYPE, data => renderReport(data as AccountUsage | null));

	cmd.addCommand({
		name: 'current-usage',
		description: 'Show account usage (5-hour, weekly, monthly) inline',
		handler: async () => {
			await refresh(0);
			cmd.showEntry(REPORT_TYPE, cache);
			const s = cache;
			if (!s) return {message: 'No account usage data available.'};
			const parts: string[] = [];
			if (s.fiveHour) {
				parts.push(`5h ${dollars(s.fiveHour.used)}/${dollars(s.fiveHour.cap)}`);
			}
			if (s.weekly) {
				parts.push(`wk ${dollars(s.weekly.used)}/${dollars(s.weekly.cap)}`);
			}
			if (s.monthUsed != null) {
				parts.push(`mo ${dollars(s.monthUsed)}/${dollars(s.monthCap)}`);
			}
			return {
				message:
					parts.length > 0
						? `⚡ ${parts.join(' · ')} ${DIM}(fresh as of ${new Date(s.fetchedAt).toLocaleTimeString()})${RESET}`
						: 'No account usage data available.',
			};
		},
	});

	void refresh(0);
}
