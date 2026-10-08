const Employee = require('../models/Employee');

const splitName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || 'Employee',
    lastName: parts.join(' ') || 'Unknown',
  };
};

const syncEmployeeForUser = async (user, { preserveFace = false } = {}) => {
  if (!user || user.role === 'admin' || !user.employeeId) return null;

  const { firstName, lastName } = splitName(user.fullName || user.name);
  const fields = {
    firstName,
    lastName,
    email: user.email,
    department: user.department || 'Unassigned',
    position: user.position || 'Employee',
    photo: user.avatar || '',
    status: user.isActive ? 'Active' : 'Inactive',
    user: user._id,
  };
  if (!preserveFace) fields.faceEncoding = user.faceDescriptor || [];

  const employee = await Employee.findOneAndUpdate(
    { employeeId: user.employeeId },
    { $set: fields },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  if (String(user.employeeRef || '') !== String(employee._id)) {
    await user.updateOne({ $set: { employeeRef: employee._id } });
    user.employeeRef = employee._id;
  }

  return employee;
};

module.exports = { syncEmployeeForUser, splitName };
