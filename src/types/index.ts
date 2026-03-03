export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'employee' | 'accountant';
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  status: 'pending' | 'paid';
  created_at: string;
}

export interface Revenue {
  id: string;
  user_id: string;
  amount: number;
  customer_name?: string;
  description: string;
  date: string;
  created_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  name?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_date: string;
  delivery_time: string;
  total_amount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  items: OrderItem[];
  notes?: string;
  material_tags?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_quantity: number;
  description?: string;
  image_url?: string;
  created_at: string;
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}
