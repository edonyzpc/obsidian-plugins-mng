import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { copy } from 'esbuild-plugin-copy';
import esbuildSvelte from "esbuild-svelte";
import sveltePreprocess from "svelte-preprocess";
import { readFile } from "fs"

const banner =
	`/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = (process.argv[2] === "production");
const cssPlugin = {
	name: 'cssPlugin',
	setup(build) {
		console.debug("starting....");
		build.onLoad(
			{ filter: /\.css$/, namespace: "css-plugin-ns" },
			async (args) => {
				console.debug("*********");
				console.debug(args)
				let css = await readFile("styles.css")
				console.debug("--------")
				console.debug(css)
				console.debug("--------")
				css = await esbuild.transform(css, { loader: 'css', minify: true })
				return { loader: 'text', contents: css }
			}
		);
		console.debug("ending....");
	},
};

const context = await esbuild.context({
	platform: "node",
	banner: {
		js: banner,
	},
	entryPoints: ["main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "dist/main.js",
	minify: prod ? true : false,
	plugins: [
		cssPlugin,
		esbuildSvelte({
			compilerOptions: { css: "injected" },
			preprocess: sveltePreprocess(),
		}),
		copy({
			assets: [
				{
					from: ['./manifest.json'],
					to: ['manifest.json'],
				},
				{
					from: ['./manifest-beta.json'],
					to: ['manifest-beta.json'],
				},
				{
					from: ['./styles.css'],
					to: ['styles.css'],
				},
			],
		}),
	],
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
