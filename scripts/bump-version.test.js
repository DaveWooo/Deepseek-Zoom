import { describe, expect, it } from 'vitest';
import { incrementVersion, updateProjectVersion } from './bump-version.mjs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('bump-version helpers', () => {
    it('increments semver versions correctly', () => {
        expect(incrementVersion('6.1.0', 'patch')).toBe('6.1.1');
        expect(incrementVersion('6.1.0')).toBe('6.1.1');
        expect(incrementVersion('6.1.0', 'minor')).toBe('6.2.0');
        expect(incrementVersion('6.1.0', 'major')).toBe('7.0.0');
        expect(incrementVersion('1.9.9', 'patch')).toBe('1.9.10');
    });

    it('throws on invalid version strings', () => {
        expect(() => incrementVersion('invalid')).toThrow(/Invalid semver/);
        expect(() => incrementVersion('1.0')).toThrow(/Invalid semver/);
        expect(() => incrementVersion('1.0.a')).toThrow(/Invalid semver/);
    });

    it('updates version across mock project files', async () => {
        const tempDir = await mkdtemp(path.join(tmpdir(), 'bump-test-'));

        try {
            await writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'test', version: '1.0.0' }, null, 4)
            );
            await writeFile(
                path.join(tempDir, 'manifest.json'),
                JSON.stringify({ manifest_version: 3, version: '1.0.0' }, null, 4)
            );
            await writeFile(
                path.join(tempDir, 'package-lock.json'),
                JSON.stringify({ name: 'test', version: '1.0.0', packages: { '': { version: '1.0.0' } } }, null, 4)
            );
            await writeFile(
                path.join(tempDir, 'CHANGELOG.md'),
                '# Changelog\n\n## v1.0.0 - 2026-01-01\n\n- Initial release\n'
            );

            await updateProjectVersion('1.0.1', 'Fix bug', tempDir);

            const pkg = JSON.parse(await readFile(path.join(tempDir, 'package.json'), 'utf8'));
            const manifest = JSON.parse(await readFile(path.join(tempDir, 'manifest.json'), 'utf8'));
            const lock = JSON.parse(await readFile(path.join(tempDir, 'package-lock.json'), 'utf8'));
            const changelog = await readFile(path.join(tempDir, 'CHANGELOG.md'), 'utf8');

            expect(pkg.version).toBe('1.0.1');
            expect(manifest.version).toBe('1.0.1');
            expect(lock.version).toBe('1.0.1');
            expect(lock.packages[''].version).toBe('1.0.1');
            expect(changelog).toContain('## v1.0.1');
            expect(changelog).toContain('Fix bug');
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });
});
