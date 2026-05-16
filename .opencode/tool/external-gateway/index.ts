/**
 * External Intelligence Gateway
 *
 * Centralized proxy for all outbound HTTP calls. Enforces:
 *   - Provider whitelisting (only approved domains may be queried)
 *   - Response caching to .opencode/cache/external/
 *   - Provenance tracking on every response
 *   - Rate limit management per provider
 *
 * Usage:
 *   import { ExternalGateway } from "./tool/external-gateway/index.ts";
 *   const gateway = new ExternalGateway();
 *   const result = await gateway.fetch("npm", "/package/next-auth/latest");
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GatewayResponse<T = unknown> {
  data: T;
  source: string;
  retrieved_at: string;
  cache_hit: boolean;
  confidence: number;
  verification_status: "external-verified" | "cached" | "stale";
}

export interface GatewayError {
  provider: string;
  endpoint: string;
  error: string;
  timestamp: string;
}

interface ProviderConfig {
  baseUrl: string;
  rateLimit: number;   // max requests per minute
  cacheTtlMs: number;  // how long to cache responses
  headers?: Record<string, string>;
}

// ── Whitelisted Providers ─────────────────────────────────────────────────────

const PROVIDERS: Record<string, ProviderConfig> = {
  npm: {
    baseUrl: "https://registry.npmjs.org",
    rateLimit: 60,
    cacheTtlMs: 60 * 60 * 1000, // 1 hour
  },
  "osv.dev": {
    baseUrl: "https://api.osv.dev/v1",
    rateLimit: 30,
    cacheTtlMs: 6 * 60 * 60 * 1000, // 6 hours
  },
  github: {
    baseUrl: "https://api.github.com",
    rateLimit: 30,
    cacheTtlMs: 30 * 60 * 1000, // 30 minutes
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  },
  "github-advisories": {
    baseUrl: "https://api.github.com/advisories",
    rateLimit: 30,
    cacheTtlMs: 6 * 60 * 60 * 1000, // 6 hours
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  },
  snyk: {
    baseUrl: "https://api.snyk.io/v1",
    rateLimit: 20,
    cacheTtlMs: 12 * 60 * 60 * 1000, // 12 hours
  },
  caniuse: {
    baseUrl: "https://raw.githubusercontent.com/Fyrd/caniuse/main",
    rateLimit: 10,
    cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  },
};

// ── Cache Layer ───────────────────────────────────────────────────────────────

const CACHE_DIR = path.resolve(
  process.cwd(),
  ".opencode/cache/external"
);

function getCacheKey(provider: string, endpoint: string): string {
  return crypto
    .createHash("sha256")
    .update(`${provider}:${endpoint}`)
    .digest("hex");
}

function getCachePath(cacheKey: string): string {
  return path.join(CACHE_DIR, `${cacheKey}.json`);
}

interface CacheEntry<T> {
  data: T;
  provider: string;
  endpoint: string;
  retrieved_at: string;
  expires_at: string;
}

function readCache<T>(cacheKey: string, ttlMs: number): CacheEntry<T> | null {
  const cachePath = getCachePath(cacheKey);
  if (!fs.existsSync(cachePath)) return null;

  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    const entry: CacheEntry<T> = JSON.parse(raw);
    const expiresAt = new Date(entry.expires_at).getTime();
    if (Date.now() > expiresAt) return null; // expired
    return entry;
  } catch {
    return null;
  }
}

function writeCache<T>(
  cacheKey: string,
  provider: string,
  endpoint: string,
  data: T,
  ttlMs: number
): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  const entry: CacheEntry<T> = {
    data,
    provider,
    endpoint,
    retrieved_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  };
  fs.writeFileSync(getCachePath(cacheKey), JSON.stringify(entry, null, 2));
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────

const requestTimestamps: Record<string, number[]> = {};

function checkRateLimit(provider: string, limit: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const timestamps = requestTimestamps[provider] ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  requestTimestamps[provider] = recent;
  if (recent.length >= limit) return false;
  requestTimestamps[provider].push(now);
  return true;
}

// ── Gateway ───────────────────────────────────────────────────────────────────

export class ExternalGateway {
  /**
   * Fetch data from a whitelisted provider.
   *
   * @param provider - One of the keys in PROVIDERS
   * @param endpoint - Path relative to the provider's baseUrl
   * @param options  - Optional fetch overrides
   */
  async fetch<T = unknown>(
    provider: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<GatewayResponse<T>> {
    const config = PROVIDERS[provider];
    if (!config) {
      throw new Error(
        `[ExternalGateway] Provider "${provider}" is not whitelisted. ` +
        `Allowed: ${Object.keys(PROVIDERS).join(", ")}`
      );
    }

    const cacheKey = getCacheKey(provider, endpoint);

    // Try cache first
    const cached = readCache<T>(cacheKey, config.cacheTtlMs);
    if (cached) {
      return {
        data: cached.data,
        source: provider,
        retrieved_at: cached.retrieved_at,
        cache_hit: true,
        confidence: 0.9,
        verification_status: "cached",
      };
    }

    // Rate limit check
    if (!checkRateLimit(provider, config.rateLimit)) {
      throw new Error(
        `[ExternalGateway] Rate limit exceeded for provider "${provider}". ` +
        `Limit: ${config.rateLimit} requests/min.`
      );
    }

    // Live fetch
    const url = `${config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "User-Agent": "OpenAgentsControl/1.0",
      ...config.headers,
      ...(options.headers as Record<string, string> ?? {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      throw new Error(
        `[ExternalGateway] ${provider} returned ${response.status} for "${endpoint}"`
      );
    }

    const data = (await response.json()) as T;
    const retrievedAt = new Date().toISOString();

    // Persist to cache
    writeCache(cacheKey, provider, endpoint, data, config.cacheTtlMs);

    return {
      data,
      source: provider,
      retrieved_at: retrievedAt,
      cache_hit: false,
      confidence: 1.0,
      verification_status: "external-verified",
    };
  }

  /**
   * Convenience: fetch npm package metadata.
   */
  async getNpmPackage(packageName: string): Promise<GatewayResponse> {
    return this.fetch("npm", `/${encodeURIComponent(packageName)}`);
  }

  /**
   * Convenience: query OSV.dev for vulnerabilities affecting a package@version.
   */
  async getOsvVulnerabilities(
    ecosystem: string,
    packageName: string,
    version?: string
  ): Promise<GatewayResponse> {
    const body = version
      ? { version, package: { name: packageName, ecosystem } }
      : { package: { name: packageName, ecosystem } };

    return this.fetch("osv.dev", "/query", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Post a comment on a GitHub PR (requires GITHUB_TOKEN env var).
   * Returns the comment URL on success.
   */
  async postPrComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<GatewayResponse<{ html_url: string }>> {
    const token = process.env["GITHUB_TOKEN"];
    if (!token) {
      throw new Error(
        "[ExternalGateway] GITHUB_TOKEN not set — cannot post PR comment. " +
        "Set GITHUB_TOKEN in your environment."
      );
    }

    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${prNumber}/comments`;
    return this.fetch<{ html_url: string }>("github", endpoint, {
      method: "POST",
      body: JSON.stringify({ body }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });
  }

  /**
   * List all whitelisted providers.
   */
  listProviders(): string[] {
    return Object.keys(PROVIDERS);
  }
}
