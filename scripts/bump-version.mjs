// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Increment semver string (e.g. 6.1.0 -> 6.1.1)
 * @param {string} currentVersion
 * @param {'patch' | 'minor' | 'major'} [type='patch']
 * @returns {string}
 */
export function incrementVersion(currentVersion, type = 'patch') {
    const parts = currentVersion.split('.').map(Number);
    if (parts.length !== 3 || parts.some((n) => isNaN(n) || n < 0)) {
        throw new Error(`Invalid semver version string: ${currentVersion}`);
    }
    let [major, minor, patch] = parts;
    if (type === 'major') {
        major += 1;
        minor = 0;
        patch = 0;
    } else if (type === 'minor') {
        minor += 1;
        patch = 0;
    } else {
        patch += 1;
    }
    return `${major}.${minor}.${patch}`;
}

/**
 * Update version in package.json, manifest.json, package-lock.json, and CHANGELOG.md
 * @param {string} newVersion
 * @param {string} [changelogTitle='']
 * @param {string} [targetRootDir=rootDir]
 */
export async function updateProjectVersion(newVersion, changelogTitle = '', targetRootDir = rootDir) {
    // 1. package.json
    const packageJsonPath = path.join(targetRootDir, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    packageJson.version = newVersion;
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n', 'utf8');

    // 2. manifest.json
    const manifestPath = path.join(targetRootDir, 'manifest.json');
    try {
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        manifest.version = newVersion;
        await writeFile(manifestPath, JSON.stringify(manifest, null, 4) + '\n', 'utf8');
    } catch {
        // Ignore if manifest.json doesn't exist
    }

    // 3. package-lock.json (if exists)
    const packageLockPath = path.join(targetRootDir, 'package-lock.json');
    try {
        const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));
        packageLock.version = newVersion;
        if (packageLock.packages && packageLock.packages['']) {
            packageLock.packages[''].version = newVersion;
        }
        await writeFile(packageLockPath, JSON.stringify(packageLock, null, 4) + '\n', 'utf8');
    } catch {
        // Ignore if package-lock doesn't exist
    }

    // 4. CHANGELOG.md
    const changelogPath = path.join(targetRootDir, 'CHANGELOG.md');
    try {
        const changelogContent = await readFile(changelogPath, 'utf8');
        const today = new Date().toISOString().slice(0, 10);
        const heading = `## v${newVersion} - ${today}`;
        if (!changelogContent.includes(`## v${newVersion}`)) {
            const lines = changelogContent.split('\n');
            const insertIndex = lines.findIndex((l) => l.startsWith('## '));
            const newSection = [
                heading,
                '',
                '### Updates',
                '',
                `- ${changelogTitle || 'Bug fixes and performance improvements.'}`,
                '',
            ];
            if (insertIndex !== -1) {
                lines.splice(insertIndex, 0, ...newSection);
            } else {
                lines.push('', ...newSection);
            }
            await writeFile(changelogPath, lines.join('\n'), 'utf8');
        }
    } catch {
        // Ignore if CHANGELOG.md doesn't exist
    }

    return newVersion;
}

async function main() {
    const rawType = process.argv[2] || 'patch';
    const type = /** @type {'patch' | 'minor' | 'major'} */ (
        ['patch', 'minor', 'major'].includes(rawType) ? rawType : 'patch'
    );
    const title = process.argv[3] || '';

    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    const newVersion = incrementVersion(currentVersion, type);

    await updateProjectVersion(newVersion, title, rootDir);
    console.log(`Successfully bumped version: ${currentVersion} -> ${newVersion}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
