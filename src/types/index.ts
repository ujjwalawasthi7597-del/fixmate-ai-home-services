export type UserRole = 'customer' | 'provider' | 'admin';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  isActive?: boolean;
  savedProviders?: ProviderProfile[] | string[];
}

export interface ProviderProfile {
  _id: string;
  userId: { _id: string; name: string; avatarUrl?: string; phone?: string } | string;
  businessName: string;
  bio: string;
  avatarUrl?: string;
  categories: string[];
  skills: string[];
  experienceYears: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationNotes?: string;
  ratingAverage: number;
  ratingCount: number;
  startingPrice: number;
  pricingMode: 'starting' | 'quotation';
  serviceLocation: {
    city: string;
    area: string;
    address: string;
    lat: number;
    lng: number;
    radiusKm: number;
  };
  workingHours: {
    start: string;
    end: string;
    days: string[];
  };
  completedJobsCount: number;
  distanceKm?: number | null;
}

export interface ServiceCategory {
  _id: string;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  basePriceRange: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ServiceItem {
  _id: string;
  providerId: string;
  providerProfileId: string;
  categorySlug: string;
  title: string;
  description: string;
  basePrice: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface Address {
  _id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
}

export type BookingStatus =
  | 'Pending'
  | 'Accepted'
  | 'Quotation Sent'
  | 'Awaiting Approval'
  | 'Confirmed'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'
  | 'Rejected';

export interface Quotation {
  _id: string;
  bookingId: string;
  inspectionCharges: number;
  labourCharges: number;
  estimatedMaterialCosts: number;
  additionalCharges: number;
  totalEstimatedAmount: number;
  expectedCompletionTime: string;
  workDescription: string;
  status: 'Pending Approval' | 'Approved' | 'Rejected';
  createdAt: string;
}

export interface Booking {
  _id: string;
  bookingCode: string;
  customerId: { _id: string; name: string; email: string; phone?: string } | string;
  providerId: { _id: string; name: string; email: string; phone?: string } | string;
  providerProfileId: ProviderProfile | string;
  serviceId?: { _id: string; title: string; basePrice: number } | string;
  categorySlug: string;
  problemTitle: string;
  problemDescription: string;
  symptoms: string[];
  customerRequirements: string;
  technicianNotes: string;
  issueImages: string[];
  scheduledDate: string;
  timeSlot: string;
  addressSnapshot: {
    label: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    lat?: number;
    lng?: number;
  };
  status: BookingStatus;
  paymentStatus: 'Unpaid' | 'Paid' | 'Refunded';
  quotation?: Quotation | null;
  createdAt: string;
}

export interface PaymentRecord {
  _id: string;
  bookingId: { _id: string; bookingCode: string; problemTitle: string; scheduledDate: string; status: string } | string;
  customerId?: { name: string; email: string };
  providerId?: { name: string; email: string };
  amount: number;
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: 'Created' | 'Paid' | 'Failed' | 'Refund Requested' | 'Refunded';
  refundStatus?: string;
  refundReason?: string;
  paidAt?: string;
  createdAt: string;
}

export interface ReviewItem {
  _id: string;
  bookingId?: { bookingCode: string; problemTitle: string };
  customerId?: { name: string };
  providerProfileId?: { businessName: string };
  rating: number;
  comment: string;
  isVisible: boolean;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  relatedBookingId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface HealthStatus {
  ok: boolean;
  dbConnected: boolean;
  dbError: string | null;
  integrations: {
    mongodbConfigured: boolean;
    jwtSecretConfigured: boolean;
    geminiConfigured: boolean;
    cloudinaryConfigured: boolean;
    razorpayConfigured: boolean;
    razorpayWebhookConfigured: boolean;
  };
}
