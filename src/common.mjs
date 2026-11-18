export function noise(seed, step, channel = 0) {
  let n = (seed ^ Math.imul(step + 1, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca6b)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

export function leading(scores) {
  return scores[0] === scores[1] ? -1 : Number(scores[1] > scores[0]);
}

export function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

export function ranked(options, value, entropy) {
  let best = -Infinity, chosen = null;
  options.forEach((option, index) => {
    const score = value(option) + noise(entropy, index) * 0.0001;
    if (score > best) { best = score; chosen = option.id; }
  });
  return chosen;
}

export function fingerprint(state) {
  let hash = 2166136261;
  for (const ch of JSON.stringify(state)) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
