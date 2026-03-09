# Timing-Safe Comparison

## What

All password hash comparisons must use `crypto.timingSafeEqual()` to compare the computed hash against the stored hash. Both buffers must be verified to have equal length before comparison.

## Why

Naive string comparison (`===`) leaks information about how many bytes matched via timing differences. An attacker can use this to brute-force passwords one byte at a time, dramatically reducing the search space. Constant-time comparison ensures the operation takes the same time regardless of how many bytes match.

## Where Applied

- Local strategy password authentication (authenticateLocalStrategy)
- API key comparison uses HMAC indexing rather than direct comparison, which sidesteps timing attacks by design — the lookup is by index, not by comparing the raw key.
