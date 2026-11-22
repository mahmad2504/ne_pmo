import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, '../demo.config.json'), 'utf8'));
const realm = config.realm;
const envFile = readEnvFile(join(here, '../../.env'));
const adminUser = process.env.KEYCLOAK_ADMIN || envFile.KC_BOOTSTRAP_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || envFile.KC_BOOTSTRAP_ADMIN_PASSWORD || 'admin';

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return values;
}

async function adminToken() {
  const response = await fetch(`${config.keycloakUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: adminUser,
      password: adminPassword,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Keycloak admin login failed (${response.status}). Start the stack with: docker compose up -d`);
  }
  return body.access_token;
}

async function admin(token, method, path, body, allow = []) {
  const response = await fetch(`${config.keycloakUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  }
  return { status: response.status, json, headers: response.headers };
}

async function findClient(token, clientId) {
  const { json } = await admin(token, 'GET', `/admin/realms/${realm}/clients?clientId=${encodeURIComponent(clientId)}`);
  return json.find((client) => client.clientId === clientId) ?? null;
}

async function ensureClient(token, representation) {
  const existing = await findClient(token, representation.clientId);
  if (!existing) {
    await admin(token, 'POST', `/admin/realms/${realm}/clients`, representation);
    return findClient(token, representation.clientId);
  }
  await admin(token, 'PUT', `/admin/realms/${realm}/clients/${existing.id}`, {
    ...existing,
    ...representation,
    id: existing.id,
    secret: existing.secret ?? representation.secret,
    attributes: { ...existing.attributes, ...representation.attributes },
  });
  return findClient(token, representation.clientId);
}

async function ensureRole(token, name) {
  const existing = await admin(token, 'GET', `/admin/realms/${realm}/roles/${encodeURIComponent(name)}`, undefined, [404]);
  if (existing.status === 404) {
    await admin(token, 'POST', `/admin/realms/${realm}/roles`, { name });
  }
  const { json } = await admin(token, 'GET', `/admin/realms/${realm}/roles/${encodeURIComponent(name)}`);
  return json;
}

async function ensureUser(token, user) {
  const { json: found } = await admin(
    token,
    'GET',
    `/admin/realms/${realm}/users?username=${encodeURIComponent(user.username)}&exact=true`,
  );
  let id = found[0]?.id;
  const profile = {
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    enabled: true,
    emailVerified: true,
    requiredActions: [],
  };
  if (!id) {
    const created = await admin(token, 'POST', `/admin/realms/${realm}/users`, profile);
    id = created.headers.get('location')?.split('/').pop();
    if (!id) {
      const again = await admin(
        token,
        'GET',
        `/admin/realms/${realm}/users?username=${encodeURIComponent(user.username)}&exact=true`,
      );
      id = again.json[0]?.id;
    }
  } else {
    await admin(token, 'PUT', `/admin/realms/${realm}/users/${id}`, { ...found[0], ...profile });
  }
  if (!id) throw new Error(`Could not create user ${user.username}`);
  if (user.password) {
    await admin(token, 'PUT', `/admin/realms/${realm}/users/${id}/reset-password`, {
      type: 'password',
      value: user.password,
      temporary: false,
    });
  }
  const roles = [];
  for (const roleName of user.roles) roles.push(await ensureRole(token, roleName));
  await admin(token, 'POST', `/admin/realms/${realm}/users/${id}/role-mappings/realm`, roles);
}

async function ensureAudienceMapper(token, client) {
  const { json: mappers } = await admin(
    token,
    'GET',
    `/admin/realms/${realm}/clients/${client.id}/protocol-mappers/models`,
  );
  const name = 'backend-api-audience';
  if (mappers.some((mapper) => mapper.name === name)) return;
  await admin(token, 'POST', `/admin/realms/${realm}/clients/${client.id}/protocol-mappers/models`, {
    name,
    protocol: 'openid-connect',
    protocolMapper: 'oidc-audience-mapper',
    config: {
      'included.client.audience': config.backendAudience,
      'id.token.claim': 'false',
      'access.token.claim': 'true',
      'introspection.token.claim': 'true',
      'lightweight.access.token.claim': 'false',
    },
  });
}

function decodeJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

async function assertAccessToken(username, password, expectedRole) {
  const response = await fetch(`${config.keycloakUrl}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: config.frontendClientId,
      username,
      password,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Could not issue a token for ${username}: ${JSON.stringify(body)}`);
  const claims = decodeJwt(body.access_token);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const roles = claims.realm_access?.roles ?? [];
  if (!audience.includes(config.backendAudience)) {
    throw new Error(`Token for ${username} is missing audience ${config.backendAudience}`);
  }
  if (!roles.includes(expectedRole)) {
    throw new Error(`Token for ${username} is missing role ${expectedRole}`);
  }
}

async function main() {
  let token = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      token = await adminToken();
      break;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  if (!token) throw lastError;

  const existingRealm = await admin(token, 'GET', `/admin/realms/${realm}`, undefined, [404]);
  if (existingRealm.status === 404) {
    await admin(token, 'POST', '/admin/realms', {
      realm,
      enabled: true,
      displayName: 'NE PM',
      registrationAllowed: false,
      sslRequired: 'none',
      bruteForceProtected: false,
      attributes: { frontendUrl: config.keycloakUrl },
    });
  }

  for (const role of ['user', 'admin']) await ensureRole(token, role);

  const frontendUrls = [config.frontendUrl, ...(config.additionalFrontendUrls || [])];
  const frontendClient = await ensureClient(token, {
    clientId: config.frontendClientId,
    name: 'NE PM',
    enabled: true,
    protocol: 'openid-connect',
    publicClient: true,
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: true,
    serviceAccountsEnabled: false,
    redirectUris: frontendUrls.map((url) => `${url}/*`),
    webOrigins: frontendUrls,
    attributes: {
      'pkce.code.challenge.method': 'S256',
      'post.logout.redirect.uris': '+',
    },
  });

  await ensureClient(token, {
    clientId: config.backendAudience,
    name: 'Backend API',
    enabled: true,
    protocol: 'openid-connect',
    publicClient: false,
    standardFlowEnabled: false,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: false,
    secret: 'audience-only-not-used-by-the-react-app',
  });
  await ensureAudienceMapper(token, frontendClient);

  for (const user of config.users) await ensureUser(token, user);
  await assertAccessToken('alice', 'alice123', 'user');
  await assertAccessToken('bob', 'bob123', 'admin');

  const refreshed = await findClient(token, config.frontendClientId);
  await admin(token, 'PUT', `/admin/realms/${realm}/clients/${refreshed.id}`, {
    ...refreshed,
    directAccessGrantsEnabled: false,
  });

  console.log(`Keycloak realm "${realm}" is ready.`);
  for (const user of config.users) {
    console.log(`  ${user.username} / ${user.password}  roles: ${user.roles.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
