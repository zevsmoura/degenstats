export interface HeliusTokenBalanceChange {
  userAccount?: string;
  mint?: string;
  rawTokenAmount?: {
    tokenAmount?: string;
    decimals?: number;
  };
}

export interface HeliusNativeTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number;
}

export interface HeliusEnhancedTransaction {
  signature: string;
  timestamp?: number | null;
  type?: string;
  fee?: number;
  feePayer?: string;
  accountData?: Array<{
    account?: string;
    tokenBalanceChanges?: HeliusTokenBalanceChange[];
  }>;
  tokenTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    mint?: string;
    tokenAmount?: number;
  }>;
  nativeTransfers?: HeliusNativeTransfer[];
  events?: {
    swap?: {
      nativeInput?: { account?: string; amount?: string | number };
      nativeOutput?: { account?: string; amount?: string | number };
    };
  };
}
