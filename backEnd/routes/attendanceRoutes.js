
const router = require('express').Router();
const {
  markAttendance, checkOutAttendance, getKioskStatus,
  getCompanyAttendance, getMyAttendance, getDashboard, getMyStats,
  getAnalytics,
} = require('../controllers/attendanceController');
const {
  listAttendance, getAttendance, createAttendance, updateAttendance, deleteAttendance,
  getEmployeeAttendance, getDateAttendance,
} = require('../controllers/attendanceCrudController');
const { protect, adminOnly, adminOrHR, employeeOrAdmin } = require('../middleware/authMiddleware');

// Public — kiosk (no auth required)
router.get('/kiosk-status', getKioskStatus);
router.post('/mark',        markAttendance);
router.post('/checkout',    checkOutAttendance);

router.use(protect);

router.get('/dashboard',  adminOrHR,       getDashboard);
router.get('/analytics',  adminOrHR,       getAnalytics);
router.get('/my/stats',   employeeOrAdmin, getMyStats);
router.get('/my',         employeeOrAdmin, getMyAttendance);
router.get('/employee/:employeeId', employeeOrAdmin, getEmployeeAttendance);
router.get('/date/:date', adminOrHR, getDateAttendance);
router.get('/records', adminOrHR, listAttendance);
router.get('/:id', adminOrHR, getAttendance);
router.get('/',           adminOrHR,       getCompanyAttendance);
router.post('/', adminOnly, createAttendance);
router.put('/:id', adminOnly, updateAttendance);
router.delete('/:id', adminOnly, deleteAttendance);

module.exports = router;
