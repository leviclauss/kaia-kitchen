/** Photo sticker row — hide broken images, show strawberry fallback. */

export function initStickers() {
  const stickers = document.querySelectorAll('.sticker');
  const fallback = document.getElementById('sticker-fallback');

  function updateFallback() {
    const anyVisible = Array.from(stickers).some(
      (s) => !s.classList.contains('hidden') && s.complete && s.naturalWidth > 0
    );
    if (fallback) fallback.classList.toggle('hidden', anyVisible);
  }

  function hide(img) {
    img.classList.add('hidden');
    updateFallback();
  }

  let pending = stickers.length;
  stickers.forEach((img) => {
    if (img.complete) {
      if (img.naturalWidth === 0) hide(img);
      pending--;
      if (pending <= 0) updateFallback();
    } else {
      img.addEventListener('load', () => {
        pending--;
        if (pending <= 0) updateFallback();
      });
      img.addEventListener('error', () => {
        hide(img);
        pending--;
        if (pending <= 0) updateFallback();
      });
    }
  });
  setTimeout(updateFallback, 400);
}
