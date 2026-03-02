import React, { useState, useEffect, useRef } from 'react';
import { FaPlus, FaTrash, FaEdit, FaShoppingCart, FaCheck, FaClock, FaTimes, FaMoneyBillWave } from 'react-icons/fa';
import { Order, OrderItem } from '../types';
import { sql } from '../lib/database';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import 'react-toastify/dist/ReactToastify.css';
import 'sweetalert2/dist/sweetalert2.css';

const OrderManager: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const loadedCustomerPhoneRef = useRef<string | null>(null);
  const existingCustomerRef = useRef<{ phone: string; name?: string | null; address?: string | null } | null>(null);
  const phoneDebounceTimeoutRef = useRef<number | null>(null);
  const [phoneSuggestions, setPhoneSuggestions] = useState<Array<{ phone: string; name?: string | null; address?: string | null }>>([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_time: '09:00',
    notes: ''
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [newItem, setNewItem] = useState({ name: '', price: '', quantity: 1 });

  // Format price input to Vietnamese format
  const formatPriceInput = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue === '') return '';
    return parseInt(cleanValue).toLocaleString('vi-VN');
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatPriceInput(e.target.value);
    setNewItem({ ...newItem, price: formattedValue });
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    const phone = (formData.customer_phone || '').trim();
    if (!showForm) return;
    if (!phone) {
      loadedCustomerPhoneRef.current = null;
      existingCustomerRef.current = null;
      setPhoneSuggestions([]);
      return;
    }
    if (loadedCustomerPhoneRef.current === phone) return;

    const load = async () => {
      try {
        const result = await sql`SELECT * FROM customers WHERE phone = ${phone} LIMIT 1`;
        if ((result as any[]).length > 0) {
          const customer = (result as any[])[0];
          existingCustomerRef.current = {
            phone: customer.phone,
            name: customer.name ?? null,
            address: customer.address ?? null
          };
          setFormData((prev) => ({
            ...prev,
            customer_name: customer.name || prev.customer_name,
            customer_address: customer.address || prev.customer_address
          }));
        } else {
          existingCustomerRef.current = null;
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
      } finally {
        loadedCustomerPhoneRef.current = phone;
      }
    };

    load();
  }, [formData.customer_phone, showForm]);

  useEffect(() => {
    const phone = (formData.customer_phone || '').trim();
    if (!showForm) return;

    if (phoneDebounceTimeoutRef.current) {
      window.clearTimeout(phoneDebounceTimeoutRef.current);
    }

    if (!phone) {
      setPhoneSuggestions([]);
      return;
    }

    phoneDebounceTimeoutRef.current = window.setTimeout(async () => {
      try {
        const q = `${phone}%`;
        const result = await sql`
          SELECT phone, name, address
          FROM customers
          WHERE phone ILIKE ${q}
          ORDER BY phone
          LIMIT 5
        `;
        setPhoneSuggestions(result as any[]);
      } catch (error) {
        console.error('Error fetching customer suggestions:', error);
        setPhoneSuggestions([]);
      }
    }, 500);
  }, [formData.customer_phone, showForm]);

  const handleSelectPhoneSuggestion = (s: { phone: string; name?: string | null; address?: string | null }) => {
    loadedCustomerPhoneRef.current = s.phone;
    existingCustomerRef.current = { phone: s.phone, name: s.name ?? null, address: s.address ?? null };
    setPhoneSuggestions([]);
    setFormData((prev) => ({
      ...prev,
      customer_phone: s.phone,
      customer_name: s.name || prev.customer_name,
      customer_address: s.address || prev.customer_address
    }));
  };

  const fetchOrders = async () => {
    try {
      const result = await sql`
        SELECT o.*, u.name as user_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
      `;
      setOrders(result as any[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    try {
      const result = await sql`SELECT * FROM order_items WHERE order_id = ${orderId}`;
      return result as OrderItem[];
    } catch (error) {
      console.error('Error fetching order items:', error);
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Bạn cần đăng nhập để thực hiện thao tác này ❌');
      return;
    }

    if (orderItems.length === 0) {
      toast.error('Vui lòng thêm ít nhất một sản phẩm vào đơn hàng ❌');
      return;
    }

    try {
      const totalItem = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      if (!totalItem) {
        toast.error('Số lượng sản phẩm phải lớn hơn 0 ❌');
        return;
      }
      const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0);

      if (editingOrder) {
        await sql`
          UPDATE orders 
          SET customer_name = ${formData.customer_name}, 
              customer_phone = ${formData.customer_phone},
              customer_address = ${formData.customer_address},
              delivery_date = ${formData.delivery_date},
              delivery_time = ${formData.delivery_time},
              total_amount = ${totalAmount},
              notes = ${formData.notes}
          WHERE id = ${editingOrder.id}
        `;
        setTimeout(() => {
          toast.success('Cập nhật đơn hàng thành công! ✏️');
        }, 0);
      } else {
        const orderResult = await sql`
          INSERT INTO orders (customer_name, customer_phone, customer_address, delivery_date, delivery_time, total_amount, status, notes, user_id)
          VALUES (${formData.customer_name}, ${formData.customer_phone}, ${formData.customer_address}, ${formData.delivery_date}, ${formData.delivery_time}, ${totalAmount}, 'pending', ${formData.notes}, ${user.id})
          RETURNING id
        `;

        const orderId = (orderResult as any)[0].id;

        // Add order items
        for (const item of orderItems) {
          await sql`
            INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
            VALUES (${orderId}, ${null}, ${item.product_name}, ${item.quantity}, ${item.unit_price}, ${item.total_price})
          `;
        }

        setTimeout(() => {
          toast.success('Thêm đơn hàng thành công! 🛒');
        }, 0);
      }

      const phone = (formData.customer_phone || '').trim();
      if (phone) {
        const existing = existingCustomerRef.current;
        if (!existing) {
          await sql`
            INSERT INTO customers (phone, name, address, notes)
            VALUES (${phone}, ${formData.customer_name || null}, ${formData.customer_address || null}, ${null})
            ON CONFLICT (phone)
            DO UPDATE SET
              name = EXCLUDED.name,
              address = EXCLUDED.address,
              updated_at = CURRENT_TIMESTAMP
          `;
        } else {
          const newName = (formData.customer_name || '').trim();
          const newAddress = (formData.customer_address || '').trim();
          const oldName = (existing.name || '').trim();
          const oldAddress = (existing.address || '').trim();
          const willOverwrite = (newName && newName !== oldName) || (newAddress && newAddress !== oldAddress);

          if (willOverwrite) {
            const confirmResult = await Swal.fire({
              title: 'Cập nhật thông tin khách hàng?',
              text: 'SĐT này đã tồn tại. Bạn có muốn cập nhật tên/địa chỉ theo dữ liệu mới không?',
              icon: 'question',
              showCancelButton: true,
              confirmButtonText: 'Cập nhật',
              cancelButtonText: 'Giữ nguyên'
            });

            if (confirmResult.isConfirmed) {
              await sql`
                UPDATE customers
                SET name = ${newName || null},
                    address = ${newAddress || null},
                    updated_at = CURRENT_TIMESTAMP
                WHERE phone = ${phone}
              `;
            }
          }
        }

        try {
          window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { scope: 'customers' } }));
        } catch (error) {
          console.log('Could not refresh customers:', error);
        }
      }

      fetchOrders();
      resetForm();

      try {
        window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { scope: 'orders' } }));
      } catch (error) {
        console.log('Could not refresh dashboard:', error);
      }
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Lỗi khi lưu đơn hàng. Vui lòng thử lại. ❌');
    }
  };

  const handleEdit = (order: Order) => {
    if (order.user_id !== user?.id && user?.role !== 'admin') {
      toast.error('Bạn không có quyền sửa đơn hàng này ❌');
      return;
    }

    setEditingOrder(order);
    setFormData({
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      delivery_date: order.delivery_date,
      delivery_time: order.delivery_time,
      notes: order.notes || ''
    });

    // Load order items
    fetchOrderItems(order.id).then(items => {
      setOrderItems(items);
    });

    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    if (order.user_id !== user?.id && user?.role !== 'admin') {
      toast.error('Bạn không có quyền xóa đơn hàng này ❌');
      return;
    }

    const result = await Swal.fire({
      title: 'Xác nhận xóa',
      text: 'Bạn có chắc chắn muốn xóa đơn hàng này không?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          await sql`DELETE FROM order_items WHERE order_id = ${id}`;
          await sql`DELETE FROM orders WHERE id = ${id}`;
          return true;
        } catch (error) {
          console.error('Error deleting order:', error);
          Swal.showValidationMessage('Lỗi khi xóa đơn hàng. Vui lòng thử lại.');
          return false;
        }
      },
      allowOutsideClick: () => !Swal.isLoading()
    });

    if (result.isConfirmed) {
      fetchOrders();

      try {
        window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { scope: 'orders' } }));
      } catch (error) {
        console.log('Could not refresh dashboard:', error);
      }

      try {
        window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { scope: 'customers' } }));
      } catch (error) {
        console.log('Could not refresh customers:', error);
      }

      setTimeout(() => {
        toast.success('Xóa đơn hàng thành công! 🗑️');
      }, 0);
    }
  };

  const updateOrderStatus = async (id: string, status: Order['status']) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    if (order.user_id !== user?.id && user?.role !== 'admin') {
      toast.error('Bạn không có quyền cập nhật trạng thái đơn hàng này ❌');
      return;
    }

    try {
      await sql`UPDATE orders SET status = ${status}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;

      // If completed, just notify (revenue is calculated from completed orders)
      if (status === 'completed') {
        toast.success('Đơn hàng hoàn thành! ✅');
      } else {
        toast.success(`Cập nhật trạng thái đơn hàng thành công! 📦`);
      }

      fetchOrders();

      // Also refresh dashboard data if available
      try {
        // Trigger dashboard refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent('dataRefresh', { detail: { scope: status === 'completed' ? 'all' : 'orders' } }));
      } catch (error) {
        console.log('Could not refresh dashboard:', error);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Lỗi khi cập nhật trạng thái đơn hàng. Vui lòng thử lại. ❌');
    }
  };

  const addOrderItem = () => {
    if (!newItem.name || !newItem.price) {
      toast.error('Vui lòng nhập tên và giá sản phẩm ❌');
      return;
    }

    // Parse formatted price (remove dots and convert to number)
    const cleanPrice = newItem.price.replace(/\D/g, '');
    const unitPrice = parseInt(cleanPrice);

    if (unitPrice <= 0) {
      toast.error('Giá sản phẩm phải lớn hơn 0 ❌');
      return;
    }

    const existingItem = orderItems.find(item => item.product_name === newItem.name);

    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item.product_name === newItem.name
          ? { ...item, quantity: item.quantity + newItem.quantity, total_price: Math.round((item.quantity + newItem.quantity) * item.unit_price) }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
        id: '',
        order_id: '',
        product_name: newItem.name,
        quantity: newItem.quantity,
        unit_price: unitPrice,
        total_price: Math.round(unitPrice * newItem.quantity)
      }]);
    }

    // Reset form
    setNewItem({ name: '', price: '', quantity: 1 });
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateOrderItemQuantity = (index: number, quantity: number) => {
    setOrderItems(orderItems.map((item, i) =>
      i === index
        ? { ...item, quantity, total_price: Math.round((quantity || 0) * item.unit_price) }
        : item
    ));
  };

  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      delivery_date: new Date().toISOString().split('T')[0],
      delivery_time: '09:00',
      notes: ''
    });
    setOrderItems([]);
    setNewItem({ name: '', price: '', quantity: 1 });
    setEditingOrder(null);
    setShowForm(false);
  };

  // Clear form when showing new form
  const handleShowForm = () => {
    resetForm();
    setShowForm(true);
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending': return <FaClock className="text-yellow-500" />;
      case 'in_progress': return <FaShoppingCart className="text-blue-500" />;
      case 'completed': return <FaCheck className="text-green-500" />;
      case 'cancelled': return <FaTimes className="text-red-500" />;
      default: return null;
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'in_progress': return 'Đang làm';
      case 'completed': return 'Hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalAmount = Math.round(orderItems.reduce((sum, item) => sum + item.total_price, 0));

  if (isLoading) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Quản lý Đơn hàng</h2>
        <button
          onClick={handleShowForm}
          className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
        >
          <FaPlus />
          Thêm đơn hàng
        </button>
      </div>

      {/* Hide overview when form is shown */}
      {!showForm && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">Chờ xử lý</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {orders.filter(o => o.status === 'pending').length}
                </p>
              </div>
              <FaClock className="text-3xl text-yellow-500" />
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Đang làm</p>
                <p className="text-2xl font-bold text-blue-700">
                  {orders.filter(o => o.status === 'in_progress').length}
                </p>
              </div>
              <FaShoppingCart className="text-3xl text-blue-500" />
            </div>
          </div>

          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Hoàn thành</p>
                <p className="text-2xl font-bold text-green-700">
                  {orders.filter(o => o.status === 'completed').length}
                </p>
              </div>
              <FaCheck className="text-3xl text-green-500" />
            </div>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Tổng doanh thu</p>
                <p className="text-2xl font-bold text-purple-700">
                  {Math.round(
                    orders
                      .filter(o => o.status === 'completed')
                      .reduce((sum, o) => sum + Number(o.total_amount), 0)
                  ).toLocaleString('vi-VN')}₫
                </p>
              </div>
              <FaMoneyBillWave className="text-3xl text-purple-500" />
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">
            {editingOrder ? 'Sửa đơn hàng' : 'Thêm đơn hàng mới'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Số điện thoại
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Số điện thoại"
                    required
                    autoComplete="off"
                  />

                  {phoneSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
                      {phoneSuggestions.map((s) => (
                        <button
                          key={s.phone}
                          type="button"
                          onClick={() => handleSelectPhoneSuggestion(s)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          <div className="text-sm font-medium text-gray-900">{s.phone}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {(s.name || 'Không có tên')}{s.address ? ` • ${s.address}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                  placeholder="Tên khách hàng"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Địa chỉ giao hàng
                </label>
                <input
                  type="text"
                  value={formData.customer_address}
                  onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Địa chỉ giao hàng"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ngày giao hàng
                </label>
                <input
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Thời gian giao hàng
                </label>
                <input
                  type="time"
                  value={formData.delivery_time}
                  onChange={(e) => setFormData({ ...formData, delivery_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ghi chú (không bắt buộc)"
                />
              </div>
            </div>

            {/* Products Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Thêm sản phẩm vào đơn hàng</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Tên sản phẩm"
                />
                <input
                  type="text"
                  value={newItem.price}
                  onChange={handlePriceChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="100.000"
                />
                <input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Số lượng"
                  min="1"
                />
                <button
                  type="button"
                  onClick={addOrderItem}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
                >
                  Thêm
                </button>
              </div>
            </div>

            {/* Order Items */}
            {orderItems.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Sản phẩm trong đơn hàng</h4>
                <div className="space-y-2">
                  {orderItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <div className="flex-1">
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-sm text-gray-600">
                          {item.unit_price.toLocaleString('vi-VN')}₫ x {item.quantity || 0}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateOrderItemQuantity(index, parseInt(e.target.value))}
                          className="w-16 px-2 py-1 border rounded text-center"
                          min="1"
                          required
                        />
                        <div className="font-medium w-24 text-right">
                          {Math.round(item.total_price).toLocaleString('vi-VN')}₫
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOrderItem(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Tổng cộng:</span>
                    <span className="text-xl font-bold text-green-600">
                      {totalAmount.toLocaleString('vi-VN')}₫
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
              >
                {editingOrder ? 'Cập nhật' : 'Thêm'}
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
                  Khách hàng
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SĐT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày giao
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tổng tiền
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
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
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{order.customer_name}</div>
                      <div className="text-xs text-gray-500">{order.customer_address}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.customer_phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div>{new Date(order.delivery_date).toLocaleDateString('vi-VN')}</div>
                      <div className="text-xs text-gray-500">{order.delivery_time}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    {Math.round(order.total_amount).toLocaleString('vi-VN')}₫
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {getStatusText(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(order as any).user_name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col sm:flex-row gap-2">
                      {/* Start Work button - most used, placed first */}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'in_progress')}
                          className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition text-sm font-medium"
                          title="Bắt đầu làm"
                        >
                          <FaShoppingCart className="inline mr-1" />
                          Làm
                        </button>
                      )}

                      {/* Complete button */}
                      {order.status === 'in_progress' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition text-sm font-medium"
                          title="Hoàn thành"
                        >
                          <FaCheck className="inline mr-1" />
                          Hoàn thành
                        </button>
                      )}

                      {/* Cancel button */}
                      {(order.status === 'pending' || order.status === 'in_progress') && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'cancelled')}
                          className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition text-sm font-medium"
                          title="Hủy đơn"
                        >
                          <FaTimes className="inline mr-1" />
                          Hủy
                        </button>
                      )}

                      {/* Edit and Delete buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(order)}
                          className="text-blue-600 hover:text-blue-800 p-2"
                          title="Sửa"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="text-red-600 hover:text-red-800 p-2"
                          title="Xóa"
                        >
                          <FaTrash />
                        </button>
                      </div>
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

export default OrderManager;
