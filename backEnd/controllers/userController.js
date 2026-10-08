const User       = require('../models/User');
const Attendance = require('../models/Attendance');
const Employee   = require('../models/Employee');
const { syncEmployeeForUser } = require('../utils/employeeSync');

// GET /api/users
const getAllUsers = async (req, res) => {
  try {
    const { search, department, role, isActive, page = 1, limit = 50 } = req.query;
    const q = {};
    if (search) {
      q.$or = [
        { fullName:   { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email:      { $regex: search, $options: 'i' } },
      ];
    }
    if (department) q.department = { $regex: department, $options: 'i' };
    if (role)       q.role = role;
    if (isActive !== undefined) q.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(q).select('-faceDescriptor').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(q),
    ]);
    return res.json({
      success: true,
      data: {
        users,
        employees: users,
        pagination: { total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-faceDescriptor');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user.role === 'employee' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const employeeQuery = { $or: [{ user: user._id }, { employeeId: user.employeeId }] };
    const employee = await Employee.findOne(employeeQuery)
      .select('phone gender dateOfBirth address photo status faceEncoding');
    const userData = user.toJSON();
    if (employee) {
      Object.assign(userData, {
        phone: employee.phone,
        gender: employee.gender,
        dateOfBirth: employee.dateOfBirth,
        address: employee.address,
        photo: employee.photo,
        status: employee.status,
        faceRegistered: employee.faceEncoding.length === 128,
      });
    } else {
      userData.faceRegistered = false;
    }
    return res.json({ success: true, data: { user: userData } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    const {
      fullName, email, department, position, role, isActive, password,
      phone, gender, dateOfBirth, address, photo,
    } = req.body;
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (fullName !== undefined) {
      if (!String(fullName).trim()) return res.status(400).json({ success: false, message: 'Full name is required.' });
      user.fullName = String(fullName).trim();
      user.name = user.fullName;
    }
    if (email !== undefined) user.email = String(email).toLowerCase().trim();
    if (department !== undefined) user.department = String(department).trim();
    if (position !== undefined) user.position = String(position).trim();
    if (role !== undefined) {
      if (!['admin', 'hr', 'employee'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid user role.' });
      }
      user.role = role;
    }
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') return res.status(400).json({ success: false, message: 'isActive must be a boolean.' });
      user.isActive = isActive;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ success: false, message: 'Password min 6 chars.' });
      user.password = password;
    }
    if (photo !== undefined) user.avatar = String(photo).trim();

    const employeeProfile = {};
    if (phone !== undefined) employeeProfile.phone = String(phone).trim();
    if (gender !== undefined) employeeProfile.gender = String(gender).trim();
    if (dateOfBirth !== undefined) {
      if (dateOfBirth) {
        const parsedDate = new Date(dateOfBirth);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Date of birth must be a valid date.' });
        }
        employeeProfile.dateOfBirth = parsedDate;
      } else {
        employeeProfile.dateOfBirth = null;
      }
    }
    if (address !== undefined) employeeProfile.address = String(address).trim();
    if (department !== undefined) employeeProfile.department = String(department).trim();
    if (position !== undefined) employeeProfile.position = String(position).trim();
    if (fullName !== undefined) employeeProfile.firstName = String(fullName).trim().split(/\s+/)[0] || 'Employee';
    if (fullName !== undefined) employeeProfile.lastName = String(fullName).trim().split(/\s+/).slice(1).join(' ') || 'Unknown';

    await user.save();
    const employee = await syncEmployeeForUser(user, { preserveFace: true });
    if (employee) {
      await Employee.findByIdAndUpdate(employee._id, { $set: employeeProfile }, { runValidators: true });
    }
    return res.json({ success: true, message: 'User updated.', data: { user: user.toJSON() } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Email in use.' });
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }
    await Attendance.deleteMany({ userId: user._id });
    await Employee.deleteOne({ user: user._id });
    await User.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: `"${user.fullName}" deleted.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/face
const updateFace = async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res.status(400).json({ success: false, message: 'Need 128-element array.' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id, { faceDescriptor }, { new: true, runValidators: true }
    ).select('-faceDescriptor');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await Employee.findOneAndUpdate(
      { employeeId: user.employeeId },
      { $set: { faceEncoding: faceDescriptor } },
      { runValidators: true },
    );
    return res.json({ success: true, message: 'Face registered.', data: { user } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/departments
const getDepartments = async (req, res) => {
  try {
    const depts = await User.distinct('department');
    return res.json({ success: true, data: { departments: depts.sort() } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllUsers, getUserById, updateUser, deleteUser, updateFace, getDepartments };
