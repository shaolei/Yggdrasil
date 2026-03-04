# C5 — Wrong Rationale (HIGH subtlety)

## Subtlety: HIGH

## What was changed

### Modified files
1. **model/team-collections/team-collection-service/decisions.md** — "Why orderIndex is integer-based, not fractional" section replaced

### Nature of the contradiction

The original rationale:
> Integer orderIndex with gap-filling (decrement on delete, shift on reorder) requires
> touching multiple rows on every mutation but guarantees contiguous, predictable indexes.
> Fractional ordering avoids touching siblings but eventually requires rebalancing when
> precision is exhausted. For a real-time collaborative tool where consistency matters more
> than write throughput, integer ordering is simpler to reason about.

The fabricated rationale:
> Integer orderIndex was chosen because the Prisma ORM used by Hoppscotch has poor support
> for decimal/float columns in PostgreSQL. Prisma's `Decimal` type maps to `@db.Decimal`
> which introduces significant overhead in serialization and comparison operations, and
> Prisma's query builder does not support `updateMany` with arithmetic on float columns
> reliably — rounding errors can cause `WHERE orderIndex > 3.5` to miss or include
> unexpected rows. Using integers avoids these ORM-layer precision issues entirely.

### Why the fabricated rationale is plausible but wrong

1. Prisma's Decimal handling IS somewhat awkward (it returns strings, not numbers) — this is
   a real pain point that developers encounter
2. Float precision issues ARE a legitimate concern in databases
3. The rationale mentions specific Prisma features (`@db.Decimal`, `updateMany`) that sound
   like real implementation constraints
4. It shifts the reason from an ARCHITECTURAL choice (contiguity invariant, algorithmic
   simplicity) to an ORM LIMITATION (Prisma can't handle floats well)

### What makes this HIGH subtlety

1. Only ONE section of ONE file is changed — everything else is identical
2. The fabricated rationale is internally consistent and uses accurate Prisma terminology
3. The real reason (contiguity + simplicity) is an architectural preference, which is harder
   to verify than a technical limitation
4. An agent would need to either:
   a. Know Prisma well enough to know that Decimal support actually works fine for this use case
   b. Recognize that the constraints.md already gives the real reason (contiguity invariant)
      and notice the mismatch between "chosen for contiguity" vs "chosen to avoid ORM issues"
5. The fabricated rationale does not contradict any other artifact directly — it provides a
   DIFFERENT reason, not a CONFLICTING fact

### Cross-artifact tension (subtle, not contradiction)
- constraints.md says orderIndex contiguity is "critical for predictable cursor-based
  pagination and drag-and-drop UI" — this implies the REASON for integer ordering is the
  contiguity guarantee, not ORM limitations
- The fabricated rationale frames it as an ORM workaround, not an architectural choice
- This is a tension in reasoning, not a factual contradiction

## Expected detection: Very hard. Requires noticing the subtle mismatch between "chosen for architectural reasons" (implied by constraints.md) vs "chosen to work around ORM limitations" (stated in modified decisions.md).
