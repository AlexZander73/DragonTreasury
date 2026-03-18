export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const lerp = (start: number, end: number, t: number): number => start + (end - start) * t;

export const inverseLerp = (start: number, end: number, value: number): number => {
  if (start === end) {
    return 0;
  }
  return clamp((value - start) / (end - start), 0, 1);
};

export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
