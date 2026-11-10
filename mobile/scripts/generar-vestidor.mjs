/**
 * Genera src/features/tryon/vestidorWeb.generated.ts: el vestidor virtual de la WEB empaquetado
 * como un script suelto, más las imágenes del probador incluidas en el frontend (public/tryon),
 * para que la app lo cargue en un WebView sin depender de la dirección del frontend.
 *
 * Volver a ejecutarlo cuando cambie la lógica del vestidor web (frontend/src/features/tryon):
 *   node scripts/generar-vestidor.mjs        (desde la carpeta mobile; usa el Vite del frontend)
 */
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const frontend = join(aqui, '..', '..', 'frontend');
const salida = join(aqui, '..', 'src', 'features', 'tryon', 'vestidorWeb.generated.ts');

const { build } = await import(pathToFileURL(join(frontend, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
const tmp = mkdtempSync(join(tmpdir(), 'vestidor-'));
try {
  await build({
    root: frontend,
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir: tmp,
      emptyOutDir: true,
      minify: true,
      lib: { entry: join(frontend, 'src', 'features', 'tryon', 'vestidorMovil.ts'), formats: ['iife'], name: 'VestidorMovil', fileName: () => 'vestidor.js' },
      rollupOptions: { external: ['@mediapipe/tasks-vision'] },
    },
  });
  const script = readFileSync(join(tmp, 'vestidor.js'), 'utf8');

  const carpeta = join(frontend, 'public', 'tryon');
  const imagenes = Object.fromEntries(
    readdirSync(carpeta)
      .filter((f) => f.endsWith('.png'))
      .map((f) => [`/tryon/${f}`, `data:image/png;base64,${readFileSync(join(carpeta, f)).toString('base64')}`]),
  );

  writeFileSync(
    salida,
    `// ARCHIVO GENERADO por scripts/generar-vestidor.mjs — no editar a mano.\n` +
      `// Vestidor virtual de la web (frontend/src/features/tryon/vestidorMovil.ts) empaquetado para el WebView,\n` +
      `// y las imágenes del probador incluidas en el frontend (public/tryon) en base64.\n\n` +
      `export const VESTIDOR_SCRIPT = ${JSON.stringify(script)};\n\n` +
      `export const IMAGENES_TRYON: Record<string, string> = ${JSON.stringify(imagenes, null, 2)};\n`,
  );
  console.log(`Generado ${salida} (script ${(script.length / 1024).toFixed(1)} KB, ${Object.keys(imagenes).length} imágenes)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
