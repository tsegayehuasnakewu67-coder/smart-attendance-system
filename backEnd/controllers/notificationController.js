const Notification = require('../models/Notification');
const User = require('../models/User');

const listNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'fullName role')
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('List notifications error:', err);
    return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
  }
};

const sendNotification = async (req, res) => {
  try {
    const { recipientId, sendToAll, type = 'message', subject, message } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'Subject and message are required.' });
    }
    if (!['message', 'warning'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid notification type.' });
    }

    let recipients;
    if (sendToAll) {
      recipients = await User.find({ role: 'employee', isActive: true }).select('_id');
    } else if (recipientId) {
      const recipient = await User.findOne({ _id: recipientId, role: 'employee', isActive: true }).select('_id');
      if (!recipient) return res.status(404).json({ success: false, message: 'Active employee not found.' });
      recipients = [recipient];
    } else {
      return res.status(400).json({ success: false, message: 'Choose one employee or all employees.' });
    }

    if (!recipients.length) {
      return res.status(400).json({ success: false, message: 'No active employees are available.' });
    }

    const documents = recipients.map(recipient => ({
      recipient: recipient._id,
      sender: req.user._id,
      type,
      subject: subject.trim(),
      message: message.trim(),
    }));
    await Notification.insertMany(documents);

    return res.status(201).json({
      success: true,
      message: `${type === 'warning' ? 'Warning' : 'Message'} sent to ${documents.length} employee${documents.length === 1 ? '' : 's'}.`,
      data: { count: documents.length },
    });
  } catch (err) {
    console.error('Send notification error:', err);
    return res.status(500).json({ success: false, message: 'Unable to send notification.' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { readAt: new Date() },
      { new: true },
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    return res.json({ success: true, data: notification });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to update notification.' });
  }
};

module.exports = { listNotifications, sendNotification, markNotificationRead };
