import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../users/user.entity';

@Entity({ name: 'documents' })
export class DocumentEntity {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'folder_name', type: 'varchar', length: 255 })
  folderName: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'uploaded_file', type: 'longtext' })
  uploadedFile: string;

  @Column({ name: 'date', type: 'varchar', length: 10, nullable: true })
  date: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'Pending' })
  status: string;

  @Column({ name: 'assigned_to_id', type: 'int', nullable: true })
  assignedToId: number | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: UserEntity | null;

  @Column({ name: 'workflow_owner_id', type: 'int', nullable: true })
  workflowOwnerId: number | null;

  @Column({ name: 'viewer_user_ids', type: 'simple-array', nullable: true })
  viewerUserIds: string[] | null;

  @Column({ name: 'user_link', type: 'int', nullable: true })
  userLink: number | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_link' })
  user: UserEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
