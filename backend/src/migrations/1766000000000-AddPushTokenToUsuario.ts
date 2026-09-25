import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushTokenToUsuario1766000000000 implements MigrationInterface {
  name = 'AddPushTokenToUsuario1766000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE usuario ADD COLUMN IF NOT EXISTS push_token varchar(255)');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE usuario DROP COLUMN IF EXISTS push_token');
  }
}
