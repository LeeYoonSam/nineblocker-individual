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
  const hash = await sha256(password);
  return hash === CONFIG.ADMIN_HASH;
}

const AdminSession = {
  set: () => sessionStorage.setItem('admin', '1'),
  clear: () => sessionStorage.removeItem('admin'),
  check: () => sessionStorage.getItem('admin') === '1',
};
