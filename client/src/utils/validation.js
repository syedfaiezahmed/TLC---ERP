export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone) => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
};

export const validateRequired = (value) => {
  return value && value.toString().trim().length > 0;
};

export const validateMinLength = (value, minLength) => {
  return value && value.toString().trim().length >= minLength;
};

export const validateMaxLength = (value, maxLength) => {
  return value && value.toString().trim().length <= maxLength;
};

export const validateNumber = (value) => {
  return !isNaN(value) && value !== '';
};

export const validatePositiveNumber = (value) => {
  return validateNumber(value) && parseFloat(value) >= 0;
};

export const validateDate = (date) => {
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj);
};

export const validateForm = (formData, rules) => {
  const errors = {};
  
  Object.keys(rules).forEach(field => {
    const value = formData[field];
    const fieldRules = rules[field];
    
    if (fieldRules.required && !validateRequired(value)) {
      errors[field] = `${fieldRules.label || field} is required`;
      return;
    }
    
    if (fieldRules.email && value && !validateEmail(value)) {
      errors[field] = 'Invalid email format';
      return;
    }
    
    if (fieldRules.phone && value && !validatePhone(value)) {
      errors[field] = 'Invalid phone number (10 digits required)';
      return;
    }
    
    if (fieldRules.minLength && value && !validateMinLength(value, fieldRules.minLength)) {
      errors[field] = `Minimum ${fieldRules.minLength} characters required`;
      return;
    }
    
    if (fieldRules.maxLength && value && !validateMaxLength(value, fieldRules.maxLength)) {
      errors[field] = `Maximum ${fieldRules.maxLength} characters allowed`;
      return;
    }
    
    if (fieldRules.number && value && !validateNumber(value)) {
      errors[field] = 'Must be a valid number';
      return;
    }
    
    if (fieldRules.positiveNumber && value && !validatePositiveNumber(value)) {
      errors[field] = 'Must be a positive number';
      return;
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatDate = (date, format = 'DD MMM YYYY') => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d)) return '-';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  
  if (format === 'DD MMM YYYY') {
    return `${day} ${month} ${year}`;
  }
  
  return d.toLocaleDateString('en-IN');
};
