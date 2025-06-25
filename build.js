
const fs = require('fs-extra');
const path = require('path');
const { minify: minifyHTML } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SOURCE_DIR = process.argv[2] || 'src';
const DIST_DIR = 'dist';

async function processFile(filePath, distPath) {
  const ext = path.extname(filePath);
  const content = await fs.readFile(filePath, 'utf8');

  let output = content;

  if (ext === '.js') {
    output = JavaScriptObfuscator.obfuscate(content, {
      compact: true,
      controlFlowFlattening: true,
    }).getObfuscatedCode();
  } else if (ext === '.css') {
    output = new CleanCSS().minify(content).styles;
  } else if (ext === '.html') {
    output = await minifyHTML(content, {
      collapseWhitespace: true,
      removeComments: true,
      minifyJS: true,
      minifyCSS: true,
    });
  }

  await fs.outputFile(distPath, output);
}

async function walkAndProcess(dir, baseOutDir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const outPath = path.join(baseOutDir, path.relative(SOURCE_DIR, fullPath));

    if (entry.isDirectory()) {
      await walkAndProcess(fullPath, baseOutDir);
    } else if (/\.(html|css|js)$/.test(entry.name)) {
      await processFile(fullPath, outPath);
    } else {
      // copiar otros archivos sin procesar
      await fs.copy(fullPath, outPath);
    }
  }
}

async function build() {
  if (!await fs.pathExists(SOURCE_DIR)) {
    console.error(`❌ Carpeta de origen no encontrada: ${SOURCE_DIR}`);
    process.exit(1);
  }

  await fs.emptyDir(DIST_DIR);
  await walkAndProcess(SOURCE_DIR, DIST_DIR);

  console.log(`✅ ¡Build completado desde '${SOURCE_DIR}'! Archivos generados en '${DIST_DIR}'`);
}

build().catch(console.error);
