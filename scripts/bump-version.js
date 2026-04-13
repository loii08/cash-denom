import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the constants file
const constantsPath = path.join(__dirname, '../src/constants.ts');
let content = fs.readFileSync(constantsPath, 'utf8');

// Extract current version
const versionMatch = content.match(/export const APP_VERSION = '(\d+\.\d+\.\d+)';/);
if (!versionMatch) {
  console.error('Could not find APP_VERSION in constants.ts');
  process.exit(1);
}

const currentVersion = versionMatch[1];
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Increment patch version
const newVersion = `${major}.${minor}.${patch + 1}`;

// Update the version in the file
content = content.replace(
  /export const APP_VERSION = '\d+\.\d+\.\d+';/,
  `export const APP_VERSION = '${newVersion}';`
);

// Add release note for the new version
const releaseNoteLine = `  '${newVersion}': 'Auto-incremented version',`;
const versionNotesMatch = content.match(/export const VERSION_NOTES: Record<string, string> = \{([\s\S]+?)\};/);
if (versionNotesMatch) {
  const notesSection = versionNotesMatch[1];
  const firstNoteMatch = notesSection.match(/'([^']+)':/);
  if (firstNoteMatch) {
    content = content.replace(
      /export const VERSION_NOTES: Record<string, string> = \{/,
      `export const VERSION_NOTES: Record<string, string> = {\n  '${newVersion}': 'Auto-incremented version',`
    );
  }
}

// Write back to the file
fs.writeFileSync(constantsPath, content);
console.log(`Version bumped from ${currentVersion} to ${newVersion}`);
