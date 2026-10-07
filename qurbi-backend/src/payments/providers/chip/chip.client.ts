import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChipPurchase, CreateChipPurchaseInput } from './chip.types';

@Injectable()
export class ChipClient {
  constructor(private readonly config: ConfigService) {}

  createPurchase(input: CreateChipPurchaseInput): Promise<ChipPurchase> {
    return this.request<ChipPurchase>('purchases/', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  retrievePurchase(id: string): Promise<ChipPurchase> {
    return this.request<ChipPurchase>(`purchases/${encodeURIComponent(id)}/`, {
      method: 'GET',
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const secretKey = this.config.get<string>('CHIP_SECRET_KEY')?.trim();
    const baseUrl = (this.config.get<string>('CHIP_API_URL') || 'https://gate.chip-in.asia/api/v1')
      .replace(/\/+$/, '');
    if (!secretKey) {
      throw new ServiceUnavailableException('CHIP is not configured on the server');
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Unable to reach CHIP payment service');
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;
      const message = extractChipError(body) || `CHIP returned HTTP ${response.status}`;
      throw new BadGatewayException(message);
    }
    return response.json() as Promise<T>;
  }
}

function extractChipError(body: Record<string, unknown> | null): string | null {
  if (!body) return null;
  const all = body.__all__;
  if (all && typeof all === 'object' && 'message' in all) {
    return String((all as { message: unknown }).message);
  }
  return null;
}
