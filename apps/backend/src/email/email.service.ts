import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { PrismaService } from "../prisma/prisma.service";

const DIGEST_UNREAD_AFTER_HOURS = 2;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromEmail = this.config.get<string>("RESEND_FROM_EMAIL") ?? "notifications@errandy.app";
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — skipping email "${subject}" to ${to}`);
      return;
    }
    await this.resend.emails.send({ from: this.fromEmail, to, subject, html });
  }

  async sendPasswordReset(to: string, resetToken: string) {
    const frontendUrl = this.config.get<string>("CORS_ORIGIN") ?? "http://localhost:5173";
    const resetUrl = new URL("/reset-password", frontendUrl);
    resetUrl.searchParams.set("token", resetToken);
    await this.send(
      to,
      "Reset your Errandy password",
      `<p><a href="${resetUrl.toString()}">Reset your password</a></p>
       <p>Or use this token directly: <code>${resetToken}</code></p>
       <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
    );
  }

  async sendBidReceived(to: string, listingTitle: string, amount: string) {
    await this.send(
      to,
      "You received a new bid on Errandy",
      `<p>You received a bid of <strong>${amount}</strong> on "${listingTitle}".</p>`,
    );
  }

  async sendBidAccepted(to: string, listingTitle: string) {
    await this.send(
      to,
      "Your bid was accepted on Errandy",
      `<p>Your bid on "${listingTitle}" was accepted. Open the chat to arrange the details.</p>`,
    );
  }

  async sendUnreadMessagesDigest(to: string, unreadCount: number) {
    await this.send(
      to,
      "You have unread messages on Errandy",
      `<p>You have ${unreadCount} unread message(s) waiting for you.</p>`,
    );
  }

  async runUnreadMessagesDigest(): Promise<{ emailed: number }> {
    const cutoff = new Date(Date.now() - DIGEST_UNREAD_AFTER_HOURS * 60 * 60 * 1000);
    const staleUnread = await this.prisma.message.findMany({
      where: { readAt: null, createdAt: { lt: cutoff } },
      include: { conversation: true },
    });

    const unreadByRecipient = new Map<string, number>();
    for (const message of staleUnread) {
      const recipientId = message.conversation.participantIds.find((id) => id !== message.senderId);
      if (!recipientId) continue;
      unreadByRecipient.set(recipientId, (unreadByRecipient.get(recipientId) ?? 0) + 1);
    }

    let emailed = 0;
    for (const [recipientId, count] of unreadByRecipient) {
      const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
      if (!recipient) continue;
      await this.sendUnreadMessagesDigest(recipient.email, count);
      emailed += 1;
    }
    return { emailed };
  }
}
