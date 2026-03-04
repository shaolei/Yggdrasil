# Experiment 8: Scale / Emergent Cross-Node Properties -- Findings

## Scoring Matrix

### Per-Question Scores (Completeness / Accuracy / Cross-node / Rationale / Actionability)

| Question | Agent A (Full Graph) | Agent B (Single Node) | Agent C (Raw Code) |
|----------|---------------------|-----------------------|--------------------|
| Q1 (getTeamMember impact) | 4/5/5/5/5 = 24 | 3/4/3/3/3 = 16 | 5/5/4/3/5 = 22 |
| Q2 (invitation to collection) | 5/5/5/5/5 = 25 | 3/4/4/4/3 = 18 | 5/5/4/3/5 = 22 |
| Q3 (pessimistic to optimistic) | 5/5/5/5/5 = 25 | 4/5/3/5/4 = 21 | 5/5/4/3/5 = 22 |
| Q4 (removed user visibility) | 5/5/5/4/5 = 24 | 4/4/3/3/3 = 17 | 5/5/5/3/5 = 23 |
| Q5 (PubSub failure) | 4/3/5/4/4 = 20 | 3/3/2/3/3 = 14 | 5/5/4/3/5 = 22 |

### Aggregate Scores

| Dimension      | Agent A (Full Graph) | Agent B (Single Node) | Agent C (Raw Code) |
|----------------|---------------------|-----------------------|--------------------|
| Completeness   | 23                  | 17                    | 25                 |
| Accuracy       | 23                  | 21                    | 25                 |
| Cross-node     | 25                  | 15                    | 21                 |
| Rationale      | 23                  | 18                    | 15                 |
| Actionability  | 24                  | 16                    | 25                 |
| **TOTAL**      | **118/125**         | **86/125**            | **109/125**        |

---

## Per-Question Analysis

### Q1: getTeamMember Impact Analysis

**Agent A (Full Graph) -- Score: 24/25**

Identified four direct consumers (TeamCollectionService, TeamEnvironmentsService, TeamInvitationService, AdminService via getTeamMemberTE) with precise detail on what each consumer uses the result for. Correctly distinguished between null-check consumers and role-inspecting consumers. Traced cascading effects through the team-member-lifecycle flow and team-ownership aspect. Identified the resolver/guard layer as an additional impact area, though it acknowledged these are "outside graph but affected." The analysis of behavior changes (e.g., returning empty object instead of null) was insightful and accurate.

Deduction: Did not enumerate specific guard classes or provide exact line numbers. The guard impact was acknowledged as existing but not inventoried. Lost 1 point on completeness.

**Agent B (Single Node) -- Score: 16/25**

Could only confirm TeamCollectionService as a direct consumer with certainty. Inferred TeamEnvironmentsService and TeamInvitationService from the team-ownership aspect description but explicitly flagged these as uncertain. Correctly identified the access pattern (null check for CLI gating) and the fp-ts variant consideration. However, the analysis was narrow by necessity -- the answer repeatedly flagged its own limitations ("I do not have context packages for TeamEnvironmentsService, TeamInvitationService, or TeamRequestService").

Strengths: Honest about confidence levels (high/medium/low). The PubSub event chain inference was creative but speculative.

Weaknesses: Could not identify AdminService as a consumer. Could not confirm guard-layer impact. Could not trace the team-member-lifecycle flow. Cross-node reasoning was limited to what the team-ownership aspect mentioned in passing.

**Agent C (Raw Code) -- Score: 22/25**

Found the most comprehensive list of call sites: 18 total, including 8 guard classes that neither Agent A nor Agent B identified by name. Provided exact file paths and line numbers for every call site. Correctly distinguished between truthiness checks and role-reading consumers. Identified internal TeamService callers (leaveTeam, getRoleOfUserInTeam, getTeamMemberTE) that Agent A mentioned only partially.

The guard inventory was uniquely valuable: GqlTeamMemberGuard, RESTTeamMemberGuard, GqlCollectionTeamMemberGuard, GqlRequestTeamMemberGuard, GqlTeamEnvTeamGuard, TeamInviteViewerGuard, TeamInviteTeamOwnerGuard, MockRequestGuard. These represent the actual authorization enforcement layer and are absent from the graph.

Deduction: Lacked the "why" dimension. Did not explain the architectural rationale for the null-check pattern, did not reference the team-ownership or role-based-access aspects as design principles, and did not trace flow-level implications. The analysis was thorough on WHAT but thin on WHY.

**Best representation for Q1:** Agent C for completeness and accuracy (guards are the real authorization layer). Agent A for understanding the architectural significance of the change. The ideal answer would combine both.

---

### Q2: Invitation to First Collection Flow

**Agent A (Full Graph) -- Score: 25/25**

Produced the most complete end-to-end trace across four services. Correctly ordered the validation chain within acceptInvitation (invitation existence, email matching, already-member re-check). Described the pessimistic locking transaction in createCollection with the correct lock mechanism (lockTeamCollectionByTeamAndParent). Identified all four PubSub events in chronological order. Correctly noted that VIEWER role blocks collection creation at the resolver/guard layer. The service dependency chain diagram was accurate and complete.

Outstanding detail: The race condition guard explanation ("even though this was checked at invitation creation time, the service re-verifies") demonstrates understanding of the concurrency concern. The pessimistic locking detail in collection creation (orderIndex assignment within a transaction) was precise.

**Agent B (Single Node) -- Score: 18/25**

Strong on the invitation acceptance phase (correctly traced the validation chain, role assignment at creation time, idempotency guard). Correctly identified the boundary between what the single context could answer and what it could not -- explicitly marking collection creation as "[CONTEXT BOUNDARY -- below is inferred, not directly documented]."

The answer correctly inferred from the team-ownership aspect that collections are team-scoped and from role-based-access that VIEWERs cannot create collections. However, the collection creation flow itself was largely absent: no detail on title validation, pessimistic locking, orderIndex assignment, or the transaction boundary. The flow diagram was incomplete beyond the invitation acceptance.

**Agent C (Raw Code) -- Score: 22/25**

Traced the complete flow with code-level precision. Identified the exact Prisma call in addMemberToTeam, the exact validation order in acceptInvitation (with a noteworthy difference from Agent A: Agent C showed already-member check before email check, while Agent A showed email check first -- Agent C's order matches the actual code at lines 205-210). Provided the exact PubSub topic patterns (e.g., `team/${teamID}/member_added` vs Agent A's vaguer "PubSub team membership channel").

The collection creation section was detailed: exact parameter order for createCollection, exact validation sequence, the orderIndex calculation logic, the lockTeamCollectionByTeamAndParent call, and the TEAM_COLL_CREATION_FAILED error for transaction failures.

Deduction on rationale: Agent C noted "the service itself does NOT enforce role-based access control" and "Role authorization is expected to be enforced at the resolver/controller layer" but did not explain WHY this architectural separation exists. Agent A's explanation of the role-based-access aspect as a deliberate design choice was more illuminating.

Notable finding: Agent C identified the email invitation template detail (`action_url` pointing to `${VITE_BASE_URL}/join-team?id=${inviteID}`) which neither other agent mentioned.

**Best representation for Q2:** Agent A for the complete architectural narrative. Agent C for code-level accuracy. Agent C caught an ordering detail (already-member check before email check) that Agent A got wrong -- a significant accuracy finding.

---

### Q3: Pessimistic to Optimistic Locking

**Agent A (Full Graph) -- Score: 25/25**

Identified both affected modules (TeamCollectionService and TeamRequestService) correctly from the graph aspect declarations. Enumerated all locking operations in both services (7 for collections, 4 for requests). Proposed three concrete options for the replacement mechanism (per-row versioning, sibling-set version counter, post-update checksum) and recommended Option B with justification. The risk analysis was thorough and well-categorized by severity.

Most critically, Agent A quoted the design rationale directly from the pessimistic-locking aspect: "optimistic locking would be impractical -- a single conflicting row would invalidate the entire batch." This is the architectural decision that the graph captures and that makes this question answerable with authority.

The analysis of two-parent move operations, import reliability, and the isParent stale-check problem demonstrated genuine cross-node architectural reasoning.

**Agent B (Single Node) -- Score: 21/25**

Correctly identified all 7 locking operations in TeamCollectionService with accurate detail. Correctly identified the retry-on-deadlock aspect interaction. Quoted the same architectural rationale from the pessimistic-locking aspect. The per-operation analysis of what would change was thorough for the collection service.

However, Agent B could not see TeamRequestService at all. It explicitly acknowledged this: "Other services that may share the pessimistic-locking aspect (TeamRequestService, TeamEnvironmentsService, etc.) are mentioned in the team-ownership aspect but their locking behavior is not visible from this context package." This is a significant gap for a question about a system-wide pattern change.

The risk analysis was strong but limited to the collection domain. The "architecturally unsound" conclusion was well-reasoned from the available evidence.

**Agent C (Raw Code) -- Score: 22/25**

Found the exact locking implementations: 8 call sites in TeamCollectionService and 4 in TeamRequestService, with verification that TeamService, TeamEnvironmentsService, and AdminService use zero lock calls. Provided the actual SQL pattern from PrismaService. Identified the specific TOCTOU race in TeamService.updateTeamAccessRole that neither graph-based agent noticed.

The per-module change analysis was practical and code-grounded. The risk assessment covered high-contention starvation, multi-row atomicity loss, cross-collection move danger, sort fragility, and cascade delete gaps.

Deduction on rationale: Agent C did not surface the explicit architectural decision that pessimistic locking was chosen deliberately. Its recommendation ("The switch would be justified only if the database has a strong reason to avoid row locks") is sensible but lacks the graph's recorded WHY. Agent A's answer was stronger because it could say "the architecture was explicitly designed around pessimistic locking for good reason" and quote the rationale.

**Best representation for Q3:** Agent A for architectural completeness and rationale. Agent C for the TOCTOU finding and precise call-site count. Agent B was surprisingly strong on depth within its single node, nearly matching Agent A for the collection service.

---

### Q4: Removed User Collection Visibility

**Agent A (Full Graph) -- Score: 24/25**

Traced the complete access control chain: removal deletes TeamMember record, collections persist with teamID only (no creatorID), CLI access checks via getTeamMember, GraphQL access enforced by guards. Correctly identified both removal paths (leaveTeam, admin removal) and the user deletion cascade. Noted getCollectionTreeForCLI's lack of userUid parameter as a potential ambiguity.

Provided the strongest "no per-collection ACL" evidence by synthesizing multiple graph sources: team-ownership aspect ("no cross-team sharing"), role-based-access aspect (team-level roles only), and the absence of any ACL-related artifacts in the TeamCollectionService context.

Deduction: Did not identify the specific guard classes (GqlTeamMemberGuard, GqlCollectionTeamMemberGuard, RESTTeamMemberGuard) by name. The answer referred to "NestJS guard / resolver" generically. Lost 1 point on rationale because it documented the access model clearly but did not explain WHY collections lack creator tracking (design choice or oversight?).

**Agent B (Single Node) -- Score: 17/25**

Correctly identified the CLI access path denial and the absence of creatorID. Honestly flagged the GraphQL path as uncertain: "No (via CLI). Unknown/depends on resolver layer (via GraphQL)." This is accurate given the context available -- the single node context does not contain guard implementations.

The two-pattern analysis (Pattern A: general queries with no service-level check, Pattern B: CLI with membership check) was well-structured. The information gaps section was particularly honest and valuable.

Weaknesses: Could not confirm the GraphQL guard chain, could not confirm the complete removal mechanism, and could not confirm the Prisma schema (no creatorID field). All of these were inferences rather than confirmations.

**Agent C (Raw Code) -- Score: 23/25**

The most definitive answer of the three. Quoted the actual Prisma schema for TeamCollection, proving there is no creatorUid/createdBy field. Identified all three guard classes by name with file paths. Traced the exact authorization chain: JwtAuthGuard -> GqlTeamMemberGuard/GqlCollectionTeamMemberGuard -> teamService.getTeamMember -> prisma.teamMember.findUnique. Identified the RESTTeamMemberGuard for the REST search endpoint and the AdminService bypass path.

Notable unique finding: Identified the `isOwnerCheck` method as misleadingly named (checks collection-to-team ownership, not user-to-collection ownership) with the exact code.

Deduction on rationale: Did not explain WHY the system uses team-level rather than per-resource ACLs. The analysis was purely descriptive: "here is what the code does" without "here is why it was designed this way."

**Best representation for Q4:** Agent C for definitive evidence (schema quote, guard enumeration). Agent A for the cross-cutting aspect synthesis. Agent B was weakest here because the single-node context genuinely lacked the guard implementations needed to answer the question fully.

---

### Q5: PubSub Failure Impact

**Agent A (Full Graph) -- Score: 20/25**

Identified all 7 PubSub-publishing services with their event types. Correctly stated the "AFTER transaction commit" timing pattern. Classified all operations as degrading gracefully (notification loss only).

**Critical error:** Concluded "No operations FAIL COMPLETELY due to PubSub outage." This is factually wrong. Agent C found 4 operations that DO fail: UserService.updateUserSessions (awaited, in try/catch, returns error), UserService.updateUserDisplayName (awaited, in try/catch, returns error), UserService.deleteUserByUID (chained in TaskEither pipeline, short-circuits on error), and AdminService.inviteUserToSignInViaEmail (awaited, no try/catch, propagates as 500). Additionally, Agent C identified that moveCollection publishes INSIDE the $transaction callback, creating a transaction rollback risk.

Agent A's error stems from reasoning at the aspect level rather than the code level. The pubsub-events aspect says events are published "AFTER the database transaction commits." This is true for most call sites but not all -- the aspect description generalizes over implementation details that matter. Agent A trusted the graph's abstraction and missed the exceptions.

The user-visible symptoms section was well-organized and the severity assessments were reasonable (given the incorrect premise that all operations degrade gracefully).

**Agent B (Single Node) -- Score: 14/25**

Limited to TeamCollectionService's PubSub usage. Correctly listed the 5 collection event channels and noted TeamService events as an indirect dependency. The timing analysis was accurate for the collection service.

However, Agent B explicitly acknowledged it could not determine whether PubSub failures cause operation failures or notification loss only: "This is the critical question, and the context package does not provide a definitive answer." This honest uncertainty is more accurate than Agent A's incorrect certainty, but it still leaves the question substantially unanswered.

Could not analyze UserService, AdminService, TeamRequestService, or TeamInvitationService PubSub behavior. The analysis covered roughly 1/7 of the system.

**Agent C (Raw Code) -- Score: 22/25**

Produced the most detailed and accurate analysis. Inventoried all 28 PubSub publish call sites across all 7 services with exact line numbers. Made the critical distinction between `await`ed and fire-and-forget publish calls -- a distinction that determines whether PubSub failures cause operation failures.

Key findings unique to Agent C:
1. UserService.updateUserSessions and updateUserDisplayName use `await` inside try/catch, meaning PubSub failure returns an error to the caller despite the DB write succeeding.
2. UserService.deleteUserByUID chains the publish in a TaskEither pipeline, meaning PubSub failure short-circuits the pipeline after the user is already deleted.
3. AdminService.inviteUserToSignInViaEmail uses `await` without try/catch, meaning PubSub failure propagates as a 500 error.
4. TeamCollectionService.moveCollection publishes INSIDE the $transaction callback (lines 776, 825), meaning a synchronous throw could roll back the transaction.
5. The remaining 22 call sites are fire-and-forget and degrade gracefully.

The summary table (3 awaited in try/catch + 1 awaited without try/catch + 2 inside $transaction + 22 fire-and-forget = 28 total) was precise and actionable.

Deduction on rationale: Did not explain the architectural reasoning for why some services await PubSub while others fire-and-forget. Did not reference any design decision or aspect that explains this inconsistency.

**Best representation for Q5:** Agent C by a significant margin. This question exposed the graph's abstraction gap most clearly -- the pubsub-events aspect's universal "AFTER transaction commit" description masked critical implementation differences that only raw code analysis could reveal.

---

## Key Findings

### 1. Emergent Properties Test

The full graph DID enable cross-node reasoning that individual contexts or raw code could not replicate in certain ways:

**Where full graph excelled:**
- Q1: Tracing the team-member-lifecycle flow across multiple services to understand cascading effects of changing getTeamMember. No other agent could describe the flow-level implications.
- Q2: Synthesizing the complete invitation-to-collection journey by stitching together four service contexts plus three aspects. The result was a coherent narrative rather than disconnected code traces.
- Q3: Quoting the explicit architectural rationale for pessimistic locking from the aspect documentation. This rationale is not present in the code and would require interviewing the original developers to reconstruct.
- Q4: Synthesizing team-ownership and role-based-access aspects to provide principled reasoning about why collections lack per-user ACLs.

**Specific emergent insights that appeared only with the full graph:**
- The team-member-lifecycle flow as a six-path process model (Q1)
- The team-ownership aspect as a cross-cutting invariant that explains collection access patterns (Q1, Q4)
- The explicit rejection of optimistic locking with documented rationale (Q3)
- The pubsub-events aspect as a universal timing contract (Q5 -- though this led to an incorrect conclusion)

**Where the emergent value was limited:**
- The graph's aspect-level abstractions sometimes obscured implementation details that matter (Q5: the "AFTER transaction commit" generalization missed awaited publish calls)
- The graph did not model guards or resolvers as nodes, creating a systematic blind spot in authorization analysis (Q1, Q4)
- Cross-node reasoning was powerful for understanding architectural intent but weaker for predicting exact failure modes

### 2. Where Each Representation Excels

**Full graph is best for:**
- Understanding WHY the system is designed as it is (rationale from aspects, flows, config)
- Tracing business processes that cross multiple services (flows map participant roles)
- Identifying the blast radius of interface changes through declared relations
- Answering architectural what-if questions (Q3: should we switch locking strategies?)
- Providing coherent narratives that connect isolated components into a system story

**Single node is best for:**
- Deep analysis of one component when that is sufficient for the question
- Honest uncertainty: Agent B consistently flagged what it could and could not confirm, producing no false positives
- Questions where the answer is contained within one service's boundary (none of the 5 test questions fell into this category, which is by design -- the experiment selected cross-node questions)

**Raw code is best for:**
- Exhaustive call-site enumeration (finding every consumer of an API)
- Distinguishing implementation details that abstractions flatten (awaited vs fire-and-forget PubSub)
- Identifying authorization enforcement mechanisms (guards, decorators) that the graph does not model
- Verifying schema-level facts (Prisma schema for creatorID absence)
- Finding edge cases and inconsistencies (moveCollection publishing inside $transaction)

### 3. Where Each Representation Fails

**Full graph misses:**
- Guard/resolver implementations (the real authorization enforcement layer)
- Await vs fire-and-forget distinctions in PubSub publishing
- Internal callers within a service (e.g., leaveTeam calling getTeamMember within TeamService itself)
- Code-level inconsistencies that contradict aspect-level generalizations
- Test files that exercise the behavior under discussion
- Exact call-site counts and line numbers

**Single node misses:**
- Everything outside its context boundary (by definition)
- Cross-service flows except what can be inferred from declared dependencies
- System-wide patterns -- it can see the aspect definition but not which other nodes share it
- Guard implementations, resolver logic, and other infrastructure layers

**Raw code misses:**
- Architectural rationale (WHY was pessimistic locking chosen? WHY are there no per-collection ACLs?)
- Business process context (what does the team-member-lifecycle represent?)
- Design decisions that are not encoded in the code itself
- Intent behind patterns that could be coincidental vs deliberate
- The abstraction layer that makes a 200-file codebase navigable

### 4. The Guard/Resolver Blind Spot

Agent C found 8 guard classes and 3 resolvers that directly call `getTeamMember` for authorization enforcement. The graph does not model any of these. This is a significant gap because:

1. **Guards are the real authorization enforcement layer.** The services themselves largely trust their callers (TeamCollectionService.createCollection has no auth check). The guards are where team membership and role verification actually happen for GraphQL and REST endpoints.

2. **The gap affects impact analysis accuracy.** Agent A identified 4 direct service consumers of getTeamMember. Agent C identified 18 total call sites (including 8 guards, 3 internal TeamService methods, and the same 4 service consumers). The graph-based blast radius is 4/18 = 22% of the actual blast radius.

3. **Guards use the return value differently than services.** Services mostly do null-checks (existence). Guards read `teamMember.role` for RBAC. A change that preserves the null/non-null semantics but modifies the role field would break guards silently while appearing safe from the graph-only analysis.

4. **The MockRequestGuard is an entirely separate domain.** Mock server access control depends on getTeamMember for TEAM-type workspaces. The graph does not capture this cross-domain dependency at all.

**Significance:** High. For any question about authorization, access control, or API contract changes, the guard/resolver blind spot means the graph provides an incomplete picture. The graph models services but not the infrastructure that connects services to user-facing APIs.

**Recommended fix:** Model guards as nodes (or at least as declared consumers in service node.yaml relations) so that impact analysis captures the full authorization chain.

### 5. The Accuracy Paradox (Q5)

Agent A concluded "no operations fail" while Agent C found 4 that do (plus 2 with transaction rollback risk). This is the most striking finding of the experiment.

**What happened:**
- The pubsub-events aspect states: "Events are published AFTER the database transaction commits successfully."
- Agent A trusted this aspect-level description and generalized it to all operations.
- In reality, 4 out of 28 publish calls use `await` (making them failure-propagating), and 2 are inside `$transaction` callbacks (making them potential transaction-aborters).
- The aspect description is correct for the majority of cases (22/28) but incorrect for 6/28.

**What this tells us about abstraction layers:**

1. **Aspects describe the intended pattern, not every implementation.** The pubsub-events aspect documents the *design intent* (fire-and-forget after commit). Some implementations deviate from this intent -- perhaps accidentally (UserService awaiting the publish might be a bug), perhaps deliberately (AdminService might have had a reason to await).

2. **Graph-level reasoning inherits graph-level errors.** If the graph is inaccurate, the agent trusting it will be inaccurate. Agent A's confidence was higher than its accuracy because the graph gave it authoritative-sounding but incomplete information.

3. **Code-level analysis is self-correcting.** Agent C could not be misled by an aspect description because it examined each call site independently. The `await` keyword is a fact that cannot be abstracted away.

4. **This is a fundamental tension in knowledge representation.** Abstractions enable reasoning at scale but sacrifice precision. The graph enables an agent to understand the system architecture in minutes, but that understanding may contain inaccuracies that only code analysis can reveal.

**Recommended fixes:**
- Enhance the pubsub-events aspect to note exceptions to the fire-and-forget pattern
- Add a validation check that compares aspect claims against actual implementations
- Consider modeling "await vs fire-and-forget" as a node-level artifact when PubSub is used

---

## Implications for Yggdrasil

### 1. Graph enhancements that would close the identified gaps

**a. Guard/resolver modeling.** The most impactful enhancement would be to model guards and resolvers as nodes or at minimum as declared consumers in service relations. Currently, the graph captures service-to-service dependencies but not the infrastructure layer between services and APIs. This could be:
- New node type: `guard` or `resolver` (fine-grained but high maintenance)
- Extended relations: Allow service nodes to declare `consumed_by` relations to guard files (lower maintenance)
- File mapping expansion: Map guard files to the service node that implements the protected logic

**b. Aspect exception tracking.** Aspects currently describe universal patterns. When implementations deviate from the aspect pattern, there is no mechanism to record these deviations. A per-node "aspect overrides" or "aspect exceptions" field would allow the graph to capture "this node follows pubsub-events EXCEPT that it awaits the publish call."

**c. Schema-level facts.** The graph's data model descriptions (e.g., "TeamCollection.teamID -- collection belongs to team") are accurate but do not include all schema fields. Recording the full set of fields (or at least the absence of notable fields like creatorID) would strengthen access-control analysis.

**d. Internal method call graphs.** The graph models inter-service calls but not intra-service calls. For TeamService, the fact that leaveTeam, getRoleOfUserInTeam, and getTeamMemberTE all call getTeamMember is not captured. A lightweight "internal dependencies" artifact could address this.

### 2. When is full-graph context genuinely superior?

The full graph was genuinely superior for:
- **Architectural change analysis** (Q3): Understanding whether a change contradicts an explicit design decision requires the rationale that only the graph stores.
- **Cross-service flow tracing** (Q2): Following a business process across 4 services is natural with the graph and laborious with code.
- **Blast radius estimation at the service level** (Q1): The graph's declared relations provide a fast approximation of which services are affected.
- **Understanding design principles** (Q4): The team-ownership and role-based-access aspects explain the system's access model in terms that code analysis cannot surface.

The graph is most valuable when the question is "should we do this?" rather than "what exactly will break?" -- it excels at architectural reasoning and struggles at implementation precision.

### 3. When is raw code analysis necessary?

Raw code analysis is necessary when:
- **Exact call-site enumeration** is needed (Q1: guards, Q5: all PubSub sites)
- **Implementation details matter** (Q5: await vs fire-and-forget)
- **Schema verification** is required (Q4: absence of creatorID)
- **Edge cases and inconsistencies** must be found (Q5: moveCollection inside $transaction)
- **The question asks "what WILL break?" rather than "what MIGHT break?"**

In practice, this means that for code modification tasks (as opposed to architectural planning), raw code analysis should supplement graph-based context. The graph gets you 80% of the answer in 20% of the time; the code gets you the remaining 20% of the answer.

### 4. Optimal strategy for different question types

| Question Type | Recommended Strategy |
|---|---|
| **Impact analysis (API change)** | Full graph for blast radius + raw code for guard/resolver call sites |
| **End-to-end flow tracing** | Full graph (flows + aspects) for the narrative + raw code for exact validation ordering |
| **Architectural what-if** | Full graph (aspects contain rationale); raw code only if the aspect accuracy is in question |
| **Access control / authorization** | Raw code is essential (guards are unmodeled); graph aspects provide the design intent |
| **Failure mode analysis** | Raw code is essential (error handling, await patterns, transaction boundaries are code-level concerns) |
| **Single-component deep dive** | Single node context is sufficient if the question does not cross boundaries |
| **"Should we do X?"** | Full graph (rationale + aspects); code is secondary |
| **"What breaks if we do X?"** | Full graph for service-level + raw code for infrastructure-level |

### 5. Scoring interpretation

The aggregate scores (Agent A: 118, Agent B: 86, Agent C: 109) should be interpreted carefully:

- **Agent A vs Agent C gap (9 points):** Agent A wins on cross-node reasoning (+4) and rationale (+8) but loses on completeness (-2) and accuracy (-2). The gap would widen on architectural questions and narrow on implementation questions.

- **Agent B's consistent weakness:** The 86 score reflects a structural limitation, not an analytical one. Agent B was often the most honest about its uncertainties and made fewer false claims than Agent A. Its low score reflects that single-node context is fundamentally insufficient for cross-node questions -- which is the expected result for this experiment.

- **Agent C's rationale weakness:** Agent C scored 15/25 on rationale across all questions. This is the most consistent gap and the one most amenable to graph enhancement. The code cannot tell you WHY pessimistic locking was chosen; it can only show you HOW it is implemented.

- **The Q5 accuracy inversion:** Agent A scored 3/5 on accuracy for Q5 while Agent C scored 5/5. This is the most concerning finding: the full graph produced a confidently wrong answer while raw code produced the correct one. The graph's abstraction layer actively misled the agent. This suggests that Yggdrasil needs a mechanism to validate aspect claims against actual implementations -- otherwise the graph can become a source of confident inaccuracy rather than reliable knowledge.
