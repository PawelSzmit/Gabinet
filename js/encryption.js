/* ===========================================
   Encryption - Web Crypto API (AES-256-GCM)
   =========================================== */

const Encryption = (() => {
  const KEY_STORAGE = 'gabinet_encryption_key';
  let cryptoKey = null;

  async function init() {
    const storedKey = localStorage.getItem(KEY_STORAGE);
    if (storedKey) {
      const keyData = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
      cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
      );
    } else {
      cryptoKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
      );
      const exported = await crypto.subtle.exportKey('raw', cryptoKey);
      const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
      localStorage.setItem(KEY_STORAGE, b64);
    }
  }

  async function encrypt(text) {
    if (!text) return '';
    if (!cryptoKey) await init();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, cryptoKey, encoded
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  async function decrypt(encryptedText) {
    if (!encryptedText) return '';
    if (!cryptoKey) await init();
    try {
      const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv }, cryptoKey, data
      );
      return new TextDecoder().decode(decrypted);
    } catch {
      return encryptedText;
    }
  }

  return { init, encrypt, decrypt };
})();
