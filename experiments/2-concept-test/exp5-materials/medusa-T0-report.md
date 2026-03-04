# Medusa Payment Module — Graph vs. Historical Code (T0) Accuracy Report

**Date:** 2026-03-03
**Graph source:** Context packages built from CURRENT code
**Historical code:** `medusa-payment-module-T0.ts`, `medusa-payment-provider-T0.ts` (~12 months prior)

---

## Methodology

Every distinct claim/statement in each artifact and aspect was extracted, then verified against the T0 source code. Each claim is marked:

- **ACCURATE** — The claim is fully supported by T0 code
- **PARTIALLY ACCURATE** — The claim is partly correct but missing nuance or has minor deviation
- **INACCURATE** — The claim does not match T0 code behavior

---

## 1. PaymentModuleService Node — Own Artifacts

### 1.1 constraints.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Capture ceiling: authorized - already captured | ACCURATE | T0 `capturePayment_` L693-699: `remainingToCapture = MathBN.sub(authorizedAmount, capturedAmount)` then `MathBN.gt(newCaptureAmount, remainingToCapture)` throws |
| 2 | The check uses `roundToCurrencyPrecision` on BOTH the new capture amount AND the remaining-to-capture amount | INACCURATE | T0 code does NOT call `roundToCurrencyPrecision` anywhere in `capturePayment_`. It uses raw `MathBN.gt` on unrounded values (L695). This function does not exist in T0. |
| 3 | Refund ceiling: captured amount, NOT authorized amount | ACCURATE | T0 `refundPayment_` L799-813: sums `capturedAmount` from captures, sums `refundedAmount` from refunds, checks `MathBN.lt(capturedAmount, totalRefundedAmount)` |
| 4 | Canceled payments cannot be captured | ACCURATE | T0 `capturePayment_` L671-676: checks `payment.canceled_at` and throws `MedusaError` immediately |
| 5 | Auto-capture coercion: sets session status to AUTHORIZED (not CAPTURED) | ACCURATE | T0 `authorizePaymentSession_` L556-558: `if (status === PaymentSessionStatus.CAPTURED) { status = PaymentSessionStatus.AUTHORIZED; autoCapture = true }` |
| 6 | Auto-capture creates the Payment record, then immediately calls `capturePayment` internally | ACCURATE | T0 L575-592: creates payment via `paymentService_.create`, then `if (autoCapture) { await this.capturePayment(...) }` |
| 7 | Auto-capture uses `is_captured: true` flag to skip the provider.capturePayment call | INACCURATE | T0 L588-589: `this.capturePayment({ payment_id: payment.id, amount: session.amount as BigNumberInput }, sharedContext)` — no `is_captured` flag. The provider IS called during auto-capture in T0. |
| 8 | Default capture amount: full authorized amount if no amount specified | ACCURATE | T0 L683-684: `if (!data.amount) { data.amount = payment.amount as number }` — `payment.amount` is the authorized amount |
| 9 | Default refund amount: full captured amount if no amount specified | INACCURATE | T0 L795-796: `if (!data.amount) { data.amount = payment.amount as BigNumberInput }` — defaults to `payment.amount` (the authorized amount), NOT the captured amount |
| 10 | Collection status is recomputed from scratch (not incremented) | ACCURATE | T0 `maybeUpdatePaymentCollection_` L882-956: reloads all sessions, captures, refunds and recomputes status from aggregated amounts |
| 11 | NOT_PAID when no sessions | ACCURATE | T0 L930-931: `paymentSessions.length === 0 ? PaymentCollectionStatus.NOT_PAID` |
| 12 | AWAITING when sessions exist but no authorizations | ACCURATE | T0 L932: default is `AWAITING` when sessions exist |
| 13 | PARTIALLY_AUTHORIZED when some authorized but not all | ACCURATE | T0 L937: `MathBN.gte(authorizedAmount, paymentCollection.amount)` for AUTHORIZED, else PARTIALLY_AUTHORIZED |
| 14 | AUTHORIZED when all authorized (authorizedAmount >= collectionAmount after rounding) | PARTIALLY ACCURATE | T0 L935: uses `MathBN.gte(authorizedAmount, paymentCollection.amount)` but does NOT use `roundToCurrencyPrecision` — the "after rounding" qualifier is wrong for T0 |
| 15 | COMPLETED when captured >= collectionAmount after rounding | PARTIALLY ACCURATE | T0 L940: uses `MathBN.eq(paymentCollection.amount, capturedAmount)` — uses equality, NOT `>=`, and does NOT round to currency precision. Two differences: eq vs gte, and no rounding. |

### 1.2 decisions.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Status recomputed from scratch instead of incrementing to eliminate state bugs | ACCURATE | T0 `maybeUpdatePaymentCollection_` reloads everything and recomputes — this design choice is clearly present |
| 2 | Refund ceiling uses captured amount not authorized because authorization is a hold not a transfer | ACCURATE | T0 refund logic enforces `capturedAmount >= totalRefunded` |
| 3 | `authorizePaymentSession` is idempotent: if session already has payment + authorized_at, returns existing | ACCURATE | T0 L489-493: `if (session.payment && session.authorized_at) { return serialize(session.payment) }` |
| 4 | Local record created before provider call; its ID used as idempotency key | ACCURATE | T0 `createPaymentSession` L343-353: creates local session first, then calls provider with `idempotency_key: paymentSession.id`. Same for capture (L708-731) and refund (L816-843). |
| 5 | If provider call fails, local record is cleaned up | ACCURATE | T0 createPaymentSession catch block L371-385 deletes session. capturePayment catch L645-649 deletes capture. refundPayment catch L772-774 deletes refund. |
| 6 | BigNumber for monetary amounts because JS floating-point `0.1 + 0.2 !== 0.3` | ACCURATE | T0 imports and uses BigNumber/MathBN throughout all monetary operations |
| 7 | `Intl.NumberFormat` for currency precision detection | INACCURATE | T0 code does NOT contain any reference to `Intl.NumberFormat` or `roundToCurrencyPrecision`. This function does not exist in the T0 file. |
| 8 | Unknown currencies: full precision preserved (safe fallback) | INACCURATE | Same as above — no currency-precision-aware rounding exists in T0 code at all |

### 1.3 responsibility.md (own-level)

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Central orchestration service for all payment operations | ACCURATE | T0 class is the main module service implementing `IPaymentModuleService` |
| 2 | Coordinates between local DB (entity services) and external providers (PaymentProviderService) | ACCURATE | T0 uses injected entity services + `paymentProviderService_` throughout |
| 3 | Creating, updating, deleting payment sessions with provider sync and dual rollback | ACCURATE | T0 has `createPaymentSession`, `updatePaymentSession`, `deletePaymentSession` with try/catch rollback patterns |
| 4 | Authorizing sessions, creating Payment records, handling auto-capture | ACCURATE | T0 `authorizePaymentSession` + `authorizePaymentSession_` with auto-capture logic |
| 5 | Capturing payments (full and partial) with currency-precision ceiling enforcement | PARTIALLY ACCURATE | Full and partial capture exists (L610-718) but ceiling does NOT use currency-precision rounding in T0 |
| 6 | Refunding with captured-amount ceiling, not authorized-amount | ACCURATE | T0 L799-813 |
| 7 | Canceling payments with provider notification | ACCURATE | T0 `cancelPayment` L856-878 calls provider then updates local |
| 8 | Recomputing PaymentCollection derived status after every state change | ACCURATE | `maybeUpdatePaymentCollection_` called after authorize, capture, refund |
| 9 | CRUD for payment collections, providers, account holders, payment methods | ACCURATE | All present in T0: createPaymentCollections, updatePaymentCollections, listPaymentProviders, createAccountHolder, listPaymentMethods, etc. |
| 10 | Webhook event translation | ACCURATE | T0 `getWebhookActionAndData` L1172-1182 |

### 1.4 state.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Status is recomputed from aggregate amounts after every operation | ACCURATE | T0 `maybeUpdatePaymentCollection_` recomputes from all sessions/captures/refunds |
| 2 | `authorizedAmount = sum of all AUTHORIZED session amounts` | ACCURATE | T0 L915-918: iterates `paymentSessions`, sums amounts where `status === AUTHORIZED` |
| 3 | `capturedAmount = sum of all capture amounts across all payments` | ACCURATE | T0 L921-923 |
| 4 | `refundedAmount = sum of all refund amounts across all payments` | ACCURATE | T0 L925-927 |
| 5 | `capturedAmount >= collectionAmount` (after currency rounding) triggers COMPLETED | INACCURATE | T0 L940 uses `MathBN.eq(paymentCollection.amount, capturedAmount)` — exact equality, NOT `>=`. No rounding. |
| 6 | Session: PENDING -> AUTHORIZED on authorization | ACCURATE | T0 L557-565: sets status to AUTHORIZED, updates session |
| 7 | Session: PENDING -> ERROR / REQUIRES_MORE on failure | ACCURATE | T0 L507-511: updates session with failed status from provider |
| 8 | If provider returns CAPTURED during auth, session set to AUTHORIZED (coerced) | ACCURATE | T0 L556-558 |
| 9 | Payment: captured_at = null (authorization only) | ACCURATE | Payment created without captured_at at L575-585 |
| 10 | Payment: captured_at = Date (when fully captured) | ACCURATE | T0 L740: `captured_at: isFullyCaptured ? new Date() : undefined` |
| 11 | Payment: canceled_at = Date (terminal state) | ACCURATE | T0 L873-874: sets `canceled_at: new Date()` |

### 1.5 node.yaml

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Type is "service" | ACCURATE | T0 class extends MedusaService, implements IPaymentModuleService |
| 2 | Relation: uses payment/payment-provider | ACCURATE | T0 constructor injects `paymentProviderService` and calls it throughout |
| 3 | Consumes: createSession, authorizePayment, capturePayment, refundPayment, cancelPayment, deleteSession | ACCURATE | All six methods called in T0: createSession (L349), authorizePayment (L495), capturePayment (L726), refundPayment (L836), cancelPayment (L527,866), deleteSession (L373,457) |

---

## 2. PaymentProviderService Node — Own Artifacts

### 2.1 interface.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | `retrieveProvider(providerId): IPaymentProvider` resolves from container by key `pp_${providerId}` | PARTIALLY ACCURATE | T0 L55-57: resolves via `this.__container__[providerId]`. The providerId is passed as-is; the `pp_` prefix is added by the CALLER (e.g., `getWebhookActionAndData` in payment-module L1176: `pp_${eventData.provider}`). The provider service itself does NOT add the prefix. |
| 2 | Throws with user-friendly message on AwilixResolutionError | ACCURATE | T0 L59-63: catches `AwilixResolutionError`, throws with formatted message |
| 3 | `createSession(providerId, sessionInput: InitiatePaymentInput) -> InitiatePaymentOutput` | ACCURATE | T0 L73-80 |
| 4 | `updateSession(providerId, sessionInput: UpdatePaymentInput) -> UpdatePaymentOutput` | ACCURATE | T0 L82-89 |
| 5 | `deleteSession(providerId, input: DeletePaymentInput) -> DeletePaymentOutput` | ACCURATE | T0 L91-97 |
| 6 | `authorizePayment(providerId, input: AuthorizePaymentInput) -> AuthorizePaymentOutput` | ACCURATE | T0 L99-105 |
| 7 | `getStatus(providerId, input: GetPaymentStatusInput) -> GetPaymentStatusOutput` | ACCURATE | T0 L107-113 |
| 8 | `capturePayment(providerId, input: CapturePaymentInput) -> CapturePaymentOutput` | ACCURATE | T0 L115-121 |
| 9 | `cancelPayment(providerId, input: CancelPaymentInput) -> CancelPaymentOutput` | ACCURATE | T0 L123-129 |
| 10 | `refundPayment(providerId, input: RefundPaymentInput) -> RefundPaymentOutput` | ACCURATE | T0 L131-137 |
| 11 | `createAccountHolder` — gracefully degrades if not implemented | ACCURATE | T0 L139-152: checks `!provider.createAccountHolder`, logs warning, returns empty |
| 12 | `retrieveAccountHolder` — gracefully degrades | INACCURATE | T0 does NOT have a `retrieveAccountHolder` method at all. The method does not exist in T0 payment-provider.ts. |
| 13 | `updateAccountHolder` — gracefully degrades | ACCURATE | T0 L154-167 |
| 14 | `deleteAccountHolder` — gracefully degrades | ACCURATE | T0 L169-182 |
| 15 | `listPaymentMethods` — gracefully degrades | ACCURATE | T0 L184-197 |
| 16 | `savePaymentMethod` — gracefully degrades | ACCURATE | T0 L199-212 |
| 17 | `getWebhookActionAndData(providerId, data) -> WebhookActionResult` | ACCURATE | T0 L214-221 |

### 2.2 errors.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | `retrieveProvider` wraps AwilixResolutionError with user-friendly message | ACCURATE | T0 L59-63 |
| 2 | Original error is logged at error level for debugging | PARTIALLY ACCURATE | T0 L67: logs at error level, but only for NON-AwilixResolutionError. For AwilixResolutionError specifically, it does NOT log the original error — it just throws a new message. The error-level logging is for the generic catch path. |
| 3 | Account holder ops (create, retrieve, update, delete) are optional | PARTIALLY ACCURATE | Create, update, delete are optional in T0. `retrieve` does not exist in T0 at all. |
| 4 | Payment method ops (list, save) are optional | ACCURATE | T0 L184-212: both check method existence and log warning |
| 5 | Logs warning: `Provider ${providerId} does not support ${operation}` | ACCURATE | T0 L146, L160, L175, L190, L205: all log warnings with this pattern |
| 6 | Returns empty object or empty array (not an error) | ACCURATE | T0: returns `{}` or `[]` depending on operation |
| 7 | Delete payment method mentioned in "payment method operations (list, save, delete)" | INACCURATE | T0 does NOT have a `deletePaymentMethod` method. Only `list` and `save` exist for payment methods. |

### 2.3 responsibility.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Adapter layer between payment module and external providers | ACCURATE | T0 resolves providers and delegates all calls |
| 2 | Translates internal calls into provider-specific API calls | ACCURATE | Each method resolves provider then calls its method |
| 3 | Resolving provider implementations from the container | ACCURATE | T0 `retrieveProvider` L55-70 |
| 4 | Forwarding session lifecycle operations (create, update, delete, authorize, capture, refund, cancel) | ACCURATE | All present in T0 |
| 5 | Forwarding account holder operations (create, update, delete) | ACCURATE | T0 L139-182 |
| 6 | Forwarding payment method operations (list, save, delete) | PARTIALLY ACCURATE | `list` and `save` exist, but `delete` does NOT exist in T0 |
| 7 | Webhook action resolution | ACCURATE | T0 L214-221 |
| 8 | Passing through idempotency keys in context | PARTIALLY ACCURATE | The provider service itself does NOT handle idempotency keys — it simply forwards whatever input it receives. The keys are set by the payment-module caller, not by the provider service. The service is transparent to them. |
| 9 | Out of scope: business logic | ACCURATE | No business logic in T0 provider service |
| 10 | Out of scope: transaction management | ACCURATE | No transaction decorators in T0 provider service |
| 11 | Out of scope: direct database access | PARTIALLY ACCURATE | T0 extends `MedusaInternalService(PaymentProvider)` which gives it database access for the PaymentProvider entity itself (list, listAndCount). So it does have some DB access for provider records. |

---

## 3. Aspect: currency-precision

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | All monetary arithmetic uses BigNumber/MathBN (never native JS numbers) | ACCURATE | T0 uses BigNumber/MathBN throughout all monetary calculations |
| 2 | Monetary COMPARISONS require rounding to currency decimal precision before comparing | INACCURATE | T0 code does NOT perform any currency-precision rounding. All comparisons use raw MathBN operations (gt, gte, eq, lt) without rounding. |
| 3 | JPY has 0 decimal places; USD has 2 | ACCURATE | This is factual currency information (not code-specific) |
| 4 | `roundToCurrencyPrecision(amount, currencyCode)` uses `Intl.NumberFormat` | INACCURATE | This function does NOT exist in T0 code. No reference to `Intl.NumberFormat` or `roundToCurrencyPrecision` anywhere in either file. |
| 5 | For unknown currencies, full precision is kept | INACCURATE | The function doesn't exist in T0 — this claim is moot |
| 6 | ALWAYS round both sides of any monetary comparison | INACCURATE | T0 never rounds any side of any comparison |
| 7 | Never compare raw BigNumber values directly for monetary equality | INACCURATE | T0 `maybeUpdatePaymentCollection_` L940: `MathBN.eq(paymentCollection.amount, capturedAmount)` compares raw values directly |
| 8 | Rounding happens at comparison time, not storage time | INACCURATE | No rounding happens at all in T0 |

---

## 4. Aspect: idempotent-provider-calls

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Every provider call includes `idempotency_key` in context | PARTIALLY ACCURATE | Most do, but `updateSession` (L423-431) does NOT pass an idempotency_key. `deleteSession` (L457-459) does not either. `deletePaymentSession` has no idempotency key. |
| 2 | createSession: `idempotency_key = paymentSession.id` | ACCURATE | T0 L353: `idempotency_key: paymentSession!.id` |
| 3 | authorizePayment: `idempotency_key = session.id` | ACCURATE | T0 L499: `idempotency_key: session.id` |
| 4 | capturePayment: `idempotency_key = capture.id` (capture created first) | ACCURATE | T0 L731: `idempotency_key: capture?.id` — capture is created at L708-715 before provider call |
| 5 | refundPayment: `idempotency_key = refund.id` (refund created first) | ACCURATE | T0 L842: `idempotency_key: refund.id` — refund created at L816-827 before provider call |
| 6 | cancelPayment: `idempotency_key = payment.id` | ACCURATE | T0 L869: `idempotency_key: payment.id` |
| 7 | createAccountHolder: `idempotency_key = customer.id` | ACCURATE | T0 L1015: `idempotency_key: input.context?.customer?.id` |
| 8 | Local record created BEFORE provider call | ACCURATE | Pattern consistently followed for createSession, capturePayment, refundPayment |
| 9 | If provider call fails, local record rolled back | ACCURATE | Catch blocks delete local records (L378-383, L645-649, L772-774) |
| 10 | If provider succeeds but local update fails, retry with same key is safe | ACCURATE | Logical consequence of the idempotency key pattern — architecturally sound |

---

## 5. Aspect: dual-rollback

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | createPaymentSession: (1) create local, (2) call provider, (3) update local | ACCURATE | T0 L342-388: creates session (L343-347), calls provider (L349-360), updates session (L362-370) |
| 2 | createPaymentSession: if provider fails, delete local session | ACCURATE | T0 L378-383: deletes session in catch |
| 3 | createPaymentSession: if local update fails, delete provider-side session then delete local | ACCURATE | T0 L372-383: if `providerPaymentSession` exists, calls deleteSession first, then deletes local |
| 4 | authorizePaymentSession: (1) call provider, (2) create payment + update session | ACCURATE | T0 L495-501: calls provider.authorizePayment, then L520-525: creates payment + updates session in `authorizePaymentSession_` |
| 5 | authorizePaymentSession: if local write fails, call provider.cancelPayment | ACCURATE | T0 L527-533: catch block calls `cancelPayment` on provider |
| 6 | capturePayment: (1) create local capture, (2) call provider | ACCURATE | T0 L708-715 creates capture, then L726-733 calls provider |
| 7 | capturePayment: if provider fails, delete local capture | ACCURATE | T0 L645-649: deletes capture in catch |
| 8 | refundPayment: (1) create local refund, (2) call provider | ACCURATE | T0 L816-827 creates refund, then L836-845 calls provider |
| 9 | refundPayment: if provider fails, delete local refund | PARTIALLY ACCURATE | T0 L773: `await super.deleteRefunds(data.payment_id, sharedContext)` — deletes ALL refunds for the payment, not just the new one. This is broader than "delete local refund record." |
| 10 | Invariant: local record ALWAYS created first, deleted on failure | ACCURATE | Consistent pattern across all operations |
| 11 | Provider NEVER called without local record to reference | PARTIALLY ACCURATE | `authorizePaymentSession` calls `provider.authorizePayment` BEFORE creating the local Payment record (the session already exists but the payment does not). The invariant as stated is slightly misleading for authorization. |

---

## 6. Hierarchy: payment (parent) responsibility.md

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Payment collection management (grouping payments for a cart/order) | ACCURATE | T0 has full CRUD for PaymentCollection |
| 2 | Payment session lifecycle (create, update, authorize, delete) | ACCURATE | All present in T0 |
| 3 | Payment capture (full and partial, with currency-precision comparison) | PARTIALLY ACCURATE | Full and partial capture exist but NO currency-precision comparison in T0 |
| 4 | Refund processing (with ceiling enforcement against captured amount) | ACCURATE | T0 L809 |
| 5 | Payment cancellation | ACCURATE | T0 L856-878 |
| 6 | Derived collection status computation | ACCURATE | `maybeUpdatePaymentCollection_` |
| 7 | Account holder management | ACCURATE | T0 L999-1095 |
| 8 | Webhook handling | ACCURATE | T0 L1172-1182 |
| 9 | Out of scope: provider-specific API implementations | ACCURATE | Delegated to PaymentProviderService |
| 10 | Out of scope: cart/order management, tax, fulfillment | ACCURATE | Not present in T0 |

---

## 7. Flow: Payment Lifecycle (description.md)

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Business context: customer selects payment, authorizes, merchant captures, refunds possible | ACCURATE | Reflected in T0 code flow |
| 2 | Trigger: checkout creates PaymentCollection + PaymentSession | ACCURATE | Methods exist in T0 |
| 3 | Happy path: createPaymentSession -> authorizePaymentSession -> capturePayment | ACCURATE | T0 flow matches |
| 4 | Collection status: NOT_PAID -> AWAITING -> AUTHORIZED -> COMPLETED | ACCURATE | T0 `maybeUpdatePaymentCollection_` implements these transitions |
| 5 | Partial capture: multiple capturePayment calls | ACCURATE | T0 supports partial capture with amount parameter |
| 6 | Collection status transitions through PARTIALLY_AUTHORIZED before COMPLETED | ACCURATE | T0 L937: PARTIALLY_AUTHORIZED when `authorizedAmount < collectionAmount` |
| 7 | Auto-capture: provider returns CAPTURED, handler sets session to AUTHORIZED, creates Payment, calls capturePayment internally | ACCURATE | T0 L556-592 |
| 8 | From caller's perspective, authorize returns Payment with captured_at set | PARTIALLY ACCURATE | The auto-capture calls `capturePayment` which sets `captured_at` only if `isFullyCaptured`. Since it passes the full session amount, it will be fully captured, so captured_at is set. However, the payment object returned from `authorizePaymentSession_` is the original `payment` variable (L594) which was created BEFORE auto-capture — it may not reflect the updated `captured_at` since the capture updates the payment separately. The serialization at L543-545 may or may not re-fetch. |
| 9 | Refund ceiling: total refunded <= total captured | ACCURATE | T0 L809 |
| 10 | Refunded_amount tracked but does not affect collection status | ACCURATE | T0 L925-927 computes refundedAmount, L949 stores it, but it's not used in status determination |
| 11 | cancelPayment: call provider.cancel, set canceled_at | ACCURATE | T0 L866-874 |
| 12 | Canceled payments cannot be captured (guard check) | ACCURATE | T0 L671-676 |
| 13 | Provider failure: local records deleted | ACCURATE | Catch blocks throughout |
| 14 | Authorization failure: provider payment is canceled | ACCURATE | T0 L527-533 |
| 15 | Every provider call includes idempotency key | PARTIALLY ACCURATE | Same as aspect analysis — most do, but updateSession and deleteSession do not |
| 16 | Local record created BEFORE provider call | ACCURATE | Consistent pattern |
| 17 | Monetary comparisons always use roundToCurrencyPrecision | INACCURATE | T0 does not use roundToCurrencyPrecision at all |
| 18 | Collection status recomputed from scratch after every capture/refund | ACCURATE | `maybeUpdatePaymentCollection_` called after authorize, capture, refund |
| 19 | Refund ceiling is captured amount, NOT authorized amount | ACCURATE | T0 L799-813 |
| 20 | authorizePaymentSession is idempotent | ACCURATE | T0 L489-493 |

---

## Summary Tables

### Per-Artifact Accuracy

| Artifact | Total Claims | Accurate | Partial | Inaccurate | Accuracy % |
|----------|-------------|----------|---------|------------|------------|
| PM constraints.md | 15 | 9 | 2 | 4 | 60.0% |
| PM decisions.md | 8 | 6 | 0 | 2 | 75.0% |
| PM responsibility.md (own) | 10 | 9 | 1 | 0 | 90.0% |
| PM state.md | 11 | 9 | 0 | 2 | 81.8% |
| PM node.yaml | 3 | 3 | 0 | 0 | 100.0% |
| PP interface.md | 17 | 15 | 1 | 1 | 88.2% |
| PP errors.md | 7 | 4 | 2 | 1 | 57.1% |
| PP responsibility.md | 11 | 8 | 3 | 0 | 72.7% |
| Hierarchy responsibility.md | 10 | 9 | 1 | 0 | 90.0% |
| **Subtotal (artifacts)** | **92** | **72** | **10** | **10** | **78.3%** |

### Per-Aspect Accuracy

| Aspect | Total Claims | Accurate | Partial | Inaccurate | Accuracy % |
|--------|-------------|----------|---------|------------|------------|
| currency-precision | 8 | 2 | 0 | 6 | 25.0% |
| idempotent-provider-calls | 10 | 9 | 1 | 0 | 90.0% |
| dual-rollback | 11 | 9 | 2 | 0 | 81.8% |
| **Subtotal (aspects)** | **29** | **20** | **3** | **6** | **69.0%** |

### Flow Accuracy

| Flow | Total Claims | Accurate | Partial | Inaccurate | Accuracy % |
|------|-------------|----------|---------|------------|------------|
| Payment Lifecycle | 20 | 16 | 2 | 2 | 80.0% |

### Overall Summary

| Category | Total Claims | Accurate | Partial | Inaccurate | Accuracy % |
|----------|-------------|----------|---------|------------|------------|
| Node artifacts | 92 | 72 | 10 | 10 | 78.3% |
| Aspects | 29 | 20 | 3 | 6 | 69.0% |
| Flow | 20 | 16 | 2 | 2 | 80.0% |
| **GRAND TOTAL** | **141** | **108** | **15** | **18** | **76.6%** |

**Counting PARTIALLY ACCURATE as half-correct:**
- Effective accuracy = (108 + 15*0.5) / 141 = 115.5 / 141 = **81.9%**

---

## Key Decay Patterns

### 1. Currency-Precision Rounding (Dominant source of inaccuracy)

The `roundToCurrencyPrecision` function and `Intl.NumberFormat` usage do NOT exist in T0 code. This is the single largest cluster of inaccuracies — 10+ claims across constraints.md, decisions.md, state.md, the currency-precision aspect, and the flow all reference rounding behavior that was added AFTER T0. This represents a feature that was added to the codebase in the 12-month window.

### 2. Auto-Capture `is_captured` Flag

The graph claims auto-capture uses an `is_captured: true` flag to skip the provider call. T0 does NOT have this flag — it calls the provider during auto-capture. This is a behavioral change introduced after T0.

### 3. COMPLETED Status Threshold

T0 uses `MathBN.eq(paymentCollection.amount, capturedAmount)` (exact equality) to determine COMPLETED status. The graph claims `capturedAmount >= collectionAmount` (with rounding). Two separate changes: the comparator changed from `eq` to `gte`, and rounding was added.

### 4. Default Refund Amount

The graph claims default refund amount is the "full captured amount." T0 defaults to `payment.amount` which is the authorized amount, not captured.

### 5. `retrieveAccountHolder` Method

The graph lists this method on PaymentProviderService, but it does not exist in T0. It was added after T0.

### 6. `deletePaymentMethod` Operation

The graph mentions `delete` as a payment method operation, but T0 only has `list` and `save`.
