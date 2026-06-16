import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const forbiddenLegacyArtifacts = [
  'anti-link',
  'antilink',
  'temporarily_away',
  'play_without_created',
  'play_without_removed',
  'link_updated',
  'conflict_updated',
  'LinkDrawer',
  'ConflictDrawer',
  'plateau_composition_forced',
];

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    if (!/\.(js|jsx)$/.test(entry.name)) return [];
    return [path];
  });
}

describe('legacy product artifacts', () => {
  it('keeps production source free of deprecated V0 events and old drawer concepts', () => {
    const filesToScan = collectSourceFiles(sourceRoot).filter((path) => {
      const relativePath = relative(sourceRoot, path);
      return !relativePath.endsWith('.test.js')
        && !relativePath.endsWith('.test.jsx')
        && relativePath !== 'shared/constants/eventTypes.js';
    });

    const offenders = filesToScan.flatMap((path) => {
      const content = readFileSync(path, 'utf8');
      return forbiddenLegacyArtifacts
        .filter((artifact) => content.includes(artifact))
        .map((artifact) => `${relative(sourceRoot, path)} contains ${artifact}`);
    });

    expect(offenders).toEqual([]);
  });
});
