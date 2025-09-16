import React, { useState } from 'react';
import { Plus, Edit2, Trash2, User, Mail, Phone, Camera, Video, Users, RefreshCw, Loader2 } from 'lucide-react';
import { useNotify } from './ToastProvider';
import { Employee } from '../types';

interface EmployeeManagerProps {
  employees: Employee[];
  onAdd: (employee: Omit<Employee, 'id' | 'createdAt'>) => Promise<boolean> | boolean;
  onUpdate: (id: string, employee: Omit<Employee, 'id' | 'createdAt'>) => Promise<boolean> | boolean;
  onDelete: (id: string) => Promise<boolean> | boolean;
  onReload?: () => Promise<void> | void;
}

const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  employees,
  onAdd,
  onUpdate,
  onDelete,
  onReload
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    role: 'photographer' as 'photographer' | 'videographer',
    email: '',
    phone: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [loadingList, setLoadingList] = useState(false);
  const notify = useNotify();

  const resetForm = () => {
    setFormData({
      name: '',
      role: 'photographer',
      email: '',
      phone: ''
    });
    setErrors({});
    setEditingEmployee(null);
    setShowForm(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) newErrors.name = 'Nama tidak boleh kosong';
    if (!formData.email.trim()) newErrors.email = 'Email tidak boleh kosong';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Format email tidak valid';
    if (!formData.phone.trim()) newErrors.phone = 'Nomor HP tidak boleh kosong';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      if (editingEmployee) {
        const ok = await Promise.resolve(onUpdate(editingEmployee.id, formData));
        ok ? notify.success('Karyawan diperbarui') : notify.error('Gagal memperbarui karyawan');
      } else {
        const ok = await Promise.resolve(onAdd(formData));
        ok ? notify.success('Karyawan ditambahkan') : notify.error('Gagal menambahkan karyawan');
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setFormData({
      name: employee.name,
      role: employee.role,
      email: employee.email,
      phone: employee.phone
    });
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus karyawan ini?')) return;
    try {
      setProcessing(prev => ({ ...prev, [id]: true }));
      const ok = await Promise.resolve(onDelete(id));
      ok ? notify.success('Karyawan dihapus') : notify.error('Gagal menghapus karyawan');
    } finally {
      setProcessing(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getRoleIcon = (role: Employee['role']) => {
    switch (role) {
      case 'photographer': return <Camera className="w-4 h-4" />;
      case 'videographer': return <Video className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: Employee['role']) => {
    switch (role) {
      case 'photographer': return 'bg-blue-100 text-blue-800';
      case 'videographer': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Kelola Karyawan</h2>
        <div className="flex space-x-3">
          <button
            onClick={async () => {
              if (!onReload) return window.location.reload();
              try {
                setLoadingList(true);
                await onReload();
                notify.success('Data karyawan dimuat');
              } catch (e) {
                notify.error('Gagal memuat data karyawan');
              } finally {
                setLoadingList(false);
              }
            }}
            disabled={loadingList}
            className={`flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg transition-colors duration-200 ${loadingList ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'}`}
          >
            {loadingList ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Karyawan
          </button>
        </div>
      </div>

      {/* Employee Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">
              {editingEmployee ? 'Edit Karyawan' : 'Tambah Karyawan'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="photographer">Photographer</option>
                  <option value="videographer">Videographer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor HP</label>
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

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors duration-200 ${submitting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 inline-block animate-spin align-text-top" />}
                  {editingEmployee ? (submitting ? 'Memproses…' : 'Update') : (submitting ? 'Memproses…' : 'Tambah')}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee List */}
      {employees.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Belum ada karyawan</h3>
          <p className="text-gray-500">Mulai dengan menambahkan karyawan pertama Anda</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {employees.map((employee) => (
            <div key={employee.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                    {employee.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(employee.role)}`}>
                      {getRoleIcon(employee.role)}
                      <span className="ml-1 capitalize">{employee.role}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(employee)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(employee.id)}
                    disabled={!!processing[employee.id]}
                    className={`p-2 rounded-lg transition-colors duration-200 ${processing[employee.id] ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                  >
                    {processing[employee.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center text-gray-600">
                  <Mail className="w-4 h-4 mr-2" />
                  <span className="text-sm">{employee.email}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Phone className="w-4 h-4 mr-2" />
                  <span className="text-sm">{employee.phone}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeManager;
