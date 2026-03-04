import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaEdit, FaMoneyBillWave, FaCheck, FaClock, FaUndo } from 'react-icons/fa';
import { Expense } from '../types';
import { sql } from '../lib/database';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import 'react-toastify/dist/ReactToastify.css';
import 'sweetalert2/dist/sweetalert2.css';

const ExpenseManager: React.FC = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    category: 'Hoa tươi',
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

  const categories = [
    'Nguyên vật liệu',
    'Điện nước',
    'Nhân viên',
    'Marketing',
    'Vận chuyển',
    'Hoa tươi',
    'Khác'
  ];

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const result = await sql`
        SELECT e.*, u.name as user_name
        FROM expenses e
        LEFT JOIN users u ON e.user_id = u.id
        ORDER BY e.created_at DESC
      `;
      setExpenses(result as any[]);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (expenseId: string) => {
    if (user?.role !== 'accountant' && user?.role !== 'admin') {
      toast.error('Bạn không có quyền thanh toán chi tiêu này ❌');
      return;
    }

    try {
      await sql`
        UPDATE expenses 
        SET status = 'paid'
        WHERE id = ${expenseId}
      `;

      fetchExpenses();
      toast.success('Đã thanh toán chi tiêu! 💰');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Lỗi khi thanh toán. Vui lòng thử lại. ❌');
    }
  };

  const handleUnpay = async (expenseId: string) => {
    if (user?.role !== 'accountant' && user?.role !== 'admin') {
      toast.error('Bạn không có quyền hủy thanh toán chi tiêu này ❌');
      return;
    }

    const result = await Swal.fire({
      title: 'Xác nhận hủy thanh toán?',
      text: 'Bạn có chắc chắn muốn hủy thanh toán khoản chi tiêu này không?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f97316',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Hủy thanh toán',
      cancelButtonText: 'Không'
    });

    if (result.isConfirmed) {
      try {
        await sql`
          UPDATE expenses 
          SET status = 'pending'
          WHERE id = ${expenseId}
        `;

        fetchExpenses();
        toast.success('Đã hủy thanh toán chi tiêu!');
      } catch (error) {
        console.error('Error unpaying expense:', error);
        toast.error('Lỗi khi hủy thanh toán. Vui lòng thử lại. ❌');
      }
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
      if (editingExpense) {
        await sql`
          UPDATE expenses 
          SET amount = ${amount}, 
              category = ${formData.category}, 
              description = ${formData.description}, 
              date = ${formData.date}
          WHERE id = ${editingExpense.id}
        `;
        toast.success('Cập nhật chi tiêu thành công! ✏️');
      } else {
        await sql`
          INSERT INTO expenses (amount, category, description, date, user_id)
          VALUES (${amount}, ${formData.category}, ${formData.description}, ${formData.date}, ${user.id})
        `;
        toast.success('Thêm chi tiêu thành công!');
      }

      fetchExpenses();
      resetForm();

      // Trigger dashboard refresh
      window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { scope: 'expenses' } }));
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Lỗi khi lưu chi tiêu. Vui lòng thử lại. ❌');
    }
  };

  const handleEdit = (expense: Expense) => {
    // Only allow editing if user created this expense or is admin
    if (expense.user_id !== user?.id && user?.role !== 'admin') {
      toast.error('Bạn không có quyền sửa chi tiêu này ❌');
      return;
    }
    setEditingExpense(expense);
    setFormData({
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description,
      date: expense.date
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    // Find the expense to check ownership
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    // Only allow deleting if user created this expense or is admin
    if (expense.user_id !== user?.id && user?.role !== 'admin') {
      toast.error('Bạn không có quyền xóa chi tiêu này ❌');
      return;
    }

    Swal.fire({
      title: 'Xác nhận xóa',
      text: "Bạn có chắc chắn muốn xóa chi tiêu này không?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await sql`DELETE FROM expenses WHERE id = ${id}`;
          fetchExpenses();
          toast.success('Xóa chi tiêu thành công! 🗑️');
        } catch (error) {
          console.error('Error deleting expense:', error);
          toast.error('Lỗi khi xóa chi tiêu. Vui lòng thử lại. ❌');
        }
      }
    });
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setEditingExpense(null);
    setShowForm(false);
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  if (isLoading) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Quản lý Chi tiêu</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
        >
          <FaPlus />
          Thêm chi tiêu
        </button>
      </div>

      <div className="bg-red-50 p-6 rounded-lg border border-red-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-600 text-sm font-medium">Tổng Chi tiêu</p>
            <p className="text-3xl font-bold text-red-700">
              {totalExpenses.toLocaleString('vi-VN')}₫
            </p>
          </div>
          <FaMoneyBillWave className="text-4xl text-red-500" />
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">
            {editingExpense ? 'Sửa chi tiêu' : 'Thêm chi tiêu mới'}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Số tiền"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Danh mục
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ngày
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mô tả (tùy chọn)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Mô tả chi tiêu"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
              >
                {editingExpense ? 'Cập nhật' : 'Thêm'}
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

      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Quản lý Chi tiêu</h3>
          <p className="text-sm text-gray-600 mt-1">
            Hiển thị {expenses.length} khoản chi tiêu
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Ngày
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Danh mục
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[200px]">
                  Mô tả
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Số tiền
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Người tạo
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-all duration-200 hover:shadow-sm">

                  {/* TRẠNG THÁI (đưa lên đầu) */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {(expense as any).status === 'paid' ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                          <FaCheck className="mr-1" /> Đã thanh toán
                        </span>
                        {(user?.role === 'accountant' || user?.role === 'admin') && (
                          <button
                            onClick={() => handleUnpay(expense.id)}
                            className="inline-flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-orange-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                            title="Hủy thanh toán"
                          >
                            <FaUndo title="Hủy thanh toán" />
                          </button>
                        )}
                      </div>
                    ) : (
                      (user?.role === 'accountant' || user?.role === 'admin') ? (
                        <button
                          onClick={() => handlePayment(expense.id)}
                          className="inline-flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-green-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                        >
                          Thanh toán
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                          <FaClock className="mr-1" /> Chờ thanh toán
                        </span>
                      )
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="font-semibold text-gray-900">
                      {new Date(expense.date).toLocaleDateString('vi-VN')}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-red-50 to-orange-50 text-red-700 rounded-full text-xs font-medium border border-red-200">
                      {expense.category}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="truncate max-w-xs" title={expense.description}>
                      {expense.description}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-red-600">
                        {Number(expense.amount).toLocaleString('vi-VN')}₫
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="font-medium text-gray-900">
                      {(expense as any).user_name || 'Unknown'}
                    </span>
                  </td>

                  {/* THAO TÁC (đã bỏ nút thanh toán) */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
                        title="Sửa"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
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
    </div >
  );
};

export default ExpenseManager;
