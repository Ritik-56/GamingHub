import { Router } from 'express';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Payment from '../models/Payment.js';
import Session from '../models/Session.js';
import Station from '../models/Station.js';
import { authenticate } from '../middleware/auth.js';
import { requireCafeRole } from '../middleware/cafeAuth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router({ mergeParams: true });

/**
 * Build a date range filter for a given date string (YYYY-MM-DD).
 * Returns { $gte: startOfDay, $lt: startOfNextDay } in local time.
 */
function buildDateFilter(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return { $gte: d, $lt: next };
}

/**
 * Build a date range filter from `from` and `to` strings (YYYY-MM-DD).
 */
function buildRangeFilter(fromStr, toStr) {
  const range = {};
  if (fromStr) {
    const d = new Date(fromStr + 'T00:00:00');
    if (!isNaN(d.getTime())) range.$gte = d;
  }
  if (toStr) {
    const d = new Date(toStr + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 1);
      range.$lt = d;
    }
  }
  return Object.keys(range).length > 0 ? range : null;
}

/**
 * Shared function to build payment query filter.
 * Used by both list and export endpoints.
 */
function buildPaymentFilter(cafeId, { status, date, from, to }) {
  const filter = { cafe: cafeId };

  // Status filter
  if (status) {
    filter.status = status;
  }

  // Date filtering — uses paidAt for PAID, createdAt for PENDING/mixed
  const dateField = status === 'PAID' ? 'paidAt' : 'createdAt';

  if (date) {
    const dateRange = buildDateFilter(date);
    if (dateRange) filter[dateField] = dateRange;
  } else if (from || to) {
    const rangeFilter = buildRangeFilter(from, to);
    if (rangeFilter) filter[dateField] = rangeFilter;
  }

  return filter;
}

/**
 * Shared populate config for payment queries.
 */
function populatePayments(query) {
  return query
    .populate('customer', 'name email phone')
    .populate({
      path: 'session',
      select: 'station startedAt endedAt pricePerHour finalAmount controllersRequested controllerCharge sessionCharge',
      populate: { path: 'station', select: 'name type' },
    })
    .sort({ createdAt: -1 });
}

/**
 * Format duration from startedAt/endedAt.
 */
function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return '—';
  const ms = new Date(endedAt) - new Date(startedAt);
  const totalMins = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

// GET /api/cafes/:cafeId/payments — list payments (staff+)
// Query params: status (PENDING|PAID), date (YYYY-MM-DD), from (YYYY-MM-DD), to (YYYY-MM-DD)
router.get(
  '/',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      const { status, date, from, to } = req.query;
      const filter = buildPaymentFilter(req.params.cafeId, {
        status: status || 'PENDING',
        date,
        from,
        to,
      });

      const payments = await populatePayments(Payment.find(filter));

      res.json({
        status: 'success',
        data: { payments },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/cafes/:cafeId/payments/export — download Excel (staff+)
// Query params: status (PAID default), date (YYYY-MM-DD), from (YYYY-MM-DD), to (YYYY-MM-DD)
router.get(
  '/export',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      const { status, date, from, to } = req.query;
      const filter = buildPaymentFilter(req.params.cafeId, {
        status: status || 'PAID',
        date,
        from,
        to,
      });

      const payments = await populatePayments(Payment.find(filter));

      // Build Excel workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Gaming Hub';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Payment Records');

      // Define columns
      sheet.columns = [
        { header: '#', key: 'sno', width: 5 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Customer Name', key: 'customerName', width: 22 },
        { header: 'Customer Phone', key: 'customerPhone', width: 16 },
        { header: 'Station', key: 'station', width: 14 },
        { header: 'Type', key: 'stationType', width: 10 },
        { header: 'Duration', key: 'duration', width: 12 },
        { header: 'Session Charge (₹)', key: 'sessionCharge', width: 18 },
        { header: 'Controllers', key: 'controllerCount', width: 12 },
        { header: 'Controller Charge (₹)', key: 'controllerCharge', width: 20 },
        { header: 'Total Amount (₹)', key: 'totalAmount', width: 16 },
        { header: 'Status', key: 'paymentStatus', width: 10 },
        { header: 'Paid At', key: 'paidAt', width: 20 },
      ];

      // Style header row
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { horizontal: 'center' };

      // Add data rows
      payments.forEach((p, i) => {
        const session = p.session;
        // Controller fields — gracefully handle when not yet implemented (Feature 3)
        const controllerCount = session?.controllersRequested ?? 0;
        const controllerCharge = session?.controllerCharge ?? 0;
        const sessionCharge = session?.sessionCharge ?? (p.amount - controllerCharge);

        sheet.addRow({
          sno: i + 1,
          date: p.paidAt
            ? new Date(p.paidAt).toLocaleDateString('en-IN')
            : new Date(p.createdAt).toLocaleDateString('en-IN'),
          customerName: p.customer?.name || '—',
          customerPhone: p.customer?.phone || p.customer?.email || '—',
          station: session?.station?.name || '—',
          stationType: session?.station?.type || '—',
          duration: formatDuration(session?.startedAt, session?.endedAt),
          sessionCharge,
          controllerCount,
          controllerCharge,
          totalAmount: p.amount,
          paymentStatus: p.status,
          paidAt: p.paidAt
            ? new Date(p.paidAt).toLocaleString('en-IN')
            : '—',
        });
      });

      // Add summary row
      const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
      const summaryRow = sheet.addRow({
        sno: '',
        date: '',
        customerName: '',
        customerPhone: '',
        station: '',
        stationType: '',
        duration: 'TOTAL',
        sessionCharge: '',
        controllerCount: '',
        controllerCharge: '',
        totalAmount,
        paymentStatus: '',
        paidAt: '',
      });
      summaryRow.font = { bold: true };

      // Generate filename
      const dateLabel = date || (from && to ? `${from}_to_${to}` : new Date().toISOString().split('T')[0]);
      const filename = `payment_records_${dateLabel}.xlsx`;

      // Set response headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/cafes/:cafeId/payments/:paymentId/markPaid — mark payment as paid (staff+)
router.post(
  '/:paymentId/markPaid',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      // Atomically update payment status to PAID — only if currently PENDING
      const payment = await Payment.findOneAndUpdate(
        {
          _id: req.params.paymentId,
          cafe: req.params.cafeId,
          status: 'PENDING',
        },
        {
          status: 'PAID',
          paidAt: new Date(),
          markedBy: req.user._id,
        },
        { new: true }
      );

      if (!payment) {
        throw new AppError('Payment not found or already processed', 404);
      }

      // Update session status from PAYMENT_PENDING to COMPLETED
      const session = await Session.findByIdAndUpdate(payment.session, {
        status: 'COMPLETED',
      }, { new: true });

      // Set station back to AVAILABLE
      if (session) {
        await Station.findByIdAndUpdate(session.station, {
          status: 'AVAILABLE',
        });
      }

      res.json({
        status: 'success',
        data: { payment },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/cafes/:cafeId/payments/stats — payment stats for dashboard (staff+)
router.get(
  '/stats',
  authenticate,
  requireCafeRole('OWNER', 'MANAGER', 'STAFF'),
  async (req, res, next) => {
    try {
      const cafeId = req.params.cafeId;

      const pendingCount = await Payment.countDocuments({
        cafe: cafeId,
        status: 'PENDING',
      });

      const pendingTotal = await Payment.aggregate([
        { $match: { cafe: new mongoose.Types.ObjectId(cafeId), status: 'PENDING' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      // Today's revenue (paid today)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayRevenue = await Payment.aggregate([
        {
          $match: {
            cafe: new mongoose.Types.ObjectId(cafeId),
            status: 'PAID',
            paidAt: { $gte: todayStart },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      const todayPaidCount = await Payment.countDocuments({
        cafe: cafeId,
        status: 'PAID',
        paidAt: { $gte: todayStart },
      });

      res.json({
        status: 'success',
        data: {
          pendingCount,
          pendingTotal: pendingTotal[0]?.total || 0,
          todayRevenue: todayRevenue[0]?.total || 0,
          todayPaidCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
