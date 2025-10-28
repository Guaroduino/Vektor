import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, '..');
  const pjPath = path.join(repoRoot, 'package.json');
  const docsDir = path.join(repoRoot, 'docs', 'libs');

  try {
    const pjRaw = await fs.readFile(pjPath, 'utf8');
    const pj = JSON.parse(pjRaw);
    const deps = { ...(pj.dependencies || {}), ...(pj.devDependencies || {}) };

    await fs.mkdir(docsDir, { recursive: true });

    // Ensure README exists (overwrite with simple index)
    const readmePath = path.join(docsDir, 'README.md');
    let readme = '# Librerías usadas\n\n';
    readme += 'Esta carpeta contiene notas y ejemplos breves de las librerías que utiliza este proyecto.\n\n';
    readme += 'Índice:\n\n';

    for (const [name, version] of Object.entries(deps)) {
      const fileName = `${name.replace('/', '-')}.md`;
      const filePath = path.join(docsDir, fileName);

      readme += `- [${name}](${fileName}) — ${version}\n`;

      // Create template file if missing
      try {
        await fs.access(filePath);
      } catch (e) {
        const content = `# ${name}\n\nVersión: ${version}\n\nDocumentación oficial y notas de uso.\n`;
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`Created ${fileName}`);
      }
    }

    await fs.writeFile(readmePath, readme, 'utf8');
    console.log('Updated docs/libs/README.md');
  } catch (err) {
    console.error('Error generating docs:', err);
    process.exitCode = 1;
  }
}

main();
