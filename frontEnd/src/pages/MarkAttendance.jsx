/**
 * MarkAttendance — Face-recognition kiosk  (/kiosk)
 * Public route. No auth required.
 *
 * ─── Phase → Color mapping ────────────────────────────────────────────────
 *  BOOT / IDLE           slate   neutral/dim — system not ready or waiting
 *  SCANNING              blue    active scanning — processing
 *  SUCCESS               green   ✅ face verified & attendance recorded
 *  CHECKOUT_OK           orange  ✅ check-out recorded successfully
 *  ALREADY / IN_BREAK /
 *  MORNING_ACTIVE /
 *  DAY_COMPLETE          amber   ⚠️  already recorded — no action needed
 *  TOO_EARLY             sky     ℹ️  outside valid window — come back later
 *  ERROR                 red     ❌ recognition failure or unknown person
 * ─────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { loadModels, getDescriptor } from '../utils/faceApi';
import { attendanceService } from '../services/attendanceService';
import { formatEthiopianDate, formatEthiopianTime } from '../utils/ethiopianDateTime';
import {
  Camera, CheckCircle2, XCircle, RefreshCw, Clock,
  LogIn, LogOut, Coffee, CalendarCheck, AlertCircle,
} from 'lucide-react';

/* ── Phase enum ─────────────────────────────────────────────────────────── */
const PHASE = {
  BOOT:            'boot',
  IDLE:            'idle',
  SCANNING:        'scanning',
  SUCCESS:         'success',         // morning check-in OR after-lunch check-in
  CHECKOUT_OK:     'checkout_ok',     // after-lunch check-out OR auto-checkout
  CHECK_IN_REQUIRED: 'check_in_required',
  ALREADY:         'already',         // already checked in (within morning session)
  MORNING_ACTIVE:  'morning_active',  // scanned mid-morning — already in
  IN_BREAK:        'in_break',        // lunch break window
  DAY_COMPLETE:    'day_complete',    // all sessions recorded today
  TOO_EARLY:       'too_early',       // before shift opens
  ERROR:           'error',           // face not recognised / server error
};

/* ── Status-bar dot + text colour ──────────────────────────────────────── */
const STATUS_STYLE = {
  [PHASE.BOOT]:           { dot: '#475569', text: '#64748b' },   // slate
  [PHASE.IDLE]:           { dot: '#3b82f6', text: '#60a5fa' },   // blue
  [PHASE.SCANNING]:       { dot: '#3b82f6', text: '#60a5fa' },   // blue (pulsing)
  [PHASE.SUCCESS]:        { dot: '#22c55e', text: '#4ade80' },   // GREEN only here
  [PHASE.CHECKOUT_OK]:    { dot: '#f97316', text: '#fb923c' },   // orange
  [PHASE.CHECK_IN_REQUIRED]: { dot: '#f59e0b', text: '#fbbf24' },
  [PHASE.ALREADY]:        { dot: '#f59e0b', text: '#fbbf24' },   // amber
  [PHASE.MORNING_ACTIVE]: { dot: '#f59e0b', text: '#fbbf24' },   // amber
  [PHASE.IN_BREAK]:       { dot: '#f59e0b', text: '#fbbf24' },   // amber
  [PHASE.DAY_COMPLETE]:   { dot: '#f59e0b', text: '#fbbf24' },   // amber
  [PHASE.TOO_EARLY]:      { dot: '#38bdf8', text: '#7dd3fc' },   // sky
  [PHASE.ERROR]:          { dot: '#ef4444', text: '#f87171' },   // RED only here
};

/* ── Overlay background per phase ──────────────────────────────────────── */
const OVERLAY_BG = {
  [PHASE.SUCCESS]:        'rgba(5,  46, 22,  0.94)',   // deep green
  [PHASE.CHECKOUT_OK]:    'rgba(67, 20, 7,   0.94)',   // deep orange
  [PHASE.CHECK_IN_REQUIRED]: 'rgba(69, 26, 3, 0.94)',
  [PHASE.ALREADY]:        'rgba(69, 26, 3,   0.94)',   // deep amber
  [PHASE.MORNING_ACTIVE]: 'rgba(69, 26, 3,   0.94)',   // deep amber
  [PHASE.IN_BREAK]:       'rgba(28, 25, 5,   0.94)',   // deep amber/brown
  [PHASE.DAY_COMPLETE]:   'rgba(28, 25, 5,   0.94)',   // deep amber/brown
  [PHASE.TOO_EARLY]:      'rgba(8,  47, 73,  0.94)',   // deep sky
  [PHASE.ERROR]:          'rgba(69, 10, 10,  0.94)',   // deep red
};

/* ── Map backend response → PHASE ──────────────────────────────────────── */
function resolvePhase(res, isCheckInMode) {
  const normalized = res ?? {};
  const message = String(normalized.message ?? '').toLowerCase();

  // Explicit flags from backend
  if (normalized.tooEarly || /not open yet|too early|come back at/i.test(message)) {
    return PHASE.TOO_EARLY;
  }
  if (normalized.inBreak)        return PHASE.IN_BREAK;
  if (normalized.morningActive)  return PHASE.MORNING_ACTIVE;
  if (normalized.dayComplete)    return PHASE.DAY_COMPLETE;
  if (normalized.noRecord)       return PHASE.CHECK_IN_REQUIRED;
  if (normalized.alreadyCheckedIn || normalized.alreadyCheckedOut) return PHASE.ALREADY;

  // Successful actions
  if (normalized.success) {
    const action = normalized.action ?? '';
    if (
      action === 'afterlunch_checkout' ||
      action === 'auto_checkout'       ||
      !isCheckInMode
    ) return PHASE.CHECKOUT_OK;
    return PHASE.SUCCESS;
  }

  return PHASE.ERROR;
}

/* ── Icon for each result phase ─────────────────────────────────────────── */
function ResultIcon({ phase }) {
  const SIZE = 56;
  switch (phase) {
    case PHASE.SUCCESS:        return <CheckCircle2 size={SIZE} color="#4ade80" />;
    case PHASE.CHECKOUT_OK:    return <LogOut       size={SIZE} color="#fb923c" />;
    case PHASE.CHECK_IN_REQUIRED: return <LogIn size={SIZE} color="#fbbf24" />;
    case PHASE.ALREADY:        return <Clock        size={SIZE} color="#fbbf24" />;
    case PHASE.MORNING_ACTIVE: return <CheckCircle2 size={SIZE} color="#fbbf24" />;
    case PHASE.IN_BREAK:       return <Coffee       size={SIZE} color="#fbbf24" />;
    case PHASE.DAY_COMPLETE:   return <CalendarCheck size={SIZE} color="#fbbf24" />;
    case PHASE.TOO_EARLY:      return <AlertCircle  size={SIZE} color="#7dd3fc" />;
    default:                   return <XCircle      size={SIZE} color="#f87171" />;
  }
}

/* ── Overlay headline for each result phase ────────────────────────────── */
function resultHeadline(phase, employeeName) {
  switch (phase) {
    case PHASE.SUCCESS:        return `Welcome, ${employeeName}!`;
    case PHASE.CHECKOUT_OK:    return `Goodbye, ${employeeName}!`;
    case PHASE.CHECK_IN_REQUIRED: return `Face Recognised, ${employeeName}`;
    case PHASE.ALREADY:        return 'Already Marked Attendance';
    case PHASE.MORNING_ACTIVE: return 'Already Checked In';
    case PHASE.IN_BREAK:       return 'Enjoy Your Lunch Break!';
    case PHASE.DAY_COMPLETE:   return 'Attendance Completed for Today';
    case PHASE.TOO_EARLY:      return 'Check-In Not Open Yet';
    case PHASE.ERROR:          return 'Not Recognised';
    default:                   return 'Error';
  }
}

/* ── Status-bar text for each phase ─────────────────────────────────────── */
function statusBarText(phase, msg, isCheckIn) {
  switch (phase) {
    case PHASE.BOOT:            return 'Loading face recognition models…';
    case PHASE.IDLE:            return 'Ready — choose an action';
    case PHASE.SCANNING:        return 'Scanning — align your face with the frame';
    case PHASE.SUCCESS:         return 'Check-in recorded successfully';
    case PHASE.CHECKOUT_OK:     return 'Check-out recorded successfully';
    case PHASE.CHECK_IN_REQUIRED: return 'Check-in is required before you can check out';
    case PHASE.ALREADY:         return isCheckIn
                                  ? 'Already checked in for this shift'
                                  : 'Already checked out for this shift';
    case PHASE.MORNING_ACTIVE:  return 'Already checked in — morning session active';
    case PHASE.IN_BREAK:        return 'Lunch break in progress — come back after break';
    case PHASE.DAY_COMPLETE:    return 'Attendance already completed for today';
    case PHASE.TOO_EARLY:       return 'Outside check-in window — too early';
    case PHASE.ERROR:           return `Recognition failed${msg ? ': ' + msg : ''}`;
    default:                    return msg || '';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function MarkAttendance() {
  const [phase,   setPhase]   = useState(PHASE.BOOT);
  const [mode,    setMode]    = useState(null);   // 'checkin' | 'checkout'
  const [msg,     setMsg]     = useState('');
  const [result,  setResult]  = useState(null);   // raw backend data payload
  const [tick,    setTick]    = useState(new Date());

  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const scanRef   = useRef(null);
  const resetRef  = useRef(null);
  const modeRef   = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  /* ── Live clock ── */
  useEffect(() => {
    const t = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── Cleanup on unmount ── */
  useEffect(() => () => {
    clearInterval(scanRef.current);
    clearTimeout(resetRef.current);
    stopCamera();
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  /* ── Boot: load face-api models ── */
  useEffect(() => {
    loadModels()
      .then(() => setPhase(PHASE.IDLE))
      .catch(() => {
        setMsg('Failed to load face recognition models.');
        setPhase(PHASE.ERROR);
      });
  }, []);

  /* ── Camera open / scanning loop ── */
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      beginScanning();
    } catch {
      setMsg('Camera access denied. Allow permissions and reload.');
      setPhase(PHASE.ERROR);
    }
  };

  const selectMode = m => {
    clearTimeout(resetRef.current);
    setMode(m);
    setMsg('');
    setResult(null);
    openCamera();
  };

  const beginScanning = () => {
    setPhase(PHASE.SCANNING);
    scanRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const descriptor = await getDescriptor(videoRef.current);
        if (!descriptor) return;   // no face detected yet — keep looping
        clearInterval(scanRef.current);
        stopCamera();
        await submitDescriptor(descriptor);
      } catch { /* transient frame error — keep scanning */ }
    }, 1000);
  };

  /* ── Submit descriptor to backend ── */
  const submitDescriptor = async (descriptor) => {
    try {
      const isCheckIn = modeRef.current === 'checkin';

      // Both check-in and check-out hit the same smart endpoint now
      const res = isCheckIn
        ? await attendanceService.mark(descriptor)
        : await attendanceService.checkout(descriptor);

      const resolvedPhase = resolvePhase(res, isCheckIn);

      setResult(res.data ?? null);
      setMsg(res.message ?? '');
      setPhase(resolvedPhase);
    } catch (err) {
      // axios puts the server's error response in err.response.data
      const serverRes = err?.response?.data ?? {};
      const resolvedPhase = resolvePhase(serverRes, modeRef.current === 'checkin');

      setResult(serverRes.data ?? null);
      setMsg(serverRes.message ?? err.message ?? 'Unknown error');
      setPhase(resolvedPhase);
    }
    // Auto-reset after 6 seconds
    resetRef.current = setTimeout(resetKiosk, 6000);
  };

  const resetKiosk = useCallback(() => {
    clearTimeout(resetRef.current);
    clearInterval(scanRef.current);
    stopCamera();
    setResult(null);
    setMsg('');
    setMode(null);
    setPhase(PHASE.IDLE);
  }, []);

  /* ── Derived booleans ── */
  const isDone    = ![PHASE.BOOT, PHASE.IDLE, PHASE.SCANNING].includes(phase);
  const isCheckIn = mode === 'checkin';

  /* ── Style lookups ── */
  const statusStyle  = STATUS_STYLE[phase] ?? STATUS_STYLE[PHASE.IDLE];
  const overlayBg    = OVERLAY_BG[phase] ?? OVERLAY_BG[PHASE.ERROR];
  const employeeName = result?.employee?.fullName ?? '';

  /* ── Inline status bar (Tailwind-free, so JIT purge can't strip it) ── */
  const statusBarStyle = {
    display: 'flex', alignItems: 'center', gap: '10px',
    marginTop: '16px', width: '100%', maxWidth: '576px',
    padding: '10px 16px', borderRadius: '12px',
    background: '#0f172a', border: '1px solid #1e293b',
  };

  /* ── Scanning pulse — inline keyframes ── */
  const PULSE_CSS = `
    @keyframes kiosk-pulse {
      0%   { box-shadow: 0 0 0 0   rgba(59,130,246,0.55); }
      70%  { box-shadow: 0 0 0 14px rgba(59,130,246,0);   }
      100% { box-shadow: 0 0 0 0   rgba(59,130,246,0);    }
    }
    .kiosk-scan-ring { animation: kiosk-pulse 1.6s ease-out infinite; }
    @keyframes kiosk-spin { to { transform: rotate(360deg); } }
    .kiosk-spin { animation: kiosk-spin 0.85s linear infinite; }
  `;

  return (
    <>
      <style>{PULSE_CSS}</style>

      <div style={{
        minHeight: '100vh', background: '#020617',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}>

        {/* ── Header ── */}
        <div style={{
          width: '100%', maxWidth: '576px', marginBottom: '24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
              Attendance Set
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '2px 0 0' }}>
              Face Recognition Attendance
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              {formatEthiopianTime(tick, { seconds: true })}
            </p>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
              {formatEthiopianDate(tick, { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* ── Mode selector (idle only) ── */}
        {phase === PHASE.IDLE && (
          <div style={{ width: '100%', maxWidth: '576px', display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <ModeBtn
              onClick={() => selectMode('checkin')}
              icon={<LogIn  size={28} />}
              label="Check In"
              accent="#15803d"
              accentBg="rgba(5,46,22,0.4)"
              accentHover="rgba(5,46,22,0.6)"
              textColor="#4ade80"
            />
            <ModeBtn
              onClick={() => selectMode('checkout')}
              icon={<LogOut size={28} />}
              label="Check Out"
              accent="#c2410c"
              accentBg="rgba(67,20,7,0.4)"
              accentHover="rgba(67,20,7,0.6)"
              textColor="#fb923c"
            />
          </div>
        )}

        {/* ── Mode badge (scanning / result) ── */}
        {mode && phase !== PHASE.IDLE && (
          <div style={{
            width: '100%', maxWidth: '576px', marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '12px',
            background: isCheckIn ? 'rgba(5,46,22,0.5)'  : 'rgba(67,20,7,0.5)',
            border:     isCheckIn ? '1px solid #166534'  : '1px solid #9a3412',
            fontSize: '0.875rem', fontWeight: 600,
            color: isCheckIn ? '#4ade80' : '#fb923c',
          }}>
            {isCheckIn ? <LogIn size={15} /> : <LogOut size={15} />}
            {isCheckIn ? 'Check-In Mode' : 'Check-Out Mode'}
          </div>
        )}

        {/* ── Camera box ── */}
        <div style={{
          position: 'relative', width: '100%', maxWidth: '576px',
          aspectRatio: '4/3', borderRadius: '20px', overflow: 'hidden',
          background: '#0f172a', border: '1px solid #1e293b',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}>
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            muted playsInline
          />

          {/* ── Scanning overlay — BLUE ring, never green ── */}
          {phase === PHASE.SCANNING && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              {/* Face alignment frame */}
              <div
                className="kiosk-scan-ring"
                style={{
                  width: '192px', height: '224px',
                  borderRadius: '20px',
                  border: '2.5px solid #60a5fa',
                }}
              />
              <p style={{
                marginTop: '16px', fontSize: '0.875rem', fontWeight: 600,
                color: '#60a5fa',
                textShadow: '0 1px 6px rgba(0,0,0,0.8)',
              }}>
                Scanning — align your face
              </p>
            </div>
          )}

          {/* ── Result overlay ── */}
          {isDone && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: overlayBg,
              padding: '24px', textAlign: 'center',
              color: '#f1f5f9',
            }}>
              {/* Icon */}
              <div style={{ marginBottom: '12px' }}>
                <ResultIcon phase={phase} />
              </div>

              {/* Headline */}
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                {resultHeadline(phase, employeeName)}
              </h2>

              {/* Employee detail block (success / already states) */}
              {result?.employee && (
                <div style={{ marginBottom: '8px' }}>
                  <p style={{ fontSize: '0.875rem', opacity: 0.75, margin: '2px 0' }}>
                    {result.employee.department}
                  </p>
                  <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', opacity: 0.55, margin: '2px 0' }}>
                    {result.employee.employeeId}
                  </p>

                  {/* Status badge — shown on success */}
                  {result.status && (
                    <span style={{
                      display: 'inline-block', marginTop: '8px',
                      fontSize: '0.875rem', fontWeight: 700,
                      padding: '3px 16px', borderRadius: '999px',
                      background: result.status === 'Present'
                        ? 'rgba(21,128,61,0.35)'
                        : result.status === 'Late'
                          ? 'rgba(180,83,9,0.35)'
                          : 'rgba(30,41,59,0.5)',
                      color: result.status === 'Present' ? '#86efac'
                           : result.status === 'Late'    ? '#fcd34d'
                           :                               '#94a3b8',
                    }}>
                      {result.status}
                    </span>
                  )}

                  {/* Time stamps */}
                  {phase === PHASE.SUCCESS && result.checkInTime && (
                    <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '6px' }}>
                      Checked in at {formatEthiopianTime(result.checkInTime)}
                    </p>
                  )}
                  {phase === PHASE.CHECKOUT_OK && (result.afterLunchCheckOut || result.checkOutTime) && (
                    <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '6px' }}>
                      Checked out at {formatEthiopianTime(result.afterLunchCheckOut ?? result.checkOutTime)}
                    </p>
                  )}
                </div>
              )}

              {/* Server message (shown on all non-success states) */}
              {msg && phase !== PHASE.SUCCESS && phase !== PHASE.CHECKOUT_OK && (
                <p style={{ fontSize: '0.8125rem', opacity: 0.75, maxWidth: '320px', lineHeight: 1.5, marginTop: '4px' }}>
                  {msg}
                </p>
              )}

              {phase === PHASE.CHECK_IN_REQUIRED && (
                <button
                  onClick={() => selectMode('checkin')}
                  style={{
                    marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 18px', borderRadius: '8px',
                    background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.4)',
                    cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#fbbf24',
                  }}
                >
                  <LogIn size={14} /> Check In Now
                </button>
              )}

              <p style={{ fontSize: '0.6875rem', opacity: 0.4, marginTop: '20px' }}>
                Auto-resetting in 6 s…
              </p>
              <button
                onClick={resetKiosk}
                style={{
                  marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
                  fontSize: '0.875rem', fontWeight: 500, color: '#f1f5f9',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              >
                <RefreshCw size={14} /> New scan
              </button>
            </div>
          )}

          {/* ── Boot overlay ── */}
          {phase === PHASE.BOOT && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(2,6,23,0.85)',
            }}>
              <div
                className="kiosk-spin"
                style={{
                  width: '40px', height: '40px',
                  borderRadius: '50%',
                  border: '4px solid #1e293b',
                  borderTopColor: '#3b82f6',
                  marginBottom: '12px',
                }}
              />
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Initialising models…</p>
            </div>
          )}

          {/* ── Idle overlay ── */}
          {phase === PHASE.IDLE && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(2,6,23,0.72)',
            }}>
              <Camera size={40} color="#334155" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '0.875rem', color: '#475569' }}>Select Check In or Check Out above</p>
            </div>
          )}
        </div>

        {/* ── Status bar ── */}
        <div style={statusBarStyle}>
          {/* Dot — pulses while scanning */}
          <span
            className={phase === PHASE.SCANNING ? 'kiosk-scan-ring' : undefined}
            style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: statusStyle.dot, flexShrink: 0,
              boxShadow: phase === PHASE.SCANNING
                ? '0 0 0 0 rgba(59,130,246,0.55)'
                : 'none',
            }}
          />
          <span style={{ fontSize: '0.875rem', color: statusStyle.text }}>
            {statusBarText(phase, msg, isCheckIn)}
          </span>
        </div>

        {/* ── Footer ── */}
        <p style={{ marginTop: '12px', fontSize: '0.75rem', color: '#334155', textAlign: 'center' }}>
          Stand in front of the camera · Look straight ahead · Ensure good lighting
        </p>
        <a
          href="/login"
          style={{ marginTop: '4px', fontSize: '0.75rem', color: '#334155', textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#3b82f6'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#334155'; }}
        >
          Staff login →
        </a>
      </div>
    </>
  );
}

/* ── Mode button sub-component ─────────────────────────────────────────── */
function ModeBtn({ onClick, icon, label, accent, accentBg, accentHover, textColor }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '8px', padding: '20px',
        borderRadius: '20px',
        border: `2px solid ${accent}`,
        background: hovered ? accentHover : accentBg,
        color: textColor,
        cursor: 'pointer', transition: 'background 0.15s',
        fontWeight: 700, fontSize: '1rem',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
