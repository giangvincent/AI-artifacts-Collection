import type {ModApi} from '@commandcode/harness';

type ShellInput = {
	command?: unknown;
	args?: unknown;
	cwd?: unknown;
};

function getString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

export default function rtkMod(cmd: ModApi): void {
	cmd.hooks({
		beforeToolCall: async ({toolName, input}) => {
			if (toolName !== 'shell_command') return undefined;

			const shell = input as ShellInput;
			const command = getString(shell.command);
			if (!command) return undefined;

			const rawArgs = shell.args;
			if (
				rawArgs !== undefined &&
				(!Array.isArray(rawArgs) || !rawArgs.every(arg => typeof arg === 'string'))
			) {
				return undefined;
			}

			const args = rawArgs as string[] | undefined;
			const cwd = getString(shell.cwd);
			try {
				const result = await cmd.exec({
					command: 'rtk',
					args: ['rewrite', '--', command, ...(args ?? [])],
					...(cwd ? {cwd} : {}),
				});
				if (result.code !== 0 && result.code !== 3) return undefined;

				const rewritten = result.stdout.trim();
				if (!rewritten) return undefined;

				const {args: _args, ...rest} = shell;
				return {input: {...rest, command: rewritten}};
			} catch {
				return undefined;
			}
		},
	});
}
