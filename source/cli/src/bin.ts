#!/usr/bin/env node
import { Command } from 'commander';
import { registerInitCommand } from './cli/init.js';
import { registerBuildCommand } from './cli/build-context.js';
import { registerValidateCommand } from './cli/validate.js';
import { registerDriftCommand } from './cli/drift.js';
import { registerDriftSyncCommand } from './cli/drift-sync.js';
import { registerStatusCommand } from './cli/status.js';
import { registerTreeCommand } from './cli/tree.js';
import { registerOwnerCommand } from './cli/owner.js';
import { registerDepsCommand } from './cli/deps.js';
import { registerImpactCommand } from './cli/impact.js';
import { registerTagsCommand } from './cli/tags.js';
import { registerJournalAddCommand } from './cli/journal-add.js';
import { registerJournalReadCommand } from './cli/journal-read.js';
import { registerJournalArchiveCommand } from './cli/journal-archive.js';

const program = new Command();

program
  .name('yg')
  .description('Yggdrasil — architectural knowledge infrastructure for AI agents')
  .version('0.1.0');

registerInitCommand(program);
registerBuildCommand(program);
registerValidateCommand(program);
registerDriftCommand(program);
registerDriftSyncCommand(program);
registerStatusCommand(program);
registerTreeCommand(program);
registerOwnerCommand(program);
registerDepsCommand(program);
registerImpactCommand(program);
registerTagsCommand(program);
registerJournalAddCommand(program);
registerJournalReadCommand(program);
registerJournalArchiveCommand(program);

program.parse();
