import { Injectable } from '@nestjs/common';

/**
 * Configuration for a rate-limited endpoint group.
 */
export interface EndpointGroupConfig {
  /** Group identifier: 'auth' | 'api' | 'upload' | 'default' */
  name: string;
  /** Maximum requests allowed within the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

/**
 * Prefix matching rule used internally to resolve route paths to endpoint groups.
 */
interface PrefixRule {
  prefixes: string[];
  group: string;
}

/**
 * Static rate limit configuration and endpoint group resolution.
 *
 * Acts as the single source of truth for rate limit parameters — no other
 * component defines or overrides limits. Configuration is in-memory and
 * static per deployment (no hot-reload, no database-backed config).
 */
@Injectable()
export class RateLimitConfig {
  /**
   * Endpoint group definitions. Limits are static per deployment.
   */
  private readonly groups: Map<string, EndpointGroupConfig> = new Map([
    ['auth', { name: 'auth', limit: 5, windowMs: 60_000 }],
    ['api', { name: 'api', limit: 100, windowMs: 60_000 }],
    ['upload', { name: 'upload', limit: 10, windowMs: 60_000 }],
    ['default', { name: 'default', limit: 60, windowMs: 60_000 }],
  ]);

  /**
   * Prefix matching rules, evaluated in order. First match wins.
   * Order: auth -> upload -> api -> default.
   */
  private readonly prefixRules: PrefixRule[] = [
    { prefixes: ['/auth/', '/login', '/register'], group: 'auth' },
    { prefixes: ['/upload/', '/import/'], group: 'upload' },
    { prefixes: ['/api/'], group: 'api' },
  ];

  /**
   * Resolves a route path to its endpoint group configuration.
   *
   * Matching is prefix-based, evaluated in order: auth -> upload -> api -> default.
   * The first match wins. If no prefix matches, returns the `default` group.
   *
   * @param path - The route path from the HTTP request (e.g., `/auth/login`, `/api/users`)
   * @returns The EndpointGroupConfig for the matched group
   */
  resolveGroup(path: string): EndpointGroupConfig {
    for (const rule of this.prefixRules) {
      for (const prefix of rule.prefixes) {
        if (path.startsWith(prefix)) {
          return this.groups.get(rule.group)!;
        }
      }
    }
    return this.groups.get('default')!;
  }

  /**
   * Returns the configuration for a named endpoint group.
   *
   * If the group name is not recognized, returns the `default` group configuration.
   *
   * @param group - Endpoint group name ('auth', 'api', 'upload', 'default')
   * @returns The EndpointGroupConfig for the specified group
   */
  getConfig(group: string): EndpointGroupConfig {
    return this.groups.get(group) ?? this.groups.get('default')!;
  }

  /**
   * Returns all configured endpoint groups.
   * Used for monitoring and admin inspection.
   *
   * @returns Array of all EndpointGroupConfig objects
   */
  getAllGroups(): EndpointGroupConfig[] {
    return Array.from(this.groups.values());
  }
}
