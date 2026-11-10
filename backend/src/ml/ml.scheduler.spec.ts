import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { TenantContext } from '../tenancy/tenant-context';
import { MlScheduler } from './ml.scheduler';
import { MlService } from './ml.service';

/** Reentrenamiento nocturno: una empresa a la vez, cada una dentro de SU contexto (RLS). */
function armar(empresas: number[], falla: number[] = []) {
  const vistos: { idEmpresa: number; contexto: string }[] = [];
  let contextoListado = '';
  const db = {
    query: jest.fn(async () => {
      contextoListado = TenantContext.databaseSetting() === '' ? 'plataforma' : 'empresa';
      return empresas.map((id) => ({ id }));
    }),
  };
  const ml = {
    entrenar: jest.fn(async (idEmpresa: number) => {
      vistos.push({ idEmpresa, contexto: TenantContext.databaseSetting() });
      if (falla.includes(idEmpresa)) throw new Error('ml-service caído');
      return {};
    }),
  };
  const registry = { addCronJob: jest.fn(), doesExist: jest.fn(() => false), deleteCronJob: jest.fn() };
  const config = { get: (k: string) => ({ ML_CRON: 'off' } as Record<string, string>)[k] };
  const s = new MlScheduler(ml as any, db as any, registry as any, config as any);
  return { s, ml, vistos, registry, listado: () => contextoListado };
}

describe('MlScheduler', () => {
  it('lista las empresas en modo plataforma y entrena cada una con su propio id de empresa', async () => {
    const { s, vistos, listado } = armar([2, 7, 9]);
    const r = await s.entrenarTodas();
    expect(listado()).toBe('plataforma');
    expect(vistos).toEqual([
      { idEmpresa: 2, contexto: '2' },
      { idEmpresa: 7, contexto: '7' },
      { idEmpresa: 9, contexto: '9' },
    ]);
    expect(r).toEqual({ omitido: false, ok: [2, 7, 9], fallidas: [] });
  });

  it('si una empresa falla, sigue con las demás', async () => {
    const { s } = armar([2, 7, 9], [7]);
    expect(await s.entrenarTodas()).toEqual({ omitido: false, ok: [2, 9], fallidas: [7] });
  });

  it('no arranca dos corridas a la vez', async () => {
    const { s } = armar([2]);
    const [a, b] = await Promise.all([s.entrenarTodas(), s.entrenarTodas()]);
    expect([a.omitido, b.omitido].sort()).toEqual([false, true]);
  });

  it('con ML_CRON=off no programa nada', () => {
    const { s, registry } = armar([]);
    s.onModuleInit();
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });
});

describe('MlService.entrenar (bloqueo por empresa)', () => {
  it('rechaza un segundo entrenamiento simultáneo de la misma empresa (409)', async () => {
    let soltar!: () => void;
    const lento = new Promise<void>((r) => (soltar = r));
    const db = { query: jest.fn(async () => { await lento; return [{ idProducto: 1, nombre: 'P', categoria: null, precio: '10', idSucursal: 1 }]; }) };
    const client = { post: jest.fn(async () => ({ ok: true })), get: jest.fn() };
    const config = { get: () => undefined };
    const service = new MlService(client as any, db as any, config as any);
    const primero = service.entrenar(5);
    await expect(service.entrenar(5)).rejects.toBeInstanceOf(ConflictException);
    expect(service.estaEntrenando(5)).toBe(true);
    soltar();
    await primero;
    expect(service.estaEntrenando(5)).toBe(false);
  });
});
