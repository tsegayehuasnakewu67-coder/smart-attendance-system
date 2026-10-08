const router = require('express').Router();
const {
  listNotifications,
  sendNotification,
  markNotificationRead,
} = require('../controllers/notificationController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', listNotifications);
router.patch('/:id/read', markNotificationRead);
router.post('/', adminOnly, sendNotification);

module.exports = router;
