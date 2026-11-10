/**
 * Crea la Empresa B de demostración y el SUPER_ADMIN de la plataforma.
 *
 *   npm run seed:demo
 *
 * Variables (backend/.env):
 *   DEMO_PASSWORD            contraseña de los usuarios demo (por defecto: demo1234)
 *   PLATFORM_ADMIN_EMAIL     email del SUPER_ADMIN (por defecto: superadmin@fashionstore.saas)
 *   PLATFORM_ADMIN_PASSWORD  contraseña del SUPER_ADMIN (por defecto: DEMO_PASSWORD)
 *
 * No corre en producción salvo con --force (son datos de prueba con contraseñas conocidas).
 */
import dataSource from '../../database/data-source';
import {
  seedDemoTenant,
  seedPlatformAdmin,
  DEMO_SLUG,
} from './demo-tenant.seed';

async function main() {
  if (
    process.env.NODE_ENV === 'production' &&
    !process.argv.includes('--force')
  ) {
    throw new Error(
      'seed:demo no se ejecuta en producción (usa --force si de verdad quieres datos demo).',
    );
  }
  const password = process.env.DEMO_PASSWORD || 'demo1234';
  const adminEmail =
    process.env.PLATFORM_ADMIN_EMAIL || 'superadmin@fashionstore.saas';
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD || password;

  await dataSource.initialize();
  try {
    const demo = await seedDemoTenant(dataSource, password);
    const admin = await seedPlatformAdmin(
      dataSource,
      adminEmail,
      adminPassword,
    );
    console.log(
      demo.creada
        ? `\nEmpresa "${DEMO_SLUG}" creada (id ${demo.idEmpresa}).`
        : `\nEmpresa "${DEMO_SLUG}" ya existía (id ${demo.idEmpresa}).`,
    );
    console.log(
      admin
        ? `SUPER_ADMIN ${adminEmail} creado.`
        : `SUPER_ADMIN ${adminEmail} ya existía.`,
    );
    console.log(
      '\nCredenciales de prueba (login con "empresa": "%s"):',
      DEMO_SLUG,
    );
    console.table(
      demo.usuarios.map((u) => ({
        rol: u.rol,
        email: u.email,
        password: demo.creada ? password : '(la que se usó al crearla)',
      })),
    );
    console.log('SUPER_ADMIN (login sin "empresa"):', adminEmail);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
