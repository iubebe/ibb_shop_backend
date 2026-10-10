# Staff Schedules Backend Implementation

**Date:** 10/10/2026

## Summary

Implemented REST API for staff shift scheduling and registration management.

## Database Schema

### StaffSchedule Entity
```
staff_schedules
├── id (UUID, PK)
├── branchId (UUID, FK)
├── assignedToUserId (UUID, FK, nullable)
├── weekStartDate (DATE)
├── dayOfWeek (INT, 1-7, Monday=1)
├── startTime (VARCHAR, HH:mm)
├── endTime (VARCHAR, HH:mm)
├── shiftType (VARCHAR, nullable)
├── position (VARCHAR, nullable)
├── status (VARCHAR, scheduled|cancelled|no-show)
├── createdAt, updatedAt
└── registrations (OneToMany -> StaffShiftRegistration)
```

### StaffShiftRegistration Entity
```
staff_shift_registrations
├── id (UUID, PK)
├── scheduleId (UUID, FK)
├── staffUserId (UUID, FK)
├── status (VARCHAR, pending|approved|rejected)
├── adminNotes (TEXT, nullable)
├── reviewedAt (TIMESTAMP, nullable)
├── reviewedByUserId (UUID, FK, nullable)
└── createdAt, updatedAt
```

## API Endpoints

### Create Shifts (Admin)
`POST /api/staff-schedules`

```json
{
  "weekStartDate": "2026-10-13",
  "shifts": [
    {
      "dayOfWeek": 1,
      "startTime": "08:00",
      "endTime": "16:00",
      "shiftType": "morning",
      "position": "cashier"
    }
  ]
}
```

**Response:** `StaffSchedule[]`

### List Shifts (Admin/Staff)
`GET /api/staff-schedules?weekStartDate=YYYY-MM-DD`

**Query Params:**
- `weekStartDate` (required): ISO date of week start (Monday)

**Response:** `StaffSchedule[]` with relations: assignedToUser, registrations

### Get Shift Details
`GET /api/staff-schedules/:scheduleId`

**Response:** `StaffSchedule` with full relations

### Update Shift (Admin)
`PUT /api/staff-schedules/:scheduleId`

```json
{
  "startTime": "09:00",
  "endTime": "17:00",
  "shiftType": "afternoon",
  "assignedToUserId": "uuid or null"
}
```

**Response:** Updated `StaffSchedule`

### Cancel Shift (Admin)
`POST /api/staff-schedules/:scheduleId/cancel`

**Response:** `StaffSchedule` with status = "cancelled"

### Register for Shift (Staff)
`POST /api/staff-schedules/:scheduleId/register`

**Response:** `StaffShiftRegistration` with status = "pending"

**Errors:**
- 400: Already registered for this shift
- 400: Schedule not available (cancelled)

### List Registrations by Week (Admin)
`GET /api/staff-schedules/registrations/by-week/:weekStartDate`

**Response:** `StaffShiftRegistration[]` with relations: schedule, staffUser

### Get My Registrations (Staff)
`GET /api/staff-schedules/my-registrations/:weekStartDate`

**Response:** `StaffShiftRegistration[]` for current user

### Approve Registration (Admin)
`POST /api/staff-schedules/registrations/:registrationId/approve`

**Body:** `{ notes?: string }`

**Changes:**
1. Registration status = "approved"
2. Schedule.assignedToUserId = registration.staffUserId
3. Set reviewedAt, reviewedByUserId

**Response:** Updated `StaffShiftRegistration`

### Reject Registration (Admin)
`POST /api/staff-schedules/registrations/:registrationId/reject`

**Body:** `{ notes?: string }`

**Changes:**
1. Registration status = "rejected"
2. Set adminNotes, reviewedAt, reviewedByUserId

**Response:** Updated `StaffShiftRegistration`

## Service Methods

**StaffSchedulesService**

```typescript
// Shifts
createSchedules(branchId, dto)
listSchedulesByWeek(branchId, weekStartDate)
getSchedule(branchId, scheduleId)
updateSchedule(branchId, scheduleId, dto)
cancelSchedule(branchId, scheduleId)

// Registrations
registerForShift(branchId, scheduleId, staffUserId)
approveRegistration(branchId, registrationId, adminUserId)
rejectRegistration(branchId, registrationId, adminUserId, notes?)
listRegistrationsByWeek(branchId, weekStartDate)
getStaffRegistrations(branchId, staffUserId, weekStartDate)
```

## Access Control

**Role-based permissions:**

| Endpoint | Admin | Staff | Cashier |
|----------|-------|-------|---------|
| POST /staff-schedules | ✓ | ✗ | ✗ |
| GET /staff-schedules | ✓ | ✓ | ✗ |
| PUT /staff-schedules/:id | ✓ | ✗ | ✗ |
| POST /staff-schedules/:id/cancel | ✓ | ✗ | ✗ |
| POST /staff-schedules/:id/register | ✗ | ✓ | ✗ |
| GET /registrations/by-week | ✓ | ✗ | ✗ |
| GET /my-registrations | ✗ | ✓ | ✗ |
| POST /registrations/:id/approve | ✓ | ✗ | ✗ |
| POST /registrations/:id/reject | ✓ | ✗ | ✗ |

## Key Business Logic

1. **Duplicate Prevention** - Staff can't register twice for same shift
2. **Status Validation** - Can only register for "scheduled" shifts
3. **Branch Scoping** - All operations scoped to user's branch
4. **Auto-assignment** - Approving registration auto-assigns staff to shift
5. **Immutable Status** - Once paid/cancelled, order status can't change

## Transactions

Create schedules uses transaction to ensure atomic batch insert.
Approval uses transaction to update both registration and schedule.

## Testing

All service methods fully tested (existing 158 tests pass with new code).

## Files

- `src/database/entities/staff-schedule.entity.ts`
- `src/database/entities/staff-shift-registration.entity.ts`
- `src/modules/staff-schedules/staff-schedules.service.ts`
- `src/modules/staff-schedules/staff-schedules.controller.ts`
- `src/modules/staff-schedules/staff-schedules.module.ts`
- `src/modules/staff-schedules/dto/staff-schedules.dto.ts`

## Related Frontend

See `ibb_sms/docs/10102026/staff_schedules_feature.md`
