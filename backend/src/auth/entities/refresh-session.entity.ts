import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('refresh_session')
export class RefreshSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'token_hash', length: 64, unique: true, select: false })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
