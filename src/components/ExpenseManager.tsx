import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaEdit, FaMoneyBillWave, FaCheck, FaClock, FaUndo, FaTimes } from 'react-icons/fa';
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
  const [users, setUsers] = useState<any[]>([]);
  const [selectedFilterUser, setSelectedFilterUser] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    category: 'Hoa tươi',
    description: '',
    date: new Date().toISOString().split('T')[0],
    user_id: user?.id || ''
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
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const result = await sql`
        SELECT id, name, role 
        FROM users 
        WHERE role IN ('admin', 'employee', 'accountant')
        ORDER BY name ASC
      `;
      setUsers(result as any[]);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

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

  const handlePayAllForUser = async () => {
    if (!selectedFilterUser || pendingExpensesForUser.length === 0) return;

    if (user?.role !== 'accountant' && user?.role !== 'admin') {
      toast.error('Bạn không có quyền thanh toán chi tiêu này ❌');
      return;
    }

    const selectedUserName = usersWithExpenses.find(u => u.id === selectedFilterUser)?.name || 'Unknown';

    const result = await Swal.fire({
      title: 'Thanh toán tất cả?',
      html: `
        <div>
          <p>Bạn có chắc chắn muốn thanh toán tất cả các khoản chi tiêu <strong>chưa thanh toán</strong> của:</p>
          <p class="text-lg font-bold text-blue-600">${selectedUserName}</p>
          <p class="text-sm text-gray-600">Số lượng: ${pendingExpensesForUser.length} khoản</p>
          <p class="text-lg font-bold text-red-600">Tổng: ${pendingTotalForUser.toLocaleString('vi-VN')}₫</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Thanh toán tất cả',
      cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
      try {
        const expenseIds = pendingExpensesForUser.map(exp => exp.id);
        await sql`
          UPDATE expenses 
          SET status = 'paid'
          WHERE id = ANY(${expenseIds})
        `;

        fetchExpenses();
        toast.success(`Đã thanh toán ${pendingExpensesForUser.length} khoản chi tiêu cho ${selectedUserName}! 💰`);
      } catch (error) {
        console.error('Error paying all expenses:', error);
        toast.error('Lỗi khi thanh toán. Vui lòng thử lại. ❌');
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
    let amount = parseInt(cleanAmount);

    if (!amount || amount <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ ❌');
      return;
    }

    if (amount < 1000) {
      amount = amount * 1000;
    }

    try {
      if (editingExpense) {
        const selectedUserId = user?.role === 'admin' ? formData.user_id : editingExpense.user_id;
        await sql`
          UPDATE expenses 
          SET amount = ${amount}, 
              category = ${formData.category}, 
              description = ${formData.description}, 
              date = ${formData.date},
              user_id = ${selectedUserId}
          WHERE id = ${editingExpense.id}
        `;
        toast.success('Cập nhật chi tiêu thành công! ✏️');
      } else {
        const selectedUserId = user?.role === 'admin' ? formData.user_id : user?.id;
        await sql`
          INSERT INTO expenses (amount, category, description, date, user_id)
          VALUES (${amount}, ${formData.category}, ${formData.description}, ${formData.date}, ${selectedUserId})
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
      amount: Number(expense.amount).toLocaleString('vi-VN'),
      category: expense.category,
      description: expense.description,
      date: new Date(expense.date).toLocaleDateString('en-CA'),
      user_id: expense.user_id
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
      date: new Date().toISOString().split('T')[0],
      user_id: user?.id || ''
    });
    setEditingExpense(null);
    setShowForm(false);
  };

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      resetForm();
    }
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showForm) {
        resetForm();
      }
    };

    if (showForm) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [showForm, resetForm]);

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  // Get unique users who have expenses
  const usersWithExpenses = Array.from(
    new Set(expenses.map(exp => exp.user_id))
  ).map(userId => {
    const expense = expenses.find(exp => exp.user_id === userId);
    return {
      id: userId,
      name: (expense as any)?.user_name || 'Unknown'
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Filter expenses by selected user
  const filteredExpenses = selectedFilterUser
    ? expenses.filter(exp => exp.user_id === selectedFilterUser)
    : expenses;

  // Calculate totals
  const filteredUserTotal = selectedFilterUser
    ? filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
    : 0;

  const pendingExpensesForUser = selectedFilterUser
    ? filteredExpenses.filter(exp => (exp as any).status === 'pending')
    : [];

  const pendingTotalForUser = selectedFilterUser
    ? pendingExpensesForUser.reduce((sum, exp) => sum + Number(exp.amount), 0)
    : 0;

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

      {/* Filter Section */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="space-y-4">
          {/* Filter dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lọc theo người chi trả
            </label>
            <select
              value={selectedFilterUser}
              onChange={(e) => setSelectedFilterUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Tất cả người chi trả</option>
              {usersWithExpenses.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Bulk payment button */}
          {selectedFilterUser && pendingExpensesForUser.length > 0 && (user?.role === 'accountant' || user?.role === 'admin') && (
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium text-green-800">
                    {pendingExpensesForUser.length} khoản chờ thanh toán
                  </p>
                  <p className="text-green-600">
                    Tổng chờ thanh toán: {pendingTotalForUser.toLocaleString('vi-VN')}₫
                  </p>
                </div>
                <button
                  onClick={handlePayAllForUser}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
                >
                  <FaCheck />
                  Thanh toán tất cả
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-red-50 p-6 rounded-lg border border-red-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-600 text-sm font-medium">Tổng Chi tiêu</p>
            <p className="text-3xl font-bold text-red-700">
              {totalExpenses.toLocaleString('vi-VN')}₫
            </p>
            {selectedFilterUser && (
              <div className="mt-2 pt-2 border-t border-red-200">
                <p className="text-red-500 text-sm font-medium">
                  Chi tiêu của {usersWithExpenses.find(u => u.id === selectedFilterUser)?.name}
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredUserTotal.toLocaleString('vi-VN')}₫
                </p>
              </div>
            )}
          </div>
          <FaMoneyBillWave className="text-4xl text-red-500" />
        </div>
      </div>

      {/* Expense Add/Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-hidden !mt-0"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingExpense ? 'Sửa chi tiêu' : 'Thêm chi tiêu mới'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
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

                    {/* User selection - only for admin */}
                    {user?.role === 'admin' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Người chi trả
                        </label>
                        <select
                          value={formData.user_id}
                          onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        >
                          {users.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
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
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Quản lý Chi tiêu</h3>
          <p className="text-sm text-gray-600 mt-1">
            Hiển thị {filteredExpenses.length} khoản chi tiêu {selectedFilterUser && `của ${usersWithExpenses.find(u => u.id === selectedFilterUser)?.name}`}
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
                  Người chi trả
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExpenses.map((expense) => (
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

                  {/* THAO TÁC */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      {/* Edit button - only admin */}
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => handleEdit(expense)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
                          title="Sửa"
                        >
                          <FaEdit />
                        </button>
                      )}
                      {/* Delete button - only admin or owner */}
                      {(expense.user_id === user?.id || user?.role === 'admin') && (
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
                          title="Xóa"
                        >
                          <FaTrash />
                        </button>
                      )}
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
