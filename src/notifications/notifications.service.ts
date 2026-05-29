import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { CalendarEventEntity } from '../events/calendar-event.entity';
import { NotificationEntity } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly eventsRepository: Repository<CalendarEventEntity>,
  ) {}

  async findAll(userId: number) {
    const notifications = await this.notificationsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const unreadCount = notifications.filter(
      (notification) => !notification.isRead,
    ).length;
    const assignedWorkCount = await this.eventsRepository.count({
      where: {
        user: { id: userId },
        startDate: MoreThan(new Date()),
      },
    });

    return {
      notifications,
      unreadCount,
      assignedWorkCount,
    };
  }

  async create(userId: number, message: string) {
    const notification = this.notificationsRepository.create({
      userId,
      message,
    });
    return this.notificationsRepository.save(notification);
  }

  async markAsRead(userId: number, id: number) {
    const notification = await this.notificationsRepository.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    return this.notificationsRepository.save(notification);
  }

  async markAllAsRead(userId: number) {
    await this.notificationsRepository.update({ userId }, { isRead: true });
    return { success: true };
  }

  async remove(userId: number, id: number) {
    const notification = await this.notificationsRepository.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationsRepository.remove(notification);
    return { success: true };
  }

  async removeAll(userId: number) {
    const result = await this.notificationsRepository.delete({ userId });

    return {
      success: true,
      deletedCount: result.affected ?? 0,
    };
  }
}
