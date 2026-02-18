# IO Errors

Parsers throw `Error` on:

- Missing file: ENOENT
- Invalid YAML: parse error
- Missing required fields: `config.yaml: missing 'name'`, `node.yaml: missing 'name'`, etc.
- Invalid relation types, mapping types

No dedicated error codes — all as standard Error with message.
