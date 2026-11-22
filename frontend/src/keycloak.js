import Keycloak from 'keycloak-js';
import config from '../keycloak.config.json';

const keycloak = new Keycloak({
  url: config.keycloakUrl,
  realm: config.realm,
  clientId: config.clientId,
});

let initPromise = null;

export function initKeycloak() {
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      responseMode: 'query',
    }).catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export function login() {
  return keycloak.login({
    redirectUri: `${window.location.origin}/`,
  });
}

export function logout() {
  return keycloak.logout({
    redirectUri: `${window.location.origin}/`,
  });
}

export function sessionFromToken() {
  if (!keycloak.authenticated || !keycloak.tokenParsed) return null;
  const roles = keycloak.tokenParsed.realm_access?.roles ?? [];
  return {
    username: keycloak.tokenParsed.preferred_username,
    name: keycloak.tokenParsed.name,
    email: keycloak.tokenParsed.email,
    roles: roles.filter((role) => role === 'user' || role === 'admin'),
  };
}

export async function authHeader() {
  if (!keycloak.authenticated) return {};
  await keycloak.updateToken(30);
  return { Authorization: `Bearer ${keycloak.token}` };
}

export default keycloak;
