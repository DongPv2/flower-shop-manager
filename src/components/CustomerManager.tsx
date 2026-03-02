import React, { useEffect, useMemo, useState } from 'react';
import { FaUsers, FaSearch, FaTrash } from 'react-icons/fa';
import { Customer } from '../types';
import { sql } from '../lib/database';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';

type CustomerWithStats = Customer & {
  total_completed_amount: number;
  completed_orders_count: number;
  last_order_date: string | null;
};

const getRank = (totalCompletedAmount: number) => {
  if (totalCompletedAmount >= 3000000) return 'Kim cương';
  if (totalCompletedAmount >= 2000000) return 'Vàng';
  if (totalCompletedAmount >= 1000000) return 'Bạc';
  return 'Đồng';
};

const getRankColor = (rank: string) => {
  switch (rank) {
    case 'Kim cương':
      return 'bg-blue-100 text-blue-800';
    case 'Vàng':
      return 'bg-yellow-100 text-yellow-800';
    case 'Bạc':
      return 'bg-gray-100 text-gray-800';
    case 'Đồng':
    default:
      return 'bg-orange-100 text-orange-800';
  }
};

const CustomerManager: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<any[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  const handleDeleteCustomer = async (customer: CustomerWithStats) => {
    if (user?.role !== 'admin') {
      toast.error('Bạn không có quyền xóa khách hàng này ❌');
      return;
    }

    const countResult = await sql`
      SELECT COUNT(*)::int AS count
      FROM orders
      WHERE customer_phone = ${customer.phone}
    `;
    const count = Number((countResult as any[])[0]?.count || 0);
    if (count > 0) {
      toast.error('Không thể xóa khách hàng đã có đơn hàng ❌');
      return;
    }

    const result = await Swal.fire({
      title: 'Xóa khách hàng?',
      text: `Bạn có chắc chắn muốn xóa khách hàng ${customer.phone} không?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
      await sql`DELETE FROM customers WHERE id = ${customer.id}`;
      setSelectedCustomer((prev) => (prev?.id === customer.id ? null : prev));
      setSelectedOrders((prev) => (selectedCustomer?.id === customer.id ? [] : prev));
      await fetchCustomers();
      toast.success('Xóa khách hàng thành công! 🗑️');

      try {
        window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { scope: 'customers' } }));
      } catch (error) {
        console.log('Could not refresh customers:', error);
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Lỗi khi xóa khách hàng. Vui lòng thử lại. ❌');
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const scope = (event as CustomEvent<{ scope?: 'customers' | 'all' }>).detail?.scope;
      if (scope === 'customers' || scope === 'all') {
        fetchCustomers();
        if (selectedCustomer) {
          fetchCustomerOrders(selectedCustomer.phone);
        }
      }
    };

    window.addEventListener('dataRefresh', handleRefresh);
    return () => {
      window.removeEventListener('dataRefresh', handleRefresh);
    };
  }, [selectedCustomer]);

  const fetchCustomers = async () => {
    try {
      const result = await sql`
        SELECT
          c.*, 
          COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0) AS total_completed_amount,
          COALESCE(COUNT(CASE WHEN o.status = 'completed' THEN 1 END), 0) AS completed_orders_count,
          MAX(o.created_at) AS last_order_date
        FROM customers c
        INNER JOIN orders o ON o.customer_phone = c.phone
        GROUP BY c.id
        ORDER BY last_order_date DESC
      `;

      setCustomers((result as any[]).map((r) => ({
        ...(r as Customer),
        total_completed_amount: Number(r.total_completed_amount || 0),
        completed_orders_count: Number(r.completed_orders_count || 0),
        last_order_date: r.last_order_date ? new Date(r.last_order_date).toISOString() : null
      })));
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomerOrders = async (phone: string) => {
    setIsOrdersLoading(true);
    try {
      const orders = await sql`
        SELECT *
        FROM orders
        WHERE customer_phone = ${phone}
        ORDER BY created_at DESC
      `;
      setSelectedOrders(orders as any[]);
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      setSelectedOrders([]);
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const phone = (c.phone || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      return phone.includes(q) || name.includes(q);
    });
  }, [customers, search]);

  const handleSelectCustomer = (c: CustomerWithStats) => {
    setSelectedCustomer(c);
    fetchCustomerOrders(c.phone);
  };

  if (isLoading) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Khách hàng</h2>
        <div className="flex items-center gap-2">
          <FaUsers className="text-gray-500" />
          <span className="text-sm text-gray-600">{customers.length} khách</span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <FaSearch className="text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            placeholder="Tìm theo SĐT hoặc tên khách..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SĐT</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng chi (Hoàn thành)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Đơn hoàn thành</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gần nhất</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((c) => {
                  const rank = getRank(c.total_completed_amount);
                  const isActive = selectedCustomer?.id === c.id;

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-gray-50 cursor-pointer ${isActive ? 'bg-pink-50' : ''}`}
                      onClick={() => handleSelectCustomer(c)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.name || <span className="text-gray-400 italic">Không có</span>}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs rounded-full ${getRankColor(rank)}`}>{rank}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {Math.round(c.total_completed_amount).toLocaleString('vi-VN')}₫
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.completed_orders_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('vi-VN') : <span className="text-gray-400 italic">-</span>}
                      </td>
                    </tr>
                  );
                })}

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                      Không tìm thấy khách hàng.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold mb-3">Chi tiết</h3>

          {!selectedCustomer ? (
            <div className="text-sm text-gray-500">Chọn 1 khách để xem lịch sử đơn hàng.</div>
          ) : (
            <div className="space-y-3">
              {user?.role === 'admin' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomer(selectedCustomer)}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                    title="Xóa khách hàng"
                  >
                    <FaTrash />
                    Xóa khách
                  </button>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500">SĐT</div>
                <div className="font-medium">{selectedCustomer.phone}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Tên</div>
                <div className="font-medium">{selectedCustomer.name || <span className="text-gray-400 italic">Không có</span>}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Địa chỉ</div>
                <div className="text-sm">{selectedCustomer.address || <span className="text-gray-400 italic">Không có</span>}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Ghi chú</div>
                <div className="text-sm">{selectedCustomer.notes || <span className="text-gray-400 italic">Không có</span>}</div>
              </div>

              <div className="pt-2 border-t">
                <div className="text-sm font-medium mb-2">Đơn hàng</div>

                {isOrdersLoading ? (
                  <div className="text-sm text-gray-500">Đang tải đơn hàng...</div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {selectedOrders.map((o) => (
                      <div key={o.id} className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between">
                          <div className="text-sm font-medium">{new Date(o.delivery_date).toLocaleDateString('vi-VN')} {o.delivery_time}</div>
                          <div className={`text-xs px-2 py-1 rounded-full ${o.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{o.status}</div>
                        </div>
                        <div className="text-sm text-gray-700 mt-1">{Math.round(Number(o.total_amount)).toLocaleString('vi-VN')}₫</div>
                        {o.notes && <div className="text-xs text-gray-500 mt-1">{o.notes}</div>}
                      </div>
                    ))}

                    {selectedOrders.length === 0 && (
                      <div className="text-sm text-gray-500">Khách này chưa có đơn hàng.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerManager;
