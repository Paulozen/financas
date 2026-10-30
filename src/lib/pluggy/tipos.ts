// Formato (parcial) das respostas da API Pluggy usado pelo app.

export interface PluggyItem {
  id: string;
  status: string;
  executionStatus?: string;
  error?: { code?: string; message?: string } | null;
  consentExpiresAt?: string | null;
  lastUpdatedAt?: string | null;
  connector?: { name?: string } | null;
}

export interface PluggyConta {
  id: string;
  itemId: string;
  type: "BANK" | "CREDIT";
  subtype?: string;
  name?: string;
  marketingName?: string | null;
  number?: string | null;
  balance?: number | null;
  creditData?: {
    creditLimit?: number | null;
    availableCreditLimit?: number | null;
    balanceDueDate?: string | null;
    minimumPayment?: number | null;
  } | null;
}

export interface PluggyTransacao {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
  status?: string;
  category?: string | null;
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
    paymentType?: string | null;
    billId?: string | null;
    billForecastDate?: string | null;
    purchaseDate?: string | null;
  } | null;
}

export interface PluggyFatura {
  id: string;
  dueDate: string;
  billClosingDate?: string | null;
  totalAmount: number;
  minimumPaymentAmount?: number | null;
  payments?: { amount: number }[] | null;
}

export interface PluggyInvestimento {
  id: string;
  itemId: string;
  name: string;
  type?: string | null;
  subtype?: string | null;
  issuer?: string | null;
  dueDate?: string | null;
  balance?: number | null;
  status?: string | null;
}
