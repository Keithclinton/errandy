import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Photos of listings, portfolios and profiles, kept as files in UPLOADS_DIR, one folder per
 * account: <UPLOADS_DIR>/<user id>/<random>.jpg, published at /uploads/<user id>/<random>.jpg.
 * In production UPLOADS_DIR is inside the website folder, so the web server sends them straight
 * from disk without involving the app (see deploy/cpanel/README.md). A photo's name is random and
 * never reused, so a published photo never changes and can be cached for good.
 *
 * Uploading only stores the photo. It's in use once a listing or profile refers to it; anything
 * nothing refers to is removed a day later (removeUnused, run nightly), and an account's folder
 * goes when the account is deleted.
 */
export const PHOTO_URL_PREFIX = "/uploads/";
export const MAX_PHOTO_BYTES = 1_000_000;
/** New photos one account may add in 24 hours: plenty for real use, and bounds what one account can fill the disk with. */
export const DAILY_PHOTO_LIMIT = 60;
/** An unused photo is kept this long, so one added to a form that isn't saved yet survives until it is. */
export const UNUSED_PHOTO_GRACE_MS = 24 * 60 * 60 * 1000;

const PHOTO_NAME = /^[A-Za-z0-9_-]{16}\.jpg$/;
const FOLDER_NAME = /^[A-Za-z0-9_-]+$/;
const PHOTO_URL = /^\/uploads\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]{16}\.jpg)$/;

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private root(): string {
    const configured = this.config.get<string>("UPLOADS_DIR");
    if (configured) return path.resolve(configured);
    // On the server the app's own folder is replaced by every deploy, so photos kept there would
    // disappear. Refuse rather than lose them.
    if (process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException("Photo uploads aren't set up yet.");
    }
    return path.resolve("uploads");
  }

  private folderOf(userId: string): string {
    if (!FOLDER_NAME.test(userId)) throw new InternalServerErrorException();
    return path.join(this.root(), userId);
  }

  /** Stores a photo sent as a JPEG data URL (the app shrinks and converts photos before sending). */
  async save(userId: string, dataUrl: string): Promise<{ url: string }> {
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match) throw new BadRequestException("Photos must be sent as JPG images.");
    const data = Buffer.from(match[1], "base64");
    if (data.length > MAX_PHOTO_BYTES) throw new BadRequestException("That photo is too large. Use one under 1 MB.");
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) {
      throw new BadRequestException("That photo isn't a valid image.");
    }

    const folder = this.folderOf(userId);
    await fs.mkdir(folder, { recursive: true, mode: 0o755 });
    if ((await this.addedSince(folder, Date.now() - 24 * 60 * 60 * 1000)) >= DAILY_PHOTO_LIMIT) {
      throw new HttpException("You've added a lot of photos today. Please try again tomorrow.", HttpStatus.TOO_MANY_REQUESTS);
    }

    const name = `${randomBytes(12).toString("base64url")}.jpg`;
    // Written under another name first, so the web server and backups never see half a photo.
    const partial = path.join(folder, `.${name}.part`);
    await fs.writeFile(partial, data, { mode: 0o644 });
    await fs.rename(partial, path.join(folder, name));
    return { url: `${PHOTO_URL_PREFIX}${userId}/${name}` };
  }

  private async addedSince(folder: string, since: number): Promise<number> {
    let count = 0;
    for (const name of await fs.readdir(folder)) {
      if (!PHOTO_NAME.test(name)) continue;
      const stat = await fs.stat(path.join(folder, name)).catch(() => null);
      if (stat && stat.mtimeMs > since) count += 1;
    }
    return count;
  }

  /**
   * Checks the photos a listing or profile is being saved with. Each must already be on it
   * (`current`), or be one this account uploaded that's still there: no addresses elsewhere, and
   * no one else's photos.
   */
  async assertUsable(userId: string, urls: string[], current: (string | null | undefined)[] = []): Promise<void> {
    const kept = new Set(current.filter(Boolean));
    for (const url of urls) {
      if (kept.has(url)) continue;
      const match = PHOTO_URL.exec(url);
      if (!match || match[1] !== userId) {
        throw new BadRequestException("Add photos with the Add photo button.");
      }
      const exists = await fs
        .stat(path.join(this.folderOf(userId), match[2]))
        .then((stat) => stat.isFile())
        .catch(() => false);
      if (!exists) {
        throw new BadRequestException("One of the photos is no longer available. Remove it and add it again.");
      }
    }
  }

  /** Deletes all of an account's photos. Called once the account itself is deleted. */
  async removeAccountPhotos(userId: string): Promise<void> {
    try {
      await fs.rm(this.folderOf(userId), { recursive: true, force: true });
    } catch (err) {
      // The account is gone either way; the nightly cleanup removes what's left of the folder.
      this.logger.error(`Couldn't delete the photos of deleted account ${userId}: ${err}`);
    }
  }

  /**
   * Deletes photos that no listing or profile uses and that are older than a day, and folders
   * left empty. Stops without deleting anything if it would remove more than half of all photos
   * (more than 20): that looks like the app reading the wrong or an empty database, not like
   * people's edits.
   */
  async removeUnused(): Promise<{ removed: number; kept: number }> {
    const root = this.root();
    const folders = await fs.readdir(root).catch((err) => {
      if (err.code === "ENOENT") return [] as string[];
      throw err;
    });

    const inUse = new Set<string>();
    const listings = await this.prisma.listing.findMany({ select: { imageUrls: true } });
    const users = await this.prisma.user.findMany({ select: { avatarUrl: true, portfolioUrls: true } });
    for (const listing of listings) listing.imageUrls.forEach((url) => inUse.add(url));
    for (const user of users) {
      if (user.avatarUrl) inUse.add(user.avatarUrl);
      user.portfolioUrls.forEach((url) => inUse.add(url));
    }

    const cutoff = Date.now() - UNUSED_PHOTO_GRACE_MS;
    const unused: string[] = [];
    const leftovers: string[] = []; // half-written uploads
    let total = 0;
    for (const folder of folders) {
      if (!FOLDER_NAME.test(folder)) continue;
      const dir = path.join(root, folder);
      const names = await fs.readdir(dir).catch(() => [] as string[]);
      for (const name of names) {
        const file = path.join(dir, name);
        const stat = await fs.stat(file).catch(() => null);
        if (!stat?.isFile()) continue;
        if (PHOTO_NAME.test(name)) {
          total += 1;
          if (stat.mtimeMs < cutoff && !inUse.has(`${PHOTO_URL_PREFIX}${folder}/${name}`)) unused.push(file);
        } else if (name.endsWith(".part") && stat.mtimeMs < cutoff) {
          leftovers.push(file);
        }
      }
    }

    if (unused.length > 20 && unused.length > total / 2) {
      throw new InternalServerErrorException(
        `Photo cleanup stopped: it would delete ${unused.length} of ${total} photos. Check the app is using the right database.`,
      );
    }

    for (const file of [...unused, ...leftovers]) await fs.rm(file, { force: true });
    for (const folder of folders) {
      if (!FOLDER_NAME.test(folder)) continue;
      // Only removes a folder that's empty.
      await fs.rmdir(path.join(root, folder)).catch(() => undefined);
    }
    if (unused.length) this.logger.log(`Removed ${unused.length} unused photos`);
    return { removed: unused.length, kept: total - unused.length };
  }
}
