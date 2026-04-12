export const canAccessCompany = (user, company) => {
  if (!user || !company) return false;
  if (user.role === 'superadmin') return true;
  if (user.company && company._id && user.company.toString() === company._id.toString()) return true;
  if (company.user && user._id && company.user.toString() === user._id.toString()) return true;
  return false;
};

