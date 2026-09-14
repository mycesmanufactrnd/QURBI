export enum UserRole {
  BUYER = 'buyer',
  FARMER = 'farmer',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export enum VerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum LivestockStatus {
  DRAFT = 'draft',
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  SOLD = 'sold',
  UNAVAILABLE = 'unavailable',
}

export enum LivestockSex {
  MALE = 'male',
  FEMALE = 'female',
}

// Not in the original spec list, but bulk_listings needs its own lifecycle:
// share sales don't map cleanly onto LivestockStatus (draft/available/... is
// single-animal language, a bulk listing needs to track "sold out" vs "cancelled").
export enum BulkListingStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  CLOSED = 'closed',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
}

export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  PREPARING = 'preparing',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
  REFUND_REQUESTED = 'refund_requested',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum DeliveryMethod {
  DELIVERY = 'delivery',
  SELF_PICKUP = 'self_pickup',
  SLAUGHTER_AT_FARM = 'slaughter_at_farm',
}

export enum RefundStatus {
  NONE = 'none',
  REQUESTED = 'requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REFUNDED = 'refunded',
}

export enum OrderItemType {
  LIVESTOCK = 'livestock',
  BULK_SHARE = 'bulk_share',
}

export enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum NotificationAudience {
  BUYER = 'buyer',
  FARMER = 'farmer',
  ADMIN = 'admin',
}

export enum NotificationType {
  ORDER_UPDATE = 'order_update',
  PAYMENT = 'payment',
  DELIVERY = 'delivery',
  VERIFICATION = 'verification',
  REQUEST_UPDATE = 'request_update',
  LISTING = 'listing',
  PROMOTION = 'promotion',
  SYSTEM = 'system',
}

export enum AddressLabel {
  HOME = 'home',
  WORK = 'work',
  OTHER = 'other',
}
