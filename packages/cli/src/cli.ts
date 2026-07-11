#!/usr/bin/env node
import { processContext } from './context.js';
import { runCli } from './run.js';

process.exit(runCli(process.argv.slice(2), processContext()));
