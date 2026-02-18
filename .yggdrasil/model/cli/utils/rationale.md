# Utils Rationale

**Reference:** docs/idea/engine.md (Drift hash, token estimate), tools.md (Path conventions)

Utils are **shared primitives** — functions used by multiple layers. Paths, hashing, token estimation. No business logic, no graph awareness beyond what's needed for the operation.

**Why findYggRoot throws:** No .yggdrasil/ means the project is not initialized. Continuing would produce confusing errors. Fail fast, fail clear. The message tells the user what to do: "Run 'yg init' first."

**Why SHA-256 for drift:** Simple, deterministic. File content → hash. Directory → sorted (path, hash) pairs → hash. Change anything, hash changes. No interpretation of *what* changed — that's the agent's job. Tools report the fact; agent assesses significance.

**Why ~4 chars per token:** No tokenizer dependency. The CLI runs in any Node environment. A heuristic is enough for budget monitoring (warning at 5000, error at 10000). Per-model tokenizers would add weight and version skew. The heuristic is documented, predictable, good enough for the purpose.
