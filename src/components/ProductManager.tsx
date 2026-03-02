import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaEdit, FaBox, FaLeaf, FaHeart, FaGift } from 'react-icons/fa';
import { Product } from '../types';
import { sql } from '../lib/database';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import 'react-toastify/dist/ReactToastify.css';
import 'sweetalert2/dist/sweetalert2.css';

const ProductManager: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Hoa tươi',
    price: '',
    stock_quantity: '',
    description: '',
    image_url: ''
  });

  const categories = [
    'Hoa tươi',
    'Hoa khô',
    'Hoa giấy',
    'Bó hoa',
    'Giỏ hoa',
    'Chậu cây',
    'Phụ kiện',
    'Khác'
  ];

  const categoryIcons: { [key: string]: React.ReactNode } = {
    'Hoa tươi': <FaLeaf className="text-pink-500" />,
    'Hoa khô': <FaGift className="text-orange-500" />,
    'Hoa giấy': <FaHeart className="text-red-500" />,
    'Bó hoa': <FaHeart className="text-red-500" />,
    'Giỏ hoa': <FaBox className="text-green-500" />,
    'Chậu cây': <FaLeaf className="text-green-500" />,
    'Phụ kiện': <FaGift className="text-purple-500" />,
    'Khác': <FaBox className="text-gray-500" />
  };

  useEffect(() => {
    if (user?.role !== 'admin') {
      return;
    }
    fetchProducts();
  }, [user]);

  const fetchProducts = async () => {
    try {
      const result = await sql`SELECT * FROM products ORDER BY name`;
      setProducts(result as Product[]);
    } catch (error) {
      console.error('Error fetching products:', error);
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

    try {
      if (editingProduct) {
        await sql`
          UPDATE products 
          SET name = ${formData.name}, 
              category = ${formData.category}, 
              price = ${Number(formData.price)}, 
              stock_quantity = ${Number(formData.stock_quantity)},
              description = ${formData.description},
              image_url = ${formData.image_url}
          WHERE id = ${editingProduct.id}
        `;
        toast.success('Cập nhật sản phẩm thành công! ✏️');
      } else {
        await sql`
          INSERT INTO products (name, category, price, stock_quantity, description, image_url)
          VALUES (${formData.name}, ${formData.category}, ${Number(formData.price)}, ${Number(formData.stock_quantity)}, ${formData.description}, ${formData.image_url})
        `;
        toast.success('Thêm sản phẩm thành công! 🌸');
      }

      fetchProducts();
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Lỗi khi lưu sản phẩm. Vui lòng thử lại. ❌');
    }
  };

  const handleEdit = (product: Product) => {
    if (user?.role !== 'admin') {
      toast.error('Chỉ admin mới có quyền sửa sản phẩm ❌');
      return;
    }

    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      stock_quantity: product.stock_quantity.toString(),
      description: product.description || '',
      image_url: product.image_url || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (user?.role !== 'admin') {
      toast.error('Chỉ admin mới có quyền xóa sản phẩm ❌');
      return;
    }

    Swal.fire({
      title: 'Xác nhận xóa',
      text: "Bạn có chắc chắn muốn xóa sản phẩm này không?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await sql`DELETE FROM products WHERE id = ${id}`;
          fetchProducts();
          toast.success('Xóa sản phẩm thành công! 🗑️');
        } catch (error) {
          console.error('Error deleting product:', error);
          toast.error('Lỗi khi xóa sản phẩm. Vui lòng thử lại. ❌');
        }
      }
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Hoa tươi',
      price: '',
      stock_quantity: '',
      description: '',
      image_url: ''
    });
    setEditingProduct(null);
    setShowForm(false);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaBox className="text-6xl text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Truy cập bị từ chối</h2>
          <p className="text-gray-600">Chỉ admin mới có quyền quản lý sản phẩm</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

  const totalProducts = products.length;
  const totalValue = products.reduce((sum, product) => sum + (product.price * product.stock_quantity), 0);
  const lowStockProducts = products.filter(p => p.stock_quantity < 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Quản lý Sản phẩm</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition"
        >
          <FaPlus />
          Thêm sản phẩm
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-pink-50 p-6 rounded-lg border border-pink-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-pink-600 text-sm font-medium">Tổng sản phẩm</p>
              <p className="text-3xl font-bold text-pink-700">{totalProducts}</p>
            </div>
            <FaBox className="text-4xl text-pink-500" />
          </div>
        </div>

        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Giá trị tồn kho</p>
              <p className="text-3xl font-bold text-green-700">
                {totalValue.toLocaleString('vi-VN')}₫
              </p>
            </div>
            <FaLeaf className="text-4xl text-green-500" />
          </div>
        </div>

        <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Sắp hết hàng</p>
              <p className="text-3xl font-bold text-orange-700">{lowStockProducts.length}</p>
            </div>
            <FaGift className="text-4xl text-orange-500" />
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">
            {editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên sản phẩm
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Tên sản phẩm"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Giá bán (₫)
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Số lượng tồn kho
                </label>
                <input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL hình ảnh
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mô tả sản phẩm
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Mô tả chi tiết về sản phẩm..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition"
              >
                {editingProduct ? 'Cập nhật' : 'Thêm'}
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
                  Sản phẩm
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Danh mục
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Giá bán
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tồn kho
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Giá trị tồn kho
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 rounded-lg object-cover mr-3"
                          onError={(e) => {
                            e.currentTarget.src = '';
                            e.currentTarget.className = 'hidden';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center mr-3">
                          <FaLeaf className="text-pink-500" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        {product.description && (
                          <div className="text-xs text-gray-500 max-w-xs truncate">
                            {product.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="flex items-center gap-1">
                      {categoryIcons[product.category] || <FaBox className="text-gray-500" />}
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-pink-600">
                    {product.price.toLocaleString('vi-VN')}₫
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-2 py-1 text-xs rounded-full ${product.stock_quantity === 0
                        ? 'bg-red-100 text-red-800'
                        : product.stock_quantity < 5
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                      {product.stock_quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {(product.price * product.stock_quantity).toLocaleString('vi-VN')}₫
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Sửa"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
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

export default ProductManager;
