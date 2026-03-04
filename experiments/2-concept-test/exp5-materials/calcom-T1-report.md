# Cal.com Graph Accuracy Audit: Current Graph vs. Historical Code (T1, ~6 months prior)

## Methodology

The semantic graph was built from CURRENT cal.com source code. This audit evaluates every
distinct claim in the graph's context packages against three HISTORICAL source files:

- `/tmp/exp5/cal.com-date-ranges-T1.ts` (date-ranges module)
- `/tmp/exp5/cal.com-slots-T1.ts` (slots module)
- `/tmp/exp5/cal.com-isOutOfBounds-T1.ts` (period-limits module)

Ratings:
- **ACCURATE** -- the claim is fully true in the historical code
- **PARTIALLY ACCURATE** -- the claim captures the gist but has material differences in detail
- **INACCURATE** -- the claim is wrong, absent, or contradicted by the historical code

---

## NODE: scheduling/date-ranges

### responsibility.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Converts organizer availability configuration (working hours, date overrides, OOO) into continuous time ranges `{ start: Dayjs, end: Dayjs }` | ACCURATE | `DateRange = { start: Dayjs; end: Dayjs }` at line 6-9; `buildDateRanges` does exactly this |
| 2 | Ranges represent "windows of time when the organizer is available" before slot discretization | ACCURATE | The module produces ranges consumed by the slots module |
| 3 | Processing working hours into date ranges for a given date window, respecting organizer timezone | ACCURATE | `processWorkingHours` iterates from `dateFrom` to `dateTo`, uses `getAdjustedTimezone` |
| 4 | Handling DST offset transitions within working hours | ACCURATE | Lines 70-74: `offsetDiff = start.utcOffset() - offsetBeginningOfDay`, applied to start/end |
| 5 | Applying travel schedule timezone overrides | ACCURATE | `getAdjustedTimezone` function at lines 16-29 |
| 6 | Processing date overrides that replace working hours for specific days | ACCURATE | `processDateOverride` + groupByDate merge with spread `...groupedDateOverrides` overriding working hours |
| 7 | Processing out-of-office dates | ACCURATE | `processOOO` at lines 218-224 and `groupedOOO` in `buildDateRanges` |
| 8 | The 23:59 -> midnight correction (UI limitation) | ACCURATE | Lines 80-83 in `processWorkingHours` and lines 200-209 in `processDateOverride` |
| 9 | Merging overlapping ranges with same end time (performance optimization using endTimeToKeyMap) | ACCURATE | Lines 90-169 implement the endTimeToKeyMap-based merge |
| 10 | Range intersection for multi-host events (pairwise intersection) | ACCURATE | `intersect` function at lines 354-416 |
| 11 | Range subtraction for removing busy/excluded time windows | ACCURATE | `subtract` function at lines 418-447 |
| 12 | Out of scope: slicing ranges into discrete slots | ACCURATE | No slot-slicing code in this module |
| 13 | Out of scope: determining booking period limits | ACCURATE | No period limit code in this module |
| 14 | Out of scope: querying the database (pure computation layer) | ACCURATE | No database/Prisma calls in this file |

### interface.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 15 | `type DateRange = { start: Dayjs; end: Dayjs }` | ACCURATE | Lines 6-9 |
| 16 | `type WorkingHours = Pick<Availability, "days" \| "startTime" \| "endTime">` | ACCURATE | Line 12 |
| 17 | `type DateOverride = Pick<Availability, "date" \| "startTime" \| "endTime">` | ACCURATE | Line 11 |
| 18 | `type TravelSchedule = { startDate: Dayjs; endDate?: Dayjs; timeZone: string }` | ACCURATE | Line 14 |
| 19 | `buildDateRanges` params: `availability`, `timeZone`, `dateFrom`, `dateTo`, `travelSchedules`, `outOfOffice?` | ACCURATE | Lines 226-240 match exactly |
| 20 | `buildDateRanges` returns `{ dateRanges: DateRange[]; oooExcludedDateRanges: DateRange[] }` | ACCURATE | Line 240 return type matches |
| 21 | `intersect(ranges: DateRange[][]): DateRange[]` | ACCURATE | Line 354 |
| 22 | `subtract` signature with pass-through properties | ACCURATE | Lines 418-421 |
| 23 | `processWorkingHours`, `processDateOverride` -- internal but exported for testing | ACCURATE | Both exported (`export function`) |

### constraints.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 24 | DST offset correction is mandatory; formula: `offsetDiff = start.utcOffset() - dayjs(start.format("YYYY-MM-DD hh:mm")).tz(adjustedTimezone).utcOffset()` | ACCURATE | Lines 70-74 implement exactly this formula |
| 25 | 23:59 -> midnight: system adds 1 minute to any 23:59 end time | ACCURATE | Lines 80-83 in `processWorkingHours` |
| 26 | For date overrides, the correction is to add a full day (making end = next day midnight) instead of 1 minute | ACCURATE | Lines 200-202 in `processDateOverride`: `endDate.add(1, "day")` |
| 27 | Zero-length ranges must be preserved temporarily (date overrides with same start/end cancel a working day) | ACCURATE | Lines 316-317: filtered out only in final step |
| 28 | Travel schedules affect timezone, not hours; lookup happens per-day using the first matching schedule | ACCURATE | `getAdjustedTimezone` uses `break` after first match (line 25) |
| 29 | Range intersection is pairwise with early exit if intersection becomes empty | ACCURATE | Lines 374-378 early exit; iterative approach lines 374-412 |

### decisions.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 30 | endTimeToKeyMap provides O(1) lookup for overlapping ranges with the same end time | ACCURATE | Lines 92-102 build the map; lines 104-126 use it |
| 31 | +/-1 day buffer for date overrides -- workaround for UTC/local date mismatch; TODO comment acknowledges this | ACCURATE | Lines 277-289: the exact TODO text is at lines 277-281 |
| 32 | OOO dates produce date ranges (not slot removal) so UI can display "away" slots with reason, redirect user, and emoji | PARTIALLY ACCURATE | OOO dates produce zero-length ranges (start == end, lines 218-224) that participate in groupByDate merge. They cancel out the day rather than "produce full-day ranges." The UI display claim is about the slots module, not this module. The core idea (OOO participates in merge rather than removing slots) is correct but the mechanism description is imprecise. |

### errors.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 33 | No explicit error throwing; pure computation layer | ACCURATE | No `throw` in the file |
| 34 | Empty availability -> zero date ranges | ACCURATE | Reduce starts from empty object; no items -> empty result |
| 35 | All date overrides cancel working hours -> zero ranges after filtering | ACCURATE | Zero-length filter at lines 316-317 removes them |
| 36 | dateFrom after dateTo -> loop does not execute, zero ranges | ACCURATE | `utcDateTo.isAfter(date)` condition at line 51 would be false immediately |
| 37 | No travel schedule match for a date -> falls through to default organizer timezone (silent) | ACCURATE | `getAdjustedTimezone` starts with `adjustedTimezone = timeZone` and only changes on match |

### logic.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 38 | processWorkingHours is a reducer iterating from dateFrom to dateTo | ACCURATE | Lines 32-173: takes `results: Record<number, DateRange>` accumulator |
| 39 | Determines adjusted timezone via travel schedules for current date | ACCURATE | Line 54 |
| 40 | Computes date in adjusted timezone, correcting for DST offset difference between dateFrom and current date | ACCURATE | Lines 52-59 |
| 41 | Skips if day-of-week is not in working hours `days` array | ACCURATE | Lines 60-62 |
| 42 | Creates start/end times by adding hours/minutes from working hours config to start of day | ACCURATE | Lines 64-68 |
| 43 | DST offset correction: `offsetDiff = start.utcOffset() - beginningOfDay.utcOffset()` | ACCURATE | Lines 70-74 |
| 44 | Clamp start to max(start, dateFrom), end to min(end, dateTo) | ACCURATE | Lines 76-77 |
| 45 | 23:59 -> midnight correction: add 1 minute | ACCURATE | Lines 80-83 |
| 46 | Skip if end < start | ACCURATE | Lines 85-88 |
| 47 | Merge with existing results via O(1) endTimeToKeyMap lookup | ACCURATE | Lines 90-169 |
| 48 | processDateOverride: get override date and find adjusted timezone | ACCURATE | Lines 186-188 |
| 49 | processDateOverride: build start/end from override's startTime/endTime | ACCURATE | Lines 190-209 |
| 50 | processDateOverride: 23:59 correction adds a full day instead of minutes | ACCURATE | Lines 200-202 |
| 51 | processDateOverride: returns single DateRange | ACCURATE | Lines 211-214 |
| 52 | buildDateRanges: processes all working hours via reduce | ACCURATE | Lines 243-261 |
| 53 | buildDateRanges: processes date overrides filtered to dateFrom..dateTo +/-1 day buffer | ACCURATE | Lines 269-310 |
| 54 | buildDateRanges: groups all ranges by date | ACCURATE | `groupByDate` calls |
| 55 | buildDateRanges: date overrides REPLACE working hours via object spread order | ACCURATE | Lines 312-314: `...groupedWorkingHours, ...groupedDateOverrides` |
| 56 | buildDateRanges: filters out zero-length ranges | ACCURATE | Lines 316-317 |
| 57 | buildDateRanges: separately computes oooExcludedDateRanges (same plus OOO entries) | ACCURATE | Lines 320-328 |
| 58 | intersect: two-pointer sweep across pre-sorted range arrays | ACCURATE | Lines 383-411 |
| 59 | intersect: uses `max(startA, startB) < min(endA, endB)` | ACCURATE | Lines 390-393 |
| 60 | intersect: result accumulates pairwise | ACCURATE | Lines 374-412 iterative approach |
| 61 | subtract: for each source range, walk through sorted excluded ranges; split when exclusion overlaps | ACCURATE | Lines 418-446 |

---

## NODE: scheduling/slots

### responsibility.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 62 | Takes continuous date ranges and slices them into discrete, bookable time slots at configured frequency | ACCURATE | `buildSlotsWithDateRanges` does exactly this |
| 63 | Each slot is a single start time representing "you can book here" | ACCURATE | Slots stored as `{ time: Dayjs, ... }` |
| 64 | Slicing date ranges into slots at configured frequency intervals | ACCURATE | Frequency-based loop |
| 65 | Aligning slot start times to aesthetic boundaries (hour, 15min, 5min) when "optimized slots" option is enabled | ACCURATE | `getCorrectedSlotStartTime` function |
| 66 | Enforcing minimum booking notice (no slots before now + N minutes) | ACCURATE | `startTimeWithMinNotice` at line 117 |
| 67 | Deduplicating slots across adjacent date ranges via boundary tracking | ACCURATE | `slotBoundaries` Map at lines 119, 143-167 |
| 68 | Annotating slots with OOO metadata (away flag, from/to user, reason, emoji, notes) | PARTIALLY ACCURATE | Code has `away`, `fromUser`, `toUser`, `reason`, `emoji` but NOT `notes` or `showNotePublicly`. The graph mentions "notes" in constraints.md but the T1 code doesn't have these fields. |
| 69 | Handling the invitee's timezone for slot display | ACCURATE | `getTimeZone(inviteeDate)` at line 234, `slotStartTime.tz(timeZone)` at line 140 |
| 70 | Out of scope: computing date ranges (scheduling/date-ranges) | ACCURATE | Receives ranges as parameter |
| 71 | Out of scope: determining booking period limits | ACCURATE | No period limit logic here |
| 72 | Out of scope: checking against existing bookings for conflicts | ACCURATE | No booking conflict code |

### constraints.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 73 | Frequency and eventLength must be at least 1 minute; `minimumOfOne` guard prevents division by zero and infinite loops | ACCURATE | Line 21: `minimumOfOne`, lines 87-88 apply it |
| 74 | `slotBoundaries` Map tracks generated slot start times as millisecond timestamps | ACCURATE | Line 119: `new Map<number, true>()`, line 176: `slotBoundaries.set(slotStartTime.valueOf(), true)` |
| 75 | New slot start checked against previous boundaries to prevent duplicates; pushed forward to next boundary if overlap | ACCURATE | Lines 143-167 |
| 76 | Loop condition: `slotStartTime + eventLength - 1 second <= range.end` | ACCURATE | Line 169: `.add(eventLength, "minutes").subtract(1, "second").utc().isAfter(range.end)` -- the negation form of the same condition |
| 77 | The -1 second prevents exclusion when end time exactly equals range end | ACCURATE | This is the purpose of the subtract(1, "second") |
| 78 | Timezone conversion before alignment -- slot start times converted to target timezone BEFORE checking minute alignment | INACCURATE | In the T1 code, alignment (`getCorrectedSlotStartTime`) happens at lines 131-138 BEFORE the `.tz(timeZone)` conversion at line 140. The graph claims timezone conversion happens first, but in the historical code the order is: alignment first, then tz conversion. |
| 79 | OOO slots shown, not hidden; annotated with `away: true` and metadata (fromUser, toUser, reason, emoji, notes, showNotePublicly) | PARTIALLY ACCURATE | OOO slots are indeed shown with `away: true`, `fromUser`, `toUser`, `reason`, `emoji` (lines 191-203). However, `notes` and `showNotePublicly` fields do NOT exist in the T1 code. |

### decisions.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 80 | Three-tier slot snapping in `getCorrectedSlotStartTime`: hour-aligned, 15-min, 5-min fallback | ACCURATE | Lines 44-61: interval -> 15min -> 5min |
| 81 | Snapping only happens if enough "extra" minutes in the range to absorb the alignment shift | ACCURATE | `extraMinutesAvailable >= minutesRequired...` checks |
| 82 | Map keyed by ISO timestamp string ensures uniqueness by construction | ACCURATE | Line 94: `new Map<string, ...>()`, line 170: `slotStartTime.toISOString()` |
| 83 | Map.set silently deduplicates | ACCURATE | Lines 171-174: if key exists, skip |
| 84 | Slot interval: largest divisor from [60, 30, 20, 15, 10, 5]; env var override `NEXT_PUBLIC_AVAILABILITY_SCHEDULE_INTERVAL` | ACCURATE | Lines 107-115 |
| 85 | For 90-min event with 90-min frequency, interval = 30 (largest divisor) | ACCURATE | 90 % 30 === 0, 90 % 60 !== 0 -- so 30 is correct |
| 86 | -1 second in loop condition: prevents exact-match end time from excluding last valid slot | ACCURATE | Line 169 |

### logic.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 87 | `getSlots` delegates to `buildSlotsWithDateRanges` after extracting timezone from inviteeDate | ACCURATE | Lines 212-240 |
| 88 | `buildSlotsWithDateRanges` step 1: `frequency = minimumOfOne(frequency)`, `eventLength = minimumOfOne(eventLength)` | ACCURATE | Lines 87-88 |
| 89 | Step 2: find largest value from [60,30,20,15,10,5] that evenly divides frequency; fallback to env var or 1 | ACCURATE | Lines 107-115 |
| 90 | Step 3: `startTimeWithMinNotice = utc.now + minimumBookingNotice minutes` | ACCURATE | Line 117 |
| 91 | Step 4: sort date ranges by start time | ACCURATE | Line 91 |
| 92 | Step 5a: set slotStartTime to max(range.start, startTimeWithMinNotice), zero out seconds/milliseconds | ACCURATE | Lines 124-129 |
| 93 | Step 5b: convert to target timezone BEFORE checking alignment | INACCURATE | In T1 code: alignment (getCorrectedSlotStartTime at lines 131-138) happens BEFORE tz conversion (line 140). Graph claims the opposite order. |
| 94 | Step 5c: if not aligned to interval boundary: call getCorrectedSlotStartTime | ACCURATE | Lines 131-138 |
| 95 | Step 5d: add offsetStart if configured | ACCURATE | Line 140: `.add(offsetStart ?? 0, "minutes")` |
| 96 | Step 5e: check against existing slotBoundaries to prevent overlapping slots | ACCURATE | Lines 143-167 |
| 97 | Step 5f: walk forward through range at `frequency + offsetStart` intervals | ACCURATE | Line 205: `.add(frequency + (offsetStart ?? 0), "minutes")` |
| 98 | Step 5g: if slot fits (start + eventLength - 1 second <= range.end), add to slots Map | ACCURATE | Line 169 condition, lines 178-204 |
| 99 | Step 5h: check OOO -- if slot's date has OOO entry, annotate with away=true + metadata | ACCURATE | Lines 178, 191-203 |
| 100 | Step 6: return Array from slots Map values | ACCURATE | Line 209 |
| 101 | `getCorrectedSlotStartTime` three-tier snapping when `showOptimizedSlots` enabled | ACCURATE | Lines 34-61 |
| 102 | Calculate extra minutes: `(range.end - slotStartTime) % interval` | ACCURATE | Line 43: `range.end.diff(slotStartTime, "minutes") % interval` |
| 103 | Tier 1: move to next interval boundary if enough extra | ACCURATE | Lines 45-50 |
| 104 | Tier 2: next 15-minute mark | ACCURATE | Lines 51-56 |
| 105 | Tier 3: next 5-minute mark | ACCURATE | Lines 57-59 |
| 106 | If none possible: keep original start | ACCURATE | Implicit -- no modification if no condition met |
| 107 | When `showOptimizedSlots` is false: snap to next interval boundary from start of hour | ACCURATE | Line 64 |

---

## NODE: scheduling/period-limits

### responsibility.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 108 | Determines the booking window -- how far into the future a booker can schedule | ACCURATE | `calculatePeriodLimits` does this |
| 109 | Returns boundary timestamps that downstream systems use to filter out-of-bounds slots | ACCURATE | Returns `PeriodLimits` type with boundary values |
| 110 | Calculating period limits for ROLLING, ROLLING_WINDOW, and RANGE | ACCURATE | Switch on `periodType` |
| 111 | Computing rolling window end date by walking forward through bookable days | ACCURATE | `getRollingWindowEndDate` function |
| 112 | Checking if a specific time violates the future limit | ACCURATE | `isTimeViolatingFutureLimit` function |
| 113 | Checking if a time is in the past or within minimum booking notice | ACCURATE | `isTimeOutOfBounds` function |
| 114 | Providing both throwing (`isTimeOutOfBounds`) and non-throwing (`getPastTimeAndMinimumBookingNoticeBoundsStatus`) variants | ACCURATE | Both functions present |
| 115 | Out of scope: computing date ranges or slots | ACCURATE | Not present |
| 116 | Out of scope: querying which days are bookable | ACCURATE | `allDatesWithBookabilityStatus` is provided by caller |
| 117 | Out of scope: database access (pure computation) | ACCURATE | No database calls |

### constraints.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 118 | ROLLING uses booker timezone, RANGE uses organizer timezone | ACCURATE | ROLLING: `currentTimeInBookerTz` (lines 73-75); RANGE: `eventUtcOffset` (lines 115-116) |
| 119 | Example: 2024-07-24T08:30 event timezone = 2024-07-23T21:30 in GMT-11 so day 23 must be bookable | ACCURATE | Code comment at lines 71-72 states exactly this |
| 120 | ROLLING_WINDOW safety limit: `ROLLING_WINDOW_PERIOD_MAX_DAYS_TO_CHECK` | ACCURATE | Lines 154, 162-163 |
| 121 | If limit reached without enough bookable days, returns last iteration day's end | ACCURATE | Line 197: `(rollingEndDay ?? startOfIterationDay).endOf("day")` |
| 122 | `_skipRollingWindowCheck` escape hatch: `isOutOfBounds` passes `true` because re-computing is expensive; TODO for API bookings | PARTIALLY ACCURATE | The escape hatch is present (lines 85-91 in calculatePeriodLimits, line 339 in isOutOfBounds). The code has an inline comment acknowledging the trade-off (lines 39-42) but it says "we absolutely need to check the ROLLING_WINDOW limits" for API bookings -- not exactly a TODO. The graph's claim of a "code TODO" is slightly imprecise. |
| 123 | Old vs. new date format backward compatibility: old = browser-timezone midnight as UTC, new = pure UTC midnight; detected by checking if hours/minutes/seconds are all zero | INACCURATE | In the T1 code, the RANGE case (lines 111-123) does NOT implement the old/new format detection. It simply does `dayjs(periodStartDate).utcOffset(eventUtcOffset).startOf("day")` and `dayjs(periodEndDate).utcOffset(eventUtcOffset).endOf("day")`. There is no format detection by checking hours/minutes/seconds. This logic may exist in the current code but is absent from the historical T1 code. |
| 124 | Null return means "no limit"; PeriodLimits all-null fields; `isTimeViolatingFutureLimit` returns false | ACCURATE | Lines 126-131 (fallback); lines 266-309 (returns false if no limits set) |

### decisions.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 125 | Why separate throwing and non-throwing variants: `isTimeOutOfBounds` throws `BookingDateInPastError` for booking flows; `getPastTimeAndMinimumBookingNoticeBoundsStatus` catches error and returns status for availability display | ACCURATE | Lines 208-258 |
| 126 | Why `isOutOfBounds` skips ROLLING_WINDOW check: passes `_skipRollingWindowCheck: true` and `allDatesWithBookabilityStatusInBookerTz: null`; performance trade-off | ACCURATE | Lines 338-339 |
| 127 | Trade-off acknowledged in code comment as needing future work for API-direct bookings | PARTIALLY ACCURATE | The comment at lines 39-42 says "for the booking that happen through API, we absolutely need to check" but it's more of a requirement statement than an explicit "needs future work" acknowledgment. Close enough but slightly embellished. |
| 128 | Why end-of-day for all rolling calculations: period limits talk in days, slot at 22:00 on day 2 should be included | ACCURATE | Lines 76-78: `endOf("day")`; comment at line 76 explains this |

### logic.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 129 | `calculatePeriodLimits` dispatches on `periodType` | ACCURATE | Switch statement at line 69 |
| 130 | ROLLING: compute end day = today (booker tz) + periodDays | ACCURATE | Lines 73-75 |
| 131 | If `periodCountCalendarDays`: use `add(days)`. If false: use `businessDaysAdd(days)` | ACCURATE | Lines 73-75 |
| 132 | Return `endOfRollingPeriodEndDayInBookerTz = endDay.endOf("day")` | ACCURATE | Line 78 |
| 133 | ROLLING_WINDOW: if `_skipRollingWindowCheck`: return all-null | ACCURATE | Lines 85-91 |
| 134 | ROLLING_WINDOW: require `allDatesWithBookabilityStatusInBookerTz` map | ACCURATE | Lines 93-95: throws error if null |
| 135 | ROLLING_WINDOW: call `getRollingWindowEndDate` | ACCURATE | Lines 97-103 |
| 136 | RANGE: parse periodStartDate and periodEndDate as UTC | PARTIALLY ACCURATE | The T1 code uses `dayjs(periodStartDate).utcOffset(eventUtcOffset)` -- it applies the event UTC offset rather than parsing "as UTC" per se. The approach is different from what the graph describes (which mentions UTC parsing + format detection). |
| 137 | RANGE: detect format -- new format (midnight UTC) vs. old format (browser timezone midnight as UTC) | INACCURATE | The T1 code does NOT detect formats. It uses a single approach: `dayjs(periodStartDate).utcOffset(eventUtcOffset).startOf("day")`. No format detection exists in the historical code. |
| 138 | RANGE: new format -- extract date string, create midnight in event timezone by subtracting UTC offset | INACCURATE | Not present in T1 code |
| 139 | RANGE: old format -- convert to event timezone and take startOf/endOf day | PARTIALLY ACCURATE | The T1 code does `dayjs(periodStartDate).utcOffset(eventUtcOffset).startOf("day")` and `.endOf("day")`. This matches the described behavior for "old format" but the code doesn't distinguish old from new -- it's the only path. |
| 140 | RANGE: return start and end boundaries in event timezone | ACCURATE | Lines 115-123 |
| 141 | `getRollingWindowEndDate`: start from today in booker timezone | ACCURATE | Parameter `startDateInBookerTz` |
| 142 | Walk forward day by day (calendar or business days based on `countNonBusinessDays`) | ACCURATE | Lines 186-188 |
| 143 | For each day: look up `allDatesWithBookabilityStatus[YYYY-MM-DD].isBookable` | ACCURATE | Lines 166-168 |
| 144 | If bookable: increment counter, update rollingEndDay | ACCURATE | Lines 170-172 |
| 145 | Stop when counter reaches `daysNeeded` OR exceeds `ROLLING_WINDOW_PERIOD_MAX_DAYS_TO_CHECK` | ACCURATE | Lines 160, 162-163 |
| 146 | Return `endOf("day")` of last found bookable day (or iteration day if none found) | ACCURATE | Line 197 |
| 147 | `isTimeOutOfBounds`: guard against booking in past (throws `BookingDateInPastError`) | ACCURATE | Lines 208-217 |
| 148 | If minimumBookingNotice: check time > now + notice minutes; return true if violated | ACCURATE | Lines 219-224 |
| 149 | Return false (within bounds) | ACCURATE | Line 226 |
| 150 | `isTimeViolatingFutureLimit`: if rolling period set, check time > endOfRollingPeriodEndDay | ACCURATE | Lines 276-289 |
| 151 | If range set: check time < rangeStart OR time > rangeEnd | ACCURATE | Lines 292-306 |
| 152 | Otherwise: return false (no limit) | ACCURATE | Line 308 |

---

## ASPECT: timezone-safe

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 153 | Three distinct timezone contexts: booker, organizer/event, UTC | ACCURATE | All three visible across the codebase |
| 154 | Booker timezone used for ROLLING and ROLLING_WINDOW | ACCURATE | `currentTimeInBookerTz` used for both |
| 155 | Organizer/Event timezone used for RANGE | ACCURATE | `eventUtcOffset` used for RANGE |
| 156 | UTC for internal storage and comparison | ACCURATE | `.utc()` used throughout |
| 157 | Never compare datetimes across different tz contexts without conversion | ACCURATE | Code consistently converts before comparison |
| 158 | Travel schedules override organizer timezone -- check `getAdjustedTimezone` | ACCURATE | Function exists and is used |
| 159 | DST transitions require offset correction formula | ACCURATE | Implemented in date-ranges |
| 160 | Half-hour offset timezones must be handled -- slot alignment in local time, not UTC | PARTIALLY ACCURATE | The T1 slots code does NOT convert to local time before alignment (see claim 78/93). The aspect rule is stated but the T1 code doesn't fully comply. |

## ASPECT: dayjs-immutable

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 161 | All date/time manipulation uses `@calcom/dayjs` wrapper | ACCURATE | All three files import from `@calcom/dayjs` |
| 162 | Native Date only at system boundaries (Prisma models, API responses) | ACCURATE | `item.startTime.getUTCHours()` accesses Date from Prisma; all computation uses dayjs |
| 163 | Arithmetic operations return new immutable instances | ACCURATE | `.add()`, `.subtract()`, `.startOf()`, `.endOf()` used throughout |
| 164 | Never use `Date.setHours()`, `Date.setMinutes()`, etc. | ACCURATE | No mutable Date operations found |
| 165 | Use `dayjs.utc()` for UTC timestamps | ACCURATE | `dayjs.utc()` used in multiple places |
| 166 | Use `dayjs.max()` / `dayjs.min()` for range clamping | ACCURATE | Lines 76-77 in date-ranges |
| 167 | `.valueOf()` for safe numeric comparison | ACCURATE | Used extensively in all three files |

## ASPECT: booking-period-aware

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 168 | Three mutually exclusive period types: ROLLING, ROLLING_WINDOW, RANGE | ACCURATE | Switch statement in `calculatePeriodLimits` |
| 169 | ROLLING: count N days forward; `periodCountCalendarDays` true = calendar, false = business days via `businessDaysAdd` | ACCURATE | Lines 73-75 of period-limits |
| 170 | ROLLING evaluated in booker timezone | ACCURATE | Uses `currentTimeInBookerTz` |
| 171 | ROLLING_WINDOW: count N bookable days forward; iterative walk with safety limit | ACCURATE | `getRollingWindowEndDate` function |
| 172 | ROLLING_WINDOW also in booker timezone | ACCURATE | `startDateInBookerTz` parameter |
| 173 | RANGE: fixed date range, evaluated in organizer/event timezone | ACCURATE | Uses `eventUtcOffset` |
| 174 | RANGE handles both old and new date format for backward compatibility | INACCURATE | T1 code does NOT have dual format handling |
| 175 | If no period type configured: all-null fields, `isTimeViolatingFutureLimit` returns false | ACCURATE | Fallback at lines 126-131 |

---

## FLOW: Slot Availability Pipeline

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 176 | Business context: booker views event page, sees available slots | ACCURATE | General architectural truth |
| 177 | Trigger: booker requests slots for a date range | ACCURATE | Standard flow |
| 178 | Goal: return discrete bookable time slots with optional OOO metadata | ACCURATE | Matches code behavior |
| 179 | Participant: scheduling/date-ranges -- converts working hours and overrides, handles travel/DST, does intersection/subtraction | ACCURATE | Matches module capabilities |
| 180 | Participant: scheduling/slots -- slices into discrete slots, handles alignment/notice/OOO/boundary tracking | ACCURATE | Matches module capabilities |
| 181 | Participant: scheduling/period-limits -- determines booking window for ROLLING/ROLLING_WINDOW/RANGE | ACCURATE | Matches module capabilities |
| 182 | Happy path: working hours -> date ranges -> date overrides -> OOO -> travel -> slots -> snapping -> min notice -> period limit -> return | ACCURATE | Matches overall flow |
| 183 | No availability path: empty working hours or cancelled overrides -> zero slots | ACCURATE | Verified in both modules |
| 184 | Multi-host intersection: pairwise intersection producing common windows | ACCURATE | `intersect` function |
| 185 | Invariant: frequency and event length >= 1 minute via `minimumOfOne` | ACCURATE | Line 21 and lines 87-88 in slots |
| 186 | Invariant: no slot in past or within min booking notice | ACCURATE | `startTimeWithMinNotice` in slots |
| 187 | Invariant: DST transitions must not produce phantom/missing slots | ACCURATE | Offset correction implemented |
| 188 | Invariant: 23:59 -> midnight always corrected (+1 minute) | ACCURATE | Both processWorkingHours and processDateOverride handle this |
| 189 | Invariant: OOO slots surfaced (not removed) so UI can show reason | ACCURATE | Slots annotated with `away: true` |

---

## SUMMARY TABLE

| Artifact / Component | Total Claims | Accurate | Partial | Inaccurate | Accuracy % |
|---|---|---|---|---|---|
| **date-ranges / responsibility.md** | 14 | 14 | 0 | 0 | 100.0% |
| **date-ranges / interface.md** | 9 | 9 | 0 | 0 | 100.0% |
| **date-ranges / constraints.md** | 6 | 6 | 0 | 0 | 100.0% |
| **date-ranges / decisions.md** | 3 | 2 | 1 | 0 | 83.3% |
| **date-ranges / errors.md** | 5 | 5 | 0 | 0 | 100.0% |
| **date-ranges / logic.md** | 24 | 24 | 0 | 0 | 100.0% |
| **slots / responsibility.md** | 11 | 10 | 1 | 0 | 95.5% |
| **slots / constraints.md** | 7 | 5 | 1 | 1 | 78.6% |
| **slots / decisions.md** | 7 | 7 | 0 | 0 | 100.0% |
| **slots / logic.md** | 21 | 19 | 0 | 2 | 90.5% |
| **period-limits / responsibility.md** | 10 | 10 | 0 | 0 | 100.0% |
| **period-limits / constraints.md** | 7 | 5 | 1 | 1 | 78.6% |
| **period-limits / decisions.md** | 4 | 3 | 1 | 0 | 87.5% |
| **period-limits / logic.md** | 24 | 20 | 2 | 2 | 87.5% |
| **aspect: timezone-safe** | 8 | 7 | 1 | 0 | 93.8% |
| **aspect: dayjs-immutable** | 7 | 7 | 0 | 0 | 100.0% |
| **aspect: booking-period-aware** | 8 | 7 | 0 | 1 | 93.8% |
| **flow: Slot Availability Pipeline** | 14 | 14 | 0 | 0 | 100.0% |
| | | | | | |
| **GRAND TOTAL** | **189** | **174** | **8** | **7** | **93.7%** |

---

## Key Findings

### Sources of Inaccuracy (7 claims)

1. **Timezone conversion order in slots (claims 78, 93):** The graph claims timezone conversion happens BEFORE alignment, but in T1 code alignment happens first, then `.tz(timeZone)`. This is a genuine code evolution -- the current code likely reordered these operations to fix the half-hour offset timezone bug described in the graph.

2. **Old/new date format detection in period-limits (claims 123, 137, 138, 174):** The graph describes a dual-format detection system for RANGE period dates (checking if hours/minutes/seconds are zero). This mechanism is entirely absent from the T1 code, which uses a simpler single-path approach: `dayjs(date).utcOffset(eventUtcOffset).startOf("day")`. This is the largest single source of decay -- it represents a feature that was added after T1.

3. **OOO field `notes`/`showNotePublicly` (claim 79 partial):** The T1 code has `away`, `fromUser`, `toUser`, `reason`, `emoji` but not `notes` or `showNotePublicly`.

### Partially Accurate Claims (8 claims)

Most partial inaccuracies relate to:
- Minor field additions (notes/showNotePublicly in OOO metadata)
- Slight embellishments of code comments (describing inline comments as "TODOs")
- The RANGE date parsing description being correct for one path but not acknowledging it was the only path in T1
- The timezone-safe aspect stating a rule the code doesn't yet fully implement

### Decay Profile

The graph shows **93.7% overall accuracy** against code from ~6 months prior. The decay is concentrated in:
- **New features added after T1**: the old/new date format backward compatibility system (4 claims)
- **Behavioral changes**: the timezone conversion ordering in slots (2 claims)
- **Data model growth**: OOO metadata fields added after T1 (2 claims)

Structural claims (responsibility, interface, flow, most constraints) proved highly stable at **98%+ accuracy**. Logic claims had the most decay at **~90%** due to implementation-level changes.
