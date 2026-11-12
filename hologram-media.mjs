// Apply the effect to an entire editorial image, never a portrait or live text.
export function hologramMedia(image, className='', persona='') {
  return `<span class="${className} holo-eyecatch"${persona?` data-persona="${persona}"`:''}><span class="holo-projection" aria-hidden="true"></span><span class="holo-media-frame">${image}<span class="holo-media-sheen" aria-hidden="true"></span></span><span class="holo-media-base" aria-hidden="true"></span></span>`;
}
