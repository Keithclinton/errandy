import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationType, UserStatus } from "@prisma/client";

interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(params: NewNotification) {
    return this.prisma.notification.create({ data: params });
  }

  /** Sends the same notification to every active admin, except `excludeUserId` if given. */
  async notifyAdmins(params: Omit<NewNotification, "userId">, excludeUserId?: string) {
    const admins = await this.prisma.user.findMany({
      where: { isAdmin: true, status: UserStatus.active, ...(excludeUserId && { id: { not: excludeUserId } }) },
      select: { id: true },
    });
    if (admins.length === 0) return;
    await this.prisma.notification.createMany({ data: admins.map((admin) => ({ ...params, userId: admin.id })) });
  }

  async listForUser(userId: string, page = 1, limit = 20) {
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, total, page, limit, unreadCount };
  }

  async unreadCount(userId: string) {
    return { unreadCount: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException("Notification not found");
    if (notification.userId !== userId) throw new ForbiddenException();
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}
