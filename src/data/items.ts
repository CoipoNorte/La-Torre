export interface WeaponDef {
  id: string; name: string; atk: number; mag: number; spd: number;
  effect?: string; effectDesc?: string; lore: string;
  tier: number; selfHarm?: boolean;
}

export interface FoodDef {
  id: string; name: string; hunger: number; energy: number;
  hpHeal?: number; mpHeal?: number; effect?: string; effectDesc?: string;
  tier: 'basura' | 'comun' | 'buena' | 'excelente' | 'legendaria';
}

export interface PotionDef {
  id: string; name: string; effect: string; effectDesc: string; tier: number; lore: string;
}

export interface BeverageDef {
  id: string; name: string; energy: number; hunger?: number; mpHeal?: number; effectDesc: string; tier: number;
}

export interface RelicDef {
  id: string; name: string; icon: string; effect: string; effectDesc: string; lore: string; tier: number;
}

export const RELICS: RelicDef[] = [
  { id: 'reliquia_hueso', name: 'Reliquia de Hueso', icon: '🦴', effect: 'hpBoost', effectDesc: '+10% HP máximo pasivo', lore: 'Un fémur tallado con símbolos. Se calienta cerca de los muertos.', tier: 1 },
  { id: 'idolo_roto', name: 'Ídolo Roto', icon: '🗿', effect: 'lckBoost', effectDesc: '+10% LCK pasivo', lore: 'Una figura sin rostro. Cada vez que lo miras, parece más familiar.', tier: 2 },
  { id: 'fragmento_corona', name: 'Fragmento de Corona', icon: '👑', effect: 'thorns', effectDesc: 'Devuelve 10% DEF como daño al atacante', lore: 'Un trozo de algo que fue sagrado. Las espinas todavía cortan.', tier: 3 },
  { id: 'ojo_preservado', name: 'Ojo Preservado', icon: '👁️', effect: 'intBoost', effectDesc: '+10% INT pasivo', lore: 'Te mira. No dejes que te convenza de que parpadea.', tier: 2 },
];

export type Element = 'physical' | 'fire' | 'ice' | 'holy' | 'dark' | 'poison' | 'arcane';

// Starting weapons per class
export const CLASS_WEAPONS: Record<string, WeaponDef> = {
  caballero: { id: 'espada_inicio', name: 'Espada de Hierro', atk: 5, mag: 0, spd: 0, tier: 1, lore: 'La espada de un caballero novel. Pesada pero confiable.' },
  mago: { id: 'varita_inicio', name: 'Varita de Cristal', atk: 1, mag: 5, spd: 1, tier: 1, lore: 'Canaliza magia arcana. Frágil al tacto.' },
  picaro: { id: 'daga_inicio', name: 'Daga Afilada', atk: 3, mag: 0, spd: 3, tier: 1, lore: 'Ligera y rápida. Ideal para lo furtivo.' },
  paladin: { id: 'maza_inicio', name: 'Maza Bendita', atk: 4, mag: 2, spd: -1, tier: 1, lore: 'Consagrada por un sacerdote. Aún conserva algo de fe.' },
  guerrero: { id: 'hacha_inicio', name: 'Hacha de Leñador', atk: 6, mag: 0, spd: -1, tier: 1, lore: 'No fue hecha para matar. Pero funciona.' },
  brujo: { id: 'cetro_inicio', name: 'Cetro de Hueso', atk: 1, mag: 4, spd: 0, tier: 1, lore: 'El hueso aún está tibio. Siempre lo está.' },
  humano: { id: 'garrote_inicio', name: 'Garrote', atk: 4, mag: 0, spd: 0, tier: 1, lore: 'Un palo. Nada más. A veces basta.' },
};

export const WEAPONS: WeaponDef[] = [
  // Tier 1 (floors 1-15)
  { id: 'daga_oxidada', name: 'Daga Oxidada', atk: 3, mag: 0, spd: 2, tier: 1, lore: 'Apenas corta. Mejor que nada.' },
  { id: 'garrote', name: 'Garrote', atk: 5, mag: 0, spd: -1, tier: 1, lore: 'Un palo con clavos. Efectivo.' },
  { id: 'vara_hueso', name: 'Vara de Hueso', atk: 2, mag: 4, spd: 0, tier: 1, lore: 'El hueso aún está tibio.' },
  { id: 'cuchillo_ritual', name: 'Cuchillo Ritual', atk: 4, mag: 2, spd: 1, tier: 1, effect: 'bleed', effectDesc: '15% sangrado', lore: 'Usado en ceremonias que no quieres imaginar.' },
  { id: 'maza_piedra', name: 'Maza de Piedra', atk: 6, mag: 0, spd: -2, tier: 1, lore: 'Pesada y tosca. Rompe huesos.' },
  { id: 'varita_astilla', name: 'Varita Astillada', atk: 1, mag: 5, spd: 1, tier: 1, lore: 'Un fragmento de algo mayor. Aún tiene poder.' },
  { id: 'antorcha', name: 'Antorcha', atk: 3, mag: 1, spd: 0, tier: 1, effect: 'burn', effectDesc: '10% quemadura', lore: 'Ilumina y quema. Ambos son útiles aquí.' },
  // Tier 2 (floors 16-30)
  { id: 'espada_sombra', name: 'Espada de Sombra', atk: 8, mag: 3, spd: 1, tier: 2, effect: 'shadowStrike', effectDesc: '+20% daño en emboscada', lore: 'Forjada en ausencia de luz.' },
  { id: 'baculo_alma', name: 'Báculo de Alma', atk: 2, mag: 10, spd: 0, tier: 2, effect: 'mpDrain', effectDesc: 'Roba 3 MP por golpe', lore: 'Cada hechizo que canaliza gime.' },
  { id: 'hacha_verdugo', name: 'Hacha del Verdugo', atk: 12, mag: 0, spd: -2, tier: 2, effect: 'execute', effectDesc: '+30% daño si HP<25%', lore: 'Nunca falla el último golpe.' },
  { id: 'espada_maldita', name: 'Espada Maldita', atk: 14, mag: 5, spd: 0, tier: 2, effect: 'cursedBlade', effectDesc: '+40% ATK, -3 HP/turno', selfHarm: true, lore: 'Te corta a ti también.' },
  { id: 'cruz_plata', name: 'Cruz de Plata', atk: 7, mag: 8, spd: 0, tier: 2, effect: 'holy', effectDesc: '+50% vs no-muertos y oscuros', lore: 'Bendecida por un sacerdote que ya no cree.' },
  { id: 'arco_sombra', name: 'Arco de Sombra', atk: 10, mag: 4, spd: 3, tier: 2, effect: 'shadowStrike', effectDesc: '+20% daño en emboscada', lore: 'Dispara flechas de oscuridad.' },
  { id: 'martillo_fe', name: 'Martillo de Fe', atk: 13, mag: 3, spd: -2, tier: 2, effect: 'stun', effectDesc: '15% aturdir', lore: 'Fe ciega convertida en acero.' },
  // Tier 3 (floors 31-50)
  { id: 'filo_dimensional', name: 'Filo Dimensional', atk: 15, mag: 8, spd: 3, tier: 3, effect: 'phaseStrike', effectDesc: 'Ignora 30% DEF', lore: 'Corta entre dimensiones.' },
  { id: 'baculo_nigromante', name: 'Báculo Nigromante', atk: 3, mag: 18, spd: -1, tier: 3, effect: 'soulHarvest', effectDesc: '+5 MP al matar', lore: 'Los muertos son combustible.' },
  { id: 'lanza_dragon', name: 'Lanza de Dragón', atk: 18, mag: 0, spd: 2, tier: 3, effect: 'dragonPierce', effectDesc: 'Ignora 50% DEF vs bosses', lore: 'Diseñada para matar dioses menores.' },
  { id: 'grimorio_viviente', name: 'Grimorio Viviente', atk: 0, mag: 22, spd: -1, tier: 3, effect: 'doublecast', effectDesc: '25% hechizo doble, -2 HP/turno', selfHarm: true, lore: 'Lee tus pensamientos. Responde con los peores.' },
  { id: 'espada_santa', name: 'Espada Santa', atk: 16, mag: 10, spd: 1, tier: 3, effect: 'holy', effectDesc: '+50% vs oscuros y no-muertos', lore: 'Forjada para purificar lo corrupto.' },
  { id: 'guadana_peste', name: 'Guadaña de Peste', atk: 14, mag: 5, spd: 0, tier: 3, effect: 'poison', effectDesc: '25% envenenar', lore: 'Cada corte es una enfermedad.' },
  // Tier 4 (floors 51-80)
  { id: 'hoja_eternidad', name: 'Hoja Eternidad', atk: 22, mag: 12, spd: 4, tier: 4, effect: 'eternal', effectDesc: 'Daño +1%/piso', lore: 'No se desgasta. Nunca.' },
  { id: 'cetro_juicio', name: 'Cetro del Juicio', atk: 5, mag: 28, spd: 0, tier: 4, effect: 'judgement', effectDesc: 'Crit mágico +25%', lore: 'Juzga y ejecuta en el mismo gesto.' },
  { id: 'espada_sacrificio', name: 'Espada del Sacrificio', atk: 30, mag: 0, spd: -1, tier: 4, effect: 'sacrifice', effectDesc: '+100% ATK 1t, -20% HP max', selfHarm: true, lore: 'El precio es tú mismo.' },
  // Tier 5 (floors 81-100)
  { id: 'fragmento_deidad', name: 'Fragmento de Deidad', atk: 25, mag: 25, spd: 5, tier: 5, effect: 'divine', effectDesc: 'Todo daño +30%, +5% cura al matar', lore: 'Un trozo del cielo que cayó.' },
  { id: 'vacio', name: 'El Vacío', atk: 35, mag: 35, spd: 0, tier: 5, effect: 'void', effectDesc: 'Borra 1 habilidad enemiga, -5 HP/turno', selfHarm: true, lore: 'No es un arma. Es una ausencia.' },
];

export const FOODS: FoodDef[] = [
  { id: 'pan_mohoso', name: 'Pan Mohoso', hunger: 8, energy: 2, tier: 'basura', effectDesc: 'Apenas comestible' },
  { id: 'carne_seca', name: 'Carne Seca', hunger: 15, energy: 5, tier: 'comun', effectDesc: 'Nutritiva' },
  { id: 'fruta_sombra', name: 'Fruta de Sombra', hunger: 12, energy: 8, hpHeal: 10, tier: 'comun', effectDesc: '+10 HP' },
  { id: 'racion', name: 'Ración de Explorador', hunger: 20, energy: 10, tier: 'buena', effectDesc: 'Completa' },
  { id: 'sopa_huesos', name: 'Sopa de Huesos', hunger: 18, energy: 12, hpHeal: 20, tier: 'buena', effectDesc: '+20 HP' },
  { id: 'elixir_sangre', name: 'Elixir de Sangre', hunger: 10, energy: 15, mpHeal: 15, tier: 'buena', effectDesc: '+15 MP' },
  { id: 'festin', name: 'Festín de la Torre', hunger: 30, energy: 20, hpHeal: 30, mpHeal: 15, tier: 'excelente', effectDesc: '+30 HP, +15 MP' },
  { id: 'ambrosia', name: 'Ambrosía Corrupta', hunger: 25, energy: 25, hpHeal: 50, mpHeal: 30, tier: 'legendaria', effectDesc: '+50 HP, +30 MP' },
  { id: 'hongos', name: 'Hongos Luminosos', hunger: 10, energy: 3, mpHeal: 10, tier: 'comun', effectDesc: '+10 MP' },
  { id: 'raices', name: 'Raíces Amargas', hunger: 12, energy: 6, tier: 'basura', effectDesc: 'Comestible. Apenas.' },
  { id: 'carne_rata', name: 'Carne de Rata', hunger: 14, energy: 4, tier: 'basura', effectDesc: 'No preguntes de dónde salió.' },
  { id: 'galletas', name: 'Galletas Rancias', hunger: 10, energy: 8, tier: 'comun', effectDesc: 'Duras como piedra pero nutritivas.' },
  { id: 'estofado', name: 'Estofado Misterioso', hunger: 22, energy: 14, hpHeal: 15, tier: 'buena', effectDesc: '+15 HP, reconfortante.' },
  { id: 'queso_torre', name: 'Queso de la Torre', hunger: 16, energy: 10, tier: 'comun', effectDesc: 'Mohoso pero sabroso.' },
  { id: 'fruto_oscuro', name: 'Fruto Oscuro', hunger: 14, energy: 12, mpHeal: 12, tier: 'buena', effectDesc: '+12 MP. Brilla en la oscuridad.' },
  { id: 'pan_elfico', name: 'Pan Élfico', hunger: 25, energy: 18, hpHeal: 10, tier: 'excelente', effectDesc: '+10 HP. Ligero y sustancioso.' },
  { id: 'carne_bestia', name: 'Carne de Bestia', hunger: 28, energy: 8, hpHeal: 25, tier: 'excelente', effectDesc: '+25 HP. Dura de masticar.' },
];

export const POTIONS: PotionDef[] = [
  { id: 'pocion_roja', name: 'Poción Roja', effect: 'healHP', effectDesc: 'Recupera 25% HP máximo', tier: 1, lore: 'El líquido es espeso. Sabe a hierro.' },
  { id: 'pocion_azul', name: 'Poción Azul', effect: 'healMP', effectDesc: 'Recupera 25% MP máximo', tier: 1, lore: 'Azul como el cielo que no has visto en días.' },
  { id: 'pocion_sombria', name: 'Poción Sombría', effect: 'healBoth', effectDesc: '+10% HP, +10% MP, +5% MAG (3t)', tier: 2, lore: 'La botella está tibia. El contenido se mueve solo.' },
  { id: 'antidoto', name: 'Antídoto', effect: 'curePoison', effectDesc: 'Cura veneno, infección y quemadura', tier: 1, lore: 'Huele peor que el veneno. Pero funciona.' },
  { id: 'pocion_vigor', name: 'Poción de Vigor', effect: 'vigor', effectDesc: 'Hambre→50, +10 Energía', tier: 2, lore: 'Sabe a tierra mojada y a desesperación.' },
  { id: 'elixir_oscuro', name: 'Elixir Oscuro', effect: 'darkElixir', effectDesc: '+40% HP, +40% MP, maldición 2t', tier: 3, lore: 'Cura todo. Cuesta todo. Casi.' },
  { id: 'pocion_vomito', name: 'Vómito Inducido', effect: 'reduceHunger', effectDesc: 'Reduce Hambre en 40 (si estás sobrealimentado)', tier: 1, lore: 'Sabe repugnante, pero libera el estómago al instante.' },
  { id: 'elixir_saciedad', name: 'Elixir de Saciedad', effect: 'increaseHunger', effectDesc: 'Aumenta Hambre en 35', tier: 1, lore: 'Un líquido denso que engaña a tu estómago vacío.' },
  { id: 'pergamino_fuego', name: 'Pergamino de Fuego', effect: 'fireDamage', effectDesc: 'Daño mágico = 30 + piso×2', tier: 2, lore: 'Las runas se encienden al desenrollarlo. Alguien lo escribió con urgencia.' },
  { id: 'pergamino_niebla', name: 'Pergamino de Niebla', effect: 'mistScroll', effectDesc: '+25% evasión (3t)', tier: 2, lore: 'El texto es ilegible. Al tocarlo, el aire se espesa.' },
  { id: 'pergamino_revelacion', name: 'Pergamino de Revelación', effect: 'revealScroll', effectDesc: 'Muestra estadísticas y debilidades del enemigo', tier: 1, lore: 'Muestra la verdad. No toda la verdad es útil.' },
  { id: 'pergamino_escape', name: 'Pergamino de Escape', effect: 'escapeScroll', effectDesc: 'Huye automáticamente (NO usable en jefes)', tier: 2, lore: 'Dice "CORRE" en cien idiomas. Algunos no son humanos.' },
];

export const BEVERAGES: BeverageDef[] = [
  { id: 'agua_turbia', name: 'Agua Turbia', energy: 12, effectDesc: '+12 Energía', tier: 1 },
  { id: 'vino_agrio', name: 'Vino Agrio', energy: 20, hunger: 3, effectDesc: '+20 Energía, +3 Hambre', tier: 1 },
  { id: 'brebaje', name: 'Brebaje Amargo', energy: 30, effectDesc: '+30 Energía', tier: 2 },
  { id: 'elixir_vigor', name: 'Elixir de Vigor', energy: 40, mpHeal: 10, effectDesc: '+40 Energía, +10 MP', tier: 2 },
  { id: 'nectar', name: 'Néctar de la Torre', energy: 55, mpHeal: 20, hunger: 5, effectDesc: '+55 Energía, +20 MP', tier: 3 },
];

export function getWeaponForFloor(floor: number, lck: number): WeaponDef {
  const maxTier = floor <= 15 ? 1 : floor <= 30 ? 2 : floor <= 50 ? 3 : floor <= 80 ? 4 : 5;
  const lckBonus = lck > 20 ? 1 : 0;
  const tier = Math.min(maxTier, Math.max(1, maxTier - 1 + (Math.random() < 0.3 + lckBonus * 0.1 ? 1 : 0)));
  const tierWeapons = WEAPONS.filter(w => w.tier === tier);
  return tierWeapons[Math.floor(Math.random() * tierWeapons.length)];
}

export function getFoodForFloor(floor: number, lck: number): FoodDef {
  const tiers: FoodDef['tier'][] = ['basura', 'comun', 'buena', 'excelente', 'legendaria'];
  const maxIdx = floor <= 10 ? 1 : floor <= 25 ? 2 : floor <= 50 ? 3 : 4;
  const roll = Math.random() + lck * 0.01;
  const idx = Math.min(maxIdx, Math.floor(roll * (maxIdx + 1)));
  const tier = tiers[Math.min(idx, tiers.length - 1)];
  const tierFoods = FOODS.filter(f => f.tier === tier);
  return tierFoods[Math.floor(Math.random() * tierFoods.length)] || FOODS[0];
}

export function getPotionForFloor(floor: number): PotionDef {
  const maxTier = floor <= 20 ? 1 : floor <= 50 ? 2 : 3;
  const available = POTIONS.filter(p => p.tier <= maxTier);
  return available[Math.floor(Math.random() * available.length)];
}

export function getBeverageForFloor(floor: number): BeverageDef {
  const maxTier = floor <= 20 ? 1 : floor <= 50 ? 2 : 3;
  const available = BEVERAGES.filter(b => b.tier <= maxTier);
  return available[Math.floor(Math.random() * available.length)];
}

export function getRelicForFloor(floor: number): RelicDef {
  const maxTier = floor <= 25 ? 1 : floor <= 60 ? 2 : 3;
  const available = RELICS.filter(r => r.tier <= maxTier);
  return available[Math.floor(Math.random() * available.length)] || RELICS[0];
}
