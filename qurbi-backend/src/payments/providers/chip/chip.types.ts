export interface ChipPurchase {
  id: string;
  status: string;
  is_test: boolean;
  checkout_url: string | null;
  event_type?: string;
  client?: {
    email?: string;
    full_name?: string;
    phone?: string;
  };
  purchase: {
    currency: string;
    total: number;
    metadata?: Record<string, unknown>;
    products?: Array<{
      name: string;
      price: number;
      quantity?: string;
    }>;
  };
}

export interface CreateChipPurchaseInput {
  brand_id: string;
  reference: string;
  client: {
    email: string;
    full_name?: string;
    phone?: string;
  };
  purchase: {
    currency: string;
    products: Array<{
      name: string;
      price: number;
      quantity?: number;
    }>;
    metadata: Record<string, unknown>;
  };
  success_redirect: string;
  failure_redirect: string;
  cancel_redirect: string;
  success_callback: string;
}
