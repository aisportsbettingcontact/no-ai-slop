/**
 * @nas/cli — the `nas` command line. Exposes `runCli` and the injectable context
 * so the tool can be driven deterministically from tests and other programs.
 */
export { runCli } from './run.js';
export { type CliContext, processContext, CliError } from './context.js';
export { EvidenceStore } from './store.js';
