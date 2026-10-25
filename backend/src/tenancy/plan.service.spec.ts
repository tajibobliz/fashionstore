import { jest } from '@jest/globals';
import { PlanService, sumarMeses } from './plan.service';

const empresa: any = { idEmpresa: 7, nombre: 'Demo', estado: 'ACTIVA' };
const basico: any = {
  nombre: 'Básico',
  maxSucursales: 2,
  maxUsuarios: 5,
  features: { aiReports: false, ml: false },
};
const susc = (plan: any, fechaVencimiento: string): any => ({
  plan,
  fechaVencimiento,
  fechaInicio: '2026-01-01',
  estado: 'ACTIVA',
});

describe('PlanService.evaluar (vigencia)', () => {
  it('vigente hasta el día de vencimiento inclusive', () => {
    const e = PlanService.evaluar(
      empresa,
      susc(basico, '2026-10-25'),
      '2026-10-25',
    );
    expect(e).toMatchObject({
      vigente: true,
      estado: 'ACTIVA',
      diasRestantes: 0,
    });
  });
  it('vencida al día siguiente', () => {
    expect(
      PlanService.evaluar(empresa, susc(basico, '2026-10-24'), '2026-10-25'),
    ).toMatchObject({ vigente: false, estado: 'VENCIDA' });
  });
  it('sin suscripción no es vigente', () => {
    expect(PlanService.evaluar(empresa, null, '2026-10-25')).toMatchObject({
      vigente: false,
      estado: 'SIN_SUSCRIPCION',
    });
  });
  it('suma meses a una fecha', () => {
    expect(sumarMeses('2026-10-25', 1)).toBe('2026-11-25');
    expect(sumarMeses('2026-10-25', 12)).toBe('2027-10-25');
  });
});

describe('PlanService (límites y funcionalidades)', () => {
  function service(
    plan: any,
    uso: { sucursales: number; usuarios: number },
    estadoEmpresa = 'ACTIVA',
    vence = '2999-01-01',
  ) {
    const s = new PlanService({} as any);
    jest
      .spyOn(s, 'estado')
      .mockResolvedValue(
        PlanService.evaluar(
          { ...empresa, estado: estadoEmpresa },
          susc(plan, vence),
          '2026-10-25',
        ),
      );
    jest.spyOn(s, 'uso').mockResolvedValue(uso);
    return s;
  }

  it('permite crear mientras haya cupo', async () => {
    await expect(
      service(basico, { sucursales: 1, usuarios: 0 }).asegurarCupo(
        7,
        'sucursales',
      ),
    ).resolves.toBeUndefined();
  });
  it('bloquea al llegar al límite de sucursales', async () => {
    await expect(
      service(basico, { sucursales: 2, usuarios: 0 }).asegurarCupo(
        7,
        'sucursales',
      ),
    ).rejects.toMatchObject({
      response: { code: 'LIMITE_DEL_PLAN', maximo: 2, usados: 2 },
    });
  });
  it('bloquea al llegar al límite de empleados', async () => {
    await expect(
      service(basico, { sucursales: 0, usuarios: 5 }).asegurarCupo(
        7,
        'usuarios',
      ),
    ).rejects.toMatchObject({
      response: { code: 'LIMITE_DEL_PLAN', recurso: 'usuarios' },
    });
  });
  it('NULL en el plan significa ilimitado', async () => {
    const empresarial = { ...basico, maxSucursales: null };
    await expect(
      service(empresarial, { sucursales: 500, usuarios: 0 }).asegurarCupo(
        7,
        'sucursales',
      ),
    ).resolves.toBeUndefined();
  });
  it('el plan Básico no incluye reportes con IA', async () => {
    await expect(
      service(basico, { sucursales: 0, usuarios: 0 }).asegurarFuncionalidad(
        7,
        'aiReports',
      ),
    ).rejects.toMatchObject({
      response: { code: 'PLAN_SIN_FUNCIONALIDAD' },
    });
  });
  it('un plan con aiReports sí lo permite', async () => {
    const pro = { ...basico, features: { aiReports: true, ml: false } };
    await expect(
      service(pro, { sucursales: 0, usuarios: 0 }).asegurarFuncionalidad(
        7,
        'aiReports',
      ),
    ).resolves.toBeUndefined();
  });
  it('con la suscripción vencida no se puede operar', async () => {
    await expect(
      service(
        basico,
        { sucursales: 0, usuarios: 0 },
        'ACTIVA',
        '2026-10-24',
      ).asegurarVigente(7),
    ).rejects.toMatchObject({
      response: { code: 'SUSCRIPCION_VENCIDA' },
    });
  });
  it('una empresa suspendida no puede operar', async () => {
    await expect(
      service(
        basico,
        { sucursales: 0, usuarios: 0 },
        'SUSPENDIDA',
      ).asegurarVigente(7),
    ).rejects.toMatchObject({
      response: { code: 'EMPRESA_SUSPENDIDA' },
    });
  });
});
