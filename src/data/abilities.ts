export interface Ability {
  id: string; name: string; icon: string; type: 'skill' | 'magic' | 'class';
  cost: number; costType?: 'mp' | 'hp' | 'none'; // default mp
  desc: string; power: number;
  effect?: string; classes: string[]; scaling: 'atk' | 'mag';
  fromEnemy?: boolean;
  chargeTurns?: number; // 0=instant, 1=next turn, etc
  passive?: boolean;
}

// Basic attacks per class (used when pressing "Atacar")
export const CLASS_ATTACKS: Record<string, { name: string; icon: string }> = {
  caballero: { name: 'Espadazo', icon: '⚔️' },
  mago: { name: 'Misil Arcano', icon: '✨' },
  picaro: { name: 'Puñalada', icon: '🗡️' },
  paladin: { name: 'Mazazo', icon: '🔨' },
  guerrero: { name: 'Hachazo', icon: '🪓' },
  brujo: { name: 'Ascua Vil', icon: '🔥' },
  humano: { name: 'Garrote', icon: '🏏' },
};

export const ABILITIES: Ability[] = [
  // ========== CLASS ABILITIES (button 1 "Clase") ==========
  { id: 'guardia', name: 'Guardia', icon: '🛡️', type: 'class', cost: 0, costType: 'none', desc: 'DEF +50% este turno. Contraataca 20%.', power: 0, effect: 'guard', scaling: 'atk', classes: ['caballero'] },
  { id: 'orbe_replicante', name: 'Orbe Replicante', icon: '🔮', type: 'class', cost: 4, desc: 'Replica tu última magia al 50% sin buffs.', power: 0.5, effect: 'replicate', scaling: 'mag', classes: ['mago'] },
  { id: 'robar', name: 'Robar', icon: '🤏', type: 'class', cost: 0, costType: 'none', desc: 'Roba item o comida. Max 3/combate. Puede fallar.', power: 0, effect: 'steal', scaling: 'atk', classes: ['picaro'] },
  { id: 'consagracion', name: 'Consagración', icon: '✝️', type: 'class', cost: 8, desc: 'Cura 3% HP y daña 5% HP enemigo por 5 turnos.', power: 0, effect: 'consecrate', scaling: 'mag', classes: ['paladin'] },
  { id: 'furia', name: 'Furia', icon: '💢', type: 'class', cost: 0, costType: 'hp', desc: 'ATK +150%, SPD +50% por 3 turnos. Cuesta 10% HP.', power: 0, effect: 'fury', scaling: 'atk', classes: ['guerrero'] },
  { id: 'fuego_vil', name: 'Fuego Vil', icon: '🔥', type: 'class', cost: 12, desc: '300% MAG + quemadura 11% HP base. Carga 1 turno.', power: 3.0, effect: 'vileFire', scaling: 'mag', classes: ['brujo'], chargeTurns: 1 },
  { id: 'ser', name: 'Ser', icon: '👤', type: 'class', cost: 0, costType: 'none', desc: 'Pasiva: 2x EXP. Activa: usa habilidad de otra clase.', power: 0, effect: 'humanBeing', scaling: 'atk', classes: ['humano'] },

  // ========== CLASS SKILLS (button 2 "Técnica") ==========
  // Caballero
  { id: 'estocada_cab', name: 'Estocada', icon: '🗡️', type: 'skill', cost: 4, desc: '140% ATK. Requiere precisión (SPD check).', power: 1.4, effect: 'precisionHit', scaling: 'atk', classes: ['caballero'] },
  { id: 'embestida', name: 'Embestida', icon: '🐂', type: 'skill', cost: 6, desc: '120% ATK + aturde 1 turno.', power: 1.2, effect: 'stun', scaling: 'atk', classes: ['caballero'] },
  // Mago
  { id: 'teletransportar', name: 'Teletransportación', icon: '💨', type: 'skill', cost: 10, desc: 'Huye del combate (consume MP). No en jefes.', power: 0, effect: 'flee', scaling: 'mag', classes: ['mago'] },
  // Pícaro
  { id: 'huir_picaro', name: 'Huir', icon: '💨', type: 'skill', cost: 0, costType: 'none', desc: 'Huye sin consumo. No en jefes.', power: 0, effect: 'flee', scaling: 'atk', classes: ['picaro'] },
  { id: 'punalada_crit', name: 'Puñalada Crítica', icon: '🎯', type: 'skill', cost: 5, desc: '130% ATK. Alto crit (LCK+SPD check).', power: 1.3, effect: 'critUp', scaling: 'atk', classes: ['picaro'] },
  { id: 'corte_furtivo', name: 'Corte Furtivo', icon: '🌙', type: 'skill', cost: 3, desc: '80% ATK. Siempre primero. Pasivo si emboscado.', power: 0.8, effect: 'alwaysFirst', scaling: 'atk', classes: ['picaro'], passive: true },
  // Paladín
  { id: 'sablazo', name: 'Sablazo', icon: '⚔️', type: 'skill', cost: 5, desc: '150% ATK. Golpe sagrado.', power: 1.5, scaling: 'atk', classes: ['paladin'] },
  { id: 'corte_sacro', name: 'Corte Sacro', icon: '✨', type: 'skill', cost: 7, desc: '130% ATK + 30% chance quemadura sagrada.', power: 1.3, effect: 'holyBurn', scaling: 'atk', classes: ['paladin'] },
  { id: 'justicia', name: 'Justicia', icon: '⚖️', type: 'skill', cost: 8, desc: '140% ATK + 50% chance aturdir.', power: 1.4, effect: 'stunHigh', scaling: 'atk', classes: ['paladin'] },
  { id: 'sellar', name: 'Sellar', icon: '🔇', type: 'skill', cost: 6, desc: 'Silencia magia enemiga 3 turnos.', power: 0, effect: 'silence', scaling: 'atk', classes: ['paladin'] },
  // Guerrero
  { id: 'golpe_pesado_g', name: 'Golpe Pesado', icon: '🔨', type: 'skill', cost: 5, desc: '180% ATK puro.', power: 1.8, scaling: 'atk', classes: ['guerrero'] },
  { id: 'grito_batalla', name: 'Grito de Batalla', icon: '📢', type: 'skill', cost: 4, costType: 'hp', desc: '+5 ATK por 3 turnos. Cuesta HP.', power: 0, effect: 'warCry', scaling: 'atk', classes: ['guerrero'] },
  { id: 'salto_gancho', name: 'Salto y Gancho', icon: '🪝', type: 'skill', cost: 7, desc: '160% ATK + aturde 1 turno.', power: 1.6, effect: 'stun', scaling: 'atk', classes: ['guerrero'] },
  // Brujo
  { id: 'invocar_sombra', name: 'Invocar Sombra', icon: '👤', type: 'skill', cost: 10, desc: 'Escudo: absorbe daño (25% HP brujo). Carga 1t.', power: 0, effect: 'summonShadow', scaling: 'mag', classes: ['brujo'], chargeTurns: 1 },
  { id: 'invocar_diablillo', name: 'Invocar Diablillo', icon: '😈', type: 'skill', cost: 14, desc: 'Daña enemigo 20% stats/turno. Carga 1t.', power: 0, effect: 'summonImp', scaling: 'mag', classes: ['brujo'], chargeTurns: 1 },
  { id: 'invocar_golem', name: 'Invocar Gólem', icon: '🗿', type: 'skill', cost: 20, desc: '75% stats brujo. Mitiga 33% daño. Carga 3t.', power: 0, effect: 'summonGolem', scaling: 'mag', classes: ['brujo'], chargeTurns: 3 },
  // Humano
  { id: 'patada', name: 'Patada', icon: '🦵', type: 'skill', cost: 3, desc: '150% ATK + bajo % aturdir.', power: 1.5, effect: 'stunLow', scaling: 'atk', classes: ['humano'] },
  { id: 'locura', name: 'Locura', icon: '🤪', type: 'skill', cost: 0, costType: 'hp', desc: '-2% HP, 250% ATK. Desesperación.', power: 2.5, effect: 'selfHarm', scaling: 'atk', classes: ['humano'] },
  { id: 'inventiva', name: 'Inventiva', icon: '💡', type: 'skill', cost: 4, desc: '+30% crit por 3 turnos.', power: 0, effect: 'critBuff', scaling: 'atk', classes: ['humano'] },
  { id: 'hambre_miedo', name: 'Hambre y Miedo', icon: '😨', type: 'skill', cost: 3, desc: '100% ATK + roba hambre. Muerde y recupera.', power: 1.0, effect: 'biteFeed', scaling: 'atk', classes: ['humano'] },
  { id: 'desesperacion', name: 'Desesperación', icon: '💥', type: 'skill', cost: 6, desc: 'Golpea 1-5 veces. Pueden ser críticos.', power: 0.6, effect: 'multiRandom', scaling: 'atk', classes: ['humano'] },
  { id: 'golpe_certero', name: 'Golpe Certero', icon: '🎯', type: 'skill', cost: 8, desc: 'Carga 1t. Siempre crítico, ignora 15% DEF.', power: 1.8, effect: 'chargedCrit', scaling: 'atk', classes: ['humano'], chargeTurns: 1 },

  // ========== CLASS MAGICS (button 4 "Magia") ==========
  // Mago
  { id: 'proyectil_arcano', name: 'Proyectil Arcano', icon: '✨', type: 'magic', cost: 6, desc: '150% MAG.', power: 1.5, scaling: 'mag', classes: ['mago', 'humano'] },
  { id: 'piroexplosion', name: 'Piroexplosión', icon: '💥', type: 'magic', cost: 12, desc: '220% MAG + quemadura.', power: 2.2, effect: 'burn', scaling: 'mag', classes: ['mago'] },
  // Paladín
  { id: 'cura_pal', name: 'Cura', icon: '💚', type: 'magic', cost: 8, desc: 'Cura 25% HP máx.', power: 0.25, effect: 'heal', scaling: 'mag', classes: ['paladin'] },
  { id: 'limpia', name: 'Limpia', icon: '🧹', type: 'magic', cost: 5, desc: 'Retira venenos, quemaduras e infecciones.', power: 0, effect: 'cleanse', scaling: 'mag', classes: ['paladin'] },
  // Brujo
  { id: 'piro_brujo', name: 'Piroexplosión', icon: '💥', type: 'magic', cost: 10, desc: '200% MAG + quemadura.', power: 2.0, effect: 'burn', scaling: 'mag', classes: ['brujo'] },
  { id: 'fuego_acido', name: 'Fuego Ácido', icon: '🧪', type: 'magic', cost: 8, desc: '140% MAG + veneno + quemadura.', power: 1.4, effect: 'poisonBurn', scaling: 'mag', classes: ['brujo'] },
  // Humano
  { id: 'malicia', name: 'Malicia', icon: '😈', type: 'magic', cost: 7, desc: '-50% precisión enemigo por 3 turnos.', power: 0, effect: 'blind', scaling: 'mag', classes: ['humano'] },

  // ========== ENEMY-LEARNABLE ABILITIES ==========
  { id: 'garra_salvaje', name: 'Garra Salvaje', icon: '🐺', type: 'skill', cost: 4, desc: '150% ATK.', power: 1.5, scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'aullido', name: 'Aullido', icon: '🌕', type: 'skill', cost: 3, desc: '+20% SPD 3t.', power: 0, effect: 'spdBuff', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'drenar_vida', name: 'Drenar Vida', icon: '🧛', type: 'skill', cost: 5, desc: '120% ATK. Roba 40% como HP.', power: 1.2, effect: 'drain', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'mordida_infecciosa', name: 'Mordida Infecciosa', icon: '🧟', type: 'skill', cost: 3, desc: '80% ATK + veneno.', power: 0.8, effect: 'poison', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'frenesi', name: 'Frenesí', icon: '🤪', type: 'skill', cost: 6, desc: '3 golpes a 50%.', power: 0.5, effect: 'multiHit3', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'toque_gelido', name: 'Toque Gélido', icon: '🥶', type: 'skill', cost: 4, desc: '100% ATK. -20% SPD 3t.', power: 1.0, effect: 'slow', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'mordisco_febril', name: 'Mordisco Febril', icon: '🤒', type: 'skill', cost: 5, desc: '110% ATK + veneno + quemadura.', power: 1.1, effect: 'poisonBurn', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'golpe_antinatural', name: 'Golpe Antinatural', icon: '👹', type: 'skill', cost: 6, desc: '130% ATK. Ignora 30% DEF.', power: 1.3, effect: 'pierce', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'zarpa_deforme', name: 'Zarpa Deforme', icon: '🧬', type: 'skill', cost: 5, desc: '150% ATK. -5% HP propio.', power: 1.5, effect: 'selfHarm', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'suplica', name: 'Súplica', icon: '🥺', type: 'skill', cost: 2, desc: '-15% ATK y MAG enemigo 2t.', power: 0, effect: 'guilt', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'golpe_hierro', name: 'Golpe de Hierro', icon: '🤖', type: 'skill', cost: 6, desc: '150% ATK. No falla.', power: 1.5, effect: 'noMiss', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'flecha_certera', name: 'Flecha Certera', icon: '🏹', type: 'skill', cost: 5, desc: '140% ATK. +15% crit.', power: 1.4, effect: 'critUp', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'estocada_elfica', name: 'Estocada Élfica', icon: '⚔️', type: 'skill', cost: 5, desc: '130% ATK + sangrado.', power: 1.3, effect: 'bleed', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'embestida_salvaje', name: 'Embestida Salvaje', icon: '🐗', type: 'skill', cost: 5, desc: '140% ATK. -15% DEF enemigo.', power: 1.4, effect: 'defBreak', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'mordida_rabiosa', name: 'Mordida Rabiosa', icon: '🐕', type: 'skill', cost: 3, desc: '100% ATK + infección.', power: 1.0, effect: 'infection', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'zarpa_silenciosa', name: 'Zarpa Silenciosa', icon: '🐆', type: 'skill', cost: 4, desc: '130% ATK. Crit si HP>80%.', power: 1.3, effect: 'assassin', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'abrazo_oso', name: 'Abrazo de Oso', icon: '🐻', type: 'skill', cost: 7, desc: '180% ATK + aturde.', power: 1.8, effect: 'stun', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'picotazo_agorero', name: 'Picotazo Agüero', icon: '🐦', type: 'skill', cost: 4, desc: '100% ATK. -5 LCK 3t.', power: 1.0, effect: 'lckDrain', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'picada_aerea', name: 'Picada Aérea', icon: '🦇', type: 'skill', cost: 5, desc: '140% ATK.', power: 1.4, scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'trampa_acero', name: 'Trampa de Acero', icon: '⛓️', type: 'skill', cost: 6, desc: 'Aturde + -20% DEF 2t.', power: 0.5, effect: 'trapStun', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'decreto_real', name: 'Decreto Real', icon: '🤴', type: 'skill', cost: 6, desc: '+25% ATK y DEF 3t.', power: 0, effect: 'royalBuff', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'mimetismo', name: 'Mimetismo', icon: '🦫', type: 'skill', cost: 4, desc: 'Copia último ataque a 80%.', power: 0.8, effect: 'copyLast', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'ira_santa', name: 'Ira Santa', icon: '😇', type: 'skill', cost: 5, desc: '+25% crit 3t.', power: 0, effect: 'critBuff', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'rugido_abismo', name: 'Rugido del Abismo', icon: '🦁', type: 'skill', cost: 6, desc: '+25% ATK. Miedo al enemigo.', power: 0, effect: 'alphaBuff', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'disparo_certero', name: 'Disparo Certero', icon: '🎯', type: 'skill', cost: 6, desc: '150% ATK. No falla.', power: 1.5, effect: 'noMiss', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'presagio', name: 'Presagio', icon: '🐦', type: 'skill', cost: 3, desc: '+25% crit 3t.', power: 0, effect: 'critBuff', scaling: 'atk', classes: [], fromEnemy: true },

  // Enemy magics
  { id: 'sombra_vampirica', name: 'Sombra Vampírica', icon: '🧛', type: 'magic', cost: 6, desc: '+15% evasión 2t.', power: 0, effect: 'evasionBuff', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'curacion_oscura', name: 'Curación Oscura', icon: '⛪', type: 'magic', cost: 8, desc: 'Cura 25% HP.', power: 0.25, effect: 'heal', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'viento_cortante', name: 'Viento Cortante', icon: '💨', type: 'magic', cost: 6, desc: '120% MAG.', power: 1.2, scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'llama_divina', name: 'Llama Divina', icon: '👼', type: 'magic', cost: 10, desc: '180% MAG + quemadura.', power: 1.8, effect: 'burn', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'mirada_paralizante', name: 'Mirada Paralizante', icon: '👁️', type: 'magic', cost: 8, desc: 'Aturde 1t.', power: 0, effect: 'stun', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'lagrimas_luz', name: 'Lágrimas de Luz', icon: '😇', type: 'magic', cost: 8, desc: 'Cura 30% HP.', power: 0.3, effect: 'heal', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'caos_dimensional', name: 'Caos Dimensional', icon: '🌀', type: 'magic', cost: 10, desc: 'Efecto aleatorio devastador.', power: 2.0, effect: 'chaos', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'juicio_final', name: 'Juicio Final', icon: '👑', type: 'magic', cost: 15, desc: '200% MAG divino.', power: 2.0, scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'paranoia_mag', name: 'Paranoia', icon: '💀', type: 'magic', cost: 7, desc: 'Confusión 2t.', power: 0, effect: 'confusion', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'lamento', name: 'Lamento', icon: '👻', type: 'magic', cost: 6, desc: '130% MAG. 20% aturde.', power: 1.3, effect: 'stunChance', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'palabra_prohibida', name: 'Palabra Prohibida', icon: '📖', type: 'magic', cost: 7, desc: '130% MAG.', power: 1.3, scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'tributo_sangre', name: 'Tributo de Sangre', icon: '🩸', type: 'magic', cost: 8, desc: '120% MAG. Roba 50% HP.', power: 1.2, effect: 'drain', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'aura_terror', name: 'Aura de Terror', icon: '😨', type: 'magic', cost: 8, desc: '-10% stats enemigo 2t.', power: 0, effect: 'terrorDebuff', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'regeneracion_aberrante', name: 'Regeneración', icon: '🧬', type: 'magic', cost: 7, desc: 'Cura 15% HP + buff.', power: 0.15, effect: 'healBuff', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'nube_toxica', name: 'Nube Tóxica', icon: '🦠', type: 'magic', cost: 8, desc: 'Veneno + quemadura + -SPD.', power: 0, effect: 'toxicAll', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'plaga_mayor', name: 'Plaga Mayor', icon: '☠️', type: 'magic', cost: 10, desc: 'Veneno, quemadura, debuffs.', power: 0, effect: 'plagueAll', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'cepa_mutante', name: 'Cepa Mutante', icon: '🧪', type: 'magic', cost: 9, desc: 'Debuff que cambia cada turno.', power: 0, effect: 'evolvingDebuff', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'encantamiento_austral', name: 'Encantamiento Austral', icon: '🦌', type: 'magic', cost: 9, desc: '160% MAG + congela.', power: 1.6, effect: 'freeze', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'canto_distorsionado', name: 'Canto Distorsionado', icon: '🧝', type: 'magic', cost: 8, desc: 'Intercambia stat con enemigo 2t.', power: 0, effect: 'statSwap', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'magia_primordial', name: 'Magia Primordial', icon: '🎭', type: 'magic', cost: 12, desc: 'Escala con piso.', power: 1.0, effect: 'floorScale', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'maldicion_portador', name: 'Maldición Portador', icon: '🛡️', type: 'magic', cost: 7, desc: '-10% stats 3t.', power: 0, effect: 'curseAll', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'tormenta_hojas', name: 'Tormenta de Hojas', icon: '🍃', type: 'magic', cost: 9, desc: '3 golpes mágicos a 50%.', power: 0.5, effect: 'multiHit3', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'nova_primal', name: 'Nova Primal', icon: '💥', type: 'magic', cost: 14, desc: '200% MAG. -15% HP propio.', power: 2.0, effect: 'selfHarm', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'corona_solar', name: 'Corona Solar', icon: '☀️', type: 'magic', cost: 12, desc: '200% MAG + quemadura.', power: 2.0, effect: 'burn', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'luz_cegadora', name: 'Luz Cegadora', icon: '🕊️', type: 'magic', cost: 8, desc: '150% MAG + ceguera.', power: 1.5, effect: 'blind', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'garra_rey', name: 'Garra del Rey', icon: '🦁', type: 'skill', cost: 7, desc: '170% ATK + sangrado.', power: 1.7, effect: 'bleed', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'coraza_oxidada', name: 'Coraza Oxidada', icon: '🤖', type: 'skill', cost: 5, desc: '+40% DEF, -20% SPD 3t.', power: 0, effect: 'tankBuff', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'paso_viento', name: 'Paso del Viento', icon: '💨', type: 'skill', cost: 4, desc: '+30% SPD, +15% evasión 2t.', power: 0, effect: 'speedBuff', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'contraataque', name: 'Contraataque', icon: '↩️', type: 'skill', cost: 5, desc: 'Refleja 40% daño físico 1t.', power: 0, effect: 'reflect', scaling: 'atk', classes: [], fromEnemy: true },
  { id: 'caida_cielo', name: 'Caída del Cielo', icon: '💫', type: 'magic', cost: 15, desc: '150% MAG. Ineludible.', power: 1.5, effect: 'noMiss', scaling: 'mag', classes: [], fromEnemy: true },
  { id: 'trono_cenizas', name: 'Trono de Cenizas', icon: '👑', type: 'magic', cost: 14, desc: '-15% stats 4t.', power: 0, effect: 'drainAll', scaling: 'mag', classes: [], fromEnemy: true },
  // Perdonar (Paladín)
  { id: 'perdonar', name: 'Perdonar', icon: '🕊️', type: 'skill', cost: 5, desc: 'Si enemigo HP<25%. Recuperas stats, sin EXP.', power: 0, effect: 'mercy', scaling: 'atk', classes: ['paladin', 'humano'] },
];

export function getAbilitiesForClass(classId: string, type: 'skill' | 'magic'): Ability[] {
  return ABILITIES.filter(a => a.type === type && a.classes.includes(classId));
}

export function getClassAbility(classId: string): Ability | undefined {
  return ABILITIES.find(a => a.type === 'class' && a.classes.includes(classId));
}

export function getAbilityById(id: string): Ability | undefined {
  return ABILITIES.find(a => a.id === id);
}
