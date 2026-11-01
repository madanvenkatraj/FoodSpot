import crypto from 'crypto';
import type { DatabaseSchema, UserRecord, UserRole, WorkspaceType } from './models';

const JWT_SECRET = process.env.JWT_SECRET || 'foodhub_production_jwt_secret_key_2026';
const DEFAULT_YANTRA_API_KEY =
  process.env.YANTRA_API_KEY || 'ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E';
const DEFAULT_YANTRA_WEBHOOK_SECRET =
  process.env.YANTRA_WEBHOOK_SECRET || 'whsec_yantra_foodhub_hmac_sha256_secret_2026';

// In-memory brute-force rate limiter (tracks failed login attempts per identifier)
interface RateLimitBucket {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

declare global {
  var _foodhubRateLimitMap: Map<string, RateLimitBucket> | undefined;
}

function getRateLimitMap(): Map<string, RateLimitBucket> {
  if (!global._foodhubRateLimitMap) {
    global._foodhubRateLimitMap = new Map<string, RateLimitBucket>();
  }
  return global._foodhubRateLimitMap;
}

export function checkLoginRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  const key = identifier.trim().toLowerCase();
  const map = getRateLimitMap();
  const now = Date.now();
  const bucket = map.get(key);

  if (!bucket) {
    return { allowed: true, remainingAttempts: 5, retryAfterSeconds: 0 };
  }

  if (bucket.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000),
    };
  }

  // Reset window if 15 minutes have elapsed since first failure
  if (now - bucket.firstFailureAt > 15 * 60 * 1000) {
    map.delete(key);
    return { allowed: true, remainingAttempts: 5, retryAfterSeconds: 0 };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, 5 - bucket.failures),
    retryAfterSeconds: 0,
  };
}

export function recordLoginFailure(identifier: string): {
  locked: boolean;
  failures: number;
  retryAfterSeconds: number;
} {
  const key = identifier.trim().toLowerCase();
  const map = getRateLimitMap();
  const now = Date.now();
  const existing = map.get(key);

  if (!existing || now - existing.firstFailureAt > 15 * 60 * 1000) {
    map.set(key, {
      failures: 1,
      firstFailureAt: now,
      lockedUntil: 0,
    });
    return { locked: false, failures: 1, retryAfterSeconds: 0 };
  }

  existing.failures += 1;
  if (existing.failures >= 5) {
    existing.lockedUntil = now + 15 * 60 * 1000; // 15-minute lockout
    map.set(key, existing);
    return {
      locked: true,
      failures: existing.failures,
      retryAfterSeconds: 15 * 60,
    };
  }

  map.set(key, existing);
  return { locked: false, failures: existing.failures, retryAfterSeconds: 0 };
}

export function clearLoginFailures(identifier: string): void {
  const key = identifier.trim().toLowerCase();
  getRateLimitMap().delete(key);
}

export function hashPassword(password: string): string {
  const salt = 'foodhub_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const computed = hashPassword(password);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

// RFC 6238 TOTP Authenticator Implementation (Base32 + HMAC-SHA1)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(length = 16): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += BASE32_ALPHABET[bytes[i] % 32];
  }
  return out;
}

function decodeBase32(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of cleaned) {
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val >= 0) {
      bits += val.toString(2).padStart(5, '0');
    }
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function computeTotpCode(secret: string, counterStep?: number): string {
  const step = counterStep ?? Math.floor(Date.now() / 1000 / 30);
  const key = decodeBase32(secret);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(step / 0x100000000), 0);
  counterBuf.writeUInt32BE(step >>> 0, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export function verifyTotpCode(secret: string, tokenInput: string): boolean {
  const cleaned = String(tokenInput || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  // Check current 30s window and ±1 adjacent windows for clock drift
  for (const offset of [-1, 0, 1]) {
    if (computeTotpCode(secret, currentStep + offset) === cleaned) {
      return true;
    }
  }
  return false;
}

export function generateRecoveryCodes(count = 6): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  workspace?: WorkspaceType;
  allowedWorkspaces?: WorkspaceType[];
  sessionId?: string;
  mfaVerified?: boolean;
  purpose?: 'session' | 'mfa_challenge';
  iat: number;
  exp: number;
}

export function signJwt(
  payload: {
    userId: string;
    email: string;
    name: string;
    role: UserRole;
    workspace?: WorkspaceType;
    allowedWorkspaces?: WorkspaceType[];
    sessionId?: string;
    mfaVerified?: boolean;
    purpose?: 'session' | 'mfa_challenge';
  },
  ttlSeconds = 7 * 24 * 3600
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const bodyObj: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(bodyObj)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (sig !== expectedSig) return null;
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtPayload;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function verifyWorkspaceSession(
  token: string | null | undefined,
  requiredWorkspace: WorkspaceType,
  db: DatabaseSchema
): {
  authorized: boolean;
  status: 200 | 401 | 403;
  reason?: string;
  user?: Omit<UserRecord, 'passwordHash'>;
  payload?: JwtPayload;
} {
  if (!token) {
    return {
      authorized: false,
      status: 401,
      reason: 'Authentication required. Please sign in to continue.',
    };
  }

  const cleaned = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const payload = verifyJwt(cleaned);
  if (!payload || payload.purpose === 'mfa_challenge') {
    return {
      authorized: false,
      status: 401,
      reason: 'Invalid or expired authentication session.',
    };
  }

  // Verify server-side session record if sessionId is present
  if (payload.sessionId && Array.isArray(db.sessions)) {
    const session = db.sessions.find((s) => s.id === payload.sessionId);
    if (!session) {
      return {
        authorized: false,
        status: 401,
        reason: 'Session not found on server. Please sign in again.',
      };
    }
    if (session.revokedAt) {
      return {
        authorized: false,
        status: 401,
        reason: 'This session has been logged out or revoked.',
      };
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return {
        authorized: false,
        status: 401,
        reason: 'Session has expired. Please sign in again.',
      };
    }
    if (session.workspace !== requiredWorkspace) {
      return {
        authorized: false,
        status: 403,
        reason: `Session was issued for ${session.workspace} workspace and cannot authorize ${requiredWorkspace} workspace.`,
      };
    }
    if (requiredWorkspace === 'admin' && !session.mfaVerified) {
      return {
        authorized: false,
        status: 403,
        reason: 'Multi-factor authentication (MFA) verification is required for Admin Console.',
      };
    }
  }

  // Revalidate live UserRecord permissions in database
  const user = db.users.find((u) => u.id === payload.userId);
  if (!user || !user.isActive) {
    return {
      authorized: false,
      status: 403,
      reason: 'User account is inactive or has been suspended.',
    };
  }

  const allowedWorkspaces: WorkspaceType[] = Array.isArray(user.allowedWorkspaces)
    ? user.allowedWorkspaces
    : user.role === 'admin'
      ? ['admin']
      : ['customer'];

  if (!allowedWorkspaces.includes(requiredWorkspace)) {
    return {
      authorized: false,
      status: 403,
      reason:
        requiredWorkspace === 'admin'
          ? 'Access Denied: Administrator Console permissions are required.'
          : 'Access Denied: Explicit Customer App workspace permission is required for this account.',
    };
  }

  if (requiredWorkspace === 'admin' && user.role !== 'admin') {
    return {
      authorized: false,
      status: 403,
      reason: 'Access Denied: Administrator role is required.',
    };
  }

  const { passwordHash: _ph, ...safeUser } = user;
  return {
    authorized: true,
    status: 200,
    user: safeUser,
    payload,
  };
}

export function generateTicketAccessToken(
  ticketNumber: string,
  customerEmail: string,
  apiKey: string = DEFAULT_YANTRA_API_KEY
): string {
  const normalizedTicket = ticketNumber.trim().toUpperCase();
  const normalizedEmail = customerEmail.trim().toLowerCase();
  const digest = crypto
    .createHmac('sha256', apiKey)
    .update(`${normalizedTicket}:${normalizedEmail}`)
    .digest('hex')
    .slice(0, 32);
  return `ytok_${digest}`;
}

export function verifyTicketAccessToken(params: {
  providedToken: string | null | undefined;
  ticketNumber: string;
  customerEmail: string;
  currentApiKey: string;
  storedAccessToken?: string;
}): boolean {
  const { providedToken, ticketNumber, customerEmail, currentApiKey, storedAccessToken } = params;
  if (!providedToken) return false;
  const expectedFromCurrentKey = generateTicketAccessToken(
    ticketNumber,
    customerEmail,
    currentApiKey
  );
  // Token must match the current API key derivation so rotating the key ends every token issued before rotation
  if (providedToken === expectedFromCurrentKey) {
    return true;
  }
  // Also allow upstream-issued tokens if storedAccessToken matches and begins with an upstream prefix while key hasn't rotated
  if (
    storedAccessToken &&
    providedToken === storedAccessToken &&
    !storedAccessToken.startsWith('ytok_') &&
    currentApiKey === DEFAULT_YANTRA_API_KEY
  ) {
    return true;
  }
  return false;
}

export function generateNewYantraApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
  const bytes = crypto.randomBytes(44);
  let suffix = '';
  for (let i = 0; i < 44; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `ytk_${suffix}`;
}

// Yantra Ticketing Rate Limiter: 10 per caller IP per 60s, 300 per API key per 60s
interface YantraWindowCounter {
  timestamps: number[];
}

declare global {
  var _yantraCallerRateMap: Map<string, YantraWindowCounter> | undefined;
  var _yantraKeyRateMap: Map<string, YantraWindowCounter> | undefined;
}

function getYantraRateMaps() {
  if (!global._yantraCallerRateMap) {
    global._yantraCallerRateMap = new Map<string, YantraWindowCounter>();
  }
  if (!global._yantraKeyRateMap) {
    global._yantraKeyRateMap = new Map<string, YantraWindowCounter>();
  }
  return {
    callerMap: global._yantraCallerRateMap,
    keyMap: global._yantraKeyRateMap,
  };
}

export function checkYantraRateLimit(
  callerIp: string,
  apiKey: string
): {
  allowed: boolean;
  retryAfterSeconds: number;
  callerCount: number;
  keyCount: number;
  reason?: string;
} {
  const { callerMap, keyMap } = getYantraRateMaps();
  const now = Date.now();
  const windowMs = 60 * 1000;

  const ipKey = (callerIp || '127.0.0.1').trim();
  const kKey = (apiKey || DEFAULT_YANTRA_API_KEY).trim();

  const callerBucket = callerMap.get(ipKey) || { timestamps: [] };
  callerBucket.timestamps = callerBucket.timestamps.filter((t) => now - t < windowMs);

  const keyBucket = keyMap.get(kKey) || { timestamps: [] };
  keyBucket.timestamps = keyBucket.timestamps.filter((t) => now - t < windowMs);

  if (callerBucket.timestamps.length >= 10) {
    const oldest = callerBucket.timestamps[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    callerMap.set(ipKey, callerBucket);
    return {
      allowed: false,
      retryAfterSeconds,
      callerCount: callerBucket.timestamps.length,
      keyCount: keyBucket.timestamps.length,
      reason: 'Rate limit exceeded: maximum 10 ticket/message write requests per caller IP every 60 seconds.',
    };
  }

  if (keyBucket.timestamps.length >= 300) {
    const oldest = keyBucket.timestamps[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    keyMap.set(kKey, keyBucket);
    return {
      allowed: false,
      retryAfterSeconds,
      callerCount: callerBucket.timestamps.length,
      keyCount: keyBucket.timestamps.length,
      reason: 'Rate limit exceeded: maximum 300 ticket/message write requests per API key every 60 seconds.',
    };
  }

  callerBucket.timestamps.push(now);
  keyBucket.timestamps.push(now);
  callerMap.set(ipKey, callerBucket);
  keyMap.set(kKey, keyBucket);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    callerCount: callerBucket.timestamps.length,
    keyCount: keyBucket.timestamps.length,
  };
}

export function resetYantraRateLimits(): void {
  const { callerMap, keyMap } = getYantraRateMaps();
  callerMap.clear();
  keyMap.clear();
}

export function getYantraCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-ticket-token',
    'Cache-Control': 'no-store',
  };
}

export function computeYantraWebhookSignature(
  rawBody: string,
  timestamp: number,
  secret: string = DEFAULT_YANTRA_WEBHOOK_SECRET
): string {
  const signedPayload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return `t=${timestamp},v1=${hmac}`;
}

export function verifyYantraWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string = DEFAULT_YANTRA_WEBHOOK_SECRET,
  toleranceSeconds = 300
): {
  valid: boolean;
  timestamp: number;
  reason?: string;
} {
  if (!signatureHeader) {
    return { valid: false, timestamp: 0, reason: 'Missing X-Yantra-Signature header' };
  }

  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.trim().split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {});

  const timestampStr = parts['t'];
  const signatureV1 = parts['v1'];

  if (!timestampStr || !signatureV1) {
    return {
      valid: false,
      timestamp: 0,
      reason: 'Invalid X-Yantra-Signature format. Expected t=<timestamp>,v1=<signature>',
    };
  }

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { valid: false, timestamp: 0, reason: 'Invalid signature timestamp value' };
  }

  const expectedWithTimestamp = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  const expectedRawOnly = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

  const sigBuf = Buffer.from(signatureV1, 'utf8');
  const exp1Buf = Buffer.from(expectedWithTimestamp, 'utf8');
  const exp2Buf = Buffer.from(expectedRawOnly, 'utf8');

  const matchesTimestamped =
    sigBuf.length === exp1Buf.length && crypto.timingSafeEqual(sigBuf, exp1Buf);
  const matchesRaw = sigBuf.length === exp2Buf.length && crypto.timingSafeEqual(sigBuf, exp2Buf);

  if (!matchesTimestamped && !matchesRaw) {
    return {
      valid: false,
      timestamp,
      reason: 'HMAC-SHA256 signature mismatch',
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return {
      valid: false,
      timestamp,
      reason: `Webhook timestamp outside ${toleranceSeconds}s replay tolerance window`,
    };
  }

  return { valid: true, timestamp };
}

export function getDefaultYantraSecrets() {
  return {
    apiKey: DEFAULT_YANTRA_API_KEY,
    webhookSecret: DEFAULT_YANTRA_WEBHOOK_SECRET,
    platformUrl: process.env.YANTRA_PLATFORM_URL || 'https://www.yantraaicofounder.com',
  };
}
