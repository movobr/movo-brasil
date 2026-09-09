import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import {
  assessCancellation,
  requestRefundForCancelledPrepaid,
} from '../../src/domain/cancellation.js';

const ASSIGNED_AT = new Date('2026-09-09T12:00:00.000Z');
const withinWindow = new Date(ASSIGNED_AT.getTime() + 119000);
const afterWindow = new Date(ASSIGNED_AT.getTime() + 121000);

describe('cancellation policy (DEC-CXL)', () => {
  it('is free before driver assignment (CXL-001)', () => {
    for (const status of ['REQUESTED', 'MATCHING'] as const) {
      const outcome = assessCancellation({
        status,
        cancelledBy: 'passenger',
        assignedAt: null,
        now: afterWindow,
        exceptionalApproval: false,
        reason: 'changed-plans',
      });
      expect(outcome).toEqual({ feeMinor: 0, feeApplies: false, driverPerformanceFlag: false });
    }
  });

  it('is free within 2 min of assignment, R$ 6,00 after (CXL-002/003)', () => {
    const free = assessCancellation({
      status: 'DRIVER_ARRIVING',
      cancelledBy: 'passenger',
      assignedAt: ASSIGNED_AT,
      now: withinWindow,
      exceptionalApproval: false,
      reason: 'changed-plans',
    });
    expect(free.feeMinor).toBe(0);
    const paid = assessCancellation({
      status: 'DRIVER_ARRIVING',
      cancelledBy: 'passenger',
      assignedAt: ASSIGNED_AT,
      now: afterWindow,
      exceptionalApproval: false,
      reason: 'changed-plans',
    });
    expect(paid).toEqual({ feeMinor: 600, feeApplies: true, driverPerformanceFlag: false });
  });

  it('charges R$ 10,00 after driver arrival (CXL-004)', () => {
    const outcome = assessCancellation({
      status: 'DRIVER_ARRIVED',
      cancelledBy: 'passenger',
      assignedAt: ASSIGNED_AT,
      now: withinWindow,
      exceptionalApproval: false,
      reason: 'changed-plans',
    });
    expect(outcome).toEqual({ feeMinor: 1000, feeApplies: true, driverPerformanceFlag: false });
  });

  it('never charges the passenger on driver cancellation (CXL-005)', () => {
    const outcome = assessCancellation({
      status: 'DRIVER_ARRIVING',
      cancelledBy: 'driver',
      assignedAt: ASSIGNED_AT,
      now: afterWindow,
      exceptionalApproval: false,
      reason: 'vehicle-issue',
    });
    expect(outcome).toEqual({ feeMinor: 0, feeApplies: false, driverPerformanceFlag: true });
  });

  it('gates IN_PROGRESS cancellation on exceptional approval, fee BLOCKED', () => {
    const base = {
      status: 'IN_PROGRESS' as const,
      cancelledBy: 'passenger' as const,
      assignedAt: ASSIGNED_AT,
      now: afterWindow,
      reason: 'emergency',
    };
    expect(() => assessCancellation({ ...base, exceptionalApproval: false })).toThrowError(DomainError);
    expect(() => assessCancellation({ ...base, exceptionalApproval: true })).toThrowError(DomainError);
  });
});

describe('refund request (CXL-007)', () => {
  it('creates refund_pending for cancelled prepaid rides', () => {
    const refund = requestRefundForCancelledPrepaid({
      id: 'ref-1',
      rideId: 'ride-1',
      paymentId: 'pay-1',
      amountMinor: 2800,
      prepaid: true,
      now: ASSIGNED_AT,
    });
    expect(refund?.status).toBe('refund_pending');
    expect(refund?.currency).toBe('BRL');
  });

  it('creates nothing when the ride was not prepaid', () => {
    expect(
      requestRefundForCancelledPrepaid({
        id: 'ref-1',
        rideId: 'ride-1',
        paymentId: 'pay-1',
        amountMinor: 2800,
        prepaid: false,
        now: ASSIGNED_AT,
      }),
    ).toBeNull();
  });
});
