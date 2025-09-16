import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, Camera, Video, User, Phone, Mail, Loader2 } from 'lucide-react';
import { Employee } from '../types';
import { api } from '../api/client';

interface CustomerViewProps {
  employees: Employee[];
  onBookingSubmit: (booking: any) => void;
}

const CustomerView: React.FC<CustomerViewProps> = ({ employees, onBookingSubmit }) => {
  const [formData, setFormData] = useState({
    serviceType: 'photographer' as 'photographer' | 'videographer',
    employeeId: '',
    date: '',
    time: '',
    customerName: '',
    phone: '',
    email: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [availability, setAvailability] = useState<{
    dates: string[];
    slots: Array<'MORNING' | 'AFTERNOON' | 'FULL_DAY'>;
    byDate?: Record<string, Array<'MORNING' | 'AFTERNOON' | 'FULL_DAY'>>;
  }>({ dates: [], slots: [] });
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // No detailed hour selection; use time slots (MORNING/AFTERNOON/FULL_DAY)

  function parseAvailability(resp: any) {
    const norm: { dates: string[]; slots: Array<'MORNING'|'AFTERNOON'|'FULL_DAY'>; byDate?: Record<string, Array<'MORNING'|'AFTERNOON'|'FULL_DAY'>> } = { dates: [], slots: [] };
    const ymd = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const parseYMD = (s: string) => {
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return undefined;
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    };
    const toDateStr = (v: any) => {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (!isNaN(n)) {
        // Detect epoch seconds vs milliseconds
        const ms = n < 1e12 ? n * 1000 : n;
        return ymd(new Date(ms));
      }
      if (typeof v === 'string') {
        const py = parseYMD(v);
        if (py && !isNaN(py.getTime())) return ymd(py);
      }
      // fallback parse
      try { const d = new Date(v); if (!isNaN(d.getTime())) return ymd(d); } catch {}
      return '';
    };
    const toSlot = (s: any) => String(s).toUpperCase() as 'MORNING'|'AFTERNOON'|'FULL_DAY';

    if (!resp) return norm;
    // If response is an object with dates/timeSlots
    if (typeof resp === 'object' && !Array.isArray(resp)) {
      const dates = resp.dates || resp.availableDates || resp.dateList;
      const slots = resp.timeSlots || resp.availableTimeSlots || resp.slots;
      const byDate = resp.byDate || resp.availability || resp.calendar;
      if (Array.isArray(dates)) {
        norm.dates = dates.map(toDateStr).filter(Boolean);
      }
      if (Array.isArray(slots)) {
        norm.slots = slots.map(toSlot).filter((v) => v === 'MORNING' || v === 'AFTERNOON' || v === 'FULL_DAY');
      }
      if (byDate && typeof byDate === 'object') {
        const map: Record<string, Array<'MORNING'|'AFTERNOON'|'FULL_DAY'>> = {};
        Object.keys(byDate).forEach(k => {
          const key = toDateStr(k);
          const val = byDate[k];
          if (Array.isArray(val)) {
            map[key] = val.map(toSlot).filter((v) => v === 'MORNING' || v === 'AFTERNOON' || v === 'FULL_DAY');
          }
        });
        norm.byDate = map;
        norm.dates = Object.keys(map).filter(Boolean);
      }
      return norm;
    }
    // If array response
    if (Array.isArray(resp)) {
      if (resp.length && typeof resp[0] === 'number') {
        norm.dates = (resp as number[]).map(toDateStr).filter(Boolean);
      } else if (resp.length && typeof resp[0] === 'string') {
        norm.slots = (resp as string[]).map(toSlot).filter((v) => v === 'MORNING' || v === 'AFTERNOON' || v === 'FULL_DAY');
      } else if (resp.length && typeof resp[0] === 'object') {
        const map: Record<string, Array<'MORNING'|'AFTERNOON'|'FULL_DAY'>> = {};
        (resp as any[]).forEach(item => {
          const d = toDateStr(item.date || item.day || item.when);
          const sl: any = item.timeSlots || item.slots || item.availableTimeSlots || item.availableSlots;
          if (d && Array.isArray(sl)) {
            map[d] = sl.map(toSlot).filter((v) => v === 'MORNING' || v === 'AFTERNOON' || v === 'FULL_DAY');
          }
        });
        if (Object.keys(map).length) {
          norm.byDate = map;
          norm.dates = Object.keys(map);
        }
      }
    }
    return norm;
  }

  // Fetch availability when employee changes
  useEffect(() => {
    async function fetchAvail() {
      if (!formData.employeeId) {
        setAvailability({ dates: [], slots: [], byDate: undefined });
        return;
      }
      try {
        setLoadingAvail(true);
        const resp = await api.bookings.checkAvailability(formData.employeeId);
        const norm = parseAvailability(resp);
        setAvailability(norm);
        // set calendar month to selected date or first available date
        const toLocalFromYmd = (s?: string) => {
          if (!s) return undefined as any;
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!m) return new Date(s);
          return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        };
        const base = (formData.date && toLocalFromYmd(formData.date)) || (norm.dates[0] ? toLocalFromYmd(norm.dates[0]) : new Date());
        if (!isNaN(base.getTime())) setCurrentMonth(new Date(base.getFullYear(), base.getMonth(), 1));
        // reset date/time if now invalid
        setFormData(prev => ({ ...prev, date: '', time: '' }));
      } catch (e) {
        console.error('Failed to fetch availability', e);
        setAvailability({ dates: [], slots: [], byDate: undefined });
      } finally {
        setLoadingAvail(false);
      }
    }
    fetchAvail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.employeeId]);

  const slotOptions = useMemo(() => {
    if (!formData.employeeId) return [] as Array<'MORNING'|'AFTERNOON'|'FULL_DAY'>;
    if (availability.byDate && formData.date) {
      return availability.byDate[formData.date] || [];
    }
    return availability.slots || [];
  }, [availability, formData.employeeId, formData.date]);

  // Close calendar on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!showCalendar) return;
      const target = e.target as Node;
      if (calendarRef.current && !calendarRef.current.contains(target)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showCalendar]);

  const availableDatesSet = useMemo(() => new Set(availability.dates), [availability.dates]);

  function formatDateDisplay(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return iso;
    }
  }

  const firstAvailableDate = useMemo(() => {
    if (!availability.dates.length) return '';
    const sorted = [...availability.dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return sorted[0];
  }, [availability.dates]);

  function monthLabel(d: Date) {
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
    const totalDays = daysInMonth(year, month);
    // Compute months that have availability
    const monthsAvail = Array.from(availableDatesSet)
      .map(s => {
        const m = s.match(/^(\d{4})-(\d{2})-\d{2}$/);
        if (!m) return null;
        return `${m[1]}-${Number(m[2]) - 1}`;
      })
      .filter(Boolean) as string[];
    const prevKey = `${new Date(year, month - 1, 1).getFullYear()}-${new Date(year, month - 1, 1).getMonth()}`;
    const nextKey = `${new Date(year, month + 1, 1).getFullYear()}-${new Date(year, month + 1, 1).getMonth()}`;
    const hasPrev = monthsAvail.includes(prevKey);
    const hasNext = monthsAvail.includes(nextKey);

    const weeks: Array<Array<{ day: number | null; iso?: string; enabled?: boolean }>> = [];
    let week: Array<{ day: number | null; iso?: string; enabled?: boolean }> = [];
    // Leading blanks (convert Sunday=0 to 0-based Mon=0 if needed; keep as is)
    for (let i = 0; i < firstWeekday; i++) week.push({ day: null });
    const toYmd = (y: number, mIdx: number, d: number) => `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    for (let d = 1; d <= totalDays; d++) {
      const iso = toYmd(year, month, d);
      const enabled = availableDatesSet.size === 0 ? true : availableDatesSet.has(iso);
      week.push({ day: d, iso, enabled });
      if (week.length === 7) {
        weeks.push(week); week = [];
      }
    }
    if (week.length) weeks.push(week);

    return (
      <div ref={calendarRef} className="absolute z-20 mt-2 bg-white border rounded-xl shadow-lg p-3 w-80">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            className={`px-2 py-1 rounded ${hasPrev ? 'hover:bg-gray-100' : 'opacity-30 cursor-not-allowed'}`}
            onClick={() => hasPrev && setCurrentMonth(new Date(year, month - 1, 1))}
            disabled={!hasPrev}
          >
            ‹
          </button>
          <div className="font-semibold">{monthLabel(currentMonth)}</div>
          <button
            type="button"
            className={`px-2 py-1 rounded ${hasNext ? 'hover:bg-gray-100' : 'opacity-30 cursor-not-allowed'}`}
            onClick={() => hasNext && setCurrentMonth(new Date(year, month + 1, 1))}
            disabled={!hasNext}
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
          <div>M</div><div>S</div><div>R</div><div>K</div><div>J</div><div>S</div><div>M</div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weeks.flatMap((w, wi) => w.map((cell, ci) => (
            <button
              key={`${wi}-${ci}`}
              type="button"
              disabled={!cell.day || !cell.enabled}
              onClick={() => {
                if (cell.iso) {
                  handleInputChange('date', cell.iso);
                  // Auto-select first available slot for the chosen date
                  const slotsForDate = availability.byDate && availability.byDate[cell.iso]
                    ? availability.byDate[cell.iso]
                    : availability.slots;
                  const mapLower = (s: string) => (s === 'MORNING' ? 'morning' : s === 'AFTERNOON' ? 'afternoon' : 'fullday');
                  if (Array.isArray(slotsForDate) && slotsForDate.length > 0) {
                    setFormData(prev => ({ ...prev, time: mapLower(String(slotsForDate[0])) as any }));
                  } else {
                    setFormData(prev => ({ ...prev, time: '' }));
                  }
                  setShowCalendar(false);
                }
              }}
              className={`h-9 text-sm ${
                !cell.day
                  ? 'invisible'
                  : !cell.enabled
                  ? 'opacity-30 cursor-not-allowed rounded'
                  : formData.date === cell.iso
                  ? 'bg-blue-600 text-white rounded-full ring-2 ring-blue-300 font-semibold shadow'
                  : 'hover:bg-gray-100 rounded'
              }`}
            >
              {cell.day || ''}
            </button>
          )))}
        </div>
      </div>
    );
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.employeeId) newErrors.employeeId = 'Pilih fotografer/videografer';
    if (!formData.date) newErrors.date = 'Pilih tanggal booking';
    if (!formData.time) newErrors.time = 'Pilih waktu booking';
    if (!formData.customerName.trim()) newErrors.customerName = 'Nama tidak boleh kosong';
    if (!formData.phone.trim()) newErrors.phone = 'Nomor HP tidak boleh kosong';
    if (!formData.email.trim()) newErrors.email = 'Email tidak boleh kosong';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Format email tidak valid';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      const booking = {
        ...formData,
        id: Date.now().toString(),
        status: 'pending' as const,
        createdAt: new Date().toISOString()
      };
      await Promise.resolve(onBookingSubmit(booking));
      // Reset form
      setFormData({
        serviceType: 'photographer',
        employeeId: '',
        date: '',
        time: '',
        customerName: '',
        phone: '',
        email: ''
      });
      alert('Booking request berhasil dikirim! Admin akan menghubungi Anda segera.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Reset employee selection when service type changes
    if (field === 'serviceType') {
      setFormData(prev => ({ ...prev, employeeId: '' }));
    }
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Filter employees based on selected service type
  const availableEmployees = employees.filter(employee => 
    employee.role === formData.serviceType
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Booking Fotografer & Videografer</h1>
        <p className="text-lg text-gray-600">Wujudkan momen spesial Anda dengan layanan profesional kami</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Service Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Pilih Layanan</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleInputChange('serviceType', 'photographer')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  formData.serviceType === 'photographer'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Camera className="w-8 h-8 mx-auto mb-2" />
                <span className="font-medium">Fotografer</span>
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('serviceType', 'videographer')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  formData.serviceType === 'videographer'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Video className="w-8 h-8 mx-auto mb-2" />
                <span className="font-medium">Videografer</span>
              </button>
            </div>
          </div>

          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <User className="inline w-4 h-4 mr-1" />
              Pilih {formData.serviceType === 'photographer' ? 'Fotografer' : 'Videografer'}
            </label>
            {availableEmployees.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                Belum ada {formData.serviceType === 'photographer' ? 'fotografer' : 'videografer'} tersedia
              </div>
            ) : (
              <select
                value={formData.employeeId}
                onChange={(e) => handleInputChange('employeeId', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.employeeId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Pilih {formData.serviceType === 'photographer' ? 'fotografer' : 'videografer'}</option>
                {availableEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} - {employee.role === 'photographer' ? 'Photographer' : 'Videographer'}
                  </option>
                ))}
              </select>
            )}
            {loadingAvail && formData.employeeId && (
              <p className="text-xs text-gray-500 mt-1 flex items-center">
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Memuat ketersediaan...
              </p>
            )}
            {errors.employeeId && <p className="text-red-500 text-sm mt-1">{errors.employeeId}</p>}
          </div>

          {/* Date Selection (from availability; disable typing; show calendar popover) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Tanggal Booking
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                onKeyDown={(e) => e.preventDefault()}
                value={formData.date ? formatDateDisplay(formData.date) : ''}
                onClick={() => {
                  if (availability.dates.length === 0) return;
                  // Auto-select first available date when opening calendar if none selected
                  if (!formData.date && firstAvailableDate) {
                    handleInputChange('date', firstAvailableDate);
                    const base = new Date(firstAvailableDate);
                    if (!isNaN(base.getTime())) setCurrentMonth(new Date(base.getFullYear(), base.getMonth(), 1));
                  }
                  setShowCalendar(!showCalendar);
                }}
                placeholder={availability.dates.length === 0 ? (formData.employeeId ? 'Tidak ada tanggal tersedia' : 'Pilih karyawan terlebih dahulu') : 'Pilih tanggal'}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                } ${availability.dates.length === 0 ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer'}`}
                disabled={availability.dates.length === 0}
              />
              {showCalendar && availability.dates.length > 0 && renderCalendar()}
            </div>
            {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
          </div>

          {/* Time Slot Selection (radio), shown after selecting employee and (if provided) date */}
          {formData.employeeId && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Clock className="inline w-4 h-4 mr-1" />
              Waktu Booking
            </label>
            {availability.dates.length > 0 && !formData.date ? (
              <div className="p-3 bg-gray-50 rounded-lg text-gray-600">Pilih tanggal terlebih dahulu</div>
            ) : slotOptions.length === 0 ? (
              <div className="p-3 bg-yellow-50 rounded-lg text-yellow-700">Belum ada slot waktu untuk pilihan saat ini</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {slotOptions.includes('MORNING') && (
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${formData.time === 'morning' ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-300'}`}>
                    <input
                      type="radio"
                      name="timeSlot"
                      value="morning"
                      checked={formData.time === 'morning'}
                      onChange={(e) => handleInputChange('time', e.target.value)}
                      className="mr-2"
                    />
                    Pagi (Morning)
                  </label>
                )}
                {slotOptions.includes('AFTERNOON') && (
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${formData.time === 'afternoon' ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-300'}`}>
                    <input
                      type="radio"
                      name="timeSlot"
                      value="afternoon"
                      checked={formData.time === 'afternoon'}
                      onChange={(e) => handleInputChange('time', e.target.value)}
                      className="mr-2"
                    />
                    Siang (Afternoon)
                  </label>
                )}
                {slotOptions.includes('FULL_DAY') && (
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${formData.time === 'fullday' ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-300'}`}>
                    <input
                      type="radio"
                      name="timeSlot"
                      value="fullday"
                      checked={formData.time === 'fullday'}
                      onChange={(e) => handleInputChange('time', e.target.value)}
                      className="mr-2"
                    />
                    Sehari Penuh (Full Day)
                  </label>
                )}
              </div>
            )}
            {errors.time && <p className="text-red-500 text-sm mt-1">{errors.time}</p>}
          </div>
          )}

          {/* Customer Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="inline w-4 h-4 mr-1" />
                Nama Lengkap
              </label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                placeholder="Masukkan nama lengkap"
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.customerName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.customerName && <p className="text-red-500 text-sm mt-1">{errors.customerName}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Phone className="inline w-4 h-4 mr-1" />
                Nomor HP
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="08xxxxxxxxxx"
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Mail className="inline w-4 h-4 mr-1" />
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="nama@email.com"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform shadow-lg ${submitting ? 'opacity-60 cursor-not-allowed' : 'hover:from-blue-700 hover:to-blue-800 hover:scale-105'}`}
          >
            {submitting ? (
              <span className="inline-flex items-center">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Mengirim...
              </span>
            ) : (
              'Kirim Booking Request'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerView;
