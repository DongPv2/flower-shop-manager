export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'employee';
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
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

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}
