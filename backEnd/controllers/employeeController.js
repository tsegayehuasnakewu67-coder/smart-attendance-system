const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { splitName } = require('../utils/employeeSync');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidId = (id) => mongoose.isValidObjectId(id);

const listEmployees = async (req, res) => {
  try {
    const { search, employeeId, name, email, department, status, page = 1, limit = 50 } = req.query;
    const query = {};
    const term = search || employeeId || name || email;
    if (term) {
      const expression = new RegExp(escapeRegex(String(term)), 'i');
      query.$or = [
        { employeeId: expression },
        { firstName: expression },
        { lastName: expression },
        { email: expression },
      ];
    }
    if (department) query.department = new RegExp(escapeRegex(String(department)), 'i');
    if (status) query.status = status;

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    const [employees, total] = await Promise.all([
      Employee.find(query).sort({ createdAt: -1 }).skip((currentPage - 1) * pageSize).limit(pageSize),
      Employee.countDocuments(query),
    ]);
    const users = employees.map((employee) => ({
      ...employee.toObject(),
      fullName: employee.fullName,
      isActive: employee.status === 'Active',
      hasFace: employee.faceEncoding.length === 128,
    }));
    return res.json({
      success: true,
      data: {
        employees: users,
        users,
        pagination: { total, page: currentPage, limit: pageSize, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to retrieve employees.' });
  }
};

const getEmployee = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid employee id.' });
  }
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    const employeeData = {
      ...employee.toObject(),
      fullName: employee.fullName,
      isActive: employee.status === 'Active',
      hasFace: employee.faceEncoding.length === 128,
    };
    return res.json({ success: true, data: { employee: employeeData, user: employeeData } });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to retrieve employee.' });
  }
};

const createEmployee = async (req, res) => {
  try {
    const { employeeId, fullName, name, firstName, lastName, email, department, position } = req.body;
    const names = firstName && lastName ? { firstName, lastName } : splitName(fullName || name);
    if (!employeeId || !names.firstName || !names.lastName || !department || !position) {
      return res.status(400).json({ success: false, message: 'Employee ID, name, department, and position are required.' });
    }
    const employee = await Employee.create({
      employeeId: String(employeeId).trim().toUpperCase(),
      ...names,
      department: String(department).trim(),
      position: String(position).trim(),
      email: email ? String(email).trim().toLowerCase() : undefined,
      phone: req.body.phone || '',
      gender: req.body.gender || '',
      dateOfBirth: req.body.dateOfBirth || null,
      address: req.body.address || '',
      photo: req.body.photo || '',
      faceEncoding: req.body.faceEncoding || [],
      status: req.body.status || 'Active',
    });
    return res.status(201).json({ success: true, message: 'Employee created.', data: { employee } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Employee ID or email already exists.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Unable to create employee.' });
  }
};

const updateEmployee = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid employee id.' });
  }
  try {
    const updates = {};
    const allowed = ['employeeId', 'firstName', 'lastName', 'email', 'phone', 'department', 'position', 'gender', 'dateOfBirth', 'address', 'photo', 'status'];
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (req.body.fullName || req.body.name) Object.assign(updates, splitName(req.body.fullName || req.body.name));
    if (updates.employeeId) updates.employeeId = String(updates.employeeId).trim().toUpperCase();
    if (updates.email) updates.email = String(updates.email).trim().toLowerCase();
    const employee = await Employee.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

    if (employee.user) {
      await User.findByIdAndUpdate(employee.user, {
        $set: {
          employeeId: employee.employeeId,
          fullName: employee.fullName,
          name: employee.fullName,
          email: employee.email,
          department: employee.department,
          position: employee.position,
          avatar: employee.photo,
          isActive: employee.status === 'Active',
        },
      }, { runValidators: true });
    }
    return res.json({ success: true, message: 'Employee updated.', data: { employee } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Employee ID or email already exists.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Unable to update employee.' });
  }
};

const deleteEmployee = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid employee id.' });
  }
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

    await Promise.all([
      Attendance.deleteMany({ $or: [{ employee: employee._id }, { employeeId: employee.employeeId }] }),
      User.updateMany({ employeeRef: employee._id }, { $set: { employeeRef: null, isActive: false } }),
    ]);
    await employee.deleteOne();
    return res.json({ success: true, message: 'Employee and related attendance records deleted.' });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to delete employee.' });
  }
};

module.exports = { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee };
