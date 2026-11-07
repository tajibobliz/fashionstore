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
      env: { ...process.env, ML_API_KEY: clave, ML_MODELOS_DIR: mkdtempSync(join(tmpdir(), 'ml-e2e-')) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let log = '';
  proc.stdout?.on('data', (d) => (log += d));
  proc.stderr?.on('data', (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${url}/health`)).ok) return { url, stop: () => proc.kill() };
    } catch {
      /* arrancando */
    }
    if (proc.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error(`ml-service no arrancó:\n${log}`);
}
