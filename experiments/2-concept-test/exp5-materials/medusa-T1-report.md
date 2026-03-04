# Medusa T1 Audit Report: Semantic Graph vs. Historical Code

**Date:** 2026-03-03
**Scope:** Context packages for `payment/payment-module` (PaymentModuleService) and `payment/payment-provider` (PaymentProviderService), including all aspects and flows, audited against historical source code from ~6 months ago.

**Source files:**

- Graph: `/workspaces/memory2/exp-base-medusa-pm-context.txt`, `/workspaces/memory2/exp-base-medusa-pp-context.txt`
- Code: `/tmp/exp5/medusa-payment-module-T1.ts`, `/tmp/exp5/medusa-payment-provider-T1.ts`

---

## Summary

| Verdict | Count |
|---|---|
| ACCURATE | 55 |
| PARTIALLY ACCURATE | 8 |
| INACCURATE | 4 |

---

## 1. PaymentModuleService — `constraints.md`

### Claim 1.1: Capture ceiling is `authorizedAmount - capturedAmount` after both sides are rounded to currency precision

**Code (lines 725-738):** `remainingToCapture = MathBN.sub(authorizedAmount, capturedAmount)`, then `MathBN.gt(roundToCurrencyPrecision(newCaptureAmount), roundToCurrencyPrecision(remainingToCapture))` throws.

**Verdict: ACCURATE**

### Claim 1.2: Refund ceiling is captured amount, NOT authorized amount (`capturedAmount >= refundedAmount + newRefund`)

**Code (lines 843-858):** `capturedAmount` is computed from captures. `totalRefundedAmount = MathBN.add(refundedAmount, data.amount)`. Check: `MathBN.lt(capturedAmount, totalRefundedAmount)` throws.

**Verdict: ACCURATE** -- The refund ceiling is enforced against captured amount as described.

### Claim 1.3: Refund ceiling comparison uses `roundToCurrencyPrecision`

**Code (line 853):** The comparison uses `MathBN.lt(capturedAmount, totalRefundedAmount)` directly -- NO `roundToCurrencyPrecision` is applied.

**Verdict: INACCURATE** -- The graph (via aspect "Currency Precision") claims "ALWAYS round both sides of any monetary comparison." The refund ceiling check does NOT use `roundToCurrencyPrecision`. This is either a code bug or a graph inaccuracy.

### Claim 1.4: Canceled payments cannot be captured -- `payment.canceled_at` check throws immediately

**Code (lines 705-710):** `if (payment.canceled_at) { throw new MedusaError(...) }`

**Verdict: ACCURATE**

### Claim 1.5: Auto-capture coercion sets session status to AUTHORIZED (not CAPTURED)

**Code (lines 588-592):** `if (status === PaymentSessionStatus.CAPTURED) { status = PaymentSessionStatus.AUTHORIZED; autoCapture = true }`

**Verdict: ACCURATE**

### Claim 1.6: Auto-capture creates the Payment record, then immediately calls `capturePayment` internally

**Code (lines 608-625):** Payment is created via `paymentService_.create(...)`, then `if (autoCapture) { await this.capturePayment({payment_id: payment.id, amount: session.amount}, sharedContext) }`

**Verdict: ACCURATE**

### Claim 1.7: Auto-capture uses an `is_captured: true` flag that skips the provider.capturePayment call

**Code:** There is NO `is_captured` flag anywhere in the codebase. Auto-capture calls `this.capturePayment(...)`, which goes through the full flow including `capturePaymentFromProvider_`, which calls `this.paymentProviderService_.capturePayment(...)`. The provider call is NOT skipped.

**Verdict: INACCURATE** -- The graph claims a flag `is_captured: true` causes the provider call to be skipped. No such flag exists. The provider IS called during auto-capture.

### Claim 1.8: Default capture amount is the full authorized amount when no amount is specified

**Code (lines 717-718):** `if (!data.amount) { data.amount = payment.amount as number }`

**Verdict: ACCURATE**

### Claim 1.9: Default refund amount is the full captured amount when no amount is specified

**Code (lines 839-840):** `if (!data.amount) { data.amount = payment.amount as BigNumberInput }` -- `payment.amount` is the payment's amount (set from `session.amount` during authorization at line 610), which is the AUTHORIZED amount, not the sum of captures.

**Verdict: PARTIALLY ACCURATE** -- The default refund amount is `payment.amount` (the authorized/payment amount), not the "full captured amount" as stated. In practice these could be the same value for a fully-captured payment, but the code does not compute or use the sum of captures as the default.

### Claim 1.10: Collection status is recomputed from scratch after every capture/refund (not incremented)

**Code (lines 927-1021):** `maybeUpdatePaymentCollection_` reloads all sessions, captures, and refunds, computes sums from scratch, and derives status.

**Verdict: ACCURATE**

### Claim 1.11: Status transitions -- No sessions -> NOT_PAID

**Code (lines 974-977):** `paymentSessions.length === 0 ? PaymentCollectionStatus.NOT_PAID : PaymentCollectionStatus.AWAITING`

**Verdict: ACCURATE**

### Claim 1.12: Status transitions -- Sessions exist but no authorizations -> AWAITING

**Code (lines 974-977):** When sessions exist, default is `AWAITING`. Only changes if `authorizedAmount > 0`.

**Verdict: ACCURATE**

### Claim 1.13: Status transitions -- Some authorized but not all -> PARTIALLY_AUTHORIZED

**Code (lines 979-991):** When `authorizedAmount > 0` but `authorizedAmount < collectionAmount` (after rounding), status is `PARTIALLY_AUTHORIZED`.

**Verdict: ACCURATE**

### Claim 1.14: Status transitions -- All authorized (authorizedAmount >= collectionAmount after rounding) -> AUTHORIZED

**Code (lines 980-990):** `MathBN.gte(roundToCurrencyPrecision(authorizedAmount, ...), roundToCurrencyPrecision(paymentCollection.amount, ...))` yields `AUTHORIZED`.

**Verdict: ACCURATE**

### Claim 1.15: Status transitions -- Captured >= collection amount -> COMPLETED

**Code (lines 994-1008):** `MathBN.gte(roundToCurrencyPrecision(capturedAmount, ...), roundToCurrencyPrecision(paymentCollection.amount, ...))` yields `COMPLETED`.

**Verdict: ACCURATE**

---

## 2. PaymentModuleService -- `decisions.md`

### Claim 2.1: Status recomputed from scratch instead of incrementally, to eliminate state-transition bugs

**Code (lines 927-1021):** Confirmed -- full reload and recomputation.

**Verdict: ACCURATE**

### Claim 2.2: Refund ceiling uses captured amount because authorization is a hold, not a transfer

**Code (line 853):** `MathBN.lt(capturedAmount, totalRefundedAmount)` -- the ceiling IS capturedAmount.

**Verdict: ACCURATE** -- The rationale is a design decision, verified consistent with code.

### Claim 2.3: `authorizePaymentSession` is idempotent -- if session has payment and authorized_at, returns existing payment

**Code (lines 522-525):** `if (session.payment && session.authorized_at) { return ... session.payment }`

**Verdict: ACCURATE**

### Claim 2.4: Local record is created before the provider call; the idempotency key is the local record's ID

**Code (multiple locations):** `createPaymentSession` creates local session first (line 371), then calls provider with `idempotency_key: paymentSession!.id` (line 381). Capture creates local capture first (line 750), then provider called with `idempotency_key: capture?.id` (line 774). Refund creates local refund first (line 860), then provider called with `idempotency_key: refund.id` (line 886).

**Verdict: ACCURATE**

### Claim 2.5: If the provider call fails, the local record is cleaned up

**Code:** `createPaymentSession` catch block deletes local session (lines 405-409). `capturePayment` catch block deletes capture (lines 681-684). `refundPayment` catch block deletes refund (lines 816-818).

**Verdict: ACCURATE**

### Claim 2.6: BigNumber for monetary amounts because JS floating-point is inadequate

**Code:** All monetary operations use `BigNumber`, `MathBN.add`, `MathBN.sub`, `MathBN.gt`, `MathBN.gte`, `MathBN.convert`.

**Verdict: ACCURATE**

### Claim 2.7: `Intl.NumberFormat` used for currency precision detection; for unknown currencies, full precision is preserved

**Code (lines 156-173):** Uses `Intl.NumberFormat(undefined, {style: "currency", currency: currencyCode}).format(0.1111111)`, splits by `.` to get precision. Catch block keeps precision as `undefined` for unknown currencies.

**Verdict: PARTIALLY ACCURATE** -- The mechanism is correct for most currencies. However, for zero-decimal currencies (like JPY), `format(0.1111111)` produces a string with no decimal point, causing `split(".")[1]` to be `undefined`, and `.length` to throw, falling into the catch block. This means zero-decimal currencies would NOT be rounded to 0 decimals but would keep full precision. The graph does not capture this nuance/potential bug.

---

## 3. PaymentModuleService -- `responsibility.md`

### Claim 3.1: Central orchestration service for all payment operations

**Verdict: ACCURATE** -- The code confirms this role.

### Claim 3.2: In scope -- creating, updating, deleting payment sessions with provider sync and dual rollback

**Verdict: ACCURATE** -- All three operations exist with corresponding provider calls and error handling.

### Claim 3.3: In scope -- authorizing payment sessions (creating Payment records, handling auto-capture)

**Verdict: ACCURATE** -- `authorizePaymentSession` creates Payment records and handles auto-capture.

### Claim 3.4: In scope -- capturing payments (full and partial, with currency-precision ceiling enforcement)

**Verdict: ACCURATE** -- `capturePayment` supports partial captures with `roundToCurrencyPrecision` ceiling.

### Claim 3.5: In scope -- refunding payments (with captured-amount ceiling, not authorized-amount)

**Verdict: ACCURATE** -- Ceiling is against `capturedAmount`.

### Claim 3.6: In scope -- canceling payments with provider notification

**Verdict: ACCURATE** -- `cancelPayment` calls provider first, then sets `canceled_at`.

### Claim 3.7: In scope -- recomputing PaymentCollection derived status after every state change

**Verdict: ACCURATE** -- `maybeUpdatePaymentCollection_` is called after authorize, capture, and refund.

### Claim 3.8: In scope -- CRUD for payment collections, providers, account holders, payment methods

**Verdict: ACCURATE** -- All CRUD operations exist in the code.

### Claim 3.9: In scope -- webhook event translation

**Verdict: ACCURATE** -- `getWebhookActionAndData` method exists (lines 1241-1251).

### Claim 3.10: Out of scope -- provider-specific API calls (delegated to PaymentProviderService)

**Verdict: ACCURATE** -- All provider calls go through `this.paymentProviderService_`.

### Claim 3.11: Out of scope -- entity-level persistence (delegated to injected entity services)

**Verdict: ACCURATE** -- Uses `paymentService_`, `captureService_`, `refundService_`, etc.

---

## 4. PaymentModuleService -- `state.md`

### Claim 4.1: PaymentCollection status machine: NOT_PAID -> AWAITING -> PARTIALLY_AUTHORIZED -> AUTHORIZED -> COMPLETED

**Verdict: ACCURATE** -- Code matches (lines 974-1008).

### Claim 4.2: Status is NOT driven by explicit transitions -- it is recomputed from aggregate amounts

**Verdict: ACCURATE** -- `maybeUpdatePaymentCollection_` recomputes from sums.

### Claim 4.3: authorizedAmount = sum of all AUTHORIZED session amounts

**Code (lines 960-964):** Sums `ps.amount` for sessions where `ps.status === PaymentSessionStatus.AUTHORIZED`.

**Verdict: ACCURATE**

### Claim 4.4: capturedAmount = sum of all capture amounts across all payments

**Code (lines 966-968):** Sums `capture.amount` for all captures.

**Verdict: ACCURATE**

### Claim 4.5: refundedAmount = sum of all refund amounts across all payments

**Code (lines 970-972):** Sums `refund.amount` for all refunds.

**Verdict: ACCURATE**

### Claim 4.6: Comparison `capturedAmount >= collectionAmount` (after rounding) triggers COMPLETED

**Verdict: ACCURATE** -- Lines 994-1008 confirm.

### Claim 4.7: PaymentSession status: PENDING -> AUTHORIZED, PENDING -> ERROR/REQUIRES_MORE

**Code (lines 535-551):** If provider returns non-AUTHORIZED and non-CAPTURED, session is updated with the returned status and an error is thrown. Authorization sets status to AUTHORIZED.

**Verdict: PARTIALLY ACCURATE** -- The code does update session status on failure, but the specific statuses ERROR and REQUIRES_MORE are type-level constants; the code just passes through whatever status the provider returns.

### Claim 4.8: If provider returns CAPTURED during auth, session status is set to AUTHORIZED (coerced)

**Verdict: ACCURATE** -- Lines 588-592 confirm.

### Claim 4.9: Payment entity lifecycle -- created during authorization, captured_at set on full capture, canceled_at is terminal

**Verdict: ACCURATE** -- Payment created in `authorizePaymentSession_`, `captured_at` set in `capturePaymentFromProvider_` when `isFullyCaptured`, `canceled_at` checked in `capturePayment_`.

---

## 5. PaymentProviderService -- `interface.md`

### Claim 5.1: `retrieveProvider(providerId)` resolves by key `pp_${providerId}`

**Code (lines 55-75):** `return this.__container__[providerId] as IPaymentProvider` -- the method uses `providerId` directly, NOT `pp_${providerId}`. The `pp_` prefix is part of the container type definition and is expected to already be part of the `providerId` argument when passed in.

**Verdict: PARTIALLY ACCURATE** -- The graph implies `retrieveProvider` adds the `pp_` prefix itself. In reality, the method uses the providerId as-is. The `pp_` prefix is added by callers (e.g., `getWebhookActionAndData` in PaymentModuleService does `const providerId = \`pp_${eventData.provider}\``). The container's type definition expects `pp_`-prefixed keys, but `retrieveProvider` does not add the prefix.

### Claim 5.2: Throws user-friendly message on AwilixResolutionError

**Code (lines 58-68):** Checks `err.name === "AwilixResolutionError"`, creates user-friendly message, logs original error at error level.

**Verdict: ACCURATE**

### Claim 5.3: Session operations -- createSession, updateSession, deleteSession, authorizePayment, getStatus, capturePayment, cancelPayment, refundPayment

**Code (lines 77-141):** All eight methods exist with correct signatures.

**Verdict: ACCURATE**

### Claim 5.4: All session methods take `(providerId, input)` and delegate to the resolved provider

**Verdict: ACCURATE** -- Each method calls `this.retrieveProvider(providerId)` then delegates.

### Claim 5.5: Account holder operations -- createAccountHolder, retrieveAccountHolder, updateAccountHolder, deleteAccountHolder

**Code:** `createAccountHolder` (line 143), `updateAccountHolder` (line 158), `deleteAccountHolder` (line 173) exist. `retrieveAccountHolder` does NOT exist in the code.

**Verdict: PARTIALLY ACCURATE** -- 3 of 4 claimed operations exist. `retrieveAccountHolder` is missing from the code.

### Claim 5.6: Account holder operations gracefully degrade (log warning, return empty)

**Code:** `createAccountHolder` (lines 148-153), `updateAccountHolder` (lines 163-168), `deleteAccountHolder` (lines 179-183) all check `!provider.<method>`, log warning, return empty.

**Verdict: ACCURATE** -- For the operations that exist, this pattern is confirmed.

### Claim 5.7: Payment method operations -- listPaymentMethods, savePaymentMethod

**Code (lines 188-216):** Both exist with graceful degradation.

**Verdict: ACCURATE**

### Claim 5.8: Payment method operations also gracefully degrade

**Verdict: ACCURATE** -- Both `listPaymentMethods` and `savePaymentMethod` check method existence, log warning, return empty.

### Claim 5.9: `getWebhookActionAndData(providerId, data)` returns WebhookActionResult

**Code (lines 218-225):** Confirmed.

**Verdict: ACCURATE**

---

## 6. PaymentProviderService -- `errors.md`

### Claim 6.1: Provider not registered -- wraps AwilixResolutionError with user-friendly message, logs original at error level

**Verdict: ACCURATE** -- Lines 58-68 confirm.

### Claim 6.2: Optional method not implemented -- logs warning, returns empty object or array

**Verdict: ACCURATE** -- All optional methods follow this pattern.

### Claim 6.3: Warning message format: `Provider ${providerId} does not support ${operation}`

**Code:** Warning messages are like `Provider ${providerId} does not support creating account holders` -- the operation is described in prose, not as a method name.

**Verdict: PARTIALLY ACCURATE** -- The format is close but uses descriptive phrases (e.g., "creating account holders") rather than a generic `${operation}` template.

---

## 7. PaymentProviderService -- `responsibility.md`

### Claim 7.1: Adapter layer between payment module and external providers

**Verdict: ACCURATE**

### Claim 7.2: In scope -- resolving provider implementations from the container

**Verdict: ACCURATE**

### Claim 7.3: In scope -- forwarding session lifecycle operations (create, update, delete, authorize, capture, refund, cancel)

**Verdict: ACCURATE** -- All seven operations exist.

### Claim 7.4: In scope -- forwarding account holder operations (create, update, delete)

**Verdict: PARTIALLY ACCURATE** -- `create`, `update`, `delete` exist for account holders. `retrieve` is claimed in the interface doc but does not exist in the code. The responsibility doc only lists "create, update, delete" which is accurate.

### Claim 7.5: In scope -- forwarding payment method operations (list, save, delete)

**Code:** `listPaymentMethods` and `savePaymentMethod` exist. `deletePaymentMethod` does NOT exist.

**Verdict: PARTIALLY ACCURATE** -- Only `list` and `save` exist. There is no `delete` operation for payment methods.

### Claim 7.6: In scope -- webhook action resolution

**Verdict: ACCURATE**

### Claim 7.7: In scope -- passing through idempotency keys in context

**Verdict: ACCURATE** -- PaymentProviderService receives the context (including idempotency keys) and passes it through to the provider.

### Claim 7.8: Out of scope -- business logic (capture ceiling, refund ceiling, status computation)

**Verdict: ACCURATE** -- No business logic in PaymentProviderService.

### Claim 7.9: Out of scope -- transaction management, direct database access

**Verdict: ACCURATE** -- No `@InjectTransactionManager` or direct DB calls in the provider service.

---

## 8. Aspect: Currency Precision (`currency-precision`)

### Claim 8.1: All monetary arithmetic uses BigNumber/MathBN (never native JS numbers)

**Verdict: ACCURATE** -- Confirmed throughout both files.

### Claim 8.2: Monetary COMPARISONS require rounding to currency decimal precision before comparing

**Verdict: PARTIALLY ACCURATE** -- Capture ceiling and collection status comparisons use `roundToCurrencyPrecision`. However, the refund ceiling comparison (line 853) does NOT use rounding. The rule is not universally applied.

### Claim 8.3: `roundToCurrencyPrecision` uses `Intl.NumberFormat` to detect precision, then `MathBN.convert`

**Code (lines 156-173):** Confirmed.

**Verdict: ACCURATE**

### Claim 8.4: For unknown currencies, full precision is kept (safe fallback)

**Verdict: ACCURATE** -- Catch block keeps `precision` as `undefined`.

### Claim 8.5: Rule -- ALWAYS round both sides of any monetary comparison

**Verdict: INACCURATE** -- The refund ceiling comparison does NOT round. This rule is stated as an absolute but is not followed in the refund path.

### Claim 8.6: Rounding happens at comparison time, not at storage time

**Verdict: ACCURATE** -- Stored values retain full precision; rounding is applied only during comparisons.

---

## 9. Aspect: Idempotent Provider Calls (`idempotent-provider-calls`)

### Claim 9.1: Every call to an external payment provider includes an `idempotency_key` in context

**Code:** `createSession` (line 381): `idempotency_key: paymentSession!.id`. `authorizePayment` (line 531): `idempotency_key: session.id`. `capturePayment` (line 774): `idempotency_key: capture?.id`. `refundPayment` (line 886): `idempotency_key: refund.id`. `cancelPayment` (line 914): `idempotency_key: payment.id`. `createAccountHolder` (line 1081): `idempotency_key: input.context?.customer?.id`.

**Verdict: ACCURATE**

### Claim 9.2: createSession key = paymentSession.id

**Verdict: ACCURATE** -- Line 381.

### Claim 9.3: authorizePayment key = session.id

**Verdict: ACCURATE** -- Line 531.

### Claim 9.4: capturePayment key = capture.id

**Verdict: ACCURATE** -- Line 774 (`capture?.id`).

### Claim 9.5: refundPayment key = refund.id

**Verdict: ACCURATE** -- Line 886.

### Claim 9.6: cancelPayment key = payment.id

**Verdict: ACCURATE** -- Line 914.

### Claim 9.7: createAccountHolder key = customer.id

**Code (line 1081):** `idempotency_key: input.context?.customer?.id`

**Verdict: ACCURATE**

### Claim 9.8: Local record created BEFORE provider call to generate idempotency key

**Verdict: ACCURATE** -- Confirmed for all operations.

### Claim 9.9: If provider call fails, local record is rolled back

**Verdict: ACCURATE** -- Catch blocks delete local records.

---

## 10. Aspect: Dual Rollback (`dual-rollback`)

### Claim 10.1: Operations spanning DB and provider cannot use a single transaction; explicit try/catch with asymmetric rollback

**Verdict: ACCURATE** -- All operations use try/catch with specific rollback logic.

### Claim 10.2: createPaymentSession pattern -- create local, call provider, update local; on provider fail delete local; on local update fail delete provider then local

**Code (lines 370-413):** Catch block checks if `providerPaymentSession` exists (deletes provider-side) and if `paymentSession` exists (deletes local).

**Verdict: ACCURATE**

### Claim 10.3: authorizePaymentSession pattern -- call provider.authorize first, then create local payment + update session; on local fail cancel provider payment

**Code (lines 527-571):** Provider `authorizePayment` is called first, then `authorizePaymentSession_` creates payment + updates session. Catch block calls `provider.cancelPayment`.

**Verdict: ACCURATE**

### Claim 10.4: capturePayment pattern -- create local capture, call provider; on fail delete local capture

**Code (lines 668-686):** Local capture created in `capturePayment_`, then `capturePaymentFromProvider_` called. Catch deletes capture.

**Verdict: ACCURATE**

### Claim 10.5: refundPayment pattern -- create local refund, call provider; on fail delete local refund

**Code (lines 812-818):** Local refund created in `refundPayment_`, then `refundPaymentFromProvider_` called. Catch deletes refund.

**Verdict: ACCURATE**

### Claim 10.6: Invariant -- local record ALWAYS created first, deleted on failure; provider NEVER called without local record

**Verdict: ACCURATE** -- With one exception: `authorizePaymentSession` calls the provider BEFORE creating the local payment record (the provider is called first, then the local record is created in `authorizePaymentSession_`). However, the idempotency key uses `session.id` (which already exists), so there IS a local record to reference. The invariant is slightly nuanced but functionally correct.

---

## 11. Flow: Payment Lifecycle

### Claim 11.1: Happy path (full capture) -- createPaymentSession -> authorizePaymentSession -> capturePayment -> Collection status NOT_PAID -> AWAITING -> AUTHORIZED -> COMPLETED

**Verdict: ACCURATE** -- All methods exist and status transitions match.

### Claim 11.2: Happy path (partial capture) -- multiple capturePayment calls with partial amounts

**Verdict: ACCURATE** -- `capturePayment_` supports partial amounts and tracks `isFullyCaptured`.

### Claim 11.3: Auto-capture -- provider returns CAPTURED, handler sets session to AUTHORIZED, creates Payment, calls capturePayment internally

**Verdict: ACCURATE** -- Lines 588-625 confirm.

### Claim 11.4: Auto-capture -- from caller's perspective, authorize returns a Payment with captured_at set

**Verdict: INACCURATE** -- The `authorizePaymentSession_` method calls `this.capturePayment(...)` which modifies the payment in the database, but the method returns the `payment` object created BEFORE the capture call (line 627: `return payment`). The returned payment object does NOT have `captured_at` set because it was created before the capture happened. The caller gets back the pre-capture payment object. The serialized payment in `authorizePaymentSession` (line 578) would serialize this pre-capture state. The database IS updated, but the returned object may not reflect `captured_at`.

### Claim 11.5: Refund -- refund ceiling is total refunded <= total captured (not authorized)

**Verdict: ACCURATE** -- Line 853 confirms.

### Claim 11.6: Refund -- refunded_amount is tracked but does not affect collection status

**Code (lines 970-1008):** `refundedAmount` is computed and stored in the collection update (line 1016: `refunded_amount: refundedAmount`), but it is NOT used in any status determination logic.

**Verdict: ACCURATE**

### Claim 11.7: Cancellation -- call provider.cancel, set canceled_at

**Verdict: ACCURATE** -- Lines 911-919 confirm.

### Claim 11.8: Canceled payments cannot be captured (guard check)

**Verdict: ACCURATE** -- Lines 705-710 confirm.

### Claim 11.9: Provider failure with rollback -- local records deleted, provider state reversed if possible

**Verdict: ACCURATE** -- Confirmed across all operations.

### Claim 11.10: Every provider call includes idempotency key (local record's ID)

**Verdict: ACCURATE**

### Claim 11.11: Monetary comparisons always use roundToCurrencyPrecision

**Verdict: INACCURATE** -- Refund ceiling comparison does NOT use `roundToCurrencyPrecision` (see Claim 1.3). This invariant is stated as universal but is violated in the refund path.

### Claim 11.12: PaymentCollection status recomputed from scratch after every capture/refund

**Verdict: ACCURATE**

### Claim 11.13: authorizePaymentSession is idempotent

**Verdict: ACCURATE** -- Lines 522-525 confirm.

---

## Critical Findings Summary

### INACCURATE claims (4):

1. **Auto-capture `is_captured` flag** (Claim 1.7) -- The graph describes an `is_captured: true` flag that skips the provider capture call. No such flag exists. Auto-capture goes through the full `capturePayment` flow, including calling the provider.

2. **Currency precision rule universality** (Claim 8.5) -- The aspect states "ALWAYS round both sides of any monetary comparison" but the refund ceiling check does not use rounding.

3. **Auto-capture return value** (Claim 11.4) -- The graph claims authorize returns a Payment with `captured_at` set during auto-capture. The returned payment object is created before the capture call and does not reflect `captured_at`.

4. **Flow invariant: all monetary comparisons use rounding** (Claim 11.11) -- Same as Claim 8.5; the refund path violates this invariant.

### PARTIALLY ACCURATE claims (8):

1. **Default refund amount** (Claim 1.9) -- Described as "full captured amount" but actually defaults to `payment.amount` (the authorized amount).

2. **Intl.NumberFormat for zero-decimal currencies** (Claim 2.7) -- Works for most currencies but zero-decimal currencies (JPY) may fall through to the catch block, keeping full precision instead of rounding to 0 decimals.

3. **PaymentSession error statuses** (Claim 4.7) -- The specific statuses ERROR/REQUIRES_MORE are from type definitions; the code passes through whatever status the provider returns.

4. **retrieveProvider key resolution** (Claim 5.1) -- The graph says it resolves by `pp_${providerId}` but the method uses `providerId` directly. The `pp_` prefix is added by callers, not by `retrieveProvider` itself.

5. **retrieveAccountHolder existence** (Claim 5.5) -- The interface doc lists `retrieveAccountHolder` but this method does not exist in the code.

6. **Warning message format** (Claim 6.3) -- Uses descriptive phrases rather than a generic template pattern.

7. **Payment method delete operation** (Claim 7.5) -- The responsibility doc claims "list, save, delete" for payment methods, but only `list` and `save` exist.

8. **Refund path missing rounding** (Claim 8.2) -- The aspect rule is not universally applied; the refund ceiling comparison omits rounding.
