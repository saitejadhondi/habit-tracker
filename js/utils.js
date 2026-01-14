export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.position = 'fixed';
    container.style.right = '1rem';
    container.style.top = '1rem';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.textContent = message;
  el.style.marginTop = '0.5rem';
  el.style.padding = '0.5rem 1rem';
  el.style.borderRadius = '4px';
  el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
  el.style.background = type === 'error' ? '#ffb3b3' : (type === 'success' ? '#b3ffcc' : '#eee');
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
