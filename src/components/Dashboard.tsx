import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMoneyBillWave, FaChartLine, FaShoppingCart, FaSignOutAlt, FaClock, FaDollarSign } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { Expense } from '../types';
import { Order } from '../types';
import { sql, createTables } from '../lib/database';
import ExpenseManager from './ExpenseManager';
import UserManager from './UserManager';
import OrderManager from './OrderManager';
import CustomerManager from './CustomerManager';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'users' | 'orders' | 'customers'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const hasFetchedInitiallyRef = useRef(false);


  const fetchExpenses = useCallback(async () => {
    const expensesData = await sql`SELECT * FROM expenses ORDER BY date DESC`;
    setExpenses(expensesData as Expense[]);
  }, []);

  const fetchOrders = useCallback(async () => {
    const ordersData = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    setOrders(ordersData as Order[]);
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      await Promise.all([fetchExpenses(), fetchOrders()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchExpenses, fetchOrders]);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    // Initialize database tables and migrations
    const initializeDatabase = async () => {
      try {
        await createTables();
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Database initialization failed:', error);
      }
    };

    if (!hasFetchedInitiallyRef.current) {
      hasFetchedInitiallyRef.current = true;
      initializeDatabase();
      fetchAllData();
    }

    // Listen for data refresh events
    const handleDataRefresh = (event: Event) => {
      const scope = (event as CustomEvent<{ scope?: 'all' | 'orders' | 'expenses' | 'customers' }>).detail?.scope;
      if (!scope || scope === 'all') {
        fetchAllData();
        return;
      }

      if (scope === 'orders') {
        fetchOrders();
        return;
      }

      if (scope === 'expenses') {
        fetchExpenses();
        return;
      }

      if (scope === 'customers') {
        // Customer tab fetches its own data; keep dashboard totals unchanged
        return;
      }
    };

    window.addEventListener('dataRefresh', handleDataRefresh);

    return () => {
      window.removeEventListener('dataRefresh', handleDataRefresh);
    };
  }, [user, navigate, fetchAllData, fetchOrders, fetchExpenses]);

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const totalRevenues = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + Number(o.total_amount), 0);
  const profit = totalRevenues - totalExpenses;

  // Payment status calculations
  const paidOrders = orders.filter(o => o.is_paid === true);
  const completedUnpaidOrders = orders.filter(o => o.status === 'completed' && o.is_paid === false);
  const paidOrdersAmount = paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const completedUnpaidOrdersAmount = completedUnpaidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

  // Handle navigation to orders tab with filter
  const handleNavigateToOrders = (filterType?: 'completed-unpaid') => {
    setActiveTab('orders');

    // Store filter state for OrderManager to use
    if (filterType === 'completed-unpaid') {
      // Add small delay to ensure OrderManager component is mounted
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('setOrderFilter', {
          detail: {
            status: 'completed',
            isPaid: false
          }
        }));
      }, 100);
    }
  };

  const DashboardView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Doanh thu</p>
              <p className="text-3xl font-bold text-green-700">
                {totalRevenues.toLocaleString('vi-VN')}₫
              </p>
              <p className="text-xs text-green-600 mt-1">
                {new Date().toLocaleDateString('vi-VN')}
              </p>
            </div>
            <FaMoneyBillWave className="text-4xl text-green-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl border border-red-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 text-sm font-medium">Chi tiêu</p>
              <p className="text-3xl font-bold text-red-700">
                {totalExpenses.toLocaleString('vi-VN')}₫
              </p>
              <p className="text-xs text-red-600 mt-1">
                {new Date().toLocaleDateString('vi-VN')}
              </p>
            </div>
            <FaChartLine className="text-4xl text-red-500" />
          </div>
        </div>

        <div className={`${profit >= 0 ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'} p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${profit >= 0 ? 'text-blue-600' : 'text-orange-600'} text-sm font-medium`}>
                Lợi nhuận
              </p>
              <p className={`text-3xl font-bold ${profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {profit.toLocaleString('vi-VN')}₫
              </p>
            </div>
            <div className={`${profit >= 0 ? 'text-blue-500' : 'text-orange-500'} transition-colors duration-300`}>
              {profit >= 0 ? <FaShoppingCart className="text-3xl" /> : <FaMoneyBillWave className="text-3xl" />}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="bg-gradient-to-br from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-emerald-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-600 text-sm font-medium">Đơn hàng đã thanh toán</p>
              <p className="text-2xl font-bold text-emerald-700">
                {paidOrders.length}
              </p>
              <p className="text-sm text-emerald-600 mt-1">
                Tổng: {paidOrdersAmount.toLocaleString('vi-VN')}₫
              </p>
            </div>
            <FaDollarSign className="text-3xl text-emerald-500" />
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:bg-orange-100"
          onClick={() => handleNavigateToOrders('completed-unpaid')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Hoàn thành chưa thanh toán</p>
              <p className="text-2xl font-bold text-orange-700">
                {completedUnpaidOrders.length}
              </p>
              <p className="text-sm text-orange-600 mt-1">
                Tổng: {completedUnpaidOrdersAmount.toLocaleString('vi-VN')}₫
              </p>
            </div>
            <FaClock className="text-3xl text-orange-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Đơn hàng gần đây</h3>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{order.customer_name}</p>
                  <p className="text-sm text-gray-600">{new Date(order.delivery_date).toLocaleDateString('vi-VN')}</p>
                </div>
                <p className="text-gray-800 font-semibold">
                  {Number(order.total_amount).toLocaleString('vi-VN')}₫
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Chi tiêu gần đây</h3>
          <div className="space-y-3">
            {expenses.slice(0, 5).map((expense) => (
              <div key={expense.id} className="flex justify-between items-center p-3 bg-red-50 rounded">
                <div>
                  <p className="font-medium">{expense.description}</p>
                  <p className="text-sm text-gray-600">{expense.category}</p>
                </div>
                <p className="text-red-600 font-semibold">
                  -{Number(expense.amount).toLocaleString('vi-VN')}₫
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tiệm hoa mặt trời nhỏ</h1>
              <p className="text-sm text-gray-600">Chào mừng, {user?.name}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              <FaSignOutAlt />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 bg-white rounded-lg border p-1 overflow-x-auto">
          <div className="inline-flex gap-1 min-w-max whitespace-nowrap">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`shrink-0 py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 ${activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              <span className="font-semibold">Tổng quan</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`shrink-0 py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 ${activeTab === 'orders'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              <span className="font-semibold">Đơn hàng</span>
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`shrink-0 py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 ${activeTab === 'expenses'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              <span className="font-semibold">Chi tiêu</span>
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`shrink-0 py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 ${activeTab === 'customers'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              <span className="font-semibold">Khách hàng</span>
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`shrink-0 py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 ${activeTab === 'users'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
              >
                Tài khoản
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'orders' && <OrderManager />}
            {activeTab === 'customers' && <CustomerManager />}
            {activeTab === 'expenses' && <ExpenseManager />}
            {activeTab === 'users' && <UserManager />}
          </>
        )}

        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </div>
    </div>
  );
};

export default Dashboard;
