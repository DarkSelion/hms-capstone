export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
  permissions: Permission[];
  pivot?: { role_id: number; permission_id: number };
}

export interface Technician {
  id: number;
  name: string;
  phone?: string;
  specialty?: string;
  is_active: boolean;
}

export interface Permission {
  id: number;
  name: string;
  slug: string;
  module: string;
}

export interface Guest {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  nationality?: string;
  date_of_birth?: string;
  gender?: string;
address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  is_blacklisted: boolean;
  blacklist_reason?: string;
  photo?: string;
  notes?: string;
  reservations?: Reservation[];
  reservations_count?: number;
  created_at: string;
}

export interface RoomType {
  id: number;
  name: string;
  slug: string;
  description?: string;
  base_price: number;
  capacity: number;
  size_sqm?: number;
  bed_type?: string;
  max_adults: number;
  max_children: number;
  amenities_json?: Amenity[];
  is_active: boolean;
  rooms_count?: number;
}

export interface Room {
  id: number;
  room_number: string;
  room_type: RoomType;
  floor: number;
  bed_type?: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved' | 'dirty';
  cleaning_status: 'clean' | 'dirty' | 'in_progress';
  price_override?: number;
  capacity: number;
  description?: string;
  notes?: string;
  images?: RoomImage[];
}

export interface RoomImage {
  id: number;
  room_id: number;
  image_url: string;
  caption?: string;
  sort_order: number;
  is_primary: boolean;
  created_at?: string;
}

export interface Reservation {
  id: number;
  reservation_number: string;
  guest: Guest;
  room: Room;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded';
  is_overdue?: boolean;
  checked_in_at?: string;
  checked_out_at?: string;
  price_per_night?: number;
  discount_percent?: number;
  tax_percent?: number;
  special_requests?: string;
  source?: string;
  payments?: Payment[];
  created_at: string;
}

export interface CheckoutPreview {
  actual_check_out: string
  total_nights: number
  subtotal: number
  discount_amount: number
  tax_percent: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  due_amount: number
  overlap: boolean
  late_checkout_fee: number
  late_checkout_applies: boolean
}

export interface GuestHistory {
  guest: Guest;
  reservations: PaginatedResponse<Reservation>;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip_address?: string;
  created_at: string;
}

export interface Payment {
  id: number;
  reservation_id: number;
  guest_id?: number;
  amount: number;
  payment_method: 'cash' | 'gcash' | 'online';
  payment_type?: 'full' | 'partial';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transaction_id?: string;
  reference_number?: string;
  notes?: string;
  paid_at?: string;
  created_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  reservation_id: number;
  guest_id: number;
  amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issued_date: string;
  due_date: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  type: string;
}

export interface HousekeepingTask {
  id: number;
  room: Room | null;
  assigned_to?: User;
  status: 'pending' | 'in_progress' | 'completed' | 'inspected';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  task_type: string;
  scheduled_date: string;
  notes?: string;
  completion_notes?: string;
}

export interface MaintenanceRequest {
  id: number;
  room: Room;
  title: string;
  description?: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'reported' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: Technician;
  estimated_cost?: number;
  actual_cost?: number;
  created_at?: string;
}

export interface ActivityLog {
  id: number;
  user_id?: number | null;
  user?: User;
  action: string;
  module: string;
  model_id?: number;
  model_type?: string;
  description?: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface Expense {
  id: number;
  category: string;
  amount: number;
  description?: string;
  date: string;
  receipt?: string;
  receipt_url?: string | null;
  created_by: number;
  created_by_user?: { id: number; name: string };
}

export interface ExpenseSummary {
  total_amount: number;
  count: number;
  average: number;
  this_month_amount: number;
}

export interface DashboardStats {
  today_revenue: number;
  occupancy_rate: number;
  available_rooms: number;
  booked_rooms: number;
  check_ins_today: number;
  check_outs_today: number;
  pending_reservations: number;
  total_rooms: number;
  dirty_rooms: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  bookings: number;
}

export interface BookingSourceData {
  source: string;
  count: number;
}

export interface OccupancyData {
  date: string;
  rate: number;
}

export interface RoomTypeData {
  type: string;
  booked: number;
  available: number;
}

export interface StaffSchedule {
  id: number;
  user_id: number;
  user?: User;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface LeaveRequest {
  id: number;
  user_id: number;
  user?: User;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  reason?: string;
  reviewed_by?: number;
  reviewed_at?: string;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}


export interface Amenity {
  name: string
  icon?: string
  description?: string
}
// === Public / Guest Types ===
export interface PublicUser {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  address?: string
  city?: string
  country?: string
  nationality?: string
  date_of_birth?: string
  gender?: string
  postal_code?: string
  is_blacklisted?: boolean
  created_at?: string
}

export interface PublicRoomType {
  id: number
  name: string
  slug: string
  description?: string
  base_price: number
  capacity: number
  size_sqm?: number
  bed_type?: string
  max_adults: number
  max_children: number
  amenities_json?: string[]
  is_active: boolean
  rooms_count?: number
  image_url?: string
}

export interface PublicRoom {
  id: number
  room_number: string
  room_type: PublicRoomType
  floor: number
  status: string
  price_override?: number
  cleaning_status?: string
  capacity?: number
  description?: string
  image_url?: string
}

export interface PublicReservation {
  id: number
  reservation_number: string
  room: PublicRoom
  status: string
  check_in: string
  check_out: string
  adults: number
  children: number
  total_amount: number
  paid_amount: number
  due_amount: number
payment_status: string
  checked_in_at?: string
  checked_out_at?: string
  special_requests?: string
  created_at: string
}

export interface PublicReservationsResponse {
  data: PublicReservation[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface PublicAuthResponse {
  token: string
  user: PublicUser
}