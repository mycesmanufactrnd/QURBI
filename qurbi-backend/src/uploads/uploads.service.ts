import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, UploadedFile, UploadVisibility, UserRole } from '../entities';
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

    if (!isOwner && !isAdmin && !isOrderFarmer) {
      throw new NotFoundException('File not found');
    }
    return file;
  }
}
