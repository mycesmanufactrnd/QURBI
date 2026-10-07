import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createVerify } from 'crypto';

@Injectable()
export class ChipSignatureService {
  constructor(private readonly config: ConfigService) {}

  verify(rawBody: Buffer | undefined, signature: string | undefined): void {
    if (!rawBody?.length || !signature) {
      throw new UnauthorizedException('Missing CHIP webhook signature');
    }
    const encodedKey = this.config.get<string>('CHIP_WEBHOOK_PUBLIC_KEY_BASE64')?.trim();
    if (!encodedKey) {
      throw new UnauthorizedException('CHIP webhook verification is not configured');
    }

    let publicKey: string;
    try {
      publicKey = Buffer.from(encodedKey, 'base64').toString('utf8');
      const verifier = createVerify('RSA-SHA256');
      verifier.update(rawBody);
      verifier.end();
      if (!verifier.verify(publicKey, signature, 'base64')) {
        throw new UnauthorizedException('Invalid CHIP webhook signature');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid CHIP webhook signature');
    }
  }
}
