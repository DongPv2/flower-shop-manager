import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaEdit, FaChartLine } from 'react-icons/fa';
import { Revenue } from '../types';
import { sql } from '../lib/database';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import 'react-toastify/dist/ReactToastify.css';
import 'sweetalert2/dist/sweetalert2.css';

const RevenueManager: React.FC = () => {
  const { user } = useAuth();
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    customer_name: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Format price input to Vietnamese format
  const formatPriceInput = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue === '') return '';
    return parseInt(cleanValue).toLocaleString('vi-VN');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatPriceInput(e.target.value);
    setFormData({ ...formData, amount: formattedValue });
  };

  useEffect(() => {
    fetchRevenues();
  }, []);

  const fetchRevenues = async () => {
    try {
      const result = await sql`
        SELECT r.*, u.name as user_name
        FROM revenues r
        LEFT JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
      `;
      setRevenues(result as any[]);
    } catch (error) {
      console.error('Error fetching revenues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Bạn cần đăng nhập để thực hiện thao tác này ❌');
      return;
    }

    // Parse formatted amount (remove dots and convert to number)
    const cleanAmount = formData.amount.replace(/\D/g, '');
    const amount = parseInt(cleanAmount);

    if (!amount || amount <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ ❌');
      return;
    }

    try {
      if (editingRevenue) {
        await sql`
          UPDATE revenues 
          SET amount = ${amount}, 
              customer_name = ${formData.customer_name}, 
              description = ${formData.description}, 
              date = ${formData.date}
          WHERE id = ${editingRevenue.id}
        `;
        toast.success('Cập nhật doanh thu thành công! ✏️');
      } else {
        await sql`
          INSERT INTO revenues (amount, customer_name, description, date, user_id)
          VALUES (${amount}, ${formData.customer_name}, ${formData.description}, ${formData.date}, ${user.id})
        `;
        toast.success('Thêm doanh thu thành công! 💰');
      }

      fetchRevenues();
      resetForm();

      // Trigger dashboard refresh
      window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { scope: 'revenues' } }));
    } catch (error) {
      console.error('Error saving revenue:', error);
      toast.error('Lỗi khi lưu doanh thu. Vui lòng thử lại. ❌');
    }
  };

  const handleEdit = (revenue: Revenue) => {
    // Only allow editing if user created this revenue or is admin
    if (revenue.user_id !== user?.id && user?.role !== 'admin') {
      alert('Bạn không có quyền sửa doanh thu này');
      return;
    }
    setEditingRevenue(revenue);
    setFormData({
      amount: revenue.amount.toString(),
      customer_name: revenue.customer_name || '',
      description: revenue.description,
      date: revenue.date
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    // Find the revenue to check ownership
    const revenue = revenues.find(r => r.id === id);
    if (!revenue) return;

    // Only allow deleting if user created this revenue or is admin
    if (revenue.user_id !== user?.id && user?.role !== 'admin') {
      toast.error('Bạn không có quyền xóa doanh thu này ❌');
      return;
    }

    Swal.fire({
      title: 'Xác nhận xóa',
      text: "Bạn có chắc chắn muốn xóa doanh thu này không?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await sql`DELETE FROM revenues WHERE id = ${id}`;
          fetchRevenues();
          toast.success('Xóa doanh thu thành công! 🗑️');
        } catch (error) {
          console.error('Error deleting revenue:', error);
          toast.error('Lỗi khi xóa doanh thu. Vui lòng thử lại. ❌');
        }
      }
    });
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      customer_name: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setEditingRevenue(null);
    setShowForm(false);
  };

  const totalRevenues = revenues.reduce((sum, rev) => sum + Number(rev.amount), 0);

  if (isLoading) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Quản lý Doanh thu</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
        >
          <FaPlus />
          Thêm doanh thu
        </button>
      </div>

      <div className="bg-green-50 p-6 rounded-lg border border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-600 text-sm font-medium">Tổng Doanh thu</p>
            <p className="text-3xl font-bold text-green-700">
              {totalRevenues.toLocaleString('vi-VN')}₫
            </p>
          </div>
          <FaChartLine className="text-4xl text-green-500" />
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">
            {editingRevenue ? 'Sửa doanh thu' : 'Thêm doanh thu mới'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Số tiền
                </label>
                <input
                  type="text"
                  value={formData.amount}
                  onChange={handleAmountChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="1.000.000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên khách hàng
                </label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Tên khách hàng (không bắt buộc)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ngày
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mô tả
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Mô tả giao dịch"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
              >
                {editingRevenue ? 'Cập nhật' : 'Thêm'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Khách hàng
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mô tả
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số tiền
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Người tạo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {revenues.map((revenue) => (
                <tr key={revenue.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(revenue.date).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {revenue.customer_name || (
                      <span className="text-gray-400 italic">Không có</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {revenue.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    {Number(revenue.amount).toLocaleString('vi-VN')}₫
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(revenue as any).user_name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(revenue)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Sửa"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(revenue.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Xóa"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RevenueManager;
