import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMoneyBillWave, FaChartLine, FaShoppingCart, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { Expense, Revenue } from '../types';
import { sql } from '../lib/database';
import ExpenseManager from './ExpenseManager';
import RevenueManager from './RevenueManager';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'revenues'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      const expensesData = await sql`SELECT * FROM expenses ORDER BY date DESC`;
      const revenuesData = await sql`SELECT * FROM revenues ORDER BY date DESC`;

      setExpenses(expensesData as Expense[]);
      setRevenues(revenuesData as Revenue[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const totalRevenues = revenues.reduce((sum, rev) => sum + Number(rev.amount), 0);
  const profit = totalRevenues - totalExpenses;

  const DashboardView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Tổng Doanh thu</p>
              <p className="text-2xl font-bold text-green-700">
                {totalRevenues.toLocaleString('vi-VN')}₫
              </p>
            </div>
            <FaChartLine className="text-3xl text-green-500" />
          </div>
        </div>

        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 text-sm font-medium">Tổng Chi tiêu</p>
              <p className="text-2xl font-bold text-red-700">
                {totalExpenses.toLocaleString('vi-VN')}₫
              </p>
            </div>
            <FaMoneyBillWave className="text-3xl text-red-500" />
          </div>
        </div>

        <div className={`${profit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} p-6 rounded-lg border`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${profit >= 0 ? 'text-blue-600' : 'text-orange-600'} text-sm font-medium`}>
                Lợi nhuận
              </p>
              <p className={`text-2xl font-bold ${profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {profit.toLocaleString('vi-VN')}₫
              </p>
            </div>
            <FaShoppingCart className={`text-3xl ${profit >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Giao dịch gần đây</h3>
          <div className="space-y-3">
            {revenues.slice(0, 5).map((revenue) => (
              <div key={revenue.id} className="flex justify-between items-center p-3 bg-green-50 rounded">
                <div>
                  <p className="font-medium">{revenue.description}</p>
                  <p className="text-sm text-gray-600">{new Date(revenue.date).toLocaleDateString('vi-VN')}</p>
                </div>
                <p className="text-green-600 font-semibold">
                  +{Number(revenue.amount).toLocaleString('vi-VN')}₫
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
        <div className="flex space-x-1 mb-8 bg-white rounded-lg border p-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2 px-4 rounded-md transition ${activeTab === 'dashboard'
              ? 'bg-pink-500 text-white'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Tổng quan
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 py-2 px-4 rounded-md transition ${activeTab === 'expenses'
              ? 'bg-pink-500 text-white'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Chi tiêu
          </button>
          <button
            onClick={() => setActiveTab('revenues')}
            className={`flex-1 py-2 px-4 rounded-md transition ${activeTab === 'revenues'
              ? 'bg-pink-500 text-white'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Doanh thu
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'expenses' && <ExpenseManager />}
            {activeTab === 'revenues' && <RevenueManager />}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
