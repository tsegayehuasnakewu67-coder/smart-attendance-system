import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useLayoutEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, ClipboardList, UserPlus,
  LogOut, Camera, ChevronRight, Building2, Settings, Bell, CalendarDays,
} from 'lucide-react';
import { formatEthiopianDate } from '../utils/ethiopianDateTime';

const adminNav = [
  { to: '/admin',          icon: LayoutDashboard, label: 'Dashboard'         },
  { to: '/admin/users',    icon: Users,           label: 'Employees'         },
  { to: '/admin/reports',  icon: ClipboardList,   label: 'Reports'           },
  { to: '/admin/register', icon: UserPlus,        label: 'Register Employee' },
  { to: '/admin/settings', icon: Settings,        label: 'System Settings'   },
  { to: '/admin/notifications', icon: Bell,       label: 'Messages & Warnings' },
  { to: '/admin/leaves',        icon: CalendarDays, label: 'Leave Management' },
];

const employeeNav = [
  { to: '/me', icon: LayoutDashboard, label: 'My Dashboard' },
  { to: '/me/notifications', icon: Bell, label: 'My Notifications' },
  { to: '/me/leaves', icon: CalendarDays, label: 'My Leave Requests' },
];

const hrNav = [
  { to: '/hr', icon: LayoutDashboard, label: 'HR Dashboard' },
  { to: '/hr/employees', icon: Users, label: 'Employee Directory' },
  { to: '/hr/reports', icon: ClipboardList, label: 'Attendance Reports' },
  { to: '/hr/leaves', icon: CalendarDays, label: 'Leave Reviews' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef(null);
  const nav = user?.role === 'admin' ? adminNav : user?.role === 'hr' ? hrNav : employeeNav;

  useLayoutEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  /* Clicking the logo signs the user out and returns to /login */
  const handleLogoClick = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#020617' }}>

      {/* ════════════════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════════════════ */}
      <aside style={{
        width: '256px', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: '#0f172a',
        borderRight: '1px solid #1e293b',
      }}>

        {/* ── Brand logo — click to sign out and return to /login ── */}
        <button
          onClick={handleLogoClick}
          aria-label="Sign out and go to login"
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '20px',
            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
            borderBottom: '1px solid #1e293b',
            background: 'transparent',
            cursor: 'pointer', width: '100%', textAlign: 'left',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,41,59,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div key={location.pathname} style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
          }}>
            <Building2 size={18} color="#ffffff" />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.2 }}>
              Smart Attendance
            </p>
            <p style={{ fontSize: '0.6875rem', color: '#475569', margin: '2px 0 0' }}>
              Corporate HR System
            </p>
          </div>
        </button>

        {/* ── Navigation ── */}
        <nav style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin' || to === '/hr' || to === '/me'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '10px',
                textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
                transition: 'background 0.12s, color 0.12s',
                background: isActive ? 'rgba(37,99,235,0.18)' : 'transparent',
                color:      isActive ? '#60a5fa' : '#94a3b8',
              })}
              onMouseEnter={e => {
                if (!e.currentTarget.dataset.active) {
                  e.currentTarget.style.background = 'rgba(30,41,59,0.8)';
                  e.currentTarget.style.color = '#f1f5f9';
                }
              }}
              onMouseLeave={e => {
                if (!e.currentTarget.dataset.active) {
                  e.currentTarget.style.background = '';
                  e.currentTarget.style.color = '';
                }
              }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {isActive && <ChevronRight size={13} />}
                </>
              )}
            </NavLink>
          ))}

          {/* Attendance Set link */}
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1e293b' }}>
            <NavLink
              to="/kiosk"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '10px',
                textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
                color: '#94a3b8', transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,41,59,0.8)'; e.currentTarget.style.color = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = ''; }}
            >
              <Camera size={16} />
              Attendance Set
            </NavLink>
          </div>
        </nav>

        {/* ── User footer ── */}
        <div style={{ padding: '16px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: '#334155', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
              color: '#cbd5e1', flexShrink: 0,
            }}>
              {user?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.fullName}
              </p>
              <p style={{ fontSize: '0.6875rem', color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.department}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '8px 10px', borderRadius: '8px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 500, color: '#64748b',
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#64748b'; }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ════════════════════════════════════════════════════ */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          height: '56px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px',
          background: '#0f172a', borderBottom: '1px solid #1e293b',
        }}>
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
            {formatEthiopianDate(new Date(), { weekday: 'long' })}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              fontSize: '0.75rem', padding: '3px 10px', borderRadius: '999px',
              background: '#1e293b', color: '#94a3b8', fontWeight: 500,
              textTransform: 'capitalize',
            }}>
              {user?.role}
            </span>
            <span style={{
              fontSize: '0.75rem', padding: '3px 10px', borderRadius: '999px',
              background: 'rgba(37,99,235,0.2)', color: '#60a5fa', fontWeight: 500,
            }}>
              {user?.employeeId}
            </span>
          </div>
        </header>

        {/* ── Page content ──
            • overflowY: auto   → page scrolls independently of sidebar
            • padding: 2.5rem   → 40 px breathing room on all sides
            • paddingBottom: 5rem → generous bottom clearance
        ── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '40px',
          paddingBottom: '80px',
          background: '#020617',
        }} ref={contentRef}>
          {/* Full content width so wide report tables can scroll horizontally */}
          <div style={{ maxWidth: '100%', width: '100%', margin: '0 auto' }}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
