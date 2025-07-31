const fs = require('fs-extra');
const path = require('path');
const prettier = require('prettier');
const beautify = require('js-beautify').css;

const DIST_DIR = 'dist';
const RESTORED_DIR = 'restored';

async function restore() {
  const classMap = await fs.readJson(path.join(DIST_DIR, 'class-map.json'));
  const reverseMap = Object.fromEntries(Object.entries(classMap).map(([k, v]) => [v, k]));

  async function restoreFile(filePath, outPath) {
  const ext = path.extname(filePath);
  let content = await fs.readFile(filePath, 'utf8');

  for (const [obf, original] of Object.entries(reverseMap)) {
    const regex = new RegExp(`\\b${obf}\\b`, 'g');
    content = content.replace(regex, original);
  }

  try {
    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      content = await prettier.format(content, { parser: 'babel' });
    } else if (ext === '.html') {
      content = await prettier.format(content, { parser: 'html' });
    } else if (ext === '.css') {
      content = beautify(content, { indent_size: 2 });
    }
  } catch (error) {
    console.warn(`⚠️ No se pudo formatear archivo ${filePath}:`, error.message);
  }

  await fs.outputFile(outPath, content);
}


  async function walk(dir, outDir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const outPath = path.join(outDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, outPath);
      } else {
        await restoreFile(fullPath, outPath);
      }
    }
  }

  await fs.emptyDir(RESTORED_DIR);
  await walk(DIST_DIR, RESTORED_DIR);
  console.log('✅ Desofuscación y desminificación completa. Archivos restaurados en /restored');
}

restore().catch(console.error);
