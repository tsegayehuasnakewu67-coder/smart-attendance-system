/**
 * Register — Admin onboards a new employee, HR user, or administrator.
 *
 * Layout guarantees (inline styles — immune to Tailwind JIT purge):
 *  • Form card: max-width 960px, background #0f172a,
 *    border 1px solid #1e293b, borderRadius 16px, overflow hidden
 *  • All inputs: zero placeholder attributes — labels above only
 *  • Confirm Password: real-time match validation (border colour + hint)
 *  • Password fields: show/hide toggle
 *  • 32px gap between every form row
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { loadModels, getDescriptor } from '../utils/faceApi';
import { CUSTOM_OPTION, DEPARTMENTS, POSITION_OPTIONS } from '../utils/employmentOptions';
import { formatEthiopianDate, formatEthiopianDateTime } from '../utils/ethiopianDateTime';
import { Camera, CheckCircle2, UserPlus, ArrowLeft, X, Eye, EyeOff } from 'lucide-react';

const INIT = {
  fullName: '', employeeId: '', email: '', password: '', confirmPassword: '',
  department: '', customDepartment: '', position: '', customPosition: '', role: 'employee',
};

/* ── Style tokens ───────────────────────────────────────────────────────── */
const CARD = {
  background:   '#0f172a',
  border:       '1px solid #1e293b',
  borderRadius: '16px',
  overflow:     'hidden',
  padding:      '32px',
};

const LABEL_STYLE = {
  display: 'block',
  fontSize: '0.6875rem',
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '6px',
};

const buildInputStyle = (extra = {}) => ({
  width: '100%',
  padding: '11px 14px',
  background: '#1e293b',
  border: '1.5px solid #334155',
  borderRadius: '10px',
  color: '#f1f5f9',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  appearance: 'none',
  ...extra,
});

const SECTION_DIVIDER = {
  borderTop: '1px solid #1e293b',
  marginTop: '8px',
  paddingTop: '24px',
};

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editUserId = searchParams.get('edit');
  const [form,    setForm]    = useState(INIT);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [editLoading, setEditLoading] = useState(Boolean(editUserId));
  const [face,    setFace    ] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const [showPw,  setShowPw]  = useState(false);
  const [showCPw, setShowCPw] = useState(false);

  const [camOpen,   setCamOpen]   = useState(false);
  const [modelsOk,  setModelsOk]  = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [camMsg,    setCamMsg]    = useState('');
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadModels().then(() => setModelsOk(true)).catch(() => {});
    return () => stopCam();
  }, []);

  useEffect(() => {
    if (!camOpen) return;

    let cancelled = false;
    let stream;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error('Camera preview is not ready.');
        video.srcObject = stream;
        await video.play();
        if (!cancelled) setCamMsg('Position your face in the frame and click Capture.');
      } catch {
        if (!cancelled) setCamMsg('Camera access denied. Please allow permissions and try again.');
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      if (streamRef.current === stream) streamRef.current = null;
    };
  }, [camOpen]);

  useEffect(() => {
    if (!editUserId) return;
    setEditLoading(true);
    userService.getById(editUserId)
      .then(user => {
        setEmployeeProfile(user);
        setForm(current => ({
          ...current,
          fullName: user.fullName,
          employeeId: user.employeeId,
          email: user.email,
          department: user.department,
          position: user.position,
          role: user.role,
        }));
      })
      .catch(err => setError(err.message))
      .finally(() => setEditLoading(false));
  }, [editUserId]);

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const pwMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;
  const pwMatch    = form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  /* ── Camera helpers ── */
  const openCam = () => {
    setCamOpen(true); setCamMsg('Starting camera…');
  };
  const stopCam = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  const closeCam = () => { stopCam(); setCamOpen(false); setCapturing(false); setCamMsg(''); };

  const captureFrame = async () => {
    if (!videoRef.current || !modelsOk) return;
    setCapturing(true); setCamMsg('Detecting face…');
    try {
      const desc = await getDescriptor(videoRef.current);
      if (!desc) { setCamMsg('No face detected — adjust lighting and try again.'); setCapturing(false); return; }
      setFace(desc); setCamMsg('Face captured!');
      stopCam();
      setTimeout(closeCam, 800);
    } catch { setCamMsg('Detection failed. Please try again.'); }
    finally { setCapturing(false); }
  };

  /* ── Submit ── */
  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!editUserId && form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    const department = form.department === CUSTOM_OPTION ? form.customDepartment.trim() : form.department;
    const position = form.position === CUSTOM_OPTION ? form.customPosition.trim() : form.position;
    if (!editUserId && (!department || !position)) { setError('Select or enter a department and position.'); return; }
    if (!face) { setError('Capture the employee face before registering so attendance can recognize them.'); return; }
    setLoading(true);
    try {
      if (editUserId) {
        const user = await userService.updateFace(editUserId, face);
        setSuccess(`Face recognition updated for "${user.fullName}".`);
        setTimeout(() => navigate('/admin/users'), 1200);
        return;
      }
      const payload = { ...form };
      delete payload.confirmPassword;
      delete payload.customDepartment;
      delete payload.customPosition;
      payload.department = department;
      payload.position = position;
      payload.faceDescriptor = face;
      const data = await authService.register(payload);
      setSuccess(`Employee "${data.user.fullName}" registered successfully.`);
      setForm(INIT); setFace(null);
      setTimeout(() => navigate('/admin/users'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackBtn onClick={() => navigate(-1)} />
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 2px', letterSpacing: '-0.025em' }}>
            {editUserId ? 'Update Employee Face' : 'Register Employee'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            {editUserId ? `Update recognition for ${form.fullName || 'employee'}` : 'Add a new employee to the system'}
          </p>
        </div>
      </div>

      {/* ── Form card — max-width 960px ── */}
      <div style={{ maxWidth: '960px' }}>
        <form onSubmit={handleSubmit} noValidate autoComplete="off">
          <div style={CARD}>

            {editUserId && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px',
                alignItems: 'start',
                marginBottom: '24px',
                paddingBottom: '24px',
                borderBottom: '1px solid #1e293b',
              }}>
                {employeeProfile?.photo && (
                  <img
                    src={employeeProfile.photo}
                    alt={`${employeeProfile.fullName} profile`}
                    style={{ width: '112px', height: '112px', objectFit: 'cover', borderRadius: '14px', border: '1px solid #334155' }}
                  />
                )}
                <div style={{ gridColumn: '1 / -1' }}>
                  <h2 style={{ margin: '0 0 16px', color: '#f1f5f9', fontSize: '1rem', fontWeight: 700 }}>
                    Employee Information
                  </h2>
                  {editLoading ? (
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>Loading employee details…</p>
                  ) : employeeProfile ? (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '16px 24px',
                    }}>
                      <ProfileDetail label="Full Name" value={employeeProfile.fullName} />
                      <ProfileDetail label="Employee ID" value={employeeProfile.employeeId} />
                      <ProfileDetail label="Email" value={employeeProfile.email} />
                      <ProfileDetail label="Department" value={employeeProfile.department} />
                      <ProfileDetail label="Position" value={employeeProfile.position} />
                      <ProfileDetail label="Role" value={employeeProfile.role} />
                      <ProfileDetail label="Phone" value={employeeProfile.phone} />
                      <ProfileDetail label="Gender" value={employeeProfile.gender} />
                      <ProfileDetail
                        label="Date of Birth"
                        value={employeeProfile.dateOfBirth ? formatEthiopianDate(employeeProfile.dateOfBirth) : ''}
                      />
                      <ProfileDetail label="Address" value={employeeProfile.address} />
                      <ProfileDetail
                        label="Employment Status"
                        value={employeeProfile.status || (employeeProfile.isActive ? 'Active' : 'Inactive')}
                      />
                      <ProfileDetail
                        label="Face Recognition"
                        value={employeeProfile.faceRegistered ? 'Registered' : 'Not registered'}
                      />
                      <ProfileDetail
                        label="Created"
                        value={employeeProfile.createdAt ? formatEthiopianDateTime(employeeProfile.createdAt) : ''}
                      />
                      <ProfileDetail
                        label="Last Updated"
                        value={employeeProfile.updatedAt ? formatEthiopianDateTime(employeeProfile.updatedAt) : ''}
                      />
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.875rem' }}>
                      Employee details could not be loaded.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Row 1: Full Name + Employee ID ── */}
            {!editUserId && <>
            <TwoCol>
              <FormField label="Full Name"   name="fullName"   value={form.fullName}   onChange={set} required />
              <FormField label="Employee ID" name="employeeId" value={form.employeeId} onChange={set} required />
            </TwoCol>

            {/* ── Row 2: Email + Role ── */}
            <TwoCol mt>
              <FormField label="Email Address" name="email" type="email" value={form.email} onChange={set} required />
              <div>
                <label style={LABEL_STYLE}>
                  Role <Asterisk />
                </label>
                <select
                  name="role"
                  value={form.role}
                  onChange={set}
                  style={buildInputStyle()}
                  onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
                  onBlur={e  => { e.target.style.borderColor = '#334155'; e.target.style.boxShadow = 'none'; }}
                >
                  <option value="employee">Employee</option>
                  <option value="hr">Human Resources</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </TwoCol>

            {/* ── Row 3: Department + Position ── */}
            <TwoCol mt>
              {/* Department — dropdown with standard departments */}
              <div>
                <label htmlFor="department" style={LABEL_STYLE}>
                  Department <Asterisk />
                </label>
                <DeptSelect
                  name="department"
                  value={form.department}
                  onChange={set}
                  required
                />
                {form.department === CUSTOM_OPTION && (
                  <input
                    name="customDepartment"
                    value={form.customDepartment}
                    onChange={set}
                    required
                    aria-label="Custom department name"
                    style={{ ...buildInputStyle(), marginTop: '8px' }}
                  />
                )}
              </div>
              <div>
                <label htmlFor="position" style={LABEL_STYLE}>
                  Position / Title <Asterisk />
                </label>
                <select
                  id="position"
                  name="position"
                  value={form.position}
                  onChange={set}
                  required
                  style={buildInputStyle()}
                >
                  <option value="">Select position title</option>
                  {POSITION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value={CUSTOM_OPTION}>Other (enter custom title)</option>
                </select>
                {form.position === CUSTOM_OPTION && (
                  <input
                    name="customPosition"
                    value={form.customPosition}
                    onChange={set}
                    required
                    aria-label="Custom position title"
                    style={{ ...buildInputStyle(), marginTop: '8px' }}
                  />
                )}
              </div>
            </TwoCol>

            {/* ── Row 4: Password + Confirm Password ── */}
            <TwoCol mt>
              {/* Password */}
              <div>
                <label htmlFor="password" style={LABEL_STYLE}>
                  Password <Asterisk />
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={form.password}
                  onChange={set}
                  show={showPw}
                  onToggle={() => setShowPw(v => !v)}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" style={LABEL_STYLE}>
                  Confirm Password <Asterisk />
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={set}
                  show={showCPw}
                  onToggle={() => setShowCPw(v => !v)}
                  borderColor={pwMismatch ? '#ef4444' : pwMatch ? '#22c55e' : undefined}
                />
                {pwMismatch && (
                  <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
                    Passwords do not match
                  </p>
                )}
                {pwMatch && (
                  <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={11} color="#4ade80" />
                    Passwords match
                  </p>
                )}
              </div>
            </TwoCol>
            </>}

            {/* ── Face Recognition ── */}
            <div style={SECTION_DIVIDER}>
              <p style={{ ...LABEL_STYLE, marginBottom: '12px' }}>Face Recognition</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  {face
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: '#4ade80', fontWeight: 500 }}>
                        <CheckCircle2 size={16} color="#4ade80" />
                        Face descriptor captured (128 points)
                      </span>
                    : <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        No face captured — required for attendance
                      </span>
                  }
                </div>
                <CameraBtn onClick={openCam} disabled={!modelsOk} hasFace={!!face} />
              </div>
            </div>

            {/* ── Feedback ── */}
            {error   && <AlertBanner type="error"   text={error}   />}
            {success && <AlertBanner type="success" text={success} />}

            {/* ── Form actions ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px' }}>
              <button
                type="button"
                onClick={() => navigate('/admin/users')}
                style={{
                  padding: '10px 20px', borderRadius: '10px',
                  background: '#1e293b', border: '1px solid #334155',
                  cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#334155'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || editLoading || pwMismatch}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 24px', borderRadius: '10px',
                  background: loading || editLoading || pwMismatch ? '#1e3a8a' : '#2563eb',
                  border: 'none', cursor: loading || editLoading || pwMismatch ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem', fontWeight: 600, color: '#fff',
                  opacity: loading || editLoading || pwMismatch ? 0.6 : 1,
                  transition: 'background 0.15s, opacity 0.15s',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                }}
                onMouseEnter={e => { if (!loading && !editLoading && !pwMismatch) e.currentTarget.style.background = '#3b82f6'; }}
                onMouseLeave={e => { if (!loading && !editLoading && !pwMismatch) e.currentTarget.style.background = '#2563eb'; }}
              >
                <UserPlus size={15} />
                {editLoading ? 'Loading…' : loading ? (editUserId ? 'Updating…' : 'Registering…') : (editUserId ? 'Update Face' : 'Register Employee')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Camera modal ── */}
      {camOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 50, padding: '16px',
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid #334155',
            borderRadius: '20px', padding: '24px',
            width: '100%', maxWidth: '440px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Capture Face</h3>
              <button
                onClick={closeCam}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '6px' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', aspectRatio: '4/3', marginBottom: '12px' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted playsInline />
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 16px', minHeight: '1rem' }}>
              {camMsg}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={closeCam}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={captureFrame}
                disabled={capturing || !videoRef.current?.srcObject}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#2563eb', border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: capturing || !videoRef.current?.srcObject ? 'not-allowed' : 'pointer', opacity: capturing || !videoRef.current?.srcObject ? 0.6 : 1 }}
              >
                {capturing ? 'Scanning…' : 'Capture'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared sub-components ─────────────────────────────────────────────── */

function ProfileDetail({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{
        margin: '0 0 5px',
        color: '#64748b',
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        {label}
      </p>
      <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.875rem', overflowWrap: 'anywhere' }}>
        {value || '—'}
      </p>
    </div>
  );
}

function TwoCol({ children, mt }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '24px',
      ...(mt ? { marginTop: '24px' } : {}),
    }}>
      {children}
    </div>
  );
}

function FormField({ label, name, value, onChange, type = 'text', required }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={name} style={LABEL_STYLE}>
        {label}{required && <Asterisk />}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        /* no placeholder — label above provides context */
        style={buildInputStyle({
          borderColor: focused ? '#3b82f6' : '#334155',
          boxShadow:   focused ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
        })}
        onFocus={() => setFocused(true)}
        onBlur={()  => setFocused(false)}
      />
    </div>
  );
}

function PasswordInput({ id, name, value, onChange, show, onToggle, borderColor }) {
  const [focused, setFocused] = useState(false);
  const activeBorder = borderColor ?? (focused ? '#3b82f6' : '#334155');
  const activeShadow = focused
    ? borderColor
      ? `0 0 0 3px ${borderColor}33`
      : '0 0 0 3px rgba(59,130,246,0.15)'
    : 'none';

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required
        /* no placeholder */
        style={buildInputStyle({ paddingRight: '40px', borderColor: activeBorder, boxShadow: activeShadow })}
        onFocus={() => setFocused(true)}
        onBlur={()  => setFocused(false)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={onToggle}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#64748b', display: 'flex', alignItems: 'center', padding: '2px',
          transition: 'color 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function CameraBtn({ onClick, disabled, hasFace }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '9px 18px', borderRadius: '10px',
        background: hovered && !disabled ? '#334155' : '#1e293b',
        border: '1px solid #334155', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0',
        opacity: disabled ? 0.5 : 1, transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      <Camera size={15} />
      {disabled ? 'Loading models…' : hasFace ? 'Re-capture' : 'Open Camera'}
    </button>
  );
}

function BackBtn({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px', borderRadius: '8px',
        background: hovered ? '#334155' : '#1e293b',
        border: '1px solid #334155', cursor: 'pointer',
        color: hovered ? '#f1f5f9' : '#64748b',
        display: 'flex', alignItems: 'center',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      <ArrowLeft size={16} />
    </button>
  );
}

function AlertBanner({ type, text }) {
  const isErr = type === 'error';
  return (
    <div style={{
      marginTop: '20px',
      padding: '12px 16px',
      borderRadius: '10px',
      borderLeft: `3px solid ${isErr ? '#ef4444' : '#22c55e'}`,
      background: isErr ? 'rgba(127,29,29,0.25)' : 'rgba(21,128,61,0.2)',
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
      color: isErr ? '#fca5a5' : '#86efac',
      fontSize: '0.875rem',
    }}>
      {text}
    </div>
  );
}

function Asterisk() {
  return <span style={{ color: '#f87171', marginLeft: '2px' }}>*</span>;
}

/* ── Department dropdown ───────────────────────────────────────────────── */
function DeptSelect({ name, value, onChange, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      style={buildInputStyle({
        borderColor: focused ? '#3b82f6' : '#334155',
        boxShadow:   focused ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
        /* show a dim "unselected" cue without using placeholder text */
        color: value === '' ? '#64748b' : '#f1f5f9',
      })}
      onFocus={() => setFocused(true)}
      onBlur={()  => setFocused(false)}
    >
      {/* First option acts as the empty state label — not a placeholder */}
      <option value="" disabled style={{ color: '#64748b', background: '#1e293b' }}>
        Select department
      </option>
      {DEPARTMENTS.map(d => (
        <option key={d} value={d} style={{ background: '#1e293b', color: '#f1f5f9' }}>
          {d}
        </option>
      ))}
      <option value={CUSTOM_OPTION} style={{ background: '#1e293b', color: '#f1f5f9' }}>
        Other (enter custom department)
      </option>
    </select>
  );
}
