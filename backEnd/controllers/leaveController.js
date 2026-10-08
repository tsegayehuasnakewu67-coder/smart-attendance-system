const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');

const listLeaves = async (req, res) => {
  try {
    const filter = req.user.role === 'employee' ? { employee: req.user._id } : {};
    if (req.query.status) filter.status = req.query.status;
    const requests = await LeaveRequest.find(filter)
      .populate('employee', 'fullName employeeId department position')
      .populate('reviewedBy', 'fullName')
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: requests });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to load leave requests.' });
  }
};

const createLeave = async (req, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    if (!startDate || !endDate || !reason?.trim()) return res.status(400).json({ success: false, message: 'Dates and reason are required.' });
    if (startDate > endDate) return res.status(400).json({ success: false, message: 'End date must be after start date.' });
    const request = await LeaveRequest.create({ employee: req.user._id, type, startDate, endDate, reason: reason.trim() });
    return res.status(201).json({ success: true, message: 'Leave request submitted.', data: request });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to submit leave request.' });
  }
};

const reviewLeave = async (req, res) => {
  try {
    const { status, reviewNote = '' } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid review status.' });
    const request = await LeaveRequest.findByIdAndUpdate(req.params.id, { status, reviewNote: reviewNote.trim(), reviewedBy: req.user._id, reviewedAt: new Date() }, { new: true }).populate('employee', 'fullName employeeId department');
    if (!request) return res.status(404).json({ success: false, message: 'Leave request not found.' });
    return res.json({ success: true, message: `Leave request ${status}.`, data: request });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to review leave request.' });
  }
};

module.exports = { listLeaves, createLeave, reviewLeave };
