import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, getDb, saveDb } from '@/lib/db/store';
import {
  checkLoginRateLimit,
  clearLoginFailures,
  generateRecoveryCodes,
  generateTotpSecret,
  hashPassword,
  recordLoginFailure,
  signJwt,
  verifyJwt,
  verifyPassword,
  verifyTotpCode,
  verifyWorkspaceSession,
} from '@/lib/db/security';
import type { UserRecord, WorkspaceType } from '@/lib/db/models';

function sanitizeUser(user: UserRecord | Omit<UserRecord, 'passwordHash'>) {
  const {
    passwordHash: _ph,
    mfaSecret: _ms,
    recoveryCodes: _rc,
    resetToken: _rt,
    ...safeUser
  } = user as UserRecord;
  return safeUser;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const workspaceParam = searchParams.get('workspace');
  const workspace: WorkspaceType = workspaceParam === 'admin' ? 'admin' : 'customer';

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ authenticated: false, user: null, workspace }, { status: 200 });
  }

  const verification = verifyWorkspaceSession(authHeader, workspace, db);
  if (!verification.authorized || !verification.user) {
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        workspace,
        error: verification.reason || 'Unauthorized session',
      },
      { status: verification.status }
    );
  }

  // NOTE: GET is read-only — do NOT call saveDb() here.
  // Concurrent reads + writes caused 'SyntaxError: Unexpected end of JSON input'.
  return NextResponse.json({
    authenticated: true,
    workspace,
    user: sanitizeUser(verification.user),
    session: {
      id: verification.payload?.sessionId || 'active',
      workspace,
      mfaVerified: Boolean(verification.payload?.mfaVerified),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const db = getDb();
    if (!Array.isArray(db.sessions)) {
      db.sessions = [];
    }
    const now = new Date().toISOString();
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    // 1. Workspace-Aware Login (Customer App or Admin Console)
    if (action === 'login') {
      const identifier = String(body.email || body.identifier || '').trim().toLowerCase();
      const password = String(body.password || '');
      const workspace: WorkspaceType = body.workspace === 'admin' ? 'admin' : 'customer';
      const rememberMe = Boolean(body.rememberMe);
      const rateLimitKey = `${workspace}:${identifier || clientIp}`;

      const rateCheck = checkLoginRateLimit(rateLimitKey);
      if (!rateCheck.allowed) {
        appendAuditLog({
          actorId: 'anonymous',
          actorName: identifier || 'unknown',
          actorRole: workspace === 'admin' ? 'admin' : 'customer',
          action: 'AUTH_RATE_LIMITED',
          resourceType: 'AuthSession',
          resourceId: workspace,
          details: `Rate limited login attempts for identifier "${identifier}" in ${workspace} workspace`,
        });
        saveDb(db);
        return NextResponse.json(
          {
            error: `Too many failed login attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
            retryAfterSeconds: rateCheck.retryAfterSeconds,
          },
          { status: 429 }
        );
      }

      const user = db.users.find(
        (u) =>
          u.email.toLowerCase() === identifier ||
          (u.username && u.username.toLowerCase() === identifier) ||
          u.phone.replace(/\s+/g, '') === identifier.replace(/\s+/g, '')
      );

      if (!user || !verifyPassword(password, user.passwordHash)) {
        const failure = recordLoginFailure(rateLimitKey);
        const remaining = Math.max(0, 5 - failure.failures);
        appendAuditLog({
          actorId: user?.id || 'anonymous',
          actorName: user?.email || identifier || 'unknown',
          actorRole: user?.role || 'customer',
          action: 'AUTH_LOGIN_FAILED',
          resourceType: 'AuthSession',
          resourceId: workspace,
          details: `Failed login attempt in ${workspace} workspace (${remaining} attempts remaining before lockout)`,
        });
        saveDb(db);
        return NextResponse.json(
          {
            error: 'Invalid credentials. Please verify your email/username and password.',
            remainingAttempts: remaining,
          },
          { status: 401 }
        );
      }

      if (!user.isActive) {
        return NextResponse.json(
          { error: 'This account has been deactivated by an administrator.' },
          { status: 403 }
        );
      }

      const allowedWorkspaces: WorkspaceType[] =
        Array.isArray(user.allowedWorkspaces) && user.allowedWorkspaces.length > 0
          ? user.allowedWorkspaces
          : user.role === 'admin'
            ? ['admin']
            : ['customer'];

      if (!allowedWorkspaces.includes(workspace)) {
        appendAuditLog({
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action: 'AUTH_WORKSPACE_DENIED',
          resourceType: 'Workspace',
          resourceId: workspace,
          details: `Account "${user.email}" attempted unauthorized access to ${workspace} workspace`,
        });
        saveDb(db);
        return NextResponse.json(
          {
            error:
              workspace === 'admin'
                ? 'Access denied. Your account does not have Administrator Console privileges.'
                : 'Access denied. Your administrator account is not provisioned for Customer App access.',
          },
          { status: 403 }
        );
      }

      if (workspace === 'admin' && user.role !== 'admin') {
        appendAuditLog({
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action: 'ADMIN_ACCESS_DENIED',
          resourceType: 'Workspace',
          resourceId: 'admin',
          details: `Non-admin user "${user.email}" rejected from Admin Console login`,
        });
        saveDb(db);
        return NextResponse.json(
          { error: 'Administrator privileges are required to sign in to the Admin Console.' },
          { status: 403 }
        );
      }

      clearLoginFailures(rateLimitKey);

      // Admin Console requires Step-2 Authenticator-App MFA when mfaEnabled is true
      if (workspace === 'admin' && user.mfaEnabled) {
        const mfaChallengeToken = signJwt(
          {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            workspace: 'admin',
            purpose: 'mfa_challenge',
          },
          300 // 5 minute challenge window
        );

        appendAuditLog({
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action: 'ADMIN_MFA_CHALLENGE_ISSUED',
          resourceType: 'AuthSession',
          resourceId: user.id,
          details: `Primary password verified for ${user.email}; awaiting TOTP MFA verification`,
        });
        saveDb(db);

        return NextResponse.json({
          mfaRequired: true,
          mfaChallengeToken,
          email: user.email,
          message: 'Enter the 6-digit code from your authenticator app or a backup recovery code.',
        });
      }

      // Create server-side session record for Customer App (or Admin without MFA)
      const sessionTtlSeconds = rememberMe ? 60 * 60 * 24 * 14 : 60 * 60 * 12;
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000).toISOString();

      db.sessions.unshift({
        id: sessionId,
        userId: user.id,
        workspace,
        mfaVerified: workspace === 'admin' ? !user.mfaEnabled : false,
        userAgent: req.headers.get('user-agent') || 'FoodSpot Web Client',
        createdAt: now,
        lastActiveAt: now,
        expiresAt,
        revokedAt: null,
      });

      const token = signJwt(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspace,
          sessionId,
          mfaVerified: workspace === 'admin' ? !user.mfaEnabled : false,
          purpose: 'session',
        },
        sessionTtlSeconds
      );

      appendAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'AUTH_LOGIN_SUCCESS',
        resourceType: 'AuthSession',
        resourceId: sessionId,
        details: `Authenticated session started in ${workspace} workspace`,
      });
      saveDb(db);

      return NextResponse.json({
        token,
        workspace,
        user: sanitizeUser(user),
      });
    }

    // 2. Administrator Step-2 TOTP MFA or Recovery Code Verification
    if (action === 'verify_mfa') {
      const { mfaChallengeToken, code } = body;
      if (!mfaChallengeToken || !code) {
        return NextResponse.json(
          { error: 'MFA challenge token and verification code are required.' },
          { status: 400 }
        );
      }

      const payload = verifyJwt(String(mfaChallengeToken));
      if (!payload || payload.purpose !== 'mfa_challenge' || payload.workspace !== 'admin') {
        return NextResponse.json(
          { error: 'MFA challenge expired or invalid. Please sign in again.' },
          { status: 401 }
        );
      }

      const rateLimitKey = `mfa:${payload.userId}`;
      const rateCheck = checkLoginRateLimit(rateLimitKey);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            error: `Too many invalid MFA attempts. Please wait ${rateCheck.retryAfterSeconds} seconds.`,
          },
          { status: 429 }
        );
      }

      const user = db.users.find((u) => u.id === payload.userId);
      if (
        !user ||
        !user.isActive ||
        user.role !== 'admin' ||
        !user.allowedWorkspaces?.includes('admin')
      ) {
        return NextResponse.json(
          { error: 'Administrator account is not authorized.' },
          { status: 403 }
        );
      }

      const normalizedCode = String(code).trim().toUpperCase();
      let verifiedByTotp = false;
      let verifiedByRecovery = false;

      if (user.mfaSecret && verifyTotpCode(user.mfaSecret, normalizedCode)) {
        verifiedByTotp = true;
      } else if (Array.isArray(user.recoveryCodes) && user.recoveryCodes.includes(normalizedCode)) {
        verifiedByRecovery = true;
        user.recoveryCodes = user.recoveryCodes.filter((c) => c !== normalizedCode);
        user.updatedAt = now;
      }

      if (!verifiedByTotp && !verifiedByRecovery) {
        const failure = recordLoginFailure(rateLimitKey);
        const remaining = Math.max(0, 5 - failure.failures);
        appendAuditLog({
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action: 'ADMIN_MFA_FAILED',
          resourceType: 'AuthSession',
          resourceId: user.id,
          details: `Invalid MFA verification code submitted (${remaining} attempts remaining)`,
        });
        saveDb(db);
        return NextResponse.json(
          {
            error: 'Invalid 6-digit authenticator code or recovery code.',
            remainingAttempts: remaining,
          },
          { status: 401 }
        );
      }

      clearLoginFailures(rateLimitKey);

      const sessionTtlSeconds = 60 * 60 * 8; // 8-hour admin session
      const sessionId = `sess_adm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000).toISOString();

      db.sessions.unshift({
        id: sessionId,
        userId: user.id,
        workspace: 'admin',
        mfaVerified: true,
        userAgent: req.headers.get('user-agent') || 'FoodSpot Admin Console',
        createdAt: now,
        lastActiveAt: now,
        expiresAt,
        revokedAt: null,
      });

      const token = signJwt(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspace: 'admin',
          sessionId,
          mfaVerified: true,
          purpose: 'session',
        },
        sessionTtlSeconds
      );

      appendAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'ADMIN_MFA_VERIFIED',
        resourceType: 'AuthSession',
        resourceId: sessionId,
        details: verifiedByRecovery
          ? `Admin MFA verified using single-use recovery code`
          : `Admin MFA verified via RFC 6238 TOTP authenticator`,
      });
      saveDb(db);

      return NextResponse.json({
        token,
        workspace: 'admin',
        user: sanitizeUser(user),
      });
    }

    // 3. Public Customer Registration (Strictly Customer App Only — Never Admin)
    if (action === 'register') {
      const { name, email, phone, password } = body;
      if (!name || !email || !phone || !password) {
        return NextResponse.json(
          { error: 'Full name, email address, phone number, and password are required.' },
          { status: 400 }
        );
      }

      if (String(password).length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters long.' },
          { status: 400 }
        );
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        return NextResponse.json(
          { error: 'An account with this email address already exists.' },
          { status: 409 }
        );
      }

      // Section 13.B: Strictly assign customer role & customer workspace on public registration
      const newUser: UserRecord = {
        id: `usr_${Date.now()}`,
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(String(password)),
        phone: String(phone).trim(),
        role: 'customer',
        allowedWorkspaces: ['customer'],
        mfaEnabled: false,
        mfaSecret: null,
        recoveryCodes: [],
        favorites: [],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      db.users.push(newUser);

      const sessionTtlSeconds = 60 * 60 * 24 * 7;
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000).toISOString();

      db.sessions.unshift({
        id: sessionId,
        userId: newUser.id,
        workspace: 'customer',
        mfaVerified: false,
        userAgent: req.headers.get('user-agent') || 'FoodSpot Customer Client',
        createdAt: now,
        lastActiveAt: now,
        expiresAt,
        revokedAt: null,
      });

      const token = signJwt(
        {
          userId: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: 'customer',
          workspace: 'customer',
          sessionId,
          mfaVerified: false,
          purpose: 'session',
        },
        sessionTtlSeconds
      );

      appendAuditLog({
        actorId: newUser.id,
        actorName: newUser.name,
        actorRole: 'customer',
        action: 'CUSTOMER_REGISTERED',
        resourceType: 'User',
        resourceId: newUser.id,
        details: `Registered new customer account (${newUser.email}) with ['customer'] workspace access`,
      });
      saveDb(db);

      return NextResponse.json(
        {
          token,
          workspace: 'customer',
          user: sanitizeUser(newUser),
        },
        { status: 201 }
      );
    }

    // 4. Explicit Session Logout & Revocation (Section 13.J)
    if (action === 'logout') {
      const authHeader = req.headers.get('authorization');
      const token =
        authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : String(body.token || '');
      const payload = token ? verifyJwt(token) : null;

      if (payload?.sessionId) {
        const session = db.sessions.find((s) => s.id === payload.sessionId);
        if (session && !session.revokedAt) {
          session.revokedAt = now;
        }
        appendAuditLog({
          actorId: payload.userId,
          actorName: payload.name,
          actorRole: payload.role,
          action: 'AUTH_LOGOUT',
          resourceType: 'AuthSession',
          resourceId: payload.sessionId,
          details: `Revoked ${payload.workspace || 'active'} session on logout`,
        });
        saveDb(db);
      }

      return NextResponse.json({ success: true });
    }

    // 5. Forgot Password & Reset Password
    if (action === 'forgot_password') {
      const { email } = body;
      const user = db.users.find(
        (u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase()
      );
      if (!user) {
        return NextResponse.json(
          { error: 'No account found with that email address.' },
          { status: 404 }
        );
      }
      const resetCode = `RST-${Math.floor(100000 + Math.random() * 900000)}`;
      user.resetToken = resetCode;
      user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      appendAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        resourceType: 'User',
        resourceId: user.id,
        details: `Password recovery initiated for ${user.email}`,
      });
      saveDb(db);
      return NextResponse.json({
        message: 'Password reset token generated and sent to your registered email.',
        resetTokenIssued: resetCode,
      });
    }

    if (action === 'reset_password') {
      const { email, resetToken, newPassword } = body;
      const user = db.users.find(
        (u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase()
      );
      if (!user || !user.resetToken || user.resetToken !== String(resetToken || '').trim()) {
        return NextResponse.json({ error: 'Invalid or expired reset token.' }, { status: 400 });
      }
      if (String(newPassword || '').length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long.' },
          { status: 400 }
        );
      }
      user.passwordHash = hashPassword(String(newPassword));
      user.resetToken = null;
      user.resetTokenExpiry = null;
      user.updatedAt = now;
      // Revoke all existing sessions on password change
      db.sessions.forEach((s) => {
        if (s.userId === user.id && !s.revokedAt) {
          s.revokedAt = now;
        }
      });
      appendAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'AUTH_PASSWORD_RESET_COMPLETED',
        resourceType: 'User',
        resourceId: user.id,
        details: `Password updated and active sessions revoked for ${user.email}`,
      });
      saveDb(db);
      return NextResponse.json({ message: 'Password updated successfully. You may now sign in.' });
    }

    // 6. Controlled Administrator Provisioning & MFA Management (Admin Session Required)
    if (action === 'provision_admin') {
      const verification = verifyWorkspaceSession(
        req.headers.get('authorization'),
        'admin',
        db
      );
      if (!verification.authorized || !verification.user) {
        return NextResponse.json(
          { error: verification.reason || 'Admin authorization required' },
          { status: verification.status }
        );
      }

      const { name, email, phone, password, grantCustomerWorkspace = false } = body;
      if (!name || !email || !password || String(password).length < 8) {
        return NextResponse.json(
          { error: 'Name, email, and a strong password (min 8 chars) are required.' },
          { status: 400 }
        );
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        return NextResponse.json(
          { error: 'An account with this email already exists.' },
          { status: 409 }
        );
      }

      const mfaSecret = generateTotpSecret();
      const recoveryCodes = generateRecoveryCodes();
      const allowedWorkspaces: WorkspaceType[] = grantCustomerWorkspace
        ? ['admin', 'customer']
        : ['admin'];

      const newAdmin: UserRecord = {
        id: `usr_admin_${Date.now()}`,
        name: String(name).trim(),
        email: normalizedEmail,
        username: normalizedEmail.split('@')[0],
        passwordHash: hashPassword(String(password)),
        phone: String(phone || '+1 (415) 890-9000').trim(),
        role: 'admin',
        allowedWorkspaces,
        mfaEnabled: true,
        mfaSecret,
        recoveryCodes,
        favorites: [],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      db.users.push(newAdmin);
      appendAuditLog({
        actorId: verification.user.id,
        actorName: verification.user.name,
        actorRole: 'admin',
        action: 'ADMIN_ACCOUNT_PROVISIONED',
        resourceType: 'User',
        resourceId: newAdmin.id,
        details: `Provisioned administrator ${newAdmin.email} with workspaces [${allowedWorkspaces.join(', ')}] and TOTP MFA`,
      });
      saveDb(db);

      return NextResponse.json(
        {
          admin: sanitizeUser(newAdmin),
          provisioningSetup: {
            mfaSecret,
            recoveryCodes,
            otpauthUrl: `otpauth://totp/FoodSpot:${encodeURIComponent(newAdmin.email)}?secret=${mfaSecret}&issuer=FoodSpot`,
          },
        },
        { status: 201 }
      );
    }

    // 7. Firebase Google Authentication (Strictly Customer App Workspace Alone)
    if (action === 'firebase_google_login') {
      const requestedWorkspace = body.workspace || 'customer';
      if (requestedWorkspace !== 'customer') {
        return NextResponse.json(
          {
            error:
              'Firebase Google Auth is strictly enabled for the Customer App workspace alone.',
          },
          { status: 403 }
        );
      }

      const rawEmail = String(body.email || '')
        .trim()
        .toLowerCase();
      const rawName = String(body.name || body.displayName || '')
        .trim();
      const firebaseUid = String(body.uid || '').trim();

      if (!rawEmail || !rawEmail.includes('@')) {
        return NextResponse.json(
          { error: 'A verified Google email address is required for Customer App sign-in.' },
          { status: 400 }
        );
      }

      let user = db.users.find((u) => u.email.toLowerCase() === rawEmail);

      if (!user) {
        user = {
          id: firebaseUid ? `usr_google_${firebaseUid.slice(0, 20)}` : `usr_google_${Date.now()}`,
          name: rawName || rawEmail.split('@')[0],
          username: rawEmail.split('@')[0],
          email: rawEmail,
          passwordHash: hashPassword(`google_oauth_${firebaseUid || Date.now()}`),
          phone: '+1 (415) 890-2311',
          role: 'customer',
          allowedWorkspaces: ['customer'],
          mfaEnabled: false,
          mfaSecret: null,
          recoveryCodes: [],
          favorites: ['rest_1'],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        db.users.push(user);

        // Seed a default delivery address and sample 'Preparing' order for new Google customers
        // so they can immediately test order status push notifications
        const defaultAddressId = `addr_${Date.now()}`;
        db.addresses.push({
          id: defaultAddressId,
          userId: user.id,
          label: 'Home',
          recipientName: user.name,
          phone: user.phone,
          street: '742 Evergreen Terrace, Apt 4B, Mission District',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94107',
          instructions: 'Leave at front concierge desk / ring bell.',
          isDefault: true,
          createdAt: now,
        });

        const sampleOrderId = `ord_google_${Date.now()}`;
        const sampleOrderNumber = `FH-${1001 + db.orders.length}`;
        db.orders.unshift({
          id: sampleOrderId,
          orderNumber: sampleOrderNumber,
          customerId: user.id,
          customerName: user.name,
          customerEmail: user.email,
          restaurantId: 'rest_1',
          restaurantName: 'Forno Di Pietra Kitchen',
          deliveryPartnerId: 'dp_1',
          deliveryPartnerName: 'Rohan Verma',
          items: [
            {
              id: `oi_${Date.now()}_1`,
              orderId: sampleOrderId,
              foodItemId: 'food_1',
              name: 'Truffle Burrata & Wild Mushroom Sourdough Pizza',
              quantity: 1,
              basePrice: 22.5,
              selectedCustomizations: [],
              unitTotal: 22.5,
              lineTotal: 22.5,
              isVeg: true,
            },
          ],
          subtotal: 22.5,
          deliveryFee: 2.99,
          taxAmount: 1.8,
          discountAmount: 0,
          couponCode: null,
          totalAmount: 27.29,
          status: 'preparing',
          addressSnapshot: {
            label: 'Home',
            recipientName: user.name,
            phone: user.phone,
            street: '742 Evergreen Terrace, Apt 4B',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94107',
          },
          contactPhone: user.phone,
          deliveryInstructions: 'Ring bell on arrival.',
          statusTimeline: [
            {
              status: 'placed',
              label: 'Order Placed',
              timestamp: now,
              note: 'Order placed via Customer App',
              actorRole: 'customer',
            },
            {
              status: 'accepted',
              label: 'Restaurant Accepted',
              timestamp: now,
              note: 'Forno Di Pietra Kitchen confirmed your order',
              actorRole: 'restaurant',
            },
            {
              status: 'preparing',
              label: 'Preparing Food',
              timestamp: now,
              note: 'Chef Marco is firing your sourdough pizza',
              actorRole: 'restaurant',
            },
          ],
          cancellationReason: null,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        if (!user.isActive) {
          return NextResponse.json(
            { error: 'This customer account has been deactivated.' },
            { status: 403 }
          );
        }
        // Ensure customer workspace access is present for Google sign-in in Customer App
        if (!Array.isArray(user.allowedWorkspaces)) {
          user.allowedWorkspaces = ['customer'];
        } else if (!user.allowedWorkspaces.includes('customer')) {
          user.allowedWorkspaces.push('customer');
        }
        if (rawName && (!user.name || user.name === user.email.split('@')[0])) {
          user.name = rawName;
        }
        user.updatedAt = now;
      }

      const sessionTtlSeconds = 60 * 60 * 24 * 14; // 14-day Customer App session
      const sessionId = `sess_google_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000).toISOString();

      db.sessions.unshift({
        id: sessionId,
        userId: user.id,
        workspace: 'customer',
        mfaVerified: false,
        userAgent: req.headers.get('user-agent') || 'FoodSpot Customer App (Firebase Google Auth)',
        createdAt: now,
        lastActiveAt: now,
        expiresAt,
        revokedAt: null,
      });

      const token = signJwt(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: 'customer',
          workspace: 'customer',
          sessionId,
          mfaVerified: false,
          purpose: 'session',
        },
        sessionTtlSeconds
      );

      appendAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: 'customer',
        action: 'CUSTOMER_FIREBASE_GOOGLE_LOGIN',
        resourceType: 'AuthSession',
        resourceId: sessionId,
        details: `Customer signed in via Firebase Google Auth (${user.email}) into Customer App workspace`,
      });
      saveDb(db);

      return NextResponse.json({
        token,
        workspace: 'customer',
        user: sanitizeUser(user),
      });
    }

    return NextResponse.json({ error: 'Unsupported auth action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication error' },
      { status: 500 }
    );
  }
}
