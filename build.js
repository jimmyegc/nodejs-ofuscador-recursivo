const fs = require('fs-extra');
const path = require('path');
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');
const CleanCSS = require('clean-css');
const { minify: minifyHTML } = require('html-minifier-terser');

// Configuración
const SOURCE_DIR = process.argv[2] || 'src';
const DIST_DIR = 'dist';

const classMap = new Map();

function generateClassName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let name = 'x';
  for (let i = 0; i < 4; i++) {
    name += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return name;
}

function generateUniqueClassName() {
  let name;
  do {
    name = generateClassName();
  } while ([...classMap.values()].includes(name));
  return name;
}

// Reemplaza clases en selectores CSS usando postcss-selector-parser
async function processCssSelectors(cssContent) {
  const processor = postcss([
    (root) => {
      root.walkRules(rule => {
        // Procesar cada selector
        rule.selector = selectorParser(selectors => {
          selectors.walkClasses(classNode => {
            const cls = classNode.value;
            if (!classMap.has(cls)) {
              classMap.set(cls, generateUniqueClassName());
            }
            classNode.value = classMap.get(cls);
          });
        }).processSync(rule.selector);
      });
    }
  ]);

  const result = await processor.process(cssContent, { from: undefined });
  return result.css;
}

function replaceClassesInHtml(content) {
  return content.replace(/class=["']([^"']+)["']/g, (match, classList) => {
    const newClassList = classList.split(/\s+/).map(cls => {
      if (!classMap.has(cls)) classMap.set(cls, generateUniqueClassName());
      return classMap.get(cls);
    }).join(' ');
    return `class="${newClassList}"`;
  });
}

function replaceClassesInJs(content) {
  return content.replace(/(['"`])([^"'`]*?)\1/g, (match, quote, value) => {
    const classes = value.split(/\s+/);
    let replaced = false;
    const newValue = classes.map(cls => {
      if (classMap.has(cls)) {
        replaced = true;
        return classMap.get(cls);
      }
      return cls;
    }).join(' ');
    return replaced ? `${quote}${newValue}${quote}` : match;
  });
}

async function processFile(filePath, distPath) {
  const ext = path.extname(filePath);
  let content = await fs.readFile(filePath, 'utf8');

  if (ext === '.css') {
    content = await processCssSelectors(content);
    content = new CleanCSS().minify(content).styles;
  } else if (ext === '.html') {
    content = replaceClassesInHtml(content);
    content = await minifyHTML(content, {
      collapseWhitespace: true,
      removeComments: true,
      minifyJS: false,
      minifyCSS: true,
    });
  } else if (ext === '.js') {
    content = replaceClassesInJs(content);
    // Aquí podrías añadir ofuscación JS si quieres
  }

  await fs.outputFile(distPath, content);
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

  // Guardar el mapa de clases para restaurar
  await fs.writeJson(path.join(DIST_DIR, 'class-map.json'), Object.fromEntries(classMap.entries()), { spaces: 2 });

  console.log('✅ Build completado. Clases ofuscadas:');
  console.table(Object.fromEntries(classMap.entries()));
}

build().catch(console.error);
