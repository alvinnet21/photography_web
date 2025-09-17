// Real API client using Swagger spec provided in the prompt.
// Base URL can be overridden by Vite env `VITE_API_BASE_URL`.

const VITE_ENV = (import.meta as any).env || {};
// Fixed absolute base API URL as requested
const API: string = 'https://13.213.63.82/api';
const AUTH_BEARER = VITE_ENV.VITE_API_TOKEN;
const AUTH_BASIC_USER = VITE_ENV.VITE_API_BASIC_USER;
const AUTH_BASIC_PASS = VITE_ENV.VITE_API_BASIC_PASS;
const API_KEY = VITE_ENV.VITE_API_KEY;
const API_KEY_HEADER = VITE_ENV.VITE_API_KEY_HEADER || 'X-API-KEY';
const WITH_CREDENTIALS = String(VITE_ENV.VITE_API_WITH_CREDENTIALS || '').toLowerCase() === 'true';

type BasicResponse<T = any> = {
  message?: string;
  content?: T;
  // other fields exist but are ignored by the frontend
};

function getCookie(name: string): string | undefined {
  try {
    const m = document?.cookie?.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

async function request<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: any
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(AUTH_BEARER ? { Authorization: `Bearer ${AUTH_BEARER}` } : {}),
    ...(AUTH_BASIC_USER && AUTH_BASIC_PASS
      ? { Authorization: `Basic ${btoa(`${AUTH_BASIC_USER}:${AUTH_BASIC_PASS}`)}` }
      : {}),
    ...(API_KEY ? { [API_KEY_HEADER]: API_KEY } : {}),
    'X-Requested-With': 'XMLHttpRequest'
  };
  // Add common Spring Security CSRF headers if cookie exists
  const xsrf = getCookie('XSRF-TOKEN') || getCookie('X-CSRF-TOKEN');
  if (xsrf) {
    headers['X-XSRF-TOKEN'] = xsrf;
    headers['X-CSRF-TOKEN'] = xsrf;
  }

  // Normalize to avoid double '/api' when callers pass '/api/...'
  const normalizedPath = path.startsWith('/api') ? path.slice(4) : path;
  const res = await fetch(`${API}${normalizedPath}`, {
    method,
    headers,
    credentials: WITH_CREDENTIALS ? 'include' : 'same-origin',
    body: body != null ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
  }
  const data = (await res.json().catch(() => ({}))) as BasicResponse<T> | T;
  // Unwrap BasicResponse if present
  if (data && typeof data === 'object' && 'content' in (data as any)) {
    return (data as BasicResponse<T>).content as T;
  }
  return data as T;
}

// Helper mappers between UI types and API DTOs
const toApiPosition = (role: 'photographer' | 'videographer') =>
  role === 'photographer' ? 'PHOTOGRAPHER' : 'VIDEOGRAPHER';
const fromApiPosition = (position?: string): 'photographer' | 'videographer' =>
  String(position || '').toUpperCase() === 'VIDEOGRAPHER' ? 'videographer' : 'photographer';

const toApiTimeSlot = (time: 'morning' | 'afternoon' | 'fullday') =>
  time === 'morning' ? 'MORNING' : time === 'afternoon' ? 'AFTERNOON' : 'FULL_DAY';
const fromApiTimeSlot = (slot?: string): 'morning' | 'afternoon' | 'fullday' => {
  const s = String(slot || '').toUpperCase();
  if (s === 'AFTERNOON') return 'afternoon';
  if (s === 'FULL_DAY') return 'fullday';
  return 'morning';
};

// Shapes used internally by the app (avoid importing app types here to reduce coupling)
export type UiEmployee = {
  id: string;
  name: string;
  role: 'photographer' | 'videographer';
  email: string;
  phone: string;
  createdAt?: string;
};

export type UiBooking = {
  id: string;
  serviceType: 'photographer' | 'videographer';
  employeeId: string;
  date: string; // ISO date string (YYYY-MM-DD or full ISO)
  time: 'morning' | 'afternoon' | 'fullday';
  customerName: string;
  phone: string;
  email: string;
  status?: string;
  createdAt?: string;
};

function mapApiEmployeeToUi(e: any): UiEmployee {
  return {
    id: String(e?.id ?? e?.employeeId ?? ''),
    name: e?.name ?? '',
    role: fromApiPosition(e?.position),
    email: e?.email ?? '',
    phone: e?.phone ?? '',
    createdAt: e?.createdAt ?? e?.created_date ?? undefined
  };
}

function mapUiEmployeeToApi(input: Omit<UiEmployee, 'id' | 'createdAt'> & { id?: string | number }) {
  return {
    id: input.id != null ? Number(input.id) : undefined,
    name: input.name,
    position: toApiPosition(input.role),
    email: input.email,
    phone: input.phone
  };
}

function mapApiBookingToUi(b: any): UiBooking {
  const dateMs = typeof b?.date === 'number' ? (b.date < 1e12 ? b.date * 1000 : b.date) : undefined;
  return {
    // Some APIs return id as bookId
    id: String(b?.id ?? b?.bookingId ?? b?.bookId ?? ''),
    serviceType: b?.serviceType ? String(b.serviceType).toLowerCase() : undefined,
    employeeId: String(b?.employeeId ?? ''),
    date: dateMs ? new Date(dateMs).toISOString() : b?.date ?? '',
    time: fromApiTimeSlot(b?.timeSlot),
    customerName: b?.customerName ?? '',
    phone: b?.customerPhone ?? b?.phone ?? '',
    email: b?.customerEmail ?? b?.email ?? '',
    status: b?.status,
    createdAt: b?.createdAt ?? undefined
  } as UiBooking;
}

function mapUiBookingToApi(input: UiBooking | any) {
  // Accepts UI booking-like object from the app and shapes it for the API
  const date = input.date ? new Date(input.date) : undefined;
  const dateMs = date && !isNaN(date.getTime()) ? date.getTime() : undefined;
  return {
    employeeId: Number(input.employeeId),
    // API expects Unix seconds, convert from ms
    date: dateMs != null ? Math.floor(dateMs / 1000) : undefined,
    timeSlot: toApiTimeSlot(input.time),
    customerName: input.customerName,
    customerPhone: input.phone ?? input.customerPhone,
    customerEmail: input.email ?? input.customerEmail
  };
}

export const api = {
  employees: {
    create: async (employee: Omit<UiEmployee, 'id' | 'createdAt'>): Promise<UiEmployee> => {
      const payload = mapUiEmployeeToApi(employee as any);
      const content = await request<any>('POST', `/api/employee`, payload);
      return mapApiEmployeeToUi(content);
    },
    update: async (id: string | number, employee: Omit<UiEmployee, 'id' | 'createdAt'>): Promise<UiEmployee> => {
      const payload = mapUiEmployeeToApi({ ...employee, id });
      const content = await request<any>('PUT', `/api/employee/${id}`, payload);
      return mapApiEmployeeToUi(content);
    },
    delete: async (id: string | number): Promise<void> => {
      await request('DELETE', `/api/employee/${id}`);
    },
    find: async (id: string | number): Promise<UiEmployee> => {
      const content = await request<any>('GET', `/api/employee/${id}`);
      return mapApiEmployeeToUi(content);
    },
    paging: async (params: { page?: number; size?: number; search?: string; dateStart?: number; dateEnd?: number } = {}): Promise<UiEmployee[]> => {
      const toSec = (v?: number) => (v == null ? undefined : v > 1e12 ? Math.floor(v / 1000) : v);
      const payload = {
        page: params.page ?? 0,
        size: params.size ?? 50,
        search: params.search ?? '',
        dateStart: toSec(params.dateStart),
        dateEnd: toSec(params.dateEnd)
      };
      const content = await request<any>('POST', `/api/employee/paging`, payload);
      const list: any[] = Array.isArray(content?.content) ? content.content : Array.isArray(content) ? content : Array.isArray(content?.data) ? content.data : [];
      return list.map(mapApiEmployeeToUi);
    }
  },
  bookings: {
    create: async (booking: any): Promise<UiBooking> => {
      const payload = mapUiBookingToApi(booking);
      const content = await request<any>('POST', `/api/book`, payload);
      return mapApiBookingToUi(content);
    },
    find: async (id: string | number): Promise<UiBooking> => {
      const content = await request<any>('GET', `/api/book/${id}`);
      return mapApiBookingToUi(content);
    },
    delete: async (id: string | number): Promise<void> => {
      await request('DELETE', `/api/book/${id}`);
    },
    paging: async (params: { page?: number; size?: number; search?: string; dateStart?: number; dateEnd?: number } = {}): Promise<UiBooking[]> => {
      const toSec = (v?: number) => (v == null ? undefined : v > 1e12 ? Math.floor(v / 1000) : v);
      const payload = {
        page: params.page ?? 0,
        size: params.size ?? 50,
        search: params.search ?? '',
        dateStart: toSec(params.dateStart),
        dateEnd: toSec(params.dateEnd)
      };
      const content = await request<any>('POST', `/api/book/paging`, payload);
      const list: any[] = Array.isArray(content?.content) ? content.content : Array.isArray(content) ? content : Array.isArray(content?.data) ? content.data : [];
      return list.map(mapApiBookingToUi);
    },
    checkAvailability: async (employeeId: string | number): Promise<any> => {
      // Return content as-is; caller will normalize
      const content = await request<any>('GET', `/api/book/check/availability/${employeeId}`);
      return content;
    },
    accept: async (id: string | number): Promise<UiBooking> => {
      const content = await request<any>('GET', `/api/book/accept/${id}`);
      return mapApiBookingToUi(content);
    },
    reject: async (id: string | number): Promise<void> => {
      await request('GET', `/api/book/reject/${id}`);
    }
  }
};
