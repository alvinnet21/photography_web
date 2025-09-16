export interface BookingRequest {
  id: string;
  serviceType: 'photographer' | 'videographer';
  employeeId: string;
  date: string;
  time: 'morning' | 'afternoon' | 'fullday';
  customerName: string;
  phone: string;
  email: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  role: 'photographer' | 'videographer';
  email: string;
  phone: string;
  createdAt: string;
}