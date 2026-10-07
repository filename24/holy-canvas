/* eslint-disable @typescript-eslint/no-unsafe-call, unicorn/no-process-exit */
import {existsSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';

mkdirSync('dist', {recursive: true});

const req = createRequire(import.meta.url);
let yogaAsmPath = resolve('node_modules/yoga-wasm-web/dist/asm.js');
try {
	const yogaPkgJson = req.resolve('yoga-wasm-web/package.json');
	yogaAsmPath = join(dirname(yogaPkgJson), 'dist', 'asm.js');
} catch {
	// Fallback to resolve
}

const yogaAutoPath = resolve('scripts/yoga-asm-auto.ts');

// 1. Bundle JavaScript for Node runtime -> dist/cli.js
console.log('[Bun] Bundling JavaScript for Node runtime -> dist/cli.js');
const nodeBuild = await Bun.build({
	entrypoints: ['./source/cli.tsx'],
	outdir: './dist',
	minify: true,
	bytecode: true,
	target: 'node',
	naming: 'cli.js',
	plugins: [
		{
			name: 'yoga-asm-alias',
			setup(build) {
				build.onResolve({filter: /^yoga-wasm-web(\/auto)?$/}, () => {
					return {path: yogaAutoPath};
				});
				build.onResolve({filter: /^yoga-wasm-web\/dist\/asm\.js$/}, () => {
					return {path: yogaAsmPath};
				});
			},
		},
	],
});

if (!nodeBuild.success) {
	console.error('[Bun] Node bundle failed:');
	for (const msg of nodeBuild.logs) console.error(msg);
	process.exit(1);
}

// 2. If --compile argument passed, compile standalone single-file executables
const shouldCompile = process.argv.includes('--compile');

if (shouldCompile) {
	const targets = [
		{target: 'bun-linux-x64', outfile: './release/holy-canvas-linux-x64'},
		{target: 'bun-linux-arm64', outfile: './release/holy-canvas-linux-arm64'},
		{target: 'bun-darwin-x64', outfile: './release/holy-canvas-darwin-x64'},
		{target: 'bun-darwin-arm64', outfile: './release/holy-canvas-darwin-arm64'},
		{target: 'bun-windows-x64', outfile: './release/holy-canvas-win-x64.exe'},
		{
			target: 'bun-windows-arm64',
			outfile: './release/holy-canvas-win-arm64.exe',
		},
	];

	mkdirSync('release', {recursive: true});

	for (const t of targets) {
		console.log(
			`[Bun] Compiling standalone executable ${t.target} -> ${t.outfile}`,
		);
		const res = await Bun.build({
			entrypoints: ['./source/cli.tsx'],
			minify: true,
			bytecode: true,
			compile: {
				target: t.target as any,
				outfile: t.outfile,
			},
			plugins: [
				{
					name: 'yoga-asm-alias',
					setup(build) {
						build.onResolve({filter: /^yoga-wasm-web(\/auto)?$/}, () => {
							return {path: yogaAutoPath};
						});
						build.onResolve({filter: /^yoga-wasm-web\/dist\/asm\.js$/}, () => {
							return {path: yogaAsmPath};
						});
					},
				},
			],
		});

		if (!res.success) {
			console.error(`[Bun] Compilation failed for ${t.target}:`);
			for (const msg of res.logs) console.error(msg);
			process.exit(1);
		}
	}
}

console.log('[Bun] Build completed successfully!');
