const router = require('express').Router();
const { listLeaves, createLeave, reviewLeave } = require('../controllers/leaveController');
const { protect, adminOrHR } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', listLeaves);
router.post('/', createLeave);
router.patch('/:id/review', adminOrHR, reviewLeave);

module.exports = router;
