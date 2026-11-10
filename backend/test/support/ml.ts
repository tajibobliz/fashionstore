/**
 * Levanta el ml-service (FastAPI) para las pruebas E2E con el Python del entorno virtual
 * `ml-service/.venv`. Si no existe, devuelve null y las pruebas que lo necesitan se omiten.
 */
import { ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface MlService {
  url: string;
  stop(): void;
}

const dir = join(__dirname, '..', '..', '..', 'ml-service');
const python =
  process.env.ML_PYTHON ||
  join(dir, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

/** true si existe el entorno virtual del ml-service (se decide al cargar las pruebas). */
export const mlDisponible = existsSync(python);

export async function startMlService(clave: string): Promise<MlService | null> {
  if (!mlDisponible) return null;
  const port = 8100 + Math.floor(Math.random() * 800);
  const url = `http://127.0.0.1:${port}`;
  const proc: ChildProcess = spawn(
    python,
    ['-m', 'uvicorn', 'app.main:app', '--port', String(port), '--log-level', 'warning'],
    {
      cwd: dir,
      // PYTHONUNBUFFERED: que los errores de Python lleguen al mensaje aunque el proceso se cierre.
      env: { ...process.env, ML_API_KEY: clave, ML_MODELOS_DIR: mkdtempSync(join(tmpdir(), 'ml-e2e-')), PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let log = '';
  proc.stdout?.on('data', (d) => (log += d));
  proc.stderr?.on('data', (d) => (log += d));
  // La primera carga de scikit-learn/pandas en Windows (con antivirus) puede tardar bastante.
  const limiteMs = Number(process.env.ML_TEST_TIMEOUT ?? 120_000);
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    try {
      if ((await fetch(`${url}/health`)).ok) return { url, stop: () => proc.kill() };
    } catch {
      /* arrancando */
    }
    if (proc.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const segundos = Math.round((Date.now() - inicio) / 1000);
  const motivo = proc.exitCode !== null ? `Python se cerró con código ${proc.exitCode}` : `no respondió en ${segundos} s`;
  proc.kill();
  throw new Error(`ml-service no arrancó (${motivo}). Python: ${python}\nSalida:\n${log || '(sin salida)'}`);
}
