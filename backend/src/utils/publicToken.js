const crypto = require('crypto');

const PUBLIC_TOKEN_RE = /^[A-Za-z0-9_-]{20,80}$/;

function newPublicToken() {
    return crypto.randomBytes(24).toString('base64url');
}

function isPublicToken(value) {
    return PUBLIC_TOKEN_RE.test(String(value || ''));
}

module.exports = { newPublicToken, isPublicToken, PUBLIC_TOKEN_RE };
