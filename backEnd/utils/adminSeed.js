const User = require('../models/User');

const ensureAdmin = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = (process.env.ADMIN_NAME || 'System Administrator').trim();

  if (!email) throw new Error('ADMIN_EMAIL is required in backEnd/.env.');
  if (!password || password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be configured in backEnd/.env and contain at least 8 characters.');
  }

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log('Admin account already exists');
    return existingAdmin;
  }

  if (await User.exists({ email })) {
    throw new Error('ADMIN_EMAIL is already assigned to a non-admin account.');
  }

  try {
    const admin = await User.create({
      name,
      fullName: name,
      employeeId: `ADMIN-${Date.now()}`,
      email,
      password,
      department: 'Administration',
      position: 'System Administrator',
      role: 'admin',
    });
    console.log('Admin account created successfully');
    return admin;
  } catch (error) {
    if (error.code === 11000) {
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        console.log('Admin account already exists');
        return admin;
      }
    }
    throw error;
  }
};

module.exports = ensureAdmin;
