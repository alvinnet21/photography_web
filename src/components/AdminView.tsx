import React, { useEffect, useRef, useState } from 'react';
import { Users, Calendar, Clock, Phone, Mail, Eye, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { useNotify } from './ToastProvider';
import EmployeeManager from './EmployeeManager';
import { BookingRequest, Employee } from '../types';

interface AdminViewProps {
  bookings: BookingRequest[];
  employees: Employee[];
  onStatusUpdate: (id: string, status: BookingRequest['status']) => Promise<boolean>;
  onEmployeeAdd: (employee: Omit<Employee, 'id' | 'createdAt'>) => Promise<boolean> | boolean;
  onEmployeeUpdate: (id: string, employee: Omit<Employee, 'id' | 'createdAt'>) => Promise<boolean> | boolean;
  onEmployeeDelete: (id: string) => Promise<boolean> | boolean;
  onLoadBookings: (range: { startDate: string; endDate: string }) => void | Promise<void>;
  onLoadEmployees?: () => void | Promise<void>;
}

const AdminView: React.FC<AdminViewProps> = ({
  bookings,
  employees,
  onStatusUpdate,
  onEmployeeAdd,
  onEmployeeUpdate,
  onEmployeeDelete,
  onLoadBookings,
  onLoadEmployees
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'employees'>('bookings');
  const [currentPage, setCurrentPage] = useState(1);
  // Default date range: first day to last day of current month (local, no TZ shift)
  const toYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [dateFilter, setDateFilter] = useState({
    startDate: toYmd(monthStart),
    endDate: toYmd(monthEnd)
  });
  const [showStartCal, setShowStartCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);
  const startCalRef = useRef<HTMLDivElement | null>(null);
  const endCalRef = useRef<HTMLDivElement | null>(null);
  const [currentMonthStart, setCurrentMonthStart] = useState<Date>(() => new Date(monthStart.getFullYear(), monthStart.getMonth(), 1));
  const [currentMonthEnd, setCurrentMonthEnd] = useState<Date>(() => new Date(monthEnd.getFullYear(), monthEnd.getMonth(), 1));
  
  const bookingsPerPage = 5;

  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const notify = useNotify();

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : 'Employee not found';
  };

  const getStatusColor = (status: BookingRequest['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: BookingRequest['status']) => {
    switch (status) {
      case 'pending': return <AlertCircle className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getTimeLabel = (time: string) => {
    switch (time) {
      case 'morning': return 'Morning (08:00 - 12:00)';
      case 'afternoon': return 'Afternoon (13:00 - 17:00)';
      case 'fullday': return 'Full Day (08:00 - 17:00)';
      default: return time;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Filter bookings based on search term and date range
  const filteredBookings = bookings.filter(booking => {
    const bookingDate = new Date(booking.date);
    const startDate = new Date(dateFilter.startDate);
    const endDate = new Date(dateFilter.endDate);
    
    const matchesDateRange = bookingDate >= startDate && bookingDate <= endDate;
    return matchesDateRange;
  });

  // Pagination
  const totalPages = Math.ceil(filteredBookings.length / bookingsPerPage);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * bookingsPerPage,
    currentPage * bookingsPerPage
  );

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter]);

  // Close calendars on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (showStartCal && startCalRef.current && !startCalRef.current.contains(e.target as Node)) {
        setShowStartCal(false);
      }
      if (showEndCal && endCalRef.current && !endCalRef.current.contains(e.target as Node)) {
        setShowEndCal(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showStartCal, showEndCal]);

  const formatDateDisplay = (iso: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  function buildMonthMatrix(base: Date) {
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const ymd = (y: number, mIdx: number, d: number) => {
      const mm = String(mIdx + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return `${y}-${mm}-${dd}`; // Local date string without timezone shifting
    };
    const cells: { day: number | null; iso?: string; current?: boolean }[] = [];
    // leading blanks
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null });
    }
    // current month days
    for (let d = 1; d <= daysInMonth; d++) {
      // Avoid toISOString() which shifts to UTC and can change the day
      cells.push({ day: d, iso: ymd(year, month, d), current: true });
    }
    // trailing blanks to complete weeks
    while (cells.length % 7 !== 0) {
      cells.push({ day: null });
    }
    // group into weeks
    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }

  const cmp = (a?: string, b?: string) => {
    if (!a || !b) return 0;
    // yyyy-mm-dd lexical compare works
    return a === b ? 0 : a < b ? -1 : 1;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
        <p className="text-lg text-gray-600">Kelola booking dan karyawan Anda</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'bookings'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow'
            }`}
          >
            <Calendar className="w-5 h-5 mr-2" />
            Booking Requests
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'employees'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow'
            }`}
          >
            <Users className="w-5 h-5 mr-2" />
            Employees
          </button>
        </nav>
      </div>

      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {/* Filter Controls */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filter & Load</h3>
              <button
                onClick={async () => {
                  try {
                    setLoadingList(true);
                    await onLoadBookings({ startDate: dateFilter.startDate, endDate: dateFilter.endDate });
                    notify.success('Data booking dimuat');
                  } catch (e) {
                    notify.error('Gagal memuat data');
                  } finally {
                    setLoadingList(false);
                  }
                }}
                disabled={loadingList}
                className={`flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg transition-colors duration-200 ${loadingList ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'}`}
              >
                {loadingList ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Load
                  </>
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Range Filter with popover calendar (style like CustomerView) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Dari Tanggal
                </label>
                <div className="relative" ref={startCalRef}>
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    readOnly
                    onKeyDown={(e) => e.preventDefault()}
                    value={formatDateDisplay(dateFilter.startDate)}
                    onClick={() => setShowStartCal((v) => !v)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                  {showStartCal && (
                    <div className="absolute z-20 mt-2 w-[320px] bg-white border rounded-2xl shadow-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={() => setCurrentMonthStart(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                          className="px-2 py-1 rounded hover:bg-gray-100"
                        >
                          ‹
                        </button>
                        <div className="font-semibold text-gray-700">
                          {currentMonthStart.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentMonthStart(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                          className="px-2 py-1 rounded hover:bg-gray-100"
                        >
                          ›
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
                        {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => (<div key={d}>{d}</div>))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {buildMonthMatrix(currentMonthStart).map((week, wi) => (
                          <React.Fragment key={wi}>
                            {week.map((cell, ci) => (
                              <button
                                key={`${wi}-${ci}`}
                                type="button"
                                disabled={!cell.day || (!!dateFilter.endDate && !!cell.iso && cmp(cell.iso, dateFilter.endDate) === 1)}
                                onClick={() => {
                                  if (!cell.iso) return;
                                  let newStart = cell.iso;
                                  let newEnd = dateFilter.endDate;
                                  if (newEnd && new Date(newEnd) < new Date(newStart)) {
                                    newEnd = newStart;
                                  }
                                  setDateFilter(prev => ({ ...prev, startDate: newStart, endDate: newEnd }));
                                  setShowStartCal(false);
                                }}
                                className={`h-9 text-sm ${(() => {
                                  if (!cell.day) return 'invisible';
                                  const iso = cell.iso || '';
                                  const isStart = !!dateFilter.startDate && iso === dateFilter.startDate;
                                  const isEnd = !!dateFilter.endDate && iso === dateFilter.endDate;
                                  const isAfterEnd = !!dateFilter.endDate && cmp(iso, dateFilter.endDate) === 1;
                                  const inRange = !!dateFilter.startDate && !!dateFilter.endDate && cmp(iso, dateFilter.startDate) >= 0 && cmp(iso, dateFilter.endDate) <= 0;
                                  if (isStart && isEnd) return 'bg-blue-600 text-white rounded-full';
                                  if (isStart) return 'bg-blue-600 text-white rounded-l-full';
                                  if (isEnd) return 'bg-blue-600 text-white rounded-r-full';
                                  if (isAfterEnd) return 'opacity-30 cursor-not-allowed rounded';
                                  if (inRange) return 'bg-blue-50 rounded';
                                  return 'hover:bg-gray-100 rounded';
                                })()}`}
                              >
                                {cell.day || ''}
                              </button>
                            ))}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Sampai Tanggal
                </label>
                <div className="relative" ref={endCalRef}>
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    readOnly
                    onKeyDown={(e) => e.preventDefault()}
                    value={formatDateDisplay(dateFilter.endDate)}
                    onClick={() => setShowEndCal((v) => !v)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                  {showEndCal && (
                    <div className="absolute z-20 mt-2 w-[320px] bg-white border rounded-2xl shadow-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={() => setCurrentMonthEnd(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                          className="px-2 py-1 rounded hover:bg-gray-100"
                        >
                          ‹
                        </button>
                        <div className="font-semibold text-gray-700">
                          {currentMonthEnd.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentMonthEnd(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                          className="px-2 py-1 rounded hover:bg-gray-100"
                        >
                          ›
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
                        {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => (<div key={d}>{d}</div>))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {buildMonthMatrix(currentMonthEnd).map((week, wi) => (
                          <React.Fragment key={wi}>
                            {week.map((cell, ci) => (
                              <button
                                key={`${wi}-${ci}`}
                                type="button"
                                disabled={!cell.day || (!!dateFilter.startDate && !!cell.iso && cmp(cell.iso, dateFilter.startDate) === -1)}
                                onClick={() => {
                                  if (!cell.iso) return;
                                  let newEnd = cell.iso;
                                  let newStart = dateFilter.startDate;
                                  if (newStart && new Date(newEnd) < new Date(newStart)) {
                                    newStart = newEnd;
                                  }
                                  setDateFilter(prev => ({ ...prev, startDate: newStart, endDate: newEnd }));
                                  setShowEndCal(false);
                                }}
                                className={`h-9 text-sm ${(() => {
                                  if (!cell.day) return 'invisible';
                                  const iso = cell.iso || '';
                                  const isStart = !!dateFilter.startDate && iso === dateFilter.startDate;
                                  const isEnd = !!dateFilter.endDate && iso === dateFilter.endDate;
                                  const isBeforeStart = !!dateFilter.startDate && cmp(iso, dateFilter.startDate) === -1;
                                  const inRange = !!dateFilter.startDate && !!dateFilter.endDate && cmp(iso, dateFilter.startDate) >= 0 && cmp(iso, dateFilter.endDate) <= 0;
                                  if (isStart && isEnd) return 'bg-blue-600 text-white rounded-full';
                                  if (isStart) return 'bg-blue-600 text-white rounded-l-full';
                                  if (isEnd) return 'bg-blue-600 text-white rounded-r-full';
                                  if (isBeforeStart) return 'opacity-30 cursor-not-allowed rounded';
                                  if (inRange) return 'bg-blue-50 rounded';
                                  return 'hover:bg-gray-100 rounded';
                                })()}`}
                              >
                                {cell.day || ''}
                              </button>
                            ))}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Results Summary */}
            <div className="mt-4 text-sm text-gray-600">
              Menampilkan {filteredBookings.length} dari {bookings.length} booking requests
            </div>
          </div>

          {/* Booking List */}
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {bookings.length === 0 ? 'Belum ada booking request' : 'Tidak ada hasil yang ditemukan'}
              </h3>
              <p className="text-gray-500">
                {bookings.length === 0 ? 'Booking dari customer akan muncul di sini' : 'Coba ubah filter tanggal Anda'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-6">
                {paginatedBookings.map((booking) => (
                  <div key={booking.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${booking.serviceType === 'photographer' ? 'bg-blue-100' : 'bg-orange-100'}`}>
                          <Eye className={`w-6 h-6 ${booking.serviceType === 'photographer' ? 'text-blue-600' : 'text-orange-600'}`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{booking.customerName}</h3>
                          <p className="text-sm text-gray-500 capitalize">{booking.serviceType} - {getEmployeeName(booking.employeeId)}</p>
                        </div>
                      </div>
                      
                      <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getStatusColor(booking.status)}`}>
                        {getStatusIcon(booking.status)}
                        <span className="capitalize">{booking.status}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span className="text-sm">{formatDate(booking.date)}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Clock className="w-4 h-4 mr-2" />
                        <span className="text-sm">{getTimeLabel(booking.time)}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Phone className="w-4 h-4 mr-2" />
                        <span className="text-sm">{booking.phone}</span>
                      </div>
                    </div>

                    <div className="flex items-center text-gray-600 mb-4">
                      <Mail className="w-4 h-4 mr-2" />
                      <span className="text-sm">{booking.email}</span>
                    </div>

                    <div className="flex space-x-2">
                      {booking.status === 'pending' && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                console.log('Accept booking', { id: booking.id, path: `/api/book/accept/${booking.id}` });
                              } catch {}
                              setProcessing(prev => ({ ...prev, [booking.id]: true }));
                              const ok = await onStatusUpdate(booking.id, 'confirmed');
                              setProcessing(prev => ({ ...prev, [booking.id]: false }));
                              ok ? notify.success('Booking dikonfirmasi') : notify.error('Gagal konfirmasi booking');
                            }}
                            disabled={!!processing[booking.id]}
                            className={`px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg transition-colors duration-200 ${processing[booking.id] ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'}`}
                          >
                            {processing[booking.id] && <Loader2 className="w-4 h-4 mr-2 inline-block animate-spin align-text-top" />}
                            {processing[booking.id] ? 'Memproses…' : 'Konfirmasi'}
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                console.log('Reject booking', { id: booking.id, path: `/api/book/reject/${booking.id}` });
                              } catch {}
                              setProcessing(prev => ({ ...prev, [booking.id]: true }));
                              const ok = await onStatusUpdate(booking.id, 'cancelled');
                              setProcessing(prev => ({ ...prev, [booking.id]: false }));
                              ok ? notify.success('Booking dibatalkan') : notify.error('Gagal membatalkan booking');
                            }}
                            disabled={!!processing[booking.id]}
                            className={`px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg transition-colors duration-200 ${processing[booking.id] ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'}`}
                          >
                            {processing[booking.id] && <Loader2 className="w-4 h-4 mr-2 inline-block animate-spin align-text-top" />}
                            {processing[booking.id] ? 'Memproses…' : 'Batalkan'}
                          </button>
                        </>
                      )}
                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => onStatusUpdate(booking.id, 'completed')}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
                        >
                          Selesai
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Halaman {currentPage} dari {totalPages}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="flex items-center px-4 py-2 text-sm bg-gray-100 rounded-lg disabled:opacity-50 hover:bg-gray-200 transition-colors duration-200"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="flex items-center px-4 py-2 text-sm bg-gray-100 rounded-lg disabled:opacity-50 hover:bg-gray-200 transition-colors duration-200"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'employees' && (
        <EmployeeManager
          employees={employees}
          onAdd={onEmployeeAdd}
          onUpdate={onEmployeeUpdate}
          onDelete={onEmployeeDelete}
          onReload={onLoadEmployees}
        />
      )}
    </div>
  );
};

export default AdminView;
