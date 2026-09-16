export function validateEnvironment(config: Record<string, unknown>) {
  const production = config.NODE_ENV === 'production';
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
  if (production) required.push('CORS_ORIGINS', 'ADMIN_EMAIL', 'ADMIN_PASSWORD');
  const missing = required.filter((key) => config[key] === undefined || String(config[key]).trim() === '');
  if (missing.length) throw new Error(`Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
  const port = Number(config.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT debe ser un puerto válido');
  return config;
}

export function databaseSsl(value: unknown) {
  return String(value).toLowerCase() === 'true' ? { rejectUnauthorized: true } : false;
}
