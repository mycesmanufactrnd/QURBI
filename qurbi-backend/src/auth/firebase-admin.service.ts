import { Injectable, UnauthorizedException } from '@nestjs/common';
import { App, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAdminService {
  private readonly app: App;

  constructor() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('FIREBASE_PROJECT_ID environment variable is required');
    }
    this.app = getApps().length ? getApp() : initializeApp({ projectId });
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    try {
      return await getAuth(this.app).verifyIdToken(idToken);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`Firebase token verification failed: ${reason}`);
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}
