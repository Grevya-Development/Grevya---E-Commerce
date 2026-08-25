# Production-Grade Order Management System - Implementation Guide

## Overview

This implementation adds a complete production-grade order management system with state machine validation, payment status tracking, and audit trails. All status transitions are enforced both on the frontend and backend.

## Files Created

### 1. Database Migration

**File:** `supabase/add_order_state_machine.sql`
**Purpose:** Implements all database-level changes
**Components:**

- Adds missing fields to orders table: `payment_status`, `tracking_number`, `estimated_delivery`
- Updates order status constraint to include: `in_transit`, `out_for_delivery`, `returned`
- Creates validation functions:
  - `is_valid_order_status_transition()` - validates order status transitions
  - `is_valid_payment_status_transition()` - validates payment status transitions
- Creates RPC function `update_order_status()` - enforces all business rules
- Adds helper functions:
  - `get_valid_order_status_transitions()` - returns valid next statuses
  - `get_valid_payment_status_transitions()` - returns valid next payment statuses
- Adds UPDATE RLS policy for secure order updates
- Creates indexes for performance

**Status:** Ready to deploy

### 2. Frontend State Machine Library

**File:** `src/lib/orderStateMachine.ts`
**Purpose:** Defines order and payment state machines
**Exports:**

- `OrderStatus` type with all valid statuses
- `PaymentStatus` type with all valid payment statuses
- `ORDER_STATUS_MACHINE` - transition rules
- `PAYMENT_STATUS_MACHINE` - payment transition rules
- `getValidOrderStatuses()` - get valid next statuses
- `getValidPaymentStatuses()` - get valid next payment statuses
- `isValidOrderTransition()` - validate transitions
- `isValidPaymentTransition()` - validate payment transitions
- Status labels and descriptions for display

### 3. Order Management Service

**File:** `src/lib/orderService.ts`
**Purpose:** Handles all order-related API calls
**Functions:**

- `updateOrderStatus()` - calls RPC to update order with validation
- `getOrderWithHistory()` - fetches order and its status history
- `getValidNextStatuses()` - queries backend for valid transitions
- `getValidNextPaymentStatuses()` - queries backend for valid payment transitions
- `getOrdersForAdmin()` - fetches orders for admin dashboard

### 4. Updated Admin Orders Component

**File:** `src/pages/admin/AdminOrders.tsx`
**Changes:**

- Imports new state machine and order service
- New state variables for status management:
  - `validOrderStatuses` - valid next order statuses
  - `validPaymentStatuses` - valid next payment statuses
  - `selectedOrderStatus` - selected new order status
  - `selectedPaymentStatus` - selected new payment status
  - `confirmDialog` - confirmation dialog state
  - `showHistory` - toggle order history display
- Updated `openOrderDetails()` to load order history and calculate valid transitions
- New `handleStatusChangeClick()` - initiates status change with confirmation
- New `confirmStatusChange()` - confirms and applies status change
- Updated UI to show:
  - Current order and payment status with descriptions
  - Only valid next status options as buttons
  - Order status timeline/history
  - Tracking number and estimated delivery inputs
  - Confirmation dialog for all status changes

**Key Improvements:**

- Prevents invalid status transitions at frontend level
- Shows only allowed next statuses to admin
- Requires confirmation before any status change
- Displays complete order history
- Separates order and payment status management
- Tracks who made changes and when

## Database Schema Changes

### Orders Table Modifications

```sql
-- New fields added:
ALTER TABLE public.orders
ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'
CHECK (payment_status IN ('pending', 'paid', 'failed', 'refund_processing', 'refunded'));

ALTER TABLE public.orders
ADD COLUMN tracking_number TEXT;

ALTER TABLE public.orders
ADD COLUMN estimated_delivery TIMESTAMPTZ;

-- Updated status constraint:
ALTER TABLE public.orders
DROP CONSTRAINT orders_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check CHECK (
  status IN (
    'pending', 'confirmed', 'processing', 'shipped',
    'in_transit', 'out_for_delivery', 'delivered',
    'cancelled', 'returned'
  )
);
```

### New Functions in Supabase

1. `is_valid_order_status_transition()` - Validates order transitions
2. `is_valid_payment_status_transition()` - Validates payment transitions
3. `update_order_status()` - RPC function for safe order updates
4. `get_valid_order_status_transitions()` - Returns valid transitions
5. `get_valid_payment_status_transitions()` - Returns valid transitions

### New RLS Policy

```sql
CREATE POLICY "Admin update orders via RPC" ON public.orders
    FOR UPDATE USING (public.has_permission(auth.uid(), 'order:write_status'))
    WITH CHECK (public.has_permission(auth.uid(), 'order:write_status'));
```

## Order Status State Machine

### Valid Transitions

```
pending ──→ confirmed ──→ processing ──→ shipped ──→ in_transit ──→ out_for_delivery ──→ delivered ──→ returned
   ↓         ↓              ↓
cancelled   cancelled      cancelled
```

### Detailed Rules

- **pending** → confirmed, cancelled
- **confirmed** → processing, cancelled
- **processing** → shipped, cancelled
- **shipped** → in_transit
- **in_transit** → out_for_delivery
- **out_for_delivery** → delivered
- **delivered** → returned
- **cancelled** → (no transitions)
- **returned** → (no transitions)

## Payment Status State Machine

### Valid Transitions

```
pending ──→ paid ──────────┐
  ↓         ↓              ↓
 failed    refund_processing ──→ refunded
  ↑              ↑
  └──────────────┘
```

### Detailed Rules

- **pending** → paid, failed, refund_processing
- **paid** → refund_processing, refunded
- **failed** → pending, refund_processing
- **refund_processing** → refunded
- **refunded** → (no transitions)

## Business Rules Enforced

### 1. State Machine Enforcement

- All status transitions must follow defined state machine
- Invalid transitions are rejected by backend
- Frontend only shows valid next statuses

### 2. Tracking Number Validation

- Required when transitioning to: shipped, in_transit, out_for_delivery, delivered
- Enforced on backend before allowing transition

### 3. Payment Status Rules

- Payment status is separate from order status
- COD orders can be shipped without being marked as paid
- COD payment is marked as paid atomically when the order is delivered
- Online payment behavior remains unchanged

### 4. Cancellation Rules

- Only allowed from: pending, confirmed, processing
- Not allowed after shipment

### 5. Audit Trail

- Every status change creates entry in `order_status_history`
- Records: changed_by user, timestamp, and reason
- Admin can view complete timeline in order details

### 6. Permission Checks

- Only users with `order:write_status` permission can update orders
- Permissions checked both at frontend and backend (RLS)
- Admin and super_admin roles have this permission

## Implementation Steps

### Step 1: Deploy Database Migration

1. Go to Supabase SQL Editor
2. Open `supabase/add_order_state_machine.sql`
3. Copy entire content
4. Paste into Supabase SQL Editor
5. Click "Run"
6. Verify no errors

### Step 2: Deploy Frontend Code

1. The three new files are created:
   - `src/lib/orderStateMachine.ts`
   - `src/lib/orderService.ts`
   - Updated `src/pages/admin/AdminOrders.tsx`
2. Run TypeScript check to verify types
3. Build and test locally

### Step 3: Test Scenarios (See Below)

## Testing Scenarios

### Scenario 1: Valid Forward Transition

- **Action:** pending → confirmed → processing → shipped → in_transit → out_for_delivery → delivered
- **Expected:** Each transition succeeds, valid next statuses are shown, history is recorded
- **Verify:** Check order status is updated, history shows all transitions, badges display correctly

### Scenario 2: Simple Cancellation

- **Action:** pending → cancelled
- **Expected:** Transition succeeds, no further status changes allowed
- **Verify:** Cancelled badge shows, no valid next statuses displayed

### Scenario 3: Invalid Transition Rejected

- **Action:** pending → delivered (skip middle steps)
- **Expected:** Frontend doesn't show this option, backend rejects if somehow sent
- **Verify:** Error message displayed, order status unchanged

### Scenario 4: Cannot Change Cancelled Order

- **Action:** cancelled → processing
- **Expected:** No valid transitions shown, backend rejects
- **Verify:** Button disabled, error message if attempted

### Scenario 5: COD Order Payment Collection

- **Action:**
  1. Create COD order with payment_status = pending
  2. Progress order to delivered
  3. Payment status still pending
- **Expected:** Order delivered and payment status becomes paid atomically
- **Verify:** Order shows "Delivered" + "Paid", with no payment action buttons

### Scenario 6: Tracking Number Required for Shipped

- **Action:** Try to transition to "shipped" without tracking number
- **Expected:** Confirmation dialog shows warning, Submit button disabled
- **Verify:** Must enter tracking number to proceed

### Scenario 7: Permission Check

- **Action:** Non-admin user tries to call update_order_status RPC
- **Expected:** Backend rejects with "Unauthorized" error
- **Verify:** Error message shows, order unchanged

### Scenario 8: Order History Display

- **Action:** Open any order and click "Show Status History"
- **Expected:** Timeline shows all status transitions in reverse chronological order
- **Verify:** Each entry shows: status, reason, changed by, timestamp

### Scenario 9: Database Persists Changes

- **Action:**
  1. Update order status
  2. Refresh page
  3. Open order again
- **Expected:** Status persists, history shows change
- **Verify:** Database query shows updated status and audit trail entry

### Scenario 10: Payment Status Change

- **Action:** Change payment status from pending → paid for active order
- **Expected:** Payment status updates independently of order status
- **Verify:** Badge shows new payment status, order status unchanged

## Key Implementation Details

### Why Backend Enforcement Matters

Frontend validation is good UX, but the RPC function in the database:

1. Prevents direct SQL updates that bypass validation
2. Enforces rules even if UI is bypassed
3. Creates audit trail atomically
4. Uses RLS to prevent unauthorized access

### Frontend-Backend Sync

- Frontend shows valid options using state machine
- Backend validates using SQL functions
- If admin somehow sends invalid transition, backend rejects it
- Error message displayed to user
- Order remains unchanged

### Audit Trail Benefits

- Complete history of all status changes
- Know who made each change and when
- Can see reason if provided
- Useful for dispute resolution and compliance

## Future Enhancements

1. **Notifications:** Send notifications to customer when order status changes
2. **Webhooks:** Trigger external systems on certain transitions
3. **Refund Automation:** Auto-create refund when order returned
4. **Seller Dashboard:** Show only sellers' orders with limited status transitions
5. **Batch Operations:** Update multiple orders at once
6. **Status Filters:** Pre-built views for common order statuses
7. **Analytics:** Dashboard showing order flow metrics

## Troubleshooting

### Issue: Valid statuses not showing

- **Check:** Run SQL query to verify functions exist
- **Check:** Verify order status value in database (may be using spaces instead of underscores)
- **Solution:** Update `getValidOrderStatuses()` to normalize status strings

### Issue: Confirmation dialog not appearing

- **Check:** Browser console for errors
- **Check:** Verify `handleStatusChangeClick` is connected to buttons
- **Solution:** Ensure state variables are properly initialized

### Issue: Changes not persisting

- **Check:** Verify RLS policy is enabled on orders table
- **Check:** User has `order:write_status` permission
- **Solution:** Run SELECT query to check permissions

### Issue: Audit trail not created

- **Check:** `order_status_history` table exists
- **Check:** Verify trigger/function creates history entry
- **Solution:** Manually verify entry after status change

## Performance Considerations

- Indexes added for common queries:
  - `idx_orders_payment_status` - filters by payment status
  - `idx_orders_status_payment` - filters by both statuses
  - `idx_order_status_history_order` - retrieves history efficiently

- Order history limited to showing recent transitions (max-height: 256px scrollable)
- Lazy load history only when "Show Status History" clicked

## Security Notes

1. All status changes go through RPC with permission checks
2. RLS policies prevent unauthorized order updates
3. User ID captured in audit trail
4. Payment status changes require order:write_status permission
5. No direct table updates from frontend (goes through RPC)

## Files to Deploy

1. **Database:** `supabase/add_order_state_machine.sql` (run in Supabase)
2. **Frontend:**
   - `src/lib/orderStateMachine.ts` (new)
   - `src/lib/orderService.ts` (new)
   - `src/pages/admin/AdminOrders.tsx` (modified)
3. **No backend changes needed** - all logic in Supabase RPC

## Estimated Deployment Time

- Database migration: 5 minutes
- Frontend build: 2 minutes
- Testing: 15-30 minutes
- Total: ~45 minutes

## Rollback Plan

If needed to rollback:

1. Revert `src/pages/admin/AdminOrders.tsx` to previous version
2. Keep the database changes (backwards compatible - just adds fields)
3. Can update orders using old method temporarily
4. Re-deploy with fixes

Database changes are safe to keep - they only add fields and functions, don't break existing queries.
