import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UploadVisibility } from './enums';
import { User } from './user.entity';

// One row per uploaded file, existing specifically so a *private* upload
// (verification IC/selfie/farm certificate) can be served through an
// authenticated, ownership-checked route instead of static file serving —
// see UploadsService. Public uploads (listing photos/videos) also get a row
// here for consistency, but are served statically and never looked up by id.
@Entity('uploaded_files')
export class UploadedFile extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  uploaderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaderId' })
  uploader: User;

  // Filename on disk under uploads/<public|private>/ — server-generated,
  // never the client's original filename (see LocalDiskStorageService).
  @Column({ type: 'varchar', length: 255 })
  storageKey: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'enum', enum: UploadVisibility })
  visibility: UploadVisibility;
}
