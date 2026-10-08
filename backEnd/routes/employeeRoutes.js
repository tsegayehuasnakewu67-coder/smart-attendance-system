const router = require('express').Router();
const {
  listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee,
} = require('../controllers/employeeController');
const { protect, adminOrHR, adminOnly } = require('../middleware/authMiddleware');

router.use(protect, adminOrHR);
router.get('/', listEmployees);
router.get('/:id', getEmployee);
router.post('/', adminOnly, createEmployee);
router.put('/:id', adminOnly, updateEmployee);
router.delete('/:id', adminOnly, deleteEmployee);

module.exports = router;
