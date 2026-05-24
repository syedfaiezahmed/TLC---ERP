import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import QrToken from '../models/QrToken.js';
import QrScan from '../models/QrScan.js';
import QrAttendanceSettings from '../models/QrAttendanceSettings.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';

// ── helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getSettings = async (companyId) => {
  let s = await QrAttendanceSettings.findOne({ company: companyId });
  if (!s) s = await QrAttendanceSettings.create({ company: companyId });
  return s;
};

const generateQRImage = async (token) => {
  return QRCode.toDataURL(`TLC-QR-${token}`, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
    color: { dark: '#000000', light: '#ffffff' },
  });
};

// ── GET /qr-attendance/generate/:userType/:userId  ────────────────────────────
// Returns (or creates) the QR token + image for a student or teacher.
export const generateUserQR = async (req, res) => {
  try {
    const { userType, userId } = req.params;
    const companyId = req.query.companyId || req.user?.company;

    if (!['Student', 'Teacher'].includes(userType))
      return res.status(400).json({ message: 'Invalid userType' });

    // Verify the user belongs to this company
    let user = null;
    if (userType === 'Student') {
      user = await Student.findOne({ _id: userId, company: companyId }).populate('group', 'name');
    } else {
      user = await Teacher.findOne({ _id: userId, company: companyId });
    }
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Find or create QR token
    let qrRecord = await QrToken.findOne({ company: companyId, userId, userType });
    if (!qrRecord) {
      const token = uuidv4();
      const qrDataUrl = await generateQRImage(token);
      qrRecord = await QrToken.create({ company: companyId, userId, userType, token, qrDataUrl });
    } else if (!qrRecord.qrDataUrl) {
      qrRecord.qrDataUrl = await generateQRImage(qrRecord.token);
      await qrRecord.save();
    }

    res.json({
      token: qrRecord.token,
      qrDataUrl: qrRecord.qrDataUrl,
      user: {
        _id: user._id,
        name: user.name,
        userType,
        identifier: userType === 'Student' ? user.studentId : user.contact,
        info: userType === 'Teacher' ? (user.specialization || '') : '',
      },
    });
  } catch (err) {
    console.error('generateUserQR error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ── POST /qr-attendance/scan  ─────────────────────────────────────────────────
// Called by the frontend when a QR code is decoded from the webcam.
// Body: { rawQR: 'TLC-QR-<uuid>', companyId }
export const processScan = async (req, res) => {
  try {
    const { rawQR, companyId } = req.body;

    if (!rawQR || !companyId)
      return res.status(400).json({ message: 'rawQR and companyId are required' });

    // Parse token from QR string
    if (!rawQR.startsWith('TLC-QR-'))
      return res.status(400).json({ message: 'Invalid QR code', type: 'invalid' });

    const token = rawQR.replace('TLC-QR-', '').trim();

    // Look up the token
    const qrRecord = await QrToken.findOne({ token, company: companyId });
    if (!qrRecord)
      return res.status(404).json({ message: 'QR code not registered to this institution', type: 'invalid' });

    const settings = await getSettings(companyId);

    // Cooldown check — prevent the same QR from firing twice in rapid succession
    const now = new Date();
    const dateStr = todayStr();

    let scan = await QrScan.findOne({ company: companyId, userId: qrRecord.userId, date: dateStr });

    if (scan) {
      const secondsSinceLastScan = scan.lastScanAt
        ? (now - new Date(scan.lastScanAt)) / 1000
        : Infinity;

      if (secondsSinceLastScan < settings.cooldownSeconds)
        return res.status(429).json({
          message: `Slow down! Wait ${Math.ceil(settings.cooldownSeconds - secondsSinceLastScan)}s`,
          type: 'cooldown',
          userName: scan.userName,
        });

      // Already completed (checked out) — no more scans today
      if (scan.status === 'completed')
        return res.status(409).json({
          message: `${scan.userName} already completed attendance today`,
          type: 'completed',
          userName: scan.userName,
          checkIn: scan.checkIn,
          checkOut: scan.checkOut,
        });

      // Second scan within 14-hour window → automatic check-out
      const CHECKOUT_WINDOW_HOURS = 14;
      if (scan.checkIn && !scan.checkOut) {
        const hoursSinceCheckIn = (now - new Date(scan.checkIn)) / (1000 * 60 * 60);
        if (hoursSinceCheckIn <= CHECKOUT_WINDOW_HOURS) {
          const durationMs = now - new Date(scan.checkIn);
          const duration   = Math.round(durationMs / 60000);
          scan.checkOut    = now;
          scan.duration    = duration;
          scan.status      = 'completed';
          scan.lastScanAt  = now;
          await scan.save();

          return res.json({
            type: 'checkout',
            message: `Check-out recorded for ${scan.userName}`,
            userName: scan.userName,
            userType: qrRecord.userType,
            checkIn: scan.checkIn,
            checkOut: scan.checkOut,
            duration,
          });
        }
      }

      // Beyond 14-hour window — already marked in
      return res.status(409).json({
        message: `${scan.userName} already checked in today`,
        type: 'already_in',
        userName: scan.userName,
        checkIn: scan.checkIn,
      });
    }

    // ── First scan of the day → Check-In ────────────────────────────────────
    let user = null;
    let userInfo = '';
    let userIdentifier = '';

    if (qrRecord.userType === 'Student') {
      user = await Student.findById(qrRecord.userId).populate('group', 'name');
      if (!user) return res.status(404).json({ message: 'Student no longer exists', type: 'invalid' });
      userInfo = user.group?.name || '';
      userIdentifier = user.studentId || '';
    } else {
      user = await Teacher.findById(qrRecord.userId);
      if (!user) return res.status(404).json({ message: 'Teacher no longer exists', type: 'invalid' });
      userInfo = user.specialization || '';
      userIdentifier = user.contact || '';
    }

    scan = await QrScan.create({
      company: companyId,
      userId: qrRecord.userId,
      userType: qrRecord.userType,
      userName: user.name,
      userInfo,
      userIdentifier,
      date: dateStr,
      checkIn: now,
      status: 'present',
      lastScanAt: now,
    });

    return res.json({
      type: 'checkin',
      message: `Check-in recorded for ${user.name}`,
      userName: user.name,
      userType: qrRecord.userType,
      userInfo,
      checkIn: scan.checkIn,
    });
  } catch (err) {
    console.error('processScan error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ── GET /qr-attendance/today/:companyId  ─────────────────────────────────────
export const getTodayScans = async (req, res) => {
  try {
    const { companyId } = req.params;
    const scans = await QrScan.find({ company: companyId, date: todayStr() })
      .sort({ checkIn: -1 })
      .lean();
    res.json(scans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /qr-attendance/history/:companyId  ────────────────────────────────────
export const getScanHistory = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 50, date, userType, search } = req.query;

    const filter = { company: companyId };
    if (date) filter.date = date;
    if (userType) filter.userType = userType;
    if (search) filter.userName = { $regex: search, $options: 'i' };

    const total = await QrScan.countDocuments(filter);
    const scans = await QrScan.find(filter)
      .sort({ date: -1, checkIn: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.json({ scans, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /qr-attendance/settings/:companyId  ──────────────────────────────────
export const getQRSettings = async (req, res) => {
  try {
    const settings = await getSettings(req.params.companyId);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /qr-attendance/settings/:companyId  ──────────────────────────────────
export const updateQRSettings = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { checkoutEnabled, cooldownSeconds, autoStart, soundEnabled } = req.body;

    const settings = await QrAttendanceSettings.findOneAndUpdate(
      { company: companyId },
      { checkoutEnabled, cooldownSeconds, autoStart, soundEnabled },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /qr-attendance/users/:companyId  ─────────────────────────────────────
// Returns all students + teachers with their QR generation status.
export const getQRUsers = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { userType = 'Student' } = req.query;

    let users = [];
    if (userType === 'Student') {
      users = await Student.find({ company: companyId, status: 'Active' })
        .select('name studentId group profileImage')
        .populate('group', 'name')
        .sort({ name: 1 })
        .lean();
    } else {
      users = await Teacher.find({ company: companyId })
        .select('name contact specialization')
        .sort({ name: 1 })
        .lean();
    }

    // Attach QR status
    const userIds = users.map(u => u._id);
    const tokens = await QrToken.find({
      company: companyId,
      userId: { $in: userIds },
      userType,
    }).lean();
    const tokenMap = {};
    tokens.forEach(t => { tokenMap[t.userId.toString()] = t; });

    const result = users.map(u => ({
      ...u,
      hasQR: !!tokenMap[u._id.toString()],
      qrToken: tokenMap[u._id.toString()]?.token || null,
      qrDataUrl: tokenMap[u._id.toString()]?.qrDataUrl || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /qr-attendance/scan/:id  ──────────────────────────────────────────
export const deleteScan = async (req, res) => {
  try {
    await QrScan.findByIdAndDelete(req.params.id);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /qr-attendance/summary/:companyId  ───────────────────────────────────
export const getDailySummary = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { date = todayStr() } = req.query;

    const scans = await QrScan.find({ company: companyId, date }).lean();
    const students = scans.filter(s => s.userType === 'Student');
    const teachers = scans.filter(s => s.userType === 'Teacher');

    res.json({
      date,
      total: scans.length,
      students: {
        total: students.length,
        present: students.filter(s => s.status === 'present').length,
        completed: students.filter(s => s.status === 'completed').length,
      },
      teachers: {
        total: teachers.length,
        present: teachers.filter(s => s.status === 'present').length,
        completed: teachers.filter(s => s.status === 'completed').length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
