export interface Breakdown {
  [key: number]: number;
}

export interface Transaction {
  id?: string;
  date: Date;
  breakdown: Breakdown;
  total: number;
  uid: string;
  hasPendingWrites?: boolean;
}

export interface ActivityLog {
  id?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  timestamp: Date;
  details: {
    total: number;
    breakdown: Breakdown;
    transactionId?: string;
    originalDate?: Date;
  };
  uid: string;
  hasPendingWrites?: boolean;
}

export interface Expense {
  id?: string;
  date: Date;
  amount: number;
  description: string;
  uid: string;
  hasPendingWrites?: boolean;
}

export const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
