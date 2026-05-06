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

export type EventAttachment = {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
};

const isEventAttachment = (value: unknown): value is EventAttachment => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const attachment = value as Record<string, unknown>;

  return (
    typeof attachment.fileName === 'string' &&
    typeof attachment.fileType === 'string' &&
    typeof attachment.fileSize === 'number' &&
    typeof attachment.fileUrl === 'string'
  );
};

const parseEventAttachments = (value: string | null): EventAttachment[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    const attachments = Array.isArray(parsed) ? parsed : [parsed];
    return attachments.filter(isEventAttachment);
  } catch {
    return [];
  }
};

@Entity({ name: 'events' })
export class CalendarEventEntity {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column()
  title: string;

  @Column({ default: '' })
  description: string;

  @Column()
  date: string;

  @Column({ name: 'start_time' })
  startTime: string;

  @Column({ name: 'end_time' })
  endTime: string;

  @Column()
  status: string;

  @Column()
  category: string;

  @Column({ name: 'user_link', type: 'int' })
  userLink: number;

  @Column({ name: 'event_attendees', type: 'simple-json', nullable: true })
  attendees: string[];

  @Column({
    name: 'event_attachments',
    type: 'longtext',
    nullable: true,
    transformer: {
      to: (value: EventAttachment[] | null) =>
        value && value.length > 0 ? JSON.stringify(value) : null,
      from: (value: string | null) => parseEventAttachments(value),
    },
  })
  attachments: EventAttachment[];

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_link' })
  user: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
