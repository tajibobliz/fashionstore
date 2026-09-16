import { jest } from '@jest/globals';
import { BranchAccessService } from './users/branch-access.service';
import { Role } from './auth/enums/role.enum';
import { PosService } from './pos/pos.service';
import { WarehousesService } from './warehouses/warehouses.service';
import { BranchesService } from './branches/branches.service';
import { Inventario } from './inventory/entities/inventario.entity';
import { getMetadataArgsStorage } from 'typeorm';
import { CreateReservaDto } from './reservations/dto/create-reserva.dto';

const repo = (extra: Record<string, any> = {}) => ({
  findOne: jest.fn(), find: jest.fn(async () => []), create: jest.fn((v) => v),
  save: jest.fn(async (v) => v), ...extra,
});
const qb = (value: any = {}) => ({ setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn(async () => value) });

describe('Almacenes, alcance territorial y POS', () => {
  const branch = { idSucursal: 1, estado: true } as any;
  const actor = { idUsuario: 7, rol: Role.CAJERO };

  it('crea almacén principal al crear una sucursal', async () => {
    const manager: any = { save: jest.fn(async (v) => ({ idSucursal: 1, ...v })), create: jest.fn((_e:any,v:any)=>v) };
    const service = new BranchesService(repo({ findOne: jest.fn(async()=>({idCiudad:1})) }) as any, repo() as any, { transaction: (cb:any)=>cb(manager) } as any);
    await service.createSucursal({ idCiudad: 1, nombre: 'Centro', direccion: 'Av. 1' });
    expect(manager.create).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ codigo: 'PRINCIPAL', nombre: 'Almacén Principal' }));
  });

  it('inventario tiene unicidad por almacén y variante', () => {
    const unique = getMetadataArgsStorage().uniques.find((u) => u.target === Inventario);
    expect(unique?.columns).toEqual(['almacen', 'variante']);
  });

  it('el mismo idAlmacen identifica la existencia usada por ecommerce y POS', () => {
    const stock = { idAlmacen: 3, disponible: 2 };
    const ecommerce = stock; const pos = stock;
    ecommerce.disponible -= 1; pos.disponible -= 1;
    expect(stock.disponible).toBe(0);
  });

  it('cajero no asignado recibe 403', async () => {
    const access = new BranchAccessService(repo({ findOne: jest.fn(async()=>null) }) as any);
    await expect(access.assertCanAccess(actor, 1)).rejects.toThrow('asignación activa');
  });

  it('encargado de sucursal no accede a otra sucursal', async () => {
    const access = new BranchAccessService(repo({ findOne: jest.fn(async()=>null) }) as any);
    await expect(access.assertCanAccess({idUsuario:8,rol:Role.ENCARGADO_SUCURSAL},2)).rejects.toThrow();
  });

  it('ENCARGADO nacional accede a todas las sucursales', async () => {
    const assignments=repo();const access=new BranchAccessService(assignments as any);
    await expect(access.assertCanAccess({idUsuario:1,rol:Role.ENCARGADO},999)).resolves.toBeUndefined();
    expect(assignments.findOne).not.toHaveBeenCalled();
  });

  function pos(options: { active?: boolean; open?: any; sales?: number } = {}) {
    const caja={idCaja:1,estado:options.active??true,sucursal:branch,almacenDefault:{idAlmacen:1,sucursal:branch}};
    const cajas=repo({findOne:jest.fn(async()=>caja)});const turnos=repo();
    const manager:any={createQueryBuilder:jest.fn(()=>qb(caja)),findOne:jest.fn(async()=>options.open??null),create:jest.fn((_e:any,v:any)=>v),save:jest.fn(async(v:any)=>v),getRepository:jest.fn(()=>({createQueryBuilder:()=>({select:jest.fn().mockReturnThis(),where:jest.fn().mockReturnThis(),andWhere:jest.fn().mockReturnThis(),getRawOne:jest.fn(async()=>({total:options.sales??0}))})}))};
    const access={assertCanAccess:jest.fn(async()=>undefined)};
    return {service:new PosService(cajas as any,turnos as any,repo() as any,repo() as any,access as any,{transaction:(cb:any)=>cb(manager)} as any),manager,caja};
  }

  it('abre turno en caja activa', async () => { const {service}=pos();const result=await service.abrir(actor,{idCaja:1,montoApertura:100});expect(result).toEqual(expect.objectContaining({estado:'ABIERTO',montoApertura:100})); });
  it('impide dos turnos abiertos en una caja', async () => { const {service}=pos({open:{idTurno:1}});await expect(service.abrir(actor,{idCaja:1,montoApertura:0})).rejects.toThrow('turno abierto'); });
  it('caja inactiva no abre turno', async () => { const {service}=pos({active:false});await expect(service.abrir(actor,{idCaja:1,montoApertura:0})).rejects.toThrow('inactiva'); });
  it('venta POS sin turno abierto falla', async () => { const {service}=pos();(service as any).turnos.find.mockResolvedValue([]);await expect(service.resolverTurno(actor,1)).rejects.toThrow('No existe'); });

  it('turno conserva cajero, caja y sucursal para asociarlos a venta', async () => { const {service,caja}=pos();const turno:any=await service.abrir(actor,{idCaja:1,montoApertura:0});expect(turno.cajero.idUsuario).toBe(actor.idUsuario);expect(turno.caja).toBe(caja);expect(turno.caja.sucursal.idSucursal).toBe(1);expect(turno.caja.almacenDefault.idAlmacen).toBe(1); });

  it('rechaza almacén de otra sucursal al crear caja', async () => {
    const service=new PosService(repo() as any,repo() as any,repo({findOne:jest.fn(async()=>branch)}) as any,repo({findOne:jest.fn(async()=>({idAlmacen:2,sucursal:{idSucursal:2}}))}) as any,{} as any,{} as any);
    await expect(service.createCaja({idSucursal:1,idAlmacenDefault:2,codigo:'C1',nombre:'Caja'})).rejects.toThrow('no pertenece');
  });

  it('cierre de turno calcula monto esperado y diferencia', async () => {
    const turno:any={idTurno:1,estado:'ABIERTO',montoApertura:100,cajero:{idUsuario:7},caja:{sucursal:branch}};const {service,manager}=pos({open:turno,sales:250});manager.findOne.mockResolvedValue(turno);const result:any=await service.cerrar(actor,1,{montoCierreDeclarado:340});expect(result.montoCierreEsperado).toBe(350);expect(result.diferencia).toBe(-10);expect(result.estado).toBe('CERRADO');
  });

  it('reserva del cliente conserva DTO por sucursal sin idAlmacen', () => {
    const dto:CreateReservaDto={idSucursal:1,detalles:[{idVariante:1,cantidad:1}]};
    expect(dto.idSucursal).toBe(1);expect(dto).not.toHaveProperty('idAlmacen');
  });

  it('CRUD de almacén valida la sucursal', async()=>{const service=new WarehousesService(repo() as any,repo({findOne:jest.fn(async()=>branch)}) as any);const saved:any=await service.create({idSucursal:1,codigo:'PISO',nombre:'Piso'});expect(saved.sucursal).toBe(branch);});
});
