export interface ClassDef {
  id: string; name: string; desc: string; lore: string;
  stats: Record<string, number>; caps: Record<string, number>;
  affinity: string[]; specials: { mas: number; name: string; desc: string; effect: string }[];
  locked?: boolean; unlockReq?: string;
}

export const CLASSES: ClassDef[] = [
  {
    id: 'caballero', name: 'Caballero', desc: 'Tanque defensivo. Primera línea duradera.',
    lore: 'Viste armadura porque cree que lo protegerá. La torre le enseñará que nada protege.',
    stats: { hp: 120, mp: 30, atk: 12, def: 14, mag: 6, int: 6, spd: 7, lck: 6, mas: 0 },
    caps: { hp: 400, mp: 80, atk: 45, def: 60, mag: 25, int: 25, spd: 30, lck: 30 },
    affinity: ['paladin', 'guerrero'],
    specials: [
      { mas: 10, name: 'Escudo Inquebrantable', desc: 'DEF +40% por 3 turnos', effect: 'shieldBuff' },
      { mas: 25, name: 'Carga Sagrada', desc: 'ATK alto + 25% Stun', effect: 'holyCharge' },
      { mas: 50, name: 'Bastión', desc: 'Reduce TODO daño 60% por 1 turno, cuesta HP', effect: 'bastion' },
      { mas: 100, name: 'Voluntad de Acero', desc: 'Auto-revive al 20% HP (1/combate)', effect: 'lastStand' },
    ]
  },
  {
    id: 'mago', name: 'Mago', desc: 'Daño mágico explosivo. Alto MAG y MP.',
    lore: 'El conocimiento es poder. Aquí, el poder es corrupción.',
    stats: { hp: 80, mp: 80, atk: 6, def: 6, mag: 16, int: 15, spd: 10, lck: 8, mas: 0 },
    caps: { hp: 250, mp: 200, atk: 20, def: 25, mag: 65, int: 60, spd: 35, lck: 40 },
    affinity: ['brujo'],
    specials: [
      { mas: 10, name: 'Tormenta Arcana', desc: 'Daño MAG masivo (alto costo MP)', effect: 'arcaneStorm' },
      { mas: 25, name: 'Barrera de Mana', desc: 'Convierte MP en escudo temporal', effect: 'manaBarrier' },
      { mas: 50, name: 'Canalización', desc: 'Pierde turno, duplica daño del siguiente hechizo', effect: 'channel' },
      { mas: 100, name: 'Drenaje Arcano', desc: 'Roba MP del enemigo, recupera MP propio', effect: 'arcaneDrain' },
    ]
  },
  {
    id: 'picaro', name: 'Pícaro', desc: 'Velocidad, críticos y oportunismo.',
    lore: 'Sobrevive con astucia. La astucia es otra palabra para cobardía útil.',
    stats: { hp: 90, mp: 40, atk: 11, def: 8, mag: 7, int: 8, spd: 15, lck: 14, mas: 0 },
    caps: { hp: 300, mp: 100, atk: 40, def: 30, mag: 30, int: 35, spd: 60, lck: 55 },
    affinity: ['guerrero'],
    specials: [
      { mas: 10, name: 'Golpe Traicionero', desc: 'Crit garantizado si enemigo HP>70%', effect: 'sneakCrit' },
      { mas: 25, name: 'Evasión Perfecta', desc: 'Esquiva los próximos 2 ataques', effect: 'perfectDodge' },
      { mas: 50, name: 'Veneno de Sombra', desc: 'Veneno fuerte + -20% ATK enemigo', effect: 'shadowPoison' },
      { mas: 100, name: 'Robo de Fortuna', desc: 'Roba TODOS los buffs del enemigo', effect: 'stealBuffs' },
    ]
  },
  {
    id: 'paladin', name: 'Paladín', desc: 'Guerrero santo equilibrado.',
    lore: 'Cree en la luz. La luz no cree en él. Pero pelea igual.',
    stats: { hp: 110, mp: 50, atk: 11, def: 11, mag: 11, int: 11, spd: 10, lck: 9, mas: 0 },
    caps: { hp: 380, mp: 140, atk: 45, def: 50, mag: 45, int: 45, spd: 35, lck: 35 },
    affinity: ['caballero', 'mago'],
    locked: true, unlockReq: 'Derrota al Paladín Oscuro',
    specials: [
      { mas: 10, name: 'Juicio Luminoso', desc: 'Daño híbrido MAG+ATK', effect: 'holyJudge' },
      { mas: 25, name: 'Aura de Protección', desc: 'DEF+25% + Regen 5% HP/turno (3t)', effect: 'protectAura' },
      { mas: 50, name: 'Sacrificio', desc: 'Gasta 30% HP para daño verdadero', effect: 'sacrifice' },
      { mas: 100, name: 'Resurrección Sagrada', desc: 'Revive completo (consume todo MP)', effect: 'resurrect' },
    ]
  },
  {
    id: 'guerrero', name: 'Guerrero', desc: 'Destrucción física bruta.',
    lore: 'No necesita magia. No necesita estrategia. Solo necesita que sangres.',
    stats: { hp: 115, mp: 25, atk: 16, def: 10, mag: 5, int: 5, spd: 10, lck: 8, mas: 0 },
    caps: { hp: 420, mp: 60, atk: 70, def: 50, mag: 20, int: 20, spd: 40, lck: 30 },
    affinity: ['caballero', 'picaro'],
    locked: true, unlockReq: 'Derrota al Guerrero Oscuro',
    specials: [
      { mas: 10, name: 'Furia Berserker', desc: '+50% ATK pero -30% DEF (3t)', effect: 'fury' },
      { mas: 25, name: 'Ejecución', desc: 'Daño masivo si enemigo HP<25% (×2.5)', effect: 'execute' },
      { mas: 50, name: 'Grito de Guerra', desc: '+25% ATK y SPD, cuesta HP', effect: 'warCry' },
      { mas: 100, name: 'Golpe Devastador', desc: 'Ignora 50% DEF enemigo', effect: 'devastate' },
    ]
  },
  {
    id: 'brujo', name: 'Brujo', desc: 'Magia oscura y caos. Sacrificio por poder.',
    lore: 'Abraza la oscuridad. La oscuridad lo abraza de vuelta. Más fuerte.',
    stats: { hp: 85, mp: 70, atk: 7, def: 7, mag: 18, int: 16, spd: 9, lck: 12, mas: 0 },
    caps: { hp: 280, mp: 180, atk: 25, def: 30, mag: 70, int: 65, spd: 30, lck: 50 },
    affinity: ['mago'],
    locked: true, unlockReq: 'Derrota al Brujo Oscuro',
    specials: [
      { mas: 10, name: 'Pacto de Sangre', desc: 'Gasta HP para hechizo gratis (sin MP)', effect: 'bloodPact' },
      { mas: 25, name: 'Maldición Eterna', desc: '-20% TODOS stats enemigo (4t)', effect: 'eternalCurse' },
      { mas: 50, name: 'Invocación Oscura', desc: 'Sombra ataca 30% MAG/turno (3t)', effect: 'darkSummon' },
      { mas: 100, name: 'Desgarro Dimensional', desc: 'Efecto masivo aleatorio devastador', effect: 'dimensionalRift' },
    ]
  },
  {
    id: 'humano', name: 'Humano', desc: 'Inicio débil. Escala ×2. Todas las afinidades.',
    lore: 'El más débil. El más humano. El más peligroso. Porque un humano que sube lo suficiente se convierte en lo que combate.',
    stats: { hp: 75, mp: 35, atk: 8, def: 8, mag: 8, int: 8, spd: 8, lck: 8, mas: 0 },
    caps: { hp: 500, mp: 250, atk: 60, def: 55, mag: 60, int: 55, spd: 50, lck: 50 },
    affinity: ['caballero', 'mago', 'picaro', 'paladin', 'guerrero', 'brujo'],
    locked: true, unlockReq: '4to clear del piso 100',
    specials: [
      { mas: 10, name: 'Adaptación', desc: 'Copia última habilidad enemiga (1/combate)', effect: 'adapt' },
      { mas: 25, name: 'Supervivencia', desc: 'HP<15%: regen 15% HP/turno (2t, 1/combate)', effect: 'survive' },
      { mas: 50, name: 'Voluntad Humana', desc: 'Inmune a estados por 2 turnos', effect: 'ironWill' },
      { mas: 100, name: 'Trascendencia', desc: 'Daño = 50% de TODOS stats permanentes', effect: 'transcend' },
    ]
  }
];
