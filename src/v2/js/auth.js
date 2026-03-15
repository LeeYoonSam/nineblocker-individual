async function sha256(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyAdmin(password) {
  if (CONFIG.DEMO_MODE) return true;
  const hash = await sha256(password);
  return hash === CONFIG.ADMIN_HASH;
}

const SESSION_DURATION = 30 * 60 * 1000; // 30분

const AdminSession = {
  set: () => {
    sessionStorage.setItem('admin', '1');
    sessionStorage.setItem('admin_expires', String(Date.now() + SESSION_DURATION));
  },
  clear: () => {
    sessionStorage.removeItem('admin');
    sessionStorage.removeItem('admin_expires');
  },
  check: () => {
    if (sessionStorage.getItem('admin') !== '1') return false;
    const expires = Number(sessionStorage.getItem('admin_expires'));
    return expires > Date.now();
  },
};
