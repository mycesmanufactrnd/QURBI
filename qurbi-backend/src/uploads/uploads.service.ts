import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  Order,
  OrderTrackingEvent,
  UploadedFile,
  UploadVisibility,
  UserRole,
} from '../entities';
import { getPrivateUploadsDir } from './storage/local-disk-storage.service';
import { StorageService } from './storage/storage.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

type UploadCategory = 'image' | 'video' | 'document';

// Extension is derived from the validated mimetype, never from the client's
// original filename — see LocalDiskStorageService for why that matters.
const ALLOWED_MIME_TYPES: Record<
  string,
  { category: UploadCategory; extension: string }
> = {
  'image/jpeg': { category: 'image', extension: '.jpg' },
  'image/png': { category: 'image', extension: '.png' },
  'image/webp': { category: 'image', extension: '.webp' },
  'image/gif': { category: 'image', extension: '.gif' },
  'video/mp4': { category: 'video', extension: '.mp4' },
  'video/quicktime': { category: 'video', extension: '.mov' },
  'video/webm': { category: 'video', extension: '.webm' },
  'application/pdf': { category: 'document', extension: '.pdf' },
};

const MAX_BYTES_BY_CATEGORY: Record<UploadCategory, number> = {
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024, // 50MB
};

// Hard ceiling for the multipart parser itself (see UploadsController) — the
// largest of the per-category caps above. Stops an oversized stream from
// being buffered into memory at all; the per-category check below is what
// actually enforces the tighter image/document limits.
export const MAX_UPLOAD_BYTES = MAX_BYTES_BY_CATEGORY.video;

@Injectable()
export class UploadsService {
  constructor(
    private readonly storage: StorageService,
    @InjectRepository(UploadedFile)
    private readonly uploadedFileRepository: Repository<UploadedFile>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderTrackingEvent)
    private readonly trackingEventRepository: Repository<OrderTrackingEvent>,
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
    uploaderId: string,
    visibilityInput: unknown,
  ): Promise<{ fileUrl: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const allowed = ALLOWED_MIME_TYPES[file.mimetype];
    if (!allowed) {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type: ${file.mimetype}`,
      );
    }

    const maxBytes = MAX_BYTES_BY_CATEGORY[allowed.category];
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `${allowed.category} uploads are limited to ${Math.round(maxBytes / (1024 * 1024))}MB`,
      );
    }

    // Fail closed: anything other than the exact literal "public" is private,
    // including a missing/malformed/unexpected value.
    const visibility =
      visibilityInput === 'public'
        ? UploadVisibility.PUBLIC
        : UploadVisibility.PRIVATE;

    const stored = await this.storage.save(
      file.buffer,
      allowed.extension,
      visibility,
    );
    const record = await this.uploadedFileRepository.save(
      this.uploadedFileRepository.create({
        uploaderId,
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        visibility,
      }),
    );

    return {
      fileUrl:
        visibility === UploadVisibility.PUBLIC
          ? stored.url
          : `/uploads/private/${record.id}`,
    };
  }

  // Private uploads stay private. Besides the uploader and admins, a farmer
  // may read a buyer's received-proof image only when that exact file is
  // attached to one of the farmer's orders.
  async getPrivateFileForViewer(
    id: string,
    viewer: AuthenticatedUser,
  ): Promise<UploadedFile> {
    const file = await this.uploadedFileRepository.findOne({ where: { id } });
    if (!file || file.visibility !== UploadVisibility.PRIVATE) {
      throw new NotFoundException('File not found');
    }

    const isOwner = file.uploaderId === viewer.id;
    const isAdmin = viewer.role === UserRole.ADMIN;
    let isOrderFarmer = false;

    // Proof photos on an order's timeline are visible to everyone party to
    // that order: its buyer, its farmer and the courier assigned to it.
    const isOrderParty =
      !isOwner && !isAdmin && (await this.isOrderParty(file.id, viewer.id));

    if (!isOwner && !isAdmin && viewer.role === UserRole.FARMER) {
      const proofUrl = `/uploads/private/${file.id}`;
      const farmerOrders = await this.orderRepository.find({
        where: { farmerId: viewer.id },
        select: { id: true, receivedProofImages: true },
      });
      isOrderFarmer = farmerOrders.some((order) =>
        (order.receivedProofImages || []).includes(proofUrl),
      );
    }

    if (!isOwner && !isAdmin && !isOrderFarmer && !isOrderParty) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  // True when this file is attached to a tracking event of an order the
  // viewer is the buyer, farmer or assigned courier of.
  private async isOrderParty(
    fileId: string,
    viewerId: string,
  ): Promise<boolean> {
    const count = await this.trackingEventRepository
      .createQueryBuilder('event')
      .innerJoin('event.order', 'o')
      .where('JSON_CONTAINS(event.images, :url)', {
        url: JSON.stringify(`/uploads/private/${fileId}`),
      })
      .andWhere(
        '(o.buyerId = :viewerId OR o.farmerId = :viewerId OR EXISTS (' +
          'SELECT 1 FROM delivery_assignments da ' +
          'WHERE da.orderId = o.id AND da.courierUserId = :viewerId))',
        { viewerId },
      )
      .getCount();
    return count > 0;
  }

  // For the courier proof flow: resolves a private upload URL back to the
  // stored bytes, but only if the caller uploaded it themselves and it is an
  // image. The server hashes what it actually stored rather than trusting a
  // client-supplied hash.
  async readOwnedPrivateImage(
    url: string,
    uploaderId: string,
  ): Promise<{ id: string; url: string; sha256: string }> {
    const match = /^\/uploads\/private\/([0-9a-f-]{36})$/i.exec(url);
    if (!match) {
      throw new BadRequestException('Photos must be private uploads');
    }
    const file = await this.uploadedFileRepository.findOne({
      where: { id: match[1] },
    });
    if (
      !file ||
      file.visibility !== UploadVisibility.PRIVATE ||
      file.uploaderId !== uploaderId ||
      !file.mimeType.startsWith('image/')
    ) {
      throw new BadRequestException(
        'Each photo must be an image you uploaded yourself',
      );
    }
    const buffer = await readFile(
      join(getPrivateUploadsDir(), file.storageKey),
    );
    return {
      id: file.id,
      url,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    };
  }
}
