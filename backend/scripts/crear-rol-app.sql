-- Rol de aplicación para DESARROLLO LOCAL (FashionStore SaaS).
--
-- ¿Por qué? PostgreSQL nunca aplica Row Level Security (RLS) a un SUPERUSUARIO.
-- Si el backend se conecta como "postgres" (superusuario), el aislamiento por empresa
-- no se aplica en la BD. Con este rol normal sí se aplica, igual que en producción.
--
-- Uso (como postgres, dentro de la BD fashionstore):
--   psql -U postgres -d fashionstore -f scripts/crear-rol-app.sql
-- Luego en backend/.env:
--   DB_USER=fashion_app
--   DB_PASSWORD=fashion_app_local
--
-- Las migraciones conviene seguir corriéndolas con el usuario dueño (postgres):
--   DB_USER=postgres npm run migration:run

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fashion_app') THEN
    CREATE ROLE fashion_app LOGIN PASSWORD 'fashion_app_local' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

GRANT CONNECT ON DATABASE fashionstore TO fashion_app;
GRANT USAGE ON SCHEMA public TO fashion_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fashion_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO fashion_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO fashion_app;
-- Tablas y secuencias que creen migraciones futuras (como postgres):
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fashion_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO fashion_app;
