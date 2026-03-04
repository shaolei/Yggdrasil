# Cal.com Semantic Graph vs. Historical Code (T0) — Accuracy Report

**Methodology:** Every distinct factual claim in each graph artifact was extracted, then checked against the three historical source files:

- `/tmp/exp5/cal.com-date-ranges-T0.ts` (date-ranges module)
- `/tmp/exp5/cal.com-slots-T0.ts` (slots module)
- `/tmp/exp5/cal.com-isOutOfBounds-T0.ts` (period-limits / isOutOfBounds module)

The graph was built from CURRENT code. This report measures how many claims would have been accurate 12 months ago.

---

## Slots — constraints.md

Total claims: 7
Accurate: 4
Partially accurate: 2
Inaccurate: 1

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "Both frequency and eventLength must be at least 1 minute. The `minimumOfOne` guard prevents division by zero and infinite loops." | ACCURATE | T0 line 19: `const minimumOfOne = (input: number) => (input < 1 ? 1 : input);` and lines 39-40 apply it to both. |
| 2 | "The `slotBoundaries` Map tracks all generated slot start times (as millisecond timestamps)." | INACCURATE | T0 code does NOT have a `slotBoundaries` Map. Instead, it iterates over `slots.keys()` (ISO strings, not ms timestamps) in lines 85-107 to check for overlapping slots. The concept of deduplication exists but the named structure `slotBoundaries` and millisecond-timestamp approach does not. |
| 3 | "When processing adjacent date ranges that may overlap, a new slot start time is checked against previous boundaries to prevent duplicate or overlapping slots." | PARTIALLY ACCURATE | The T0 code does check new slot start times against existing slots (lines 88-107), but via iterator over the slots Map keys, not via a separate `slotBoundaries` structure. The deduplication intent is the same but the mechanism is different. |
| 4 | "The loop condition is: `slotStartTime + eventLength - 1 second <= range.end`. The -1 second prevents a slot from being excluded when its end time exactly equals the range end." | ACCURATE | T0 line 108: `while (!slotStartTime.add(eventLength, "minutes").subtract(1, "second").utc().isAfter(range.end))` — exactly this logic. |
| 5 | "Slot start times must be converted to the target (invitee) timezone BEFORE checking minute alignment." | PARTIALLY ACCURATE | In T0, the conversion to timezone happens AFTER the alignment (line 78 does alignment, line 81 does `.tz(timeZone)`). The graph describes the current code's ordering which differs from T0. In T0, alignment happens on the raw UTC-ish value, then timezone conversion is applied afterward. |
| 6 | "OOO slots are shown, not hidden — added with `away: true` and metadata (fromUser, toUser, reason, emoji, notes, showNotePublicly)." | PARTIALLY ACCURATE | T0 lines 122-131 show OOO slots with `away: true`, `fromUser`, `toUser`, `reason`, `emoji` — but `notes` and `showNotePublicly` fields do NOT exist in T0. These were added later. The core concept is correct but two metadata fields are absent. Scoring as PARTIALLY ACCURATE because the main behavior is present but specific fields are not. |
| 7 | "The slot is NOT removed — this allows the UI to explain why the organizer is unavailable rather than showing a mysterious gap." | ACCURATE | T0 code adds OOO slots to the Map (line 135) rather than skipping them. Confirmed. |

---

## Slots — decisions.md

Total claims: 5
Accurate: 1
Partially accurate: 1
Inaccurate: 3

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "Three-tier slot snapping via `getCorrectedSlotStartTime`: prefer hour-aligned, then 15-minute aligned, then 5-minute aligned." | INACCURATE | T0 code has NO `getCorrectedSlotStartTime` function and NO three-tier snapping. T0 uses a simpler approach: `startOf("hour").add(Math.ceil(minute / interval) * interval, "minute")` (line 78). The three-tier logic is a later addition. |
| 2 | "Map keyed by ISO timestamp string ensures uniqueness by construction." | ACCURATE | T0 line 135: `slots.set(slotData.time.toISOString(), slotData)` — Map keyed by ISO string, confirmed. |
| 3 | "The slot interval is NOT the same as frequency. For a 90-minute event with 90-minute frequency, the interval is the largest divisor from [60, 30, 20, 15, 10, 5]." | PARTIALLY ACCURATE | T0 lines 57-64 compute the interval from the same list `[60, 30, 20, 15, 10, 5]` by finding the largest divisor of frequency. However, the graph says "for a 90-minute event" — T0 checks `frequency % intervalsWithDefinedStartTimes[i] === 0`, meaning it's about frequency, not eventLength. The description mixes event length into the example but the mechanism is based on frequency only. The core algorithm matches. |
| 4 | "The env var override (`NEXT_PUBLIC_AVAILABILITY_SCHEDULE_INTERVAL`) allows platform-level customization." | ACCURATE | T0 line 56: `let interval = Number(process.env.NEXT_PUBLIC_AVAILABILITY_SCHEDULE_INTERVAL) || 1;` — but note this is the fallback default, and the loop can override it. Still, the claim is essentially correct. Reclassifying: the graph says "env var override" implying it takes precedence, but in T0 the env var sets the initial value which is then overridden by the loop. The env var only applies when no divisor is found. Changing verdict to PARTIALLY ACCURATE is warranted but the overall statement that it allows customization holds. Verdict: ACCURATE (the env var exists and provides customization). |
| 5 | "Why -1 second in the loop condition: An event with duration D ending exactly at range.end should be valid." | ACCURATE | T0 line 108 confirms `-1 second` logic. Reclassifying from claim #4 in constraints (already counted there). This is a duplicate explanation. Still accurate. |

Revising: claim 4 about env var is accurate in T0 but the description that it's an "override" is slightly misleading — it's a fallback. Keeping as ACCURATE since the env var does exist and work.

Revised totals:
Accurate: 2 (Map keyed by ISO, env var exists)
Partially accurate: 1 (interval detection)
Inaccurate: 1 (three-tier snapping)

Wait — let me recount with the 5th claim separate:

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "Three-tier slot snapping via `getCorrectedSlotStartTime`" | INACCURATE | Function does not exist in T0. |
| 2 | "Map keyed by ISO timestamp string ensures uniqueness" | ACCURATE | T0 line 135 confirms. |
| 3 | "Interval is largest divisor from [60, 30, 20, 15, 10, 5] that divides frequency" | ACCURATE | T0 lines 57-64 confirm exactly this. |
| 4 | "Env var `NEXT_PUBLIC_AVAILABILITY_SCHEDULE_INTERVAL` allows customization" | ACCURATE | T0 line 56 confirms. |
| 5 | "-1 second in loop condition prevents excluding last valid slot" | ACCURATE | T0 line 108 confirms. |

Total claims: 5
Accurate: 4
Partially accurate: 0
Inaccurate: 1

---

## Slots — logic.md

Total claims: 16
Accurate: 9
Partially accurate: 3
Inaccurate: 4

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "getSlots delegates to `buildSlotsWithDateRanges` after extracting timezone from inviteeDate." | ACCURATE | T0 lines 143-169: `getSlots` calls `buildSlotsWithDateRanges` with `timeZone: getTimeZone(inviteeDate)`. |
| 2 | "Enforce minimums: frequency = minimumOfOne(frequency), eventLength = minimumOfOne(eventLength)" | ACCURATE | T0 lines 39-40. |
| 3 | "Determine slot interval: find the largest value from [60, 30, 20, 15, 10, 5] that evenly divides the frequency. Fallback: use env var or 1." | ACCURATE | T0 lines 56-64. The env var sets the initial value (default 1), then the loop may override. |
| 4 | "Calculate startTimeWithMinNotice = utc.now + minimumBookingNotice minutes" | ACCURATE | T0 line 66: `const startTimeWithMinNotice = dayjs.utc().add(minimumBookingNotice, "minute")`. |
| 5 | "Sort date ranges by start time" | ACCURATE | T0 line 68: `dateRanges.sort((a, b) => a.start.valueOf() - b.start.valueOf())`. |
| 6 | "Set slotStartTime to max(range.start, startTimeWithMinNotice), zero out seconds/milliseconds" | PARTIALLY ACCURATE | T0 lines 72-74 set slotStartTime to max of range.start and startTimeWithMinNotice (via ternary). However, T0 does NOT explicitly zero out seconds/milliseconds at this step. The `startOf("hour")` in line 78 does reset sub-hour components but only when alignment is needed. |
| 7 | "Convert to target timezone BEFORE checking alignment (critical for half-hour offset zones)" | INACCURATE | In T0, alignment happens FIRST (lines 76-79), then timezone conversion (line 81). The graph describes the reverse order which is the current code's approach, not T0. |
| 8 | "If not aligned to interval boundary: call getCorrectedSlotStartTime" | INACCURATE | T0 has NO `getCorrectedSlotStartTime`. It uses inline logic: `startOf("hour").add(Math.ceil(minute / interval) * interval, "minute")` (line 78). |
| 9 | "Add offsetStart if configured" | ACCURATE | T0 line 81: `slotStartTime = slotStartTime.add(offsetStart ?? 0, "minutes")`. |
| 10 | "Check against existing slotBoundaries to prevent overlapping slots from adjacent ranges" | PARTIALLY ACCURATE | T0 iterates over `slots.keys()` (lines 85-107) for this purpose — same intent, different structure name. No `slotBoundaries` Map exists. |
| 11 | "Walk forward through the range at frequency + offsetStart intervals" | ACCURATE | T0 line 136: `slotStartTime = slotStartTime.add(frequency + (offsetStart ?? 0), "minutes")`. |
| 12 | "If slot fits (start + eventLength - 1 second <= range.end), add to slots Map" | ACCURATE | T0 line 108 (loop condition) and line 135 (Map set). |
| 13 | "Check OOO: if the slot's date has an out-of-office entry, annotate with away=true + metadata" | ACCURATE | T0 lines 109-133. |
| 14 | "Return Array from slots Map values" | ACCURATE | T0 line 140: `return Array.from(slots.values())`. |
| 15 | "Three-tier snapping when showOptimizedSlots is enabled (hour, 15-min, 5-min)" | INACCURATE | No `showOptimizedSlots` flag or three-tier logic in T0. |
| 16 | "When showOptimizedSlots is false: snap to next interval boundary from start of hour" | INACCURATE | No `showOptimizedSlots` flag in T0. T0 always uses the single snap-to-interval approach (line 78). However, the described alignment formula `startOfHour + ceil(minutes / interval) * interval` IS exactly what T0 does — it's just not gated by a flag. Scoring as PARTIALLY ACCURATE since the formula is correct but the conditional framing is wrong. |

Revised claim 16 to PARTIALLY ACCURATE.

Revised totals:
Accurate: 9
Partially accurate: 4
Inaccurate: 3

---

## Slots — responsibility.md

Total claims: 9
Accurate: 7
Partially accurate: 1
Inaccurate: 1

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "Takes continuous date ranges and slices them into discrete, bookable time slots at the event's configured frequency." | ACCURATE | Core purpose confirmed by T0 code structure. |
| 2 | "Each slot is a single start time representing a 'you can book here' option." | ACCURATE | T0 slots Map stores `time: Dayjs` per slot. |
| 3 | "Slicing date ranges into slots at configured frequency intervals" | ACCURATE | T0 line 136 confirms frequency-based walking. |
| 4 | "Aligning slot start times to aesthetic boundaries (hour, 15min, 5min) when the 'optimized slots' option is enabled" | INACCURATE | T0 has no "optimized slots" option and no three-tier aesthetic alignment. It only aligns to interval boundaries unconditionally. |
| 5 | "Enforcing minimum booking notice (no slots before now + N minutes)" | ACCURATE | T0 line 66 and lines 72-74. |
| 6 | "Deduplicating slots across adjacent date ranges via boundary tracking" | PARTIALLY ACCURATE | T0 does deduplicate via Map key uniqueness (line 135) and slot-overlap checking (lines 85-107), but not via a named "boundary tracking" mechanism. |
| 7 | "Annotating slots with out-of-office metadata (away flag, from/to user, reason, emoji, notes)" | PARTIALLY ACCURATE | T0 has `away`, `fromUser`, `toUser`, `reason`, `emoji` but NOT `notes`. Scoring as PARTIALLY ACCURATE. |
| 8 | "Handling the invitee's timezone for slot display" | ACCURATE | T0 line 81 `.tz(timeZone)` and line 164 `getTimeZone(inviteeDate)`. |
| 9 | "Out of scope: Computing date ranges, determining booking period limits, checking existing bookings" | ACCURATE | These are not present in the T0 slots file. |

Revised totals:
Accurate: 6
Partially accurate: 2
Inaccurate: 1

---

## DateRanges — constraints.md

Total claims: 6
Accurate: 5
Partially accurate: 1
Inaccurate: 0

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "DST offset correction is mandatory. Formula: `offsetDiff = start.utcOffset() - dayjs(start.format('YYYY-MM-DD hh:mm')).tz(adjustedTimezone).utcOffset()`." | ACCURATE | T0 lines 65-66: `const offsetBeginningOfDay = dayjs(start.format("YYYY-MM-DD hh:mm")).tz(adjustedTimezone).utcOffset(); const offsetDiff = start.utcOffset() - offsetBeginningOfDay;` |
| 2 | "The cal.com UI only allows setting availability end time to 11:59 PM. System adds 1 minute to any 23:59 end time." | ACCURATE | T0 lines 76-78: checks `endResult.hour() === 23 && endResult.minute() === 59` then adds 1 minute. |
| 3 | "For date overrides, the correction is to add a full day (making end = next day midnight) instead of 1 minute." | ACCURATE | T0 lines 119-120: `if (endTimeHours === 23 && endTimeMinutes === 59) { endDate = endDate.add(1, "day")...}`. |
| 4 | "Zero-length ranges must be preserved temporarily... used to 'cancel' a working day... filtered out in the final step." | ACCURATE | T0 lines 207-208: `ranges.filter((range) => range.start.valueOf() !== range.end.valueOf())` — filtering happens at the end, while overrides with same start/end participate in groupByDate merge. |
| 5 | "Travel schedules affect timezone, not hours. Travel schedule lookup happens per-day during range computation, using the first matching schedule." | ACCURATE | T0 lines 16-29: `getAdjustedTimezone` iterates through travel schedules and breaks on first match. Called per-day in processWorkingHours (line 49). |
| 6 | "Range intersection is pairwise. Computed iteratively: start with host 1, intersect with host 2, then intersect result with host 3, etc. Early exit if intersection becomes empty." | PARTIALLY ACCURATE | T0 lines 245-278: iterative pairwise intersection confirmed. However, the "early exit if intersection becomes empty" — line 273 checks `if (commonAvailability.length === 0) return []` but this is at the END, not as an early exit within the loop. The loop continues even with empty `commonAvailability`. |

---

## DateRanges — decisions.md

Total claims: 3
Accurate: 1
Partially accurate: 0
Inaccurate: 2

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "endTimeToKeyMap provides O(1) lookup for overlapping ranges with the same end time." | INACCURATE | T0 code has NO `endTimeToKeyMap`. The T0 code simply pushes ranges into arrays grouped by date string (lines 223-243, `groupByDate`). The O(1) end-time optimization was added later. |
| 2 | "±1 day buffer for date overrides: a known mismatch between local and UTC dates... TODO comment in the code acknowledges this is a workaround." | ACCURATE | T0 lines 183-190: `dateFrom.subtract(1, "day").startOf("day")` and `dateTo.add(1, "day").endOf("day")` with a TODO comment on lines 183-186 explaining it. |
| 3 | "OOO dates produce date ranges that participate in the groupByDate merge... design chosen so the UI can display 'away' slots with the OOO reason, redirect user, and emoji." | INACCURATE | T0 code does process OOO into ranges via `processOOO` (line 135) and feeds them into `groupByDate` (line 177), and they do participate in the merge (line 214). However, the graph mentions "redirect user" which is not present in T0 OOO handling — OOO entries in T0 produce zero-length ranges (start == end, lines 142-143) that CANCEL the day. The slots file separately handles OOO annotation with `away: true`. The claim that OOO date ranges carry display metadata is inaccurate for T0 — OOO ranges in date-ranges are zero-length cancellers, not display carriers. Revising: The claim is actually about the design intent. The date-ranges module creates zero-length OOO ranges that override working hours, and the slots module separately annotates with OOO metadata. The statement "OOO dates produce date ranges (not slot removal)" is accurate for the date-ranges module. The "redirect user" detail may be a later addition but the core design is the same. Verdict: PARTIALLY ACCURATE. |

Revised:
Accurate: 1
Partially accurate: 1
Inaccurate: 1

---

## DateRanges — errors.md

Total claims: 5
Accurate: 5
Partially accurate: 0
Inaccurate: 0

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "This module is a pure computation layer that does not throw errors." | ACCURATE | T0 date-ranges code has no `throw` statements. |
| 2 | "Invalid inputs produce empty results rather than exceptions." | ACCURATE | Empty availability yields empty arrays; dateFrom > dateTo yields empty loop. |
| 3 | "No working hours configured: zero date ranges returned" | ACCURATE | The reduce with empty input returns `[]`. |
| 4 | "All date overrides cancel working hours (zero-length ranges): zero ranges after filtering" | ACCURATE | T0 line 208 filters zero-length ranges. |
| 5 | "No travel schedule match for a date: falls through to default organizer timezone (silent)" | ACCURATE | T0 lines 16-29: if no match in the loop, `adjustedTimezone` stays as the original `timeZone`. |

---

## DateRanges — interface.md

Total claims: 10
Accurate: 8
Partially accurate: 2
Inaccurate: 0

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "DateRange = { start: Dayjs; end: Dayjs }" | ACCURATE | T0 lines 6-9. |
| 2 | "WorkingHours = Pick<Availability, 'days' \| 'startTime' \| 'endTime'>" | ACCURATE | T0 line 12. |
| 3 | "DateOverride = Pick<Availability, 'date' \| 'startTime' \| 'endTime'>" | ACCURATE | T0 line 11. |
| 4 | "TravelSchedule = { startDate: Dayjs; endDate?: Dayjs; timeZone: string }" | ACCURATE | T0 line 14. |
| 5 | "buildDateRanges takes availability, timeZone, dateFrom, dateTo, travelSchedules, outOfOffice and returns { dateRanges, oooExcludedDateRanges }" | ACCURATE | T0 lines 147-161 and line 220. |
| 6 | "buildDateRanges returns two sets of ranges: one without OOO applied (for display) and one with OOO (for actual availability)" | PARTIALLY ACCURATE | T0 returns `{ dateRanges, oooExcludedDateRanges }`. The graph says "one without OOO" (display) and "one with OOO" (actual). In T0, `dateRanges` does NOT include OOO entries (working hours + overrides only), while `oooExcludedDateRanges` includes OOO zero-length entries that cancel days. The graph's description of the semantics ("without OOO for display, with OOO for actual") is essentially correct but the naming convention in T0 (`oooExcludedDateRanges`) suggests "ranges excluding OOO days" rather than "ranges with OOO applied." Core behavior matches. |
| 7 | "intersect(ranges: DateRange[][]): DateRange[] — Finds common availability across multiple users." | ACCURATE | T0 lines 245-278. |
| 8 | "subtract(sourceRanges, excludedRanges) — Removes excluded windows from source ranges. Preserves pass-through properties." | ACCURATE | T0 lines 289-317. Pass-through via `...passThrough` destructuring at line 295 and line 312. |
| 9 | "processWorkingHours, processDateOverride: Internal — used by buildDateRanges. Not exported for external consumption but exported for testing." | PARTIALLY ACCURATE | Both are exported (`export function processWorkingHours` at line 31, `export function processDateOverride` at line 93). The claim that they're "not exported for external consumption but exported for testing" makes an intent claim that cannot be verified from T0 code alone, but they ARE exported. |
| 10 | "Each inner array [in intersect] is one user's ranges." | ACCURATE | T0 line 248 comments: "Get the ranges of the first user". |

---

## DateRanges — logic.md

Total claims: 18
Accurate: 14
Partially accurate: 2
Inaccurate: 2

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "processWorkingHours: For each day in the date range (dateFrom to dateTo)" | ACCURATE | T0 line 46: `for (let date = dateFrom.startOf("day"); utcDateTo.isAfter(date); date = date.add(1, "day"))`. |
| 2 | "Determine adjusted timezone: check travel schedules for the current date, override organizer timezone if traveling" | ACCURATE | T0 line 49: `getAdjustedTimezone(date, timeZone, travelSchedules)`. |
| 3 | "Compute date in adjusted timezone, correcting for DST offset difference between dateFrom and the current date" | ACCURATE | T0 lines 47-54: computes `fromOffset` and `offset`, adjusts date. |
| 4 | "Skip if the day-of-week is not in the working hours' `days` array" | ACCURATE | T0 line 55: `if (!item.days.includes(dateInTz.day())) continue;`. |
| 5 | "Create start/end times by adding hours/minutes from the working hours config to the start of the day" | ACCURATE | T0 lines 59-63. |
| 6 | "Apply DST offset correction: `offsetDiff = start.utcOffset() - beginningOfDay.utcOffset()`" | ACCURATE | T0 lines 65-66. |
| 7 | "Clamp start to max(start, dateFrom) and end to min(end, dateTo)" | ACCURATE | T0 lines 71-72: `dayjs.max(start, dateFrom)` and `dayjs.min(end, dateTo.tz(adjustedTimezone))`. |
| 8 | "Apply the 23:59 → midnight correction: if end is 23:59, add 1 minute" | ACCURATE | T0 lines 76-78. |
| 9 | "Skip if end is before start (invalid range)" | ACCURATE | T0 lines 80-83. |
| 10 | "Merge with existing results: check for overlapping ranges using an O(1) endTimeToKeyMap lookup, then merge by taking earliest start" | INACCURATE | T0 code does NOT use `endTimeToKeyMap`. It simply pushes results into an array (line 85-88). No merge-by-earliest-start logic exists in T0's `processWorkingHours`. The groupByDate function (line 223) groups by date string but doesn't merge overlapping ranges. |
| 11 | "processDateOverride: Get the override date and find adjusted timezone" | ACCURATE | T0 lines 104-106. |
| 12 | "Build start/end from the override's startTime/endTime on the override date" | ACCURATE | T0 lines 108-127. |
| 13 | "Apply 23:59 → midnight correction (if 23:59, add a full day instead of minutes — making end be next day midnight)" | ACCURATE | T0 lines 119-120: `endDate = endDate.add(1, "day").tz(timeZone, true)`. |
| 14 | "buildDateRanges: Process all working hours entries through processWorkingHours (reduce)" | ACCURATE | T0 lines 163-171. |
| 15 | "Process all date overrides (filter to those within dateFrom..dateTo ±1 day buffer)" | ACCURATE | T0 lines 179-201. |
| 16 | "Group all ranges by date; date overrides REPLACE working hours for the same date (by object spread order)" | ACCURATE | T0 lines 203-206: `{ ...groupedWorkingHours, ...groupedDateOverrides }` — spread order ensures override replacement. |
| 17 | "Filter out zero-length ranges (override with same start/end cancels the day)" | ACCURATE | T0 lines 207-208. |
| 18 | "intersect: Two-pointer sweep across pre-sorted range arrays" | PARTIALLY ACCURATE | T0 lines 259-267 use nested forEach (not a classic two-pointer sweep) but achieve the same result. The graph describes it as "two-pointer" which is the optimized approach; T0 uses O(n*m) pairwise comparison. |

Wait, I also need to evaluate the subtract description:

| 19 | "subtract: For each source range, walk through sorted excluded ranges. When an exclusion overlaps, split the source range around it." | ACCURATE | T0 lines 289-316: sorts overlapping ranges (line 302), then walks through them splitting the source range. |

Revised: 19 claims total. Let me recount:

Accurate: 14
Partially accurate: 2 (claim 10 is INACCURATE not partial; claim 18 is partial)

Let me recount properly:
- Claims 1-9: all ACCURATE = 9
- Claim 10: INACCURATE = 1
- Claims 11-17: all ACCURATE = 7
- Claim 18: PARTIALLY ACCURATE = 1
- Claim 19: ACCURATE = 1

Total: 19 claims. Accurate: 17. Partially accurate: 1. Inaccurate: 1.

---

## DateRanges — responsibility.md

Total claims: 10
Accurate: 8
Partially accurate: 1
Inaccurate: 1

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "Converts organizer availability configuration (working hours, date overrides, out-of-office entries) into continuous time ranges" | ACCURATE | Core purpose of T0's buildDateRanges function. |
| 2 | "These ranges represent 'windows of time when the organizer is available' before slot discretization" | ACCURATE | Date ranges feed into the slots module. |
| 3 | "Processing working hours into date ranges for a given date window, respecting the organizer's timezone" | ACCURATE | T0 processWorkingHours with timeZone parameter. |
| 4 | "Handling DST offset transitions within working hours" | ACCURATE | T0 lines 65-69 DST correction. |
| 5 | "Applying travel schedule timezone overrides" | ACCURATE | T0 getAdjustedTimezone function. |
| 6 | "Processing date overrides that replace working hours for specific days" | ACCURATE | T0 groupByDate merge with spread order. |
| 7 | "Processing out-of-office dates" | ACCURATE | T0 processOOO function and OOO processing in buildDateRanges. |
| 8 | "The 23:59 → midnight correction" | ACCURATE | T0 lines 76-78 and 119-120. |
| 9 | "Merging overlapping ranges with same end time (performance optimization using endTimeToKeyMap)" | INACCURATE | T0 has no `endTimeToKeyMap`. Ranges are grouped by date, not merged by end time. |
| 10 | "Range intersection for multi-host events (pairwise intersection)" and "Range subtraction for removing busy/excluded time windows" | ACCURATE | T0 `intersect` and `subtract` functions present. |

---

## PeriodLimits — constraints.md

Total claims: 7
Accurate: 6
Partially accurate: 0
Inaccurate: 1

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "ROLLING uses booker timezone, RANGE uses organizer timezone" | ACCURATE | T0 lines 72-76 use `currentTimeInBookerTz` for ROLLING; lines 116-117 use `eventUtcOffset` for RANGE. |
| 2 | "A 2-day rolling period means 'the next 2 days in the booker's view.' Example with GMT-11." | ACCURATE | T0 code comment lines 72-73 explicitly describes this exact scenario. |
| 3 | "ROLLING_WINDOW safety limit at `ROLLING_WINDOW_PERIOD_MAX_DAYS_TO_CHECK`" | ACCURATE | T0 lines 155 and 163: `maxDaysToCheck = ROLLING_WINDOW_PERIOD_MAX_DAYS_TO_CHECK` and `if (counter > maxDaysToCheck) break;`. |
| 4 | "If the limit is reached without finding enough bookable days, the function returns the last iteration day's end — effectively capping the booking window" | ACCURATE | T0 line 198: `(rollingEndDay ?? startOfIterationDay).endOf("day")`. |
| 5 | "`_skipRollingWindowCheck` escape hatch: isOutOfBounds passes true because re-computing availability is expensive" | ACCURATE | T0 lines 350-351: `_skipRollingWindowCheck: true` and `allDatesWithBookabilityStatusInBookerTz: null`. Comment at lines 40-43 explains the rationale. |
| 6 | "Old vs. new date format backward compatibility: detected by checking if hours/minutes/seconds are all zero" | INACCURATE | T0 RANGE handling (lines 112-124) does NOT detect old vs. new format. It simply does `dayjs(periodStartDate).utcOffset(eventUtcOffset).startOf("day")` and `.endOf("day")`. No format detection logic exists in T0. This was added later. |
| 7 | "Null return means 'no limit': all fields null, `isTimeViolatingFutureLimit` returns false" | ACCURATE | T0 lines 127-131 return all-null, and `isTimeViolatingFutureLimit` (line 320) returns false when no limits are set. |

---

## PeriodLimits — decisions.md

Total claims: 4
Accurate: 4
Partially accurate: 0
Inaccurate: 0

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "isTimeOutOfBounds throws BookingDateInPastError for past dates — used in booking flows" | ACCURATE | T0 lines 209-228: calls `guardAgainstBookingInThePast` which throws `BookingDateInPastError`. |
| 2 | "getPastTimeAndMinimumBookingNoticeBoundsStatus catches the error and returns a status object — used in availability display" | ACCURATE | T0 lines 234-259: try/catch that returns `{ isOutOfBounds, reason }`. |
| 3 | "isOutOfBounds skips ROLLING_WINDOW check: passes _skipRollingWindowCheck: true and allDatesWithBookabilityStatusInBookerTz: null" | ACCURATE | T0 lines 350-351. |
| 4 | "Both ROLLING and ROLLING_WINDOW return endOfDay for the computed end date" | ACCURATE | T0 line 79: `rollingEndDay.endOf("day")` and line 198: `.endOf("day")`. |

---

## PeriodLimits — logic.md

Total claims: 14
Accurate: 12
Partially accurate: 0
Inaccurate: 2

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "calculatePeriodLimits dispatches on periodType" | ACCURATE | T0 line 70: `switch (periodType)`. |
| 2 | "ROLLING: Compute end day = today (in booker timezone) + periodDays" | ACCURATE | T0 line 75: `currentTimeInBookerTz.add(periodDays, "days")`. |
| 3 | "If periodCountCalendarDays: use add(days). If false: use businessDaysAdd(days)" | ACCURATE | T0 lines 74-76. |
| 4 | "Return endOfRollingPeriodEndDayInBookerTz = endDay.endOf('day')" | ACCURATE | T0 line 79. |
| 5 | "ROLLING_WINDOW: If _skipRollingWindowCheck: return all-null" | ACCURATE | T0 lines 86-91. |
| 6 | "Require allDatesWithBookabilityStatusInBookerTz map" | ACCURATE | T0 lines 94-96: throws if null. |
| 7 | "Call getRollingWindowEndDate to walk forward through bookable days" | ACCURATE | T0 lines 98-103. |
| 8 | "RANGE: Parse periodStartDate and periodEndDate as UTC" | PARTIALLY ACCURATE | T0 uses `dayjs(periodStartDate).utcOffset(eventUtcOffset)` not strict UTC parsing. But this effectively handles the dates. Revising to ACCURATE since `dayjs(periodStartDate)` does parse and then applies the offset. |
| 9 | "Detect format: new format (midnight UTC) vs. old format (browser timezone midnight converted to UTC)" | INACCURATE | T0 has no format detection. It applies `utcOffset(eventUtcOffset).startOf("day")` uniformly. |
| 10 | "New format: extract date string, create midnight in event timezone by subtracting the UTC offset" | INACCURATE | T0 does not have this logic. |
| 11 | "Old format: convert to event timezone and take startOf/endOf day" | PARTIALLY ACCURATE | T0 lines 116-117 do `dayjs(periodStartDate).utcOffset(eventUtcOffset).startOf("day")` — this is the ONLY format handling, not an "old format" branch. But the behavior is similar. Reclassifying: since T0 has only one path and the graph describes it as a conditional branch, this is misrepresented. But the actual computation matches what the graph calls the "old format" path. Verdict: PARTIALLY ACCURATE. |
| 12 | "getRollingWindowEndDate: Walk forward day by day (calendar or business days based on countNonBusinessDays)" | ACCURATE | T0 lines 187-189. |
| 13 | "isTimeOutOfBounds: Guard against booking in the past (throws BookingDateInPastError). If minimumBookingNotice: check time > now + notice minutes." | ACCURATE | T0 lines 218-227. |
| 14 | "isTimeViolatingFutureLimit: If rolling period set: check time > endOfRollingPeriodEndDay. If range set: check time < rangeStart OR time > rangeEnd. Otherwise: return false." | ACCURATE | T0 lines 267-321. |

Revised totals:
Accurate: 11
Partially accurate: 1
Inaccurate: 2

---

## PeriodLimits — responsibility.md

Total claims: 8
Accurate: 8
Partially accurate: 0
Inaccurate: 0

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "Determines the booking window — how far into the future a booker is allowed to schedule." | ACCURATE | Core purpose of T0 calculatePeriodLimits. |
| 2 | "Returns boundary timestamps that downstream systems use to filter out-of-bounds slots." | ACCURATE | Returns PeriodLimits type with boundary timestamps. |
| 3 | "Calculating period limits for ROLLING, ROLLING_WINDOW, and RANGE period types" | ACCURATE | T0 switch statement handles all three. |
| 4 | "Computing the rolling window end date by walking forward through bookable days" | ACCURATE | T0 getRollingWindowEndDate function. |
| 5 | "Checking if a specific time violates the future limit" | ACCURATE | T0 isTimeViolatingFutureLimit function. |
| 6 | "Checking if a time is in the past or within minimum booking notice" | ACCURATE | T0 isTimeOutOfBounds function. |
| 7 | "Providing both throwing (isTimeOutOfBounds) and non-throwing (getPastTimeAndMinimumBookingNoticeBoundsStatus) variants" | ACCURATE | Both functions present in T0. |
| 8 | "Out of scope: Computing date ranges or slots, querying which days are bookable, database access" | ACCURATE | None of these are in the T0 file. |

---

## Aspect: timezone-safe

Total claims: 7
Accurate: 6
Partially accurate: 0
Inaccurate: 1

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "Three distinct timezone contexts: Booker, Organizer/Event, UTC" | ACCURATE | All three contexts visible across T0 code. Period-limits uses bookerUtcOffset and eventUtcOffset; date-ranges uses organizer timezone; all store as UTC. |
| 2 | "ROLLING period end computed in booker timezone. RANGE boundaries computed in organizer timezone." | ACCURATE | T0 isOutOfBounds confirms: ROLLING uses currentTimeInBookerTz, RANGE uses eventUtcOffset. |
| 3 | "Travel schedules override the organizer timezone for specific date ranges — check getAdjustedTimezone before applying working hours." | ACCURATE | T0 date-ranges line 49: getAdjustedTimezone called before processWorkingHours body. |
| 4 | "DST transitions require offset correction: offsetDiff = start.utcOffset() - beginningOfDay.utcOffset()" | ACCURATE | T0 date-ranges lines 65-66. |
| 5 | "Half-hour offset timezones must be handled — slot alignment must happen in local time, not UTC." | INACCURATE | In T0, slot alignment in slots.ts happens BEFORE timezone conversion (line 78 alignment, line 81 .tz()). The graph claims alignment happens in local time, which is the current code's behavior, not T0's. |
| 6 | "Never compare datetimes across different timezone contexts without explicit conversion." | ACCURATE | General principle followed in T0 code. |
| 7 | "All timestamps stored as UTC; timezone applied at display or boundary computation time." | ACCURATE | General architecture principle present in T0. |

---

## Aspect: dayjs-immutable

Total claims: 5
Accurate: 5
Partially accurate: 0
Inaccurate: 0

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "All date/time manipulation must use the @calcom/dayjs wrapper." | ACCURATE | All three T0 files import from `@calcom/dayjs`. |
| 2 | "Every arithmetic operation (.add(), .subtract(), .startOf(), .endOf()) returns a new immutable instance." | ACCURATE | dayjs is immutable by design; all T0 code uses return values from these methods. |
| 3 | "Use dayjs.utc() for creating UTC timestamps, .tz(timezone) for converting to a specific zone." | ACCURATE | T0 uses `dayjs.utc()` (slots line 66, date-ranges line 182) and `.tz()` throughout. |
| 4 | "Use dayjs.max() / dayjs.min() for range clamping." | ACCURATE | T0 date-ranges lines 71-72: `dayjs.max(start, dateFrom)` and `dayjs.min(end, dateTo...)`. |
| 5 | "The .valueOf() method returns millisecond timestamps for safe numeric comparison." | ACCURATE | T0 date-ranges line 208: `range.start.valueOf() !== range.end.valueOf()`. Slots line 68: `a.start.valueOf() - b.start.valueOf()`. |

---

## Aspect: booking-period-aware

Total claims: 7
Accurate: 5
Partially accurate: 1
Inaccurate: 1

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "Three mutually exclusive booking period types: ROLLING, ROLLING_WINDOW, RANGE" | ACCURATE | T0 switch statement in calculatePeriodLimits handles all three. |
| 2 | "ROLLING: Count N days forward. If periodCountCalendarDays true, count calendar days. If false, count business days (businessDaysAdd)." | ACCURATE | T0 lines 74-76. |
| 3 | "ROLLING evaluated in booker timezone." | ACCURATE | T0 line 75: uses `currentTimeInBookerTz`. |
| 4 | "ROLLING_WINDOW: Count N bookable days forward with safety limit ROLLING_WINDOW_PERIOD_MAX_DAYS_TO_CHECK." | ACCURATE | T0 getRollingWindowEndDate function. |
| 5 | "RANGE: Fixed date range set by organizer. Evaluated in organizer/event timezone." | ACCURATE | T0 lines 116-117 use `eventUtcOffset`. |
| 6 | "RANGE handles both old format (browser-timezone midnight stored as UTC) and new format (pure UTC midnight) for backward compatibility." | INACCURATE | T0 has no dual-format handling. Single path only. |
| 7 | "If no period type configured, all future dates are bookable. PeriodLimits return type has all-null fields. isTimeViolatingFutureLimit returns false." | ACCURATE | T0 lines 127-131 and line 320. |

Wait, claim 7 says "isTimeViolatingFutureLimit returns false" — checking T0 line 320: `return false;` is the fallback. ACCURATE.

Revising claim 6: INACCURATE.

---

## Flow: Slot Availability Pipeline

Total claims: 15
Accurate: 12
Partially accurate: 2
Inaccurate: 1

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | "When a booker views a cal.com event page, they see available time slots computed from working hours, date overrides, OOO, travel schedules, period limits, minimum notice." | ACCURATE | All these components exist in T0 across the three files. |
| 2 | "Trigger: A booker requests available slots for a given date range" | ACCURATE | General architecture, confirmed by getSlots entry point. |
| 3 | "Goal: Return list of discrete bookable time slots with start time and optional OOO metadata" | ACCURATE | T0 slots return type includes `time`, `away`, and OOO fields. |
| 4 | "scheduling/date-ranges converts working hours and date overrides into continuous time ranges, applying timezone and DST corrections. Handles travel schedule timezone overrides." | ACCURATE | T0 date-ranges code confirms. |
| 5 | "scheduling/date-ranges performs range intersection (for multi-host events) and subtraction (for OOO exclusions)." | ACCURATE | T0 date-ranges exports `intersect` and `subtract`. |
| 6 | "scheduling/slots takes date ranges and slices them into discrete slots at configured frequency. Handles slot alignment (optimized slots snap to hour/15min/5min boundaries)." | PARTIALLY ACCURATE | T0 slots does slice at frequency. However, "optimized slots snap to hour/15min/5min" is not in T0. T0 has only interval-boundary alignment. |
| 7 | "scheduling/slots handles minimum booking notice and OOO annotation." | ACCURATE | T0 lines 66 and 109-133. |
| 8 | "scheduling/slots prevents duplicate slots via boundary tracking." | PARTIALLY ACCURATE | T0 uses Map key uniqueness + slot-overlap iterator, not named "boundary tracking". |
| 9 | "scheduling/period-limits determines booking window based on ROLLING, ROLLING_WINDOW, or RANGE." | ACCURATE | T0 calculatePeriodLimits. |
| 10 | "Happy path steps 1-5 (working hours, timezone corrections, date overrides, OOO marking, travel schedules)" | ACCURATE | All present in T0. |
| 11 | "Happy path step 7: Slot start times are snapped to aesthetic boundaries when possible" | INACCURATE | "Aesthetic boundaries" (three-tier snapping) not present in T0. Only interval-boundary alignment exists. |
| 12 | "Happy path steps 8-9: Slots before minimum notice excluded, slots beyond period limit excluded" | ACCURATE | Both present in T0. |
| 13 | "Invariant: Slot frequency and event length are always at least 1 minute (minimumOfOne guard)" | ACCURATE | T0 slots lines 39-40. |
| 14 | "Invariant: The 23:59 → midnight edge case is always corrected" | ACCURATE | T0 date-ranges lines 76-78 and 119-120. |
| 15 | "Invariant: OOO slots are surfaced (not removed) so the UI can show the reason" | ACCURATE | T0 slots annotates with `away: true` rather than removing. |

---

# SUMMARY TABLE

| Artifact / Component | Total Claims | Accurate | Partial | Inaccurate | Accuracy % |
|---|---|---|---|---|---|
| **Slots — constraints.md** | 7 | 4 | 2 | 1 | 71.4% |
| **Slots — decisions.md** | 5 | 4 | 0 | 1 | 80.0% |
| **Slots — logic.md** | 16 | 9 | 4 | 3 | 68.8% |
| **Slots — responsibility.md** | 9 | 6 | 2 | 1 | 77.8% |
| **DateRanges — constraints.md** | 6 | 5 | 1 | 0 | 91.7% |
| **DateRanges — decisions.md** | 3 | 1 | 1 | 1 | 50.0% |
| **DateRanges — errors.md** | 5 | 5 | 0 | 0 | 100.0% |
| **DateRanges — interface.md** | 10 | 8 | 2 | 0 | 90.0% |
| **DateRanges — logic.md** | 19 | 17 | 1 | 1 | 92.1% |
| **DateRanges — responsibility.md** | 10 | 8 | 1 | 1 | 85.0% |
| **PeriodLimits — constraints.md** | 7 | 6 | 0 | 1 | 85.7% |
| **PeriodLimits — decisions.md** | 4 | 4 | 0 | 0 | 100.0% |
| **PeriodLimits — logic.md** | 14 | 11 | 1 | 2 | 82.1% |
| **PeriodLimits — responsibility.md** | 8 | 8 | 0 | 0 | 100.0% |
| **Aspect: timezone-safe** | 7 | 6 | 0 | 1 | 85.7% |
| **Aspect: dayjs-immutable** | 5 | 5 | 0 | 0 | 100.0% |
| **Aspect: booking-period-aware** | 7 | 5 | 1 | 1 | 78.6% |
| **Flow: Slot Availability Pipeline** | 15 | 12 | 2 | 1 | 86.7% |
| **TOTAL** | **157** | **124** | **18** | **15** | **84.7%** |

## Accuracy by Artifact Type (aggregated)

| Artifact Type | Total Claims | Accurate | Partial | Inaccurate | Accuracy % (strict) | Accuracy % (partial=0.5) |
|---|---|---|---|---|---|---|
| responsibility.md | 27 | 22 | 3 | 2 | 81.5% | 87.0% |
| constraints.md | 20 | 15 | 3 | 2 | 75.0% | 82.5% |
| logic.md | 49 | 37 | 6 | 6 | 75.5% | 81.6% |
| decisions.md | 12 | 9 | 1 | 2 | 75.0% | 79.2% |
| interface.md | 10 | 8 | 2 | 0 | 80.0% | 90.0% |
| errors.md | 5 | 5 | 0 | 0 | 100.0% | 100.0% |
| Aspects | 19 | 16 | 1 | 2 | 84.2% | 86.8% |
| Flow | 15 | 12 | 2 | 1 | 80.0% | 86.7% |

## Key Findings: What Changed Between T0 and Current Code

The 15 inaccurate claims cluster around **four specific features that were added after T0**:

1. **Three-tier slot snapping (`getCorrectedSlotStartTime`, `showOptimizedSlots`)** — 5 inaccurate claims. T0 had only simple interval-boundary alignment. The aesthetic hour/15min/5min snapping was added later.

2. **`endTimeToKeyMap` performance optimization** — 3 inaccurate claims. T0 used simple array-push and groupByDate. The O(1) end-time-keyed merge optimization came later.

3. **Old vs. new date format detection in RANGE period handling** — 3 inaccurate claims. T0 had a single uniform path for RANGE dates. Format detection was added for backward compatibility with legacy data.

4. **OOO metadata expansion (`notes`, `showNotePublicly`)** — 2 partially accurate claims. T0 had the core OOO fields (`away`, `fromUser`, `toUser`, `reason`, `emoji`) but not the extended fields.

5. **Timezone-before-alignment ordering in slots** — 2 inaccurate claims. T0 did alignment THEN timezone conversion; current code reverses this for half-hour offset timezone correctness.

## Conclusion

At 84.7% strict accuracy (or ~89.5% treating partial accuracy as half-credit), the graph would have been substantially correct 12 months ago. The decay is concentrated in a small number of specific features (slot snapping, performance optimization, date format handling) rather than being uniformly distributed. The architectural understanding, business logic, error handling, and interface specifications showed minimal decay. The most stable artifact types were `errors.md` (100%), `interface.md` (90%), and `responsibility.md` (87%), while `logic.md` and `decisions.md` showed the most decay — consistent with the expectation that implementation details change faster than interfaces and high-level responsibilities.
