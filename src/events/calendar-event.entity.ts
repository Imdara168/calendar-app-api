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
      to: (
        value:
          | {
              fileName: string;
              fileType: string;
              fileSize: number;
              fileUrl: string;
            }[]
          | null,
      ) => (value && value.length > 0 ? JSON.stringify(value) : null),
      from: (value: string | null) => {
        if (!value) {
          return [];
        }

        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      },
    },
  })
  attachments: {
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
  }[];

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_link' })
  user: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
