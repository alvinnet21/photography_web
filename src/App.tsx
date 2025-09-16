import React, { useState, useEffect } from 'react';
import { User, Shield, Camera, ArrowRight } from 'lucide-react';
import CustomerView from './components/CustomerView';
import AdminView from './components/AdminView';
import { BookingRequest, Employee } from './types';
import { api } from './api/client';

type ViewMode = 'landing' | 'customer' | 'admin';

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('landing');
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Initial load from API
  useEffect(() => {
    async function load() {
      try {
        const [emps, books] = await Promise.all([
          api.employees.paging({ page: 0, size: 100 }),
          api.bookings.paging({ page: 0, size: 100 })
        ]);
        // Map API UI shapes to local app types
        const mappedEmployees: Employee[] = emps.map((e: any) => ({
          id: String(e.id),
          name: e.name,
          role: e.role,
          email: e.email,
          phone: e.phone,
          createdAt: e.createdAt || new Date().toISOString()
        }));
        const mappedBookings: BookingRequest[] = books.map((b: any) => ({
          id: String(b.id),
          serviceType: (b.serviceType as any) ?? (mappedEmployees.find(e => e.id === String(b.employeeId))?.role ?? 'photographer'),
          employeeId: String(b.employeeId),
          date: b.date,
          time: b.time,
          customerName: b.customerName,
          phone: b.phone,
          email: b.email,
          status: (b.status as any) ?? 'pending',
          createdAt: b.createdAt || new Date().toISOString()
        }));
        setEmployees(mappedEmployees);
        setBookings(mappedBookings);
      } catch (e) {
        console.error('Failed to load initial data', e);
      }
    }
    load();
  }, []);

  const handleBookingSubmit = async (booking: BookingRequest) => {
    try {
      // Persist booking to API then add to local state
      const created = await api.bookings.create({
        employeeId: booking.employeeId,
        date: booking.date,
        time: booking.time,
        customerName: booking.customerName,
        phone: booking.phone,
        email: booking.email
      } as any);
      const mapped: BookingRequest = {
        id: String(created.id || booking.id || Date.now()),
        serviceType: booking.serviceType,
        employeeId: String(created.employeeId || booking.employeeId),
        date: created.date || booking.date,
        time: created.time || booking.time,
        customerName: created.customerName || booking.customerName,
        phone: created.phone || booking.phone,
        email: created.email || booking.email,
        status: (created.status as any) || 'pending',
        createdAt: created.createdAt || new Date().toISOString()
      };
      setBookings(prev => [mapped, ...prev]);
    } catch (e) {
      console.error('Failed to create booking', e);
      // Fallback: keep local append so UI remains responsive
      setBookings(prev => [booking, ...prev]);
    }
  };

  const handleStatusUpdate = async (id: string, status: BookingRequest['status']): Promise<boolean> => {
    try {
      if (status === 'confirmed') {
        const updated = await api.bookings.accept(id);
        // Map API booking to local type and update only that one
        setBookings(prev => prev.map(b => {
          if (b.id !== id) return b;
          return {
            id: String(updated.id || b.id),
            serviceType: (updated.serviceType as any) ?? b.serviceType,
            employeeId: String(updated.employeeId || b.employeeId),
            date: updated.date || b.date,
            time: updated.time || b.time,
            customerName: updated.customerName || b.customerName,
            phone: updated.phone || b.phone,
            email: updated.email || b.email,
            status: (updated.status as any) || 'confirmed',
            createdAt: updated.createdAt || b.createdAt
          };
        }));
        return true;
      } else if (status === 'cancelled') {
        await api.bookings.reject(id);
        // reflect cancellation
        setBookings(prev => prev.map(booking => (booking.id === id ? { ...booking, status } : booking)));
        return true;
      }
    } catch (e) {
      console.error('Failed to update booking status', e);
      // Fallback/local update when API fails
      setBookings(prev => prev.map(booking => (booking.id === id ? { ...booking, status } : booking)));
      return false;
    }
    // For statuses other than confirmed/cancelled, just update locally
    setBookings(prev => prev.map(booking => (booking.id === id ? { ...booking, status } : booking)));
    return true;
  };

  const handleEmployeeAdd = async (employeeData: Omit<Employee, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const created = await api.employees.create({
        name: employeeData.name,
        role: employeeData.role,
        email: employeeData.email,
        phone: employeeData.phone
      });
      const newEmployee: Employee = {
        id: String(created.id || Date.now()),
        name: created.name || employeeData.name,
        role: created.role || employeeData.role,
        email: created.email || employeeData.email,
        phone: created.phone || employeeData.phone,
        createdAt: created.createdAt || new Date().toISOString()
      };
      setEmployees(prev => [newEmployee, ...prev]);
      return true;
    } catch (e) {
      console.error('Failed to create employee', e);
      // Fallback to local add
      const newEmployee: Employee = {
        ...employeeData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      };
      setEmployees(prev => [newEmployee, ...prev]);
      return false;
    }
  };

  const handleEmployeeUpdate = async (id: string, employeeData: Omit<Employee, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const updated = await api.employees.update(id, employeeData);
      setEmployees(prev => prev.map(employee =>
        employee.id === String(id)
          ? {
              ...employee,
              name: updated.name || employeeData.name,
              role: updated.role || employeeData.role,
              email: updated.email || employeeData.email,
              phone: updated.phone || employeeData.phone
            }
          : employee
      ));
      return true;
    } catch (e) {
      console.error('Failed to update employee', e);
      // Fallback to local update
      setEmployees(prev => prev.map(employee =>
        employee.id === id ? { ...employee, ...employeeData } : employee
      ));
      return false;
    }
  };

  const handleEmployeeDelete = async (id: string): Promise<boolean> => {
    try {
      await api.employees.delete(id);
      setEmployees(prev => prev.filter(employee => employee.id !== id));
      return true;
    } catch (e) {
      console.error('Failed to delete employee', e);
      // keep UI unchanged on failure
      return false;
    }
  };

  const handleLoadEmployees = async (): Promise<void> => {
    try {
      const emps = await api.employees.paging({ page: 0, size: 100 });
      // Map to app Employee type
      const mappedEmployees: Employee[] = emps.map((e: any) => ({
        id: String(e.id),
        name: e.name,
        role: e.role,
        email: e.email,
        phone: e.phone,
        createdAt: e.createdAt || new Date().toISOString()
      }));
      setEmployees(mappedEmployees);
    } catch (e) {
      console.error('Failed to load employees', e);
    }
  };

  // Load bookings from API using current or provided date range
  const handleLoadBookings = async (range: { startDate: string; endDate: string }) => {
    try {
      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      // Expand end to end-of-day
      const dateStart = isNaN(start.getTime()) ? undefined : start.getTime();
      const dateEnd = isNaN(end.getTime()) ? undefined : new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
      const books = await api.bookings.paging({ page: 0, size: 100, dateStart, dateEnd });
      const mappedBookings: BookingRequest[] = books.map((b: any) => ({
        id: String(b.id),
        serviceType: (b.serviceType as any) ?? (employees.find(e => e.id === String(b.employeeId))?.role ?? 'photographer'),
        employeeId: String(b.employeeId),
        date: b.date,
        time: b.time,
        customerName: b.customerName,
        phone: b.phone,
        email: b.email,
        status: (b.status as any) ?? 'pending',
        createdAt: b.createdAt || new Date().toISOString()
      }));
      setBookings(mappedBookings);
    } catch (e) {
      console.error('Failed to load bookings', e);
    }
  };

  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 pt-8">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg">
                <Camera className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">PhotoPro Studio</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Layanan fotografer dan videografer profesional untuk mengabadikan momen spesial Anda
            </p>
          </div>

          {/* View Selection Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Customer Card */}
            <div className="group cursor-pointer" onClick={() => setCurrentView('customer')}>
              <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transform hover:scale-105 transition-all duration-300">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <User className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Customer</h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Booking fotografer atau videografer untuk acara Anda dengan mudah dan cepat
                  </p>
                  <div className="flex items-center justify-center text-blue-600 font-semibold group-hover:text-blue-700">
                    <span>Mulai Booking</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Card */}
            <div className="group cursor-pointer" onClick={() => setCurrentView('admin')}>
              <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transform hover:scale-105 transition-all duration-300">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Shield className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin</h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Kelola booking requests dari customer dan data karyawan secara efisien
                  </p>
                  <div className="flex items-center justify-center text-orange-600 font-semibold group-hover:text-orange-700">
                    <span>Akses Dashboard</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{bookings.length}</div>
              <p className="text-gray-600">Total Bookings</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">{employees.length}</div>
              <p className="text-gray-600">Team Members</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {bookings.filter(b => b.status === 'completed').length}
              </div>
              <p className="text-gray-600">Completed Projects</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center bg-white rounded-xl shadow-lg px-6 py-4">
          <button
            onClick={() => setCurrentView('landing')}
            className="flex items-center space-x-2 text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors duration-200"
          >
            <Camera className="w-8 h-8" />
            <span>PhotoPro Studio</span>
          </button>
          
          <div className="flex space-x-4">
            <button
              onClick={() => setCurrentView('customer')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                currentView === 'customer'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Customer
            </button>
            <button
              onClick={() => setCurrentView('admin')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                currentView === 'admin'
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-600 hover:text-orange-600'
              }`}
            >
              Admin
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        {currentView === 'customer' && (
          <CustomerView 
            employees={employees}
            onBookingSubmit={handleBookingSubmit} 
          />
        )}
        
        {currentView === 'admin' && (
          <AdminView
            bookings={bookings}
            employees={employees}
            onStatusUpdate={handleStatusUpdate}
            onEmployeeAdd={handleEmployeeAdd}
            onEmployeeUpdate={handleEmployeeUpdate}
            onEmployeeDelete={handleEmployeeDelete}
            onLoadBookings={handleLoadBookings}
            onLoadEmployees={handleLoadEmployees}
          />
        )}
      </main>
    </div>
  );
}

export default App;
