# Validator Responsibility

Structural validation and completeness checks. Implements E001–E016 (errors) and W001–W009 (warnings).

**In scope:**

- Structural errors block build-context. E001 from nodeParseErrors; E002–E016 for types, tags, relations, knowledge, mapping, cycles, artifacts, budget, templates. E010 structural-cycle: cycles involving at least one blackbox node are tolerated.
- Completeness warnings: W001–W009. W008 stale-knowledge uses Git commit timestamps.

**Out of scope:**

- Graph loading (cli/core/loader)
- Context building (cli/core/context)
