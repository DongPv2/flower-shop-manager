import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaPlus, FaTrash, FaEdit, FaShoppingCart, FaCheck, FaClock, FaTimes, FaEye, FaCheckCircle, FaExclamationCircle, FaCopy } from 'react-icons/fa';
import { Order, OrderItem } from '../types';
import { sql } from '../lib/database';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import MaterialTagSelector from './MaterialTagSelector';
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [, setTotalOrders] = useState(0);
  const itemsPerPage = 10;
  const [materialTags, setMaterialTags] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [dashboardFilter, setDashboardFilter] = useState<{ status?: string; isPaid?: boolean } | null>(null);

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

  // Check if order is overdue (pending from previous days)
  const isOverdue = (order: Order) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDate = new Date(order.delivery_date);
    deliveryDate.setHours(0, 0, 0, 0);
    return order.status === 'pending' && deliveryDate < today;
  };

  // Check if order is for today
  const isToday = (order: Order) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDate = new Date(order.delivery_date);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate.getTime() === today.getTime();
  };

  // Handle column sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sort and process orders
  const processOrders = useCallback((rawOrders: Order[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Only apply overdue/today grouping when no sort is active
    if (!sortConfig) {
      const overdueOrders = rawOrders.filter(order => isOverdue(order));
      const todayOrders = rawOrders.filter(order => isToday(order) && !isOverdue(order));
      const otherOrders = rawOrders.filter(order => !isOverdue(order) && !isToday(order));

      const sortOrders = (orders: Order[]) => {
        return orders.sort((a, b) => {
          const dateCompare =
            new Date(a.delivery_date).getTime() -
            new Date(b.delivery_date).getTime();
          if (dateCompare !== 0) return dateCompare;
          return a.delivery_time.localeCompare(b.delivery_time);
        });
      };

      const sortedOverdue = sortOrders(overdueOrders);
      const sortedToday = sortOrders(todayOrders);
      const sortedOthers = sortOrders(otherOrders);

      return [...sortedOverdue, ...sortedToday, ...sortedOthers];
    }

    // When sorting is active, sort all orders together
    return rawOrders.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'customer_name':
          aValue = a.customer_name;
          bValue = b.customer_name;
          break;
        case 'total_amount':
          aValue = Number(a.total_amount);
          bValue = Number(b.total_amount);
          break;
        case 'delivery_date':
          aValue = new Date(a.delivery_date).getTime();
          bValue = new Date(b.delivery_date).getTime();
          break;
        default:
          aValue = a[sortConfig.key as keyof Order];
          bValue = b[sortConfig.key as keyof Order];
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortConfig]);

  // Filter orders by status and dashboard filter
  const filteredOrders = React.useMemo(() => {
    let filtered = orders;

    // Apply dashboard filter first (it has priority)
    if (dashboardFilter && dashboardFilter.status === 'completed' && dashboardFilter.isPaid === false) {
      filtered = filtered.filter(order => order.status === 'completed' && order.is_paid === false);
    } else {
      // Apply normal status filter only if no dashboard filter
      if (selectedStatus !== 'all') {
        filtered = filtered.filter(order => order.status === selectedStatus);
      }
    }

    return filtered;
  }, [orders, selectedStatus, dashboardFilter]);

  // Get paginated orders for current page
  const paginatedOrders = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, currentPage]);

  // Calculate statistics for each status
  const statusStats = React.useMemo(() => {
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const inProgressOrders = orders.filter(o => o.status === 'in_progress');
    const completedOrders = orders.filter(o => o.status === 'completed');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');

    return {
      pending: {
        count: pendingOrders.length,
        total: pendingOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
      },
      in_progress: {
        count: inProgressOrders.length,
        total: inProgressOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
      },
      completed: {
        count: completedOrders.length,
        total: completedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
      },
      cancelled: {
        count: cancelledOrders.length,
        total: cancelledOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
      }
    };
  }, [orders]);

  const fetchOrders = useCallback(async () => {
    try {
      // Fetch all orders for filtering (not paginated)
      const result = await sql`
        SELECT o.*, u.name as user_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY 
          CASE 
            WHEN o.delivery_date IS NOT NULL THEN o.delivery_date 
            ELSE '9999-12-31' 
          END ASC,
          CASE 
            WHEN o.delivery_time IS NOT NULL THEN o.delivery_time 
            ELSE '23:59:59' 
          END ASC,
          o.created_at DESC,
          o.id ASC
      `;

      // Ensure is_paid field exists (default to false if not present)
      const processedOrders = processOrders(result as Order[]);
      const ordersWithPayment = processedOrders.map(order => ({
        ...order,
        is_paid: order.is_paid || false
      }));

      setOrders(ordersWithPayment);

      // Set total count for pagination
      setTotalOrders((result as Order[]).length);
    } catch (error) {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [processOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Listen for dashboard filter events
  useEffect(() => {

    const handleSetOrderFilter = (event: Event) => {
      const filter = (event as CustomEvent<{ status?: string; isPaid?: boolean }>).detail;
      console.log('Dashboard filter received:', filter);
      setDashboardFilter(filter);

      // Update status filter based on dashboard filter
      if (filter.status === 'completed') {
        setSelectedStatus('completed');
      }
    };

    window.addEventListener('setOrderFilter', handleSetOrderFilter);

    return () => {
      window.removeEventListener('setOrderFilter', handleSetOrderFilter);
    };
  }, []);

  // Reset to first page when status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedOrder || showForm) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '0px'; // Prevent layout shift
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [selectedOrder, showForm]);

  // Handle escape key to close modals
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showForm) {
          resetForm();
        }
        if (selectedOrder) {
          handleCloseOrderDetail();
        }
      }
    };

    if (showForm || selectedOrder) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [showForm, selectedOrder]);

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
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    loadedCustomerPhoneRef.current = s.phone;
    existingCustomerRef.current = { phone: s.phone, name: s.name ?? null, address: s.address ?? null };
    setPhoneSuggestions([]);
    setIsPhoneFocused(false);
    setFormData((prev) => ({
      ...prev,
      customer_phone: s.phone,
      customer_name: s.name || prev.customer_name,
      customer_address: s.address || prev.customer_address
    }));
  };

  const fetchOrderItems = async (orderId: string) => {
    try {
      const result = await sql`SELECT * FROM order_items WHERE order_id = ${orderId}`;
      return (result as any[]).map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price)
      })) as OrderItem[];
    } catch (error) {
      console.error('Error fetching order items:', error);
      return [];
    }
  };

  const handleViewOrder = async (order: Order) => {
    setSelectedOrder(order);
    const items = await fetchOrderItems(order.id);
    setSelectedOrderItems(items);
  };

  const handleCloseOrderDetail = () => {
    setSelectedOrder(null);
    setSelectedOrderItems([]);
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;

    const result = await Swal.fire({
      title: 'Xác nhận hủy đơn hàng?',
      text: `Bạn có chắc chắn muốn hủy đơn hàng của ${selectedOrder.customer_name} không?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Hủy đơn',
      cancelButtonText: 'Không'
    });

    if (result.isConfirmed) {
      await updateOrderStatus(selectedOrder.id, 'cancelled');
      handleCloseOrderDetail();
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
        // Update order details
        await sql`
          UPDATE orders 
          SET customer_name = ${formData.customer_name}, 
              customer_phone = ${formData.customer_phone},
              customer_address = ${formData.customer_address},
              delivery_date = ${formData.delivery_date},
              delivery_time = ${formData.delivery_time},
              total_amount = ${totalAmount},
              notes = ${formData.notes},
              material_tags = ${JSON.stringify(materialTags)}
          WHERE id = ${editingOrder.id}
        `;

        // Delete existing order items
        await sql`DELETE FROM order_items WHERE order_id = ${editingOrder.id}`;

        // Add updated order items
        for (const item of orderItems) {
          await sql`
            INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
            VALUES (${editingOrder.id}, ${null}, ${item.product_name}, ${Number(item.quantity)}, ${Number(item.unit_price)}, ${Number(item.total_price)})
          `;
        }

        setTimeout(() => {
          toast.success('Cập nhật đơn hàng thành công! ✏️');
        }, 0);
      } else {
        const orderResult = await sql`
          INSERT INTO orders (customer_name, customer_phone, customer_address, delivery_date, delivery_time, total_amount, status, is_paid, notes, material_tags, user_id)
          VALUES (${formData.customer_name}, ${formData.customer_phone}, ${formData.customer_address}, ${formData.delivery_date}, ${formData.delivery_time}, ${totalAmount}, 'pending', false, ${formData.notes}, ${JSON.stringify(materialTags)}, ${user.id})
          RETURNING id
        `;

        const orderId = (orderResult as any)[0].id;

        // Add order items
        for (const item of orderItems) {
          await sql`
            INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
            VALUES (${orderId}, ${null}, ${item.product_name}, ${Number(item.quantity)}, ${Number(item.unit_price)}, ${Number(item.total_price)})
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
      setCurrentPage(1); // Reset to first page after changes

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
      delivery_date: new Date(order.delivery_date).toLocaleDateString('en-CA'),
      delivery_time: order.delivery_time,
      notes: order.notes || ''
    });

    // Load material tags
    if (order.material_tags) {
      try {
        const tags = JSON.parse(order.material_tags);
        setMaterialTags(Array.isArray(tags) ? tags : []);
      } catch (error) {
        setMaterialTags([]);
      }
    } else {
      setMaterialTags([]);
    }

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
      setCurrentPage(1); // Reset to first page after deletion

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
        toast.success('Xóa đơn hàng thành công!');
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
        toast.success('Đơn hàng hoàn thành!');
      } else {
        toast.success(`Cập nhật trạng thái đơn hàng thành công!`);
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

  const togglePaymentStatus = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      const newPaymentStatus = !order.is_paid;
      await sql`UPDATE orders SET is_paid = ${newPaymentStatus}, updated_at = CURRENT_TIMESTAMP WHERE id = ${orderId}`;

      toast.success(`Cập nhật trạng thái thanh toán thành công!`);
      fetchOrders();
    } catch (error) {
      console.error('Error toggling payment status:', error);
      toast.error('Lỗi khi cập nhật trạng thái thanh toán. Vui lòng thử lại. ❌');
    }
  };

  const addOrderItem = () => {
    if (!newItem.name || !newItem.price) {
      toast.error('Vui lòng nhập tên và giá sản phẩm ❌');
      return;
    }

    // Parse formatted price (remove dots and convert to number)
    const cleanPrice = newItem.price.replace(/\D/g, '');
    let unitPrice = parseInt(cleanPrice);

    if (unitPrice <= 0) {
      toast.error('Giá sản phẩm phải lớn hơn 0 ❌');
      return;
    }

    if (unitPrice < 1000) {
      unitPrice = unitPrice * 1000;
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
    setMaterialTags([]);
    setEditingOrder(null);
    setShowForm(false);
  };

  // Clear form when showing new form
  const handleShowForm = () => {
    resetForm();
    setShowForm(true);
  };

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      resetForm();
    }
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${fieldName}! 📋`);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success(`Đã sao chép ${fieldName}! 📋`);
    }
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
        <div className="space-y-4">
          {/* Status Filter Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* All Orders */}
            <div
              onClick={() => setSelectedStatus('all')}
              className={`p-6 rounded-lg border cursor-pointer transition-all ${selectedStatus === 'all'
                ? 'bg-indigo-50 border-indigo-300 shadow-md'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Tất cả</p>
                  <p className="text-2xl font-bold text-gray-700">{orders.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round(orders.reduce((sum, o) => sum + Number(o.total_amount), 0)).toLocaleString('vi-VN')}₫
                  </p>
                </div>
                <FaShoppingCart className={`text-3xl ${selectedStatus === 'all' ? 'text-indigo-500' : 'text-gray-400'}`} />
              </div>
            </div>

            {/* Pending */}
            <div
              onClick={() => setSelectedStatus('pending')}
              className={`p-6 rounded-lg border cursor-pointer transition-all ${selectedStatus === 'pending'
                ? 'bg-yellow-50 border-yellow-300 shadow-md'
                : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-600 text-sm font-medium">Chờ xử lý</p>
                  <p className="text-2xl font-bold text-yellow-700">{statusStats.pending.count}</p>
                  <p className="text-xs text-yellow-600 mt-1">
                    {Math.round(statusStats.pending.total).toLocaleString('vi-VN')}₫
                  </p>
                </div>
                <FaClock className={`text-3xl ${selectedStatus === 'pending' ? 'text-yellow-600' : 'text-yellow-500'}`} />
              </div>
            </div>

            {/* In Progress */}
            <div
              onClick={() => setSelectedStatus('in_progress')}
              className={`p-6 rounded-lg border cursor-pointer transition-all ${selectedStatus === 'in_progress'
                ? 'bg-blue-50 border-blue-300 shadow-md'
                : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">Đang làm</p>
                  <p className="text-2xl font-bold text-blue-700">{statusStats.in_progress.count}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {Math.round(statusStats.in_progress.total).toLocaleString('vi-VN')}₫
                  </p>
                </div>
                <FaShoppingCart className={`text-3xl ${selectedStatus === 'in_progress' ? 'text-blue-600' : 'text-blue-500'}`} />
              </div>
            </div>


            {/* Cancelled */}
            <div
              onClick={() => setSelectedStatus('cancelled')}
              className={`p-6 rounded-lg border cursor-pointer transition-all ${selectedStatus === 'cancelled'
                ? 'bg-red-50 border-red-300 shadow-md'
                : 'bg-red-50 border-red-200 hover:bg-red-100'
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 text-sm font-medium">Đã hủy</p>
                  <p className="text-2xl font-bold text-red-700">{statusStats.cancelled.count}</p>
                  <p className="text-xs text-red-600 mt-1">
                    {Math.round(statusStats.cancelled.total).toLocaleString('vi-VN')}₫
                  </p>
                </div>
                <FaTimes className={`text-3xl ${selectedStatus === 'cancelled' ? 'text-red-600' : 'text-red-500'}`} />
              </div>
            </div>

            {/* Completed */}
            <div
              onClick={() => setSelectedStatus('completed')}
              className={`p-6 rounded-lg border cursor-pointer transition-all ${selectedStatus === 'completed'
                ? 'bg-green-50 border-green-300 shadow-md'
                : 'bg-green-50 border-green-200 hover:bg-green-100'
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Hoàn thành</p>
                  <p className="text-2xl font-bold text-green-700">{statusStats.completed.count}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {Math.round(statusStats.completed.total).toLocaleString('vi-VN')}₫
                  </p>
                </div>
                <FaCheck className={`text-3xl ${selectedStatus === 'completed' ? 'text-green-600' : 'text-green-500'}`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Add/Edit Modal - Move outside space-y-6 container */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-hidden !mt-0"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingOrder ? 'Sửa đơn hàng' : 'Thêm đơn hàng mới'}
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
                        Số điện thoại
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={formData.customer_phone}
                          onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                          onFocus={() => {
                            if (blurTimeoutRef.current) {
                              clearTimeout(blurTimeoutRef.current);
                              blurTimeoutRef.current = null;
                            }
                            setIsPhoneFocused(true);
                          }}
                          onBlur={() => {
                            blurTimeoutRef.current = window.setTimeout(() => {
                              setIsPhoneFocused(false);
                              blurTimeoutRef.current = null;
                            }, 200);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="Số điện thoại (không bắt buộc)"
                          autoComplete="off"
                        />

                        {phoneSuggestions.length > 0 && isPhoneFocused && (
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

                  {/* Material Tags Section */}
                  <div className="border-t pt-4">
                    <MaterialTagSelector
                      selectedTags={materialTags}
                      onChange={setMaterialTags}
                    />
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
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Số lượng"
                        min="1"
                        required
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
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-green-50 to-orange-50 px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Quản lý Đơn hàng</h3>
          <p className="text-sm text-gray-600 mt-1">
            {dashboardFilter && dashboardFilter.status === 'completed' && dashboardFilter.isPaid === false
              ? `Hiển thị ${filteredOrders.length} đơn hàng hoàn thành chưa thanh toán`
              : `Hiển thị ${filteredOrders.length} đơn hàng ${selectedStatus === 'all' ? '' : `trạng thái ${getStatusText(selectedStatus)}`}`
            }
          </p>
          {dashboardFilter && dashboardFilter.status === 'completed' && dashboardFilter.isPaid === false && (
            <button
              onClick={() => {
                setDashboardFilter(null);
                setSelectedStatus('all');
              }}
              className="mt-2 text-sm text-orange-600 hover:text-orange-800 underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Thao tác
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Khách hàng
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Nguyên vật liệu
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors rounded" onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-center gap-2">
                    Trạng thái
                    {sortConfig?.key === 'status' && (
                      <span className="text-blue-600">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Thanh toán
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors rounded" onClick={() => handleSort('delivery_date')}>
                  <div className="flex items-center gap-2">
                    Ngày giao
                    {sortConfig?.key === 'delivery_date' && (
                      <span className="text-blue-600">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors rounded" onClick={() => handleSort('total_amount')}>
                  <div className="flex items-center justify-end gap-2">
                    Tổng tiền
                    {sortConfig?.key === 'total_amount' && (
                      <span className="text-blue-600">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y ">
              {paginatedOrders.map((order) => (
                <tr
                  key={order.id}
                  className={`hover:bg-gray-50 transition-all duration-200 ${isOverdue(order)
                    ? 'bg-red-50 border-l-4 border-red-500 shadow-sm'
                    : isToday(order) && (order.status === 'pending' || order.status === 'in_progress')
                      ? 'bg-blue-50 border-l-4 border-blue-300'
                      : 'hover:shadow-sm'
                    }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col gap-2 items-center">
                      {/* View button - always visible */}
                      <button
                        onClick={() => handleViewOrder(order)}
                        className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
                        title="Xem chi tiết"
                      >
                        <FaEye className="inline" />
                      </button>

                      {/* Complete button - only for in_progress orders */}
                      {order.status === 'in_progress' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          className="text-green-600 hover:text-green-800 hover:bg-green-50 p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
                          title="Hoàn thành"
                        >
                          <FaCheck className="inline" />
                        </button>
                      )}

                      {/* Edit button - only admin or order owner */}
                      {(user?.role === 'admin' || order.user_id === user?.id) && (
                        <button
                          onClick={() => handleEdit(order)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
                          title="Sửa"
                        >
                          <FaEdit />
                        </button>
                      )}

                      {/* Delete button - only for non-completed orders and admin/owner */}
                      {order.status !== 'completed' && (user?.role === 'admin' || order.user_id === user?.id) && (
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
                          title="Xóa"
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="max-w-[150px]">
                      <div className="font-semibold text-gray-900 truncate" title={order.customer_name}>
                        {order.customer_name}
                      </div>
                      <div className="text-xs text-gray-500 truncate" title={order.customer_phone || ''}>
                        {order.customer_phone || 'Không có SĐT'}
                      </div>
                      <div className="text-xs text-gray-500 truncate" title={order.customer_address || ''}>
                        {order.customer_address}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.material_tags ? (
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {(() => {
                          try {
                            const tags = JSON.parse(order.material_tags);
                            return Array.isArray(tags) ? tags.slice(0, 2).map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-full text-xs font-medium border border-green-200 truncate"
                                title={tag}
                              >
                                {tag}
                              </span>
                            )) : null;
                          } catch (error) {
                            return null;
                          }
                        })()}
                        {(() => {
                          try {
                            const tags = JSON.parse(order.material_tags);
                            return Array.isArray(tags) && tags.length > 2 ? (
                              <span
                                className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium cursor-help hover:bg-gray-200 transition-colors"
                                title={tags.slice(2).join(', ')}
                              >
                                +{tags.length - 2}
                              </span>
                            ) : null;
                          } catch (error) {
                            return null;
                          }
                        })()}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                        Không có
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1.5">{getStatusText(order.status)}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <button
                      onClick={() => togglePaymentStatus(order.id)}
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold transition-all duration-200 hover:scale-110 ${order.is_paid
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                      title={order.is_paid ? 'Đã thanh toán (Click để đổi)' : 'Chưa thanh toán (Click để đổi)'}
                    >
                      {order.is_paid ? <FaCheckCircle /> : <FaExclamationCircle />}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex flex-col">
                      <div className="font-semibold text-gray-900">
                        {new Date(order.delivery_date).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.delivery_time}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end">
                      <span className="text-lg font-bold text-green-600">
                        {Math.round(order.total_amount).toLocaleString('vi-VN')}₫
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredOrders.length > itemsPerPage && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 sm:p-6 mt-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 sm:px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              >
                ← <span className="hidden sm:inline">Trước</span>
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.ceil(filteredOrders.length / itemsPerPage) }, (_, i) => i + 1).map(page => {
                const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
                let showPage = false;

                // Show first page, last page, current page, and pages around current
                if (page === 1 || page === totalPages || page === currentPage ||
                  Math.abs(page - currentPage) <= 1) {
                  showPage = true;
                }

                // Show ellipsis for gaps
                if (!showPage && (page === currentPage - 2 || page === currentPage + 2)) {
                  showPage = true;
                }

                if (!showPage) return null;

                const isEllipsis = (page === currentPage - 2 && page > 2) ||
                  (page === currentPage + 2 && page < totalPages - 1);

                return isEllipsis ? (
                  <span key={page} className="px-2 sm:px-3 py-2 text-sm text-gray-500">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2 sm:px-4 py-2 text-sm font-medium border rounded-lg transition-all duration-200 ${currentPage === page
                      ? 'bg-blue-500 text-white border-blue-500 shadow-md transform scale-105'
                      : 'border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                      }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredOrders.length / itemsPerPage)))}
                disabled={currentPage === Math.ceil(filteredOrders.length / itemsPerPage)}
                className="px-3 sm:px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              >
                <span className="hidden sm:inline">Sau</span> →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-hidden !mt-0">
          <div className="bg-white rounded-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">Chi tiết đơn hàng</h3>
                <button
                  onClick={handleCloseOrderDetail}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
                {/* Notes Section - Prominently displayed */}
                {selectedOrder.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <h5 className="font-semibold text-yellow-800 mb-2">Ghi chú</h5>
                    <p className="text-gray-700 break-words text-left">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}

                {/* Material Tags Section */}
                {selectedOrder.material_tags && (() => {
                  try {
                    const tags = JSON.parse(selectedOrder.material_tags);
                    return Array.isArray(tags) && tags.length > 0;
                  } catch (error) {
                    return selectedOrder.material_tags.trim() !== '';
                  }
                })() && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                      <h5 className="font-semibold text-green-800 mb-2">Nguyên vật liệu cần mua</h5>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          try {
                            const tags = JSON.parse(selectedOrder.material_tags);
                            return Array.isArray(tags) ? tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                              >
                                {tag}
                              </span>
                            )) : null;
                          } catch (error) {
                            return (
                              <span className="text-gray-600 text-sm">
                                {selectedOrder.material_tags}
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  )}

                {/* Customer Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Thông tin khách hàng</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Tên:</span> {selectedOrder.customer_name}</p>
                      <div className="flex items-center justify-center">
                        <p><span className="font-medium">SĐT:</span> {selectedOrder.customer_phone}</p>
                        {selectedOrder.customer_phone && (
                          <button
                            onClick={() => copyToClipboard(selectedOrder.customer_phone, 'số điện thoại')}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 ml-2 rounded-lg transition-all duration-200 flex items-center justify-center"
                            title="Sao chép SĐT"
                          >
                            <FaCopy />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-center">
                        <p className="break-words"><span className="font-medium">Địa chỉ:</span> {selectedOrder.customer_address || 'Không có'}</p>
                        {selectedOrder.customer_address && (
                          <button
                            onClick={() => copyToClipboard(selectedOrder.customer_address, 'địa chỉ')}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 ml-2 rounded-lg transition-all duration-200 flex items-center justify-center"
                            title="Sao chép địa chỉ"
                          >
                            <FaCopy />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Thời gian giao hàng</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Ngày:</span> {new Date(selectedOrder.delivery_date).toLocaleDateString('vi-VN')}</p>
                      <p><span className="font-medium">Giờ:</span> {selectedOrder.delivery_time}</p>
                      <p><span className="font-medium">Trạng thái:</span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusColor(selectedOrder.status)}`}>
                          {getStatusText(selectedOrder.status)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-700 mb-2">Sản phẩm</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Sản phẩm</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">SL</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Đơn giá</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedOrderItems.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm">{item.product_name}</td>
                            <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm text-right">{Math.round(item.unit_price).toLocaleString('vi-VN')}₫</td>
                            <td className="px-4 py-2 text-sm font-medium text-right">{Math.round(item.total_price).toLocaleString('vi-VN')}₫</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-sm font-medium text-right">Tổng cộng:</td>
                          <td className="px-4 py-2 text-sm font-bold text-right">{Math.round(selectedOrder.total_amount).toLocaleString('vi-VN')}₫</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end">
                  {(selectedOrder.status === 'pending' || selectedOrder.status === 'in_progress') && (
                    <>
                      {selectedOrder.status === 'pending' && (
                        <button
                          onClick={() => {
                            updateOrderStatus(selectedOrder.id, 'in_progress');
                            handleCloseOrderDetail();
                          }}
                          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center"
                        >
                          <FaShoppingCart className="mr-2" />
                          Bắt đầu
                        </button>
                      )}
                      <button
                        onClick={handleCancelOrder}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition flex items-center"
                      >
                        <FaTimes className="mr-2" />
                        Hủy
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleCloseOrderDetail}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default OrderManager;
