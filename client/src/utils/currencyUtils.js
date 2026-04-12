// Currency formatting utilities
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'PKR 0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

export const formatCurrencyCompact = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'PKR 0';
  }
  if (amount >= 1000000) {
    return `PKR ${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `PKR ${(amount / 1000).toFixed(1)}K`;
  }
  return `PKR ${amount.toFixed(0)}`;
};

export const parseCurrency = (currencyString) => {
  if (!currencyString) return 0;
  // Remove currency symbols and commas, then parse as number
  const cleaned = currencyString.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
};
