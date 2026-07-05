export function calcDamage(atk: number, def: number, weaponAtk: number, isCrit: boolean, multiplier = 1): number {
  const base = Math.max(1, (atk + weaponAtk) * multiplier - def * 0.5);
  const variance = 0.85 + Math.random() * 0.3;
  const critMult = isCrit ? 1.5 : 1;
  return Math.max(1, Math.round(base * variance * critMult));
}

export function calcMagicDamage(mag: number, enemyInt: number, weaponMag: number, isCrit: boolean, multiplier = 1): number {
  const base = Math.max(1, (mag + weaponMag) * multiplier * 1.2 - enemyInt * 0.3);
  const variance = 0.9 + Math.random() * 0.2;
  const critMult = isCrit ? 1.5 : 1;
  return Math.max(1, Math.round(base * variance * critMult));
}

export function calcCritChance(lck: number, baseCrit = 5): number {
  return Math.min(50, baseCrit + lck * 0.5);
}

export function calcDodgeChance(spd: number, enemySpd: number, baseDodge = 3): number {
  return Math.min(40, baseDodge + Math.max(0, (spd - enemySpd) * 0.8));
}

export function rollCrit(lck: number, bonusCrit = 0): boolean {
  return Math.random() * 100 < calcCritChance(lck) + bonusCrit;
}

export function rollDodge(spd: number, enemySpd: number, bonusDodge = 0): boolean {
  return Math.random() * 100 < calcDodgeChance(spd, enemySpd) + bonusDodge;
}

export function getHungerZone(hunger: number): { zone: string; color: string; penalties: Record<string, number> } {
  if (hunger >= 86) return { zone: 'Sobrealimentado', color: 'text-amber-400', penalties: { spd: -10, atk: -5 } };
  if (hunger >= 71) return { zone: 'Bien alimentado', color: 'text-green-400', penalties: { spd: -5 } };
  if (hunger >= 40) return { zone: 'Cómodo', color: 'text-green-300', penalties: {} };
  if (hunger >= 25) return { zone: 'Hambriento', color: 'text-amber-400', penalties: { atk: -5, def: -5 } };
  return { zone: 'Famélico', color: 'text-red-400', penalties: { atk: -15, def: -15, mag: -10 } };
}

export function getHungerDecrease(energy: number, rested: boolean): number {
  let base = 6 + Math.floor(Math.random() * 5); // 6-10 per floor — tower is merciless
  if (energy < 10) base *= 2;
  else if (energy < 30) base *= 1.5;
  else if (energy < 60) base *= 1.2;
  if (rested) base *= 0.5;
  return Math.round(base);
}

export function calcStatGain(baseGain: number, isHumano: boolean, hasAffinity: boolean): number {
  let gain = baseGain;
  if (isHumano) gain *= 2;
  if (hasAffinity) gain = Math.ceil(gain * 1.3);
  return Math.max(1, Math.round(gain));
}
