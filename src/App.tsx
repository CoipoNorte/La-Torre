import { useState, useEffect, useCallback, useRef } from 'react';
import { CLASSES, type ClassDef } from './data/classes';
import { ENEMIES, ENEMY_EMOJI, getEnemiesForFloor, getBossForFloor, scaleEnemy, type EnemyDef } from './data/enemies';
import { WEAPONS, FOODS, POTIONS, CLASS_WEAPONS, getWeaponForFloor, getFoodForFloor, getPotionForFloor, getBeverageForFloor, type WeaponDef, type FoodDef, type PotionDef, type BeverageDef } from './data/items';
import { getFloorText, COMBAT_INTROS, COMBAT_OUTROS, REST_TEXTS, OBSERVATION_TEXTS, MEDITATION_TEXTS, pick } from './data/narrative';
import { FOUND_NOTES, WALL_INSCRIPTIONS } from './data/notes';
import { ABILITIES, getAbilitiesForClass, getClassAbility, CLASS_ATTACKS } from './data/abilities';

import type { Ability } from './data/abilities';
import { saveData, loadData, deleteData } from './lib/db';
import { calcDamage, calcMagicDamage, rollCrit, rollDodge, getHungerZone, getHungerDecrease, calcStatGain } from './lib/formulas';
import { initAudio, sfxHit, sfxMagic, sfxDamage, sfxHeal, sfxLevelUp, sfxDeath, sfxBossWarning, sfxEat, sfxSwap, sfxAmbush, sfxObserve, sfxMeditate, sfxClick, setMusicState, setSfxEnabled, setMusicEnabled, setMusicVolume, setSfxVolume, stopMusic } from './lib/audio';
import { speak, stopNarrator, setNarratorEnabled, setNarratorVolume, setNarratorRate, setNarratorVoice, setNarratorVoiceIdx, getAvailableVoices } from './lib/narrator';

// ==================== TYPES ====================
interface GameStats {
  hp: number; maxHp: number; mp: number; maxMp: number;
  atk: number; def: number; mag: number; int: number; spd: number; lck: number; mas: number;
}
interface StatusEffect { id: string; name: string; turns: number; stat?: string; value?: number; }
interface CombatEnemy {
  def: EnemyDef; hp: number; maxHp: number; mp: number; buffs: StatusEffect[];
}
interface RunState {
  className: string; floor: number; day: number;
  stats: GameStats; permStats: GameStats;
  hunger: number; energy: number;
  weapons: WeaponDef[]; equippedWeapon: number;
  foods: FoodDef[]; potions: PotionDef[]; beverages: BeverageDef[];
  combatLog: string[]; score: number; kills: number; bossKills: number;
  consecutiveRests: number; lastFloorRested: boolean;
  buffs: StatusEffect[];
  skills: string[]; magics: string[];
  narrativePhase: number;
  level: number; exp: number; expToNext: number;
}
interface GlobalProfile {
  unlockedClasses: string[]; ascendedClasses: string[];
  bestiary: Record<string, { seen: boolean; killed: number }>;
  highScores: { cls: string; floor: number; day: number; score: number; date: string }[];
  foundNotes: number[];
  classProgress: Record<string, { level: number; exp: number; expToNext: number; skills: string[]; magics: string[]; permStats: GameStats }>;
  discoveredItems: string[]; // ids of weapons/potions/foods ever found
  settings: { musicEnabled: boolean; sfxEnabled: boolean; musicVol: number; sfxVol: number; textSpeed: number; narratorEnabled: boolean; narratorVol: number; narratorRate: number; narratorVoice: 'male' | 'female' };
}
type Screen = 'start' | 'charSelect' | 'tower' | 'death' | 'victory' | 'bestiary' | 'scores';
type Phase = 'arrival' | 'decision' | 'observation' | 'meditation' | 'combat' | 'postCombat' | 'rest' | 'itemFound' | 'empty';

const DEFAULT_PROFILE: GlobalProfile = {
  unlockedClasses: ['caballero', 'mago', 'picaro'],
  ascendedClasses: [], bestiary: {}, highScores: [], foundNotes: [], classProgress: {}, discoveredItems: [],
  settings: { musicEnabled: true, sfxEnabled: true, musicVol: 0.3, sfxVol: 0.6, textSpeed: 30, narratorEnabled: false, narratorVol: 0.8, narratorRate: 0.85, narratorVoice: 'female' as const }
};

// ==================== HELPERS ====================
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const pct = (chance: number) => Math.random() * 100 < chance;

function makeStats(cls: ClassDef): GameStats {
  return {
    hp: cls.stats.hp, maxHp: cls.stats.hp, mp: cls.stats.mp, maxMp: cls.stats.mp,
    atk: cls.stats.atk, def: cls.stats.def, mag: cls.stats.mag,
    int: cls.stats.int, spd: cls.stats.spd, lck: cls.stats.lck, mas: cls.stats.mas || 0,
  };
}

function newRun(className: string, savedProgress?: { level: number; exp: number; expToNext: number; skills: string[]; magics: string[]; permStats: GameStats }): RunState {
  const cls = CLASSES.find(c => c.id === className)!;
  const baseStats = makeStats(cls);
  const startWeapon = CLASS_WEAPONS[className] || WEAPONS[0];
  // ALL class skills and magics are available from the start
  const startSkills = getAbilitiesForClass(className, 'skill').map(a => a.id);
  const startMagics = getAbilitiesForClass(className, 'magic').map(a => a.id);

  // ROGUELIKE: If there's saved progress for this class, restore level/skills/stats
  if (savedProgress) {
    const s = { ...savedProgress.permStats, hp: savedProgress.permStats.maxHp, mp: savedProgress.permStats.maxMp };
    // Merge skills: keep saved + add any class starters not yet known
    const mergedSkills = [...new Set([...savedProgress.skills, ...startSkills])];
    const mergedMagics = [...new Set([...savedProgress.magics, ...startMagics])];
    return {
      className, floor: 1, day: 1, stats: s, permStats: { ...s },
      hunger: 55, energy: 70,
      weapons: [startWeapon], equippedWeapon: 0,
      foods: [FOODS[1]], potions: [POTIONS[0]], beverages: [],
      combatLog: [], score: 0, kills: 0, bossKills: 0,
      consecutiveRests: 0, lastFloorRested: false,
      buffs: [], skills: mergedSkills, magics: mergedMagics,
      narrativePhase: 0,
      level: savedProgress.level, exp: savedProgress.exp, expToNext: savedProgress.expToNext,
    };
  }

  return {
    className, floor: 1, day: 1, stats: baseStats, permStats: { ...baseStats },
    hunger: 55, energy: 70,
    weapons: [startWeapon], equippedWeapon: 0,
    foods: [FOODS[1]], potions: [POTIONS[0]], beverages: [],
    combatLog: [], score: 0, kills: 0, bossKills: 0,
    consecutiveRests: 0, lastFloorRested: false,
    buffs: [], skills: startSkills, magics: startMagics,
    narrativePhase: 0,
    level: 1, exp: 0, expToNext: 20,
  };
}

// ==================== STAT BAR COMPONENT ====================
function StatBar({ value, max, color, height = 'h-2' }: { value: number; max: number; color: string; height?: string }) {
  const pctVal = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`${height} rounded-sm overflow-hidden w-full`} style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className={`${height} ${color} transition-all duration-300`} style={{ width: `${pctVal}%` }} />
    </div>
  );
}

// ==================== TYPEWRITER ====================
function TypewriterText({ text, speed = 30, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idx = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    idx.current = 0;
    setDisplayed('');
    setDone(false);
    const timer = setInterval(() => {
      idx.current++;
      if (idx.current >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(timer);
        onDoneRef.current?.();
      } else {
        setDisplayed(text.slice(0, idx.current));
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <div className="font-mono text-sm text-white/70 leading-relaxed min-h-[3rem]">
      {displayed}
      {!done && <span className="animate-blink" style={{ color: '#8a6a3a' }}>▊</span>}
    </div>
  );
}

// ==================== MODAL ====================
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" />
      <div
        className="relative stone-bg gilt-border rounded-md overflow-y-auto scroll-styled animate-slideUpModal"
        style={{ maxWidth: 420, maxHeight: '85dvh', width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 px-4 py-3 flex justify-between items-center border-b border-rune/40"
          style={{ background: 'linear-gradient(180deg,#1a130c,#0d0906)' }}>
          <h2 className="font-display text-base tracking-wider text-bone/90">{title}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-sm btn-stone flex items-center justify-center">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function ActionListModal({ title, onClose, items, render }: { title: string; onClose: () => void; items: Ability[]; render: (a: Ability) => React.ReactNode }) {
  return (
    <Modal open onClose={onClose} title={title}>
      {items.length === 0 ? <p className="text-bone/40 font-type text-sm text-center py-6">No conoces ninguna.</p> : items.map(render)}
    </Modal>
  );
}

// ==================== MAIN APP ====================
export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [profile, setProfile] = useState<GlobalProfile>(DEFAULT_PROFILE);
  const [run, setRun] = useState<RunState | null>(null);
  const [phase, setPhase] = useState<Phase>('arrival');
  const [enemy, setEnemy] = useState<CombatEnemy | null>(null);
  const [floorText, setFloorText] = useState('');
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [ambushState, setAmbushState] = useState<'none' | 'player' | 'enemy'>('none');
  const [ambushTurns, setAmbushTurns] = useState(0);
  const [playerTurn, setPlayerTurn] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [restTab, setRestTab] = useState(0);
  const [meditationBuff, setMeditationBuff] = useState(false);
  const [postCombatData, setPostCombatData] = useState<{ enemyName: string; damageTaken: number; statsGained: Record<string, number>; weaponFound?: WeaponDef; itemFound?: string; learnedAbility?: string } | null>(null);
  const [, setCombatAction] = useState<string | null>(null);
  const [defending, setDefending] = useState(false);
  const [shakeEnemy, setShakeEnemy] = useState(false);
  const [shakePlayer, setShakePlayer] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [actionModal, setActionModal] = useState<null | 'skills' | 'magic' | 'items' | 'swap'>(null);
  const [floorEvent, setFloorEvent] = useState<null | 'altar' | 'espejo' | 'fuente' | 'cadaver' | 'susurro' | 'trampa' | 'niebla' | 'grieta'>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [pendingClass, setPendingClass] = useState('');
  const [showAbandon, setShowAbandon] = useState(false);
  const [chronicleTab, setChronicleTab] = useState(0);
  const [compendiumTab, setCompendiumTab] = useState(0);
  const [debugInGame, setDebugInGame] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const [enemyLunge, setEnemyLunge] = useState(false);
  const eyeClicks = useRef(0);
  const eyeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [floatDmg, setFloatDmg] = useState<{ id: number; val: string; crit: boolean; side: 'enemy' | 'player' } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const floatId = useRef(0);

  // Load profile
  useEffect(() => {
    loadData<GlobalProfile>('profile').then(p => { if (p) setProfile(p); });
    loadData<RunState>('currentRun').then(r => { if (r) setRun(r); });
  }, []);

  // Save profile
  const saveProfile = useCallback(async (p: GlobalProfile) => {
    setProfile(p);
    await saveData('profile', p);
  }, []);

  // Save run
  const saveRun = useCallback(async (r: RunState) => {
    setRun(r);
    await saveData('currentRun', r);
  }, []);

  // Auto-scroll combat log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combatLog]);

  // Init audio on first interaction
  const startAudio = useCallback(() => {
    if (!audioStarted) {
      initAudio();
      setAudioStarted(true);
      setSfxEnabled(profile.settings.sfxEnabled);
      setMusicEnabled(profile.settings.musicEnabled);
      setMusicVolume(profile.settings.musicVol);
      setSfxVolume(profile.settings.sfxVol);
      setNarratorEnabled(profile.settings.narratorEnabled);
      setNarratorVolume(profile.settings.narratorVol);
      setNarratorRate(profile.settings.narratorRate);
      setNarratorVoice(profile.settings.narratorVoice);
    }
  }, [audioStarted, profile.settings]);

  // Music state management
  useEffect(() => {
    if (!audioStarted) return;
    if (screen === 'start') setMusicState('menu');
    else if (screen === 'death') setMusicState('death');
    else if (screen === 'victory') setMusicState('victory');
    else if (screen === 'tower') {
      if (phase === 'combat') {
        if (enemy?.def.isBoss) setMusicState('boss');
        else setMusicState('combat');
      } else if (phase === 'rest') setMusicState('rest');
      else setMusicState('explore');
    }
  }, [screen, phase, enemy?.def.isBoss, audioStarted]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (screen !== 'tower' || !run) return;
      if (phase === 'combat' && playerTurn) {
        if (e.key === '1') doCombatAction('attack');
        if (e.key === '2') doCombatAction('defend');
        if (e.key === '3') doCombatAction('magic');
        if (e.key === '5') doCombatAction('potion');
        if (e.key === '6') doCombatAction('swap');
      }
      if (phase === 'decision') {
        if (e.key === 'a' || e.key === 'A') doFloorDecision('advance');
        if (e.key === 'o' || e.key === 'O') doFloorDecision('observe');
        if (e.key === 'd' || e.key === 'D') doFloorDecision('meditate');
      }
      if (e.key === 's' || e.key === 'S') setShowStats(v => !v);
      if (e.key === 'Escape') { setShowMenu(false); setShowStats(false); setShowSettings(false); }
      if (e.key === ' ' || e.key === 'Enter') {
        if (phase === 'arrival') setPhase('decision');
        if (phase === 'empty') advanceFloor();
        if (phase === 'postCombat') { /* handled by buttons */ }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ==================== GAME LOGIC ====================
  const getCls = () => CLASSES.find(c => c.id === run?.className);
  const getWeapon = (): WeaponDef | null => run ? run.weapons[run.equippedWeapon] || null : null;

  const getEffectiveStats = useCallback((): GameStats | null => {
    if (!run) return null;
    const s = { ...run.stats };
    const hz = getHungerZone(run.hunger);
    for (const [k, v] of Object.entries(hz.penalties)) {
      const key = k as keyof GameStats;
      if (typeof s[key] === 'number') {
        (s as Record<string, number>)[key] = Math.round(s[key] * (1 + v / 100));
      }
    }
    if (run.energy < 15) {
      for (const k of ['atk', 'def', 'mag', 'spd', 'lck'] as const) {
        s[k] = Math.round(s[k] * 0.85);
      }
    } else if (run.energy < 35) {
      for (const k of ['atk', 'def', 'mag', 'spd', 'lck'] as const) {
        s[k] = Math.round(s[k] * 0.92);
      }
    }
    for (const b of run.buffs) {
      if (b.stat && b.value) {
        (s as Record<string, number>)[b.stat] = (s[b.stat as keyof GameStats] || 0) + b.value;
      }
    }
    const w = getWeapon();
    if (w) { s.atk += w.atk; s.mag += w.mag; s.spd += w.spd; }
    return s;
  }, [run]);

  function addLog(msg: string) {
    setCombatLog(prev => [...prev.slice(-50), msg]);
  }

  function showFloat(val: string, crit: boolean, side: 'enemy' | 'player') {
    floatId.current++;
    const id = floatId.current;
    setFloatDmg({ id, val, crit, side });
    setTimeout(() => setFloatDmg(cur => (cur && cur.id === id ? null : cur)), 850);
  }

  // startFloor merged into advanceFloor and startNewGame/continueGame

  function doFloorDecision(choice: 'advance' | 'observe' | 'meditate') {
    if (!run) return;
    sfxClick();

    // 12% chance of floor event (non-boss floors)
    if (run.floor % 10 !== 0 && pct(12)) {
      const evs: ('altar' | 'espejo' | 'fuente' | 'cadaver' | 'susurro' | 'trampa' | 'niebla' | 'grieta')[] = ['altar', 'espejo', 'fuente', 'cadaver', 'susurro', 'trampa', 'niebla', 'grieta'];
      setFloorEvent(evs[Math.floor(Math.random() * evs.length)]);
      return;
    }

    // The tower grows more hostile with depth. danger scales enemy ambush chance.
    const danger = Math.min(28, Math.floor(run.floor / 4)); // up to +28% enemy ambush
    const lckDef = run.stats.lck * 0.35; // luck reduces enemy ambush

    if (choice === 'advance') {
      let playerAmbush: number, enemyAmbush: number;
      if (!run.lastFloorRested) {
        playerAmbush = 32 + run.stats.spd * 0.2;
        enemyAmbush = 20 + danger - lckDef;
      } else {
        // Resting dulls momentum but you're more rested/aware — still dangerous
        playerAmbush = 12 + run.stats.spd * 0.2;
        enemyAmbush = 14 + danger * 0.6 - lckDef;
      }
      // 3% chance to find a note while advancing
      if (pct(3)) tryFindNote();
      resolveAmbush(playerAmbush, enemyAmbush, () => startEncounter());
    } else if (choice === 'observe') {
      if (run.energy < 6) { addLog('⚠ No tienes suficiente energía para observar (6◈).'); return; }
      sfxObserve();
      saveRun({ ...run, energy: run.energy - 6 });
      setPhase('observation');

      const roll = Math.random() * 100;
      const lckBonus = run.stats.lck * 0.4;
      // Even careful observation is dangerous. Nothing is truly safe.
      if (roll < 26 + lckBonus) {
        // Enemy detected — you get the drop on it
        addLog(pick(OBSERVATION_TEXTS.found_enemy));
        setTimeout(() => resolveAmbush(50, 4 - lckDef * 0.2, () => startEncounter()), 1300);
      } else if (roll < 44 + lckBonus) {
        // Item found — but something may lurk (30% + danger)
        addLog(pick(OBSERVATION_TEXTS.found_item));
        findItem(pct(30 + danger));
      } else if (roll < 58 + lckBonus) {
        // Food found — lurking chance too
        addLog(pick(OBSERVATION_TEXTS.found_food));
        findFood(pct(25 + danger));
      } else if (roll < 68 + lckBonus) {
        // Potion + guaranteed nearby enemy
        addLog(pick(OBSERVATION_TEXTS.found_item));
        findPotion(true);
      } else if (roll < 74) {
        // Genuinely empty — rare, but may find a note
        addLog(pick(OBSERVATION_TEXTS.empty));
        if (pct(50)) tryFindNote();
        setPhase('empty');
      } else if (roll < 90) {
        // Hidden strong enemy — you still get the drop
        addLog(pick(OBSERVATION_TEXTS.hidden_enemy));
        setTimeout(() => { setAmbushState('player'); setAmbushTurns(2); startEncounter(true); }, 1300);
      } else {
        // Ambushed despite observing — the tower deceives
        addLog('💀 Creíste estar seguro. Algo te observaba a ti.');
        setTimeout(() => { setAmbushState('enemy'); setAmbushTurns(1); sfxAmbush(); startEncounter(); }, 1300);
      }
    } else if (choice === 'meditate') {
      if (run.hunger < 10) { addLog('⚠ Demasiada hambre para meditar (10▣).'); return; }
      if (run.energy < 5) { addLog('⚠ Demasiado cansado para meditar (5◈).'); return; }
      sfxMeditate();
      setMeditationBuff(true);
      const medText = pick(MEDITATION_TEXTS);
      addLog(medText);
      speak(medText);
      saveRun({ ...run, hunger: run.hunger - 4, energy: run.energy - 4 });
      setPhase('meditation');
      // Meditation is mental — you're vulnerable while entranced. Real risk.
      setTimeout(() => {
        const enemyAmbush = 16 + danger - lckDef;
        resolveAmbush(6, enemyAmbush, () => startEncounter());
      }, 1800);
    }
  }

  function discoverItem(id: string) {
    if (!profile.discoveredItems.includes(id)) {
      saveProfile({ ...profile, discoveredItems: [...profile.discoveredItems, id] });
    }
  }

  // Helper: can add item? (max 10 types, max 19 per type)
  function canAddItem<T extends {id:string}>(arr: T[], item: T): boolean {
    const sameCount = arr.filter(x => x.id === item.id).length;
    if (sameCount >= 19) return false; // max 19 per type
    const uniqueTypes = new Set(arr.map(x => x.id)).size;
    const isNewType = sameCount === 0;
    return !isNewType || uniqueTypes < 10;
  }

  function tryFindNote() {
    const available = FOUND_NOTES.map((_, i) => i).filter(i => !profile.foundNotes.includes(i));
    if (available.length === 0) return;
    const idx = available[Math.floor(Math.random() * available.length)];
    addLog(`📜 Encuentras una nota: "${FOUND_NOTES[idx].slice(0, 50)}..."`);
    saveProfile({ ...profile, foundNotes: [...profile.foundNotes, idx] });
  }

  function resolveAmbush(playerAmbush: number, enemyAmbush: number, then: () => void) {
    if (!run) return;
    const roll = Math.random() * 100;
    if (roll < playerAmbush) {
      setAmbushState('player');
      setAmbushTurns(run.stats.spd > 20 ? 2 : 1);
      addLog('⚔ ¡EMBOSCADA! El enemigo no te ha visto llegar.');
      sfxAmbush();
    } else if (roll < playerAmbush + Math.max(0, enemyAmbush)) {
      setAmbushState('enemy');
      setAmbushTurns(1);
      addLog('💀 ¡EMBOSCADO! Algo te ataca desde las sombras.');
      sfxAmbush();
    } else {
      setAmbushState('none');
      setAmbushTurns(0);
    }
    then();
  }

  function findItem(lurking = false) {
    if (!run) return;
    const w = getWeaponForFloor(run.floor, run.stats.lck);
    setPostCombatData({ enemyName: '', damageTaken: 0, statsGained: {}, weaponFound: w, itemFound: `Encontraste: ${w.name}` });
    if (run.weapons.length < 5) {
      saveRun({ ...run, weapons: [...run.weapons, w], score: run.score + 20 });
      addLog(`🗡 Recogiste: ${w.name}`);
      discoverItem(w.id);
    } else {
      addLog(`⚠ Mochila llena (${run.weapons.length}/5). Descansa para gestionar armas.`);
      addLog(`🗡 Arma ignorada: ${w.name} (ATK+${w.atk})`);
    }
    if (lurking) {
      addLog('👁 Al tomarlo... no estabas solo.');
      setTimeout(() => resolveAmbush(20, 45, () => startEncounter()), 1200);
    } else {
      setPhase('itemFound');
    }
  }

  function findFood(lurking = false) {
    if (!run) return;
    // 35% chance it's a beverage instead of food
    if (Math.random() < 0.35) {
      const bev = getBeverageForFloor(run.floor);
      if (canAddItem(run.beverages, bev)) saveRun({ ...run, beverages: [...run.beverages, bev], score: run.score + 10 });
      addLog(`🥤 Encontraste: ${bev.name}`); discoverItem(bev.id);
      if (lurking) { addLog('👁 El olor no solo te atrajo a ti.'); setTimeout(() => resolveAmbush(20, 45, () => startEncounter()), 1200); }
      else setPhase('itemFound');
      return;
    }
    const f = getFoodForFloor(run.floor, run.stats.lck);
    if (canAddItem(run.foods, f)) {
      saveRun({ ...run, foods: [...run.foods, f], score: run.score + 10 });
    } else {
      addLog('⚠ Mochila llena. Descansa para gestionar.');
    }
    addLog(`🍖 Encontraste: ${f.name}`); discoverItem(f.id);
    if (lurking) {
      addLog('👁 El olor no solo te atrajo a ti.');
      setTimeout(() => resolveAmbush(20, 45, () => startEncounter()), 1200);
    } else {
      setPhase('itemFound');
    }
  }

  function findPotion(withEnemy = false) {
    if (!run) return;
    const p = getPotionForFloor(run.floor);
    if (canAddItem(run.potions, p)) {
      saveRun({ ...run, potions: [...run.potions, p], score: run.score + 15 });
    }
    addLog(`🧪 Encontraste: ${p.name}`); discoverItem(p.id);
    if (withEnemy) {
      addLog('⚔ Pero algo lo custodiaba.');
      setTimeout(() => resolveAmbush(35, 20, () => startEncounter()), 1200);
    } else {
      setPhase('itemFound');
    }
  }

  function startEncounter(stronger = false) {
    if (!run) return;
    const isBossFloor = run.floor % 10 === 0;
    let eDef: EnemyDef;

    if (isBossFloor) {
      eDef = getBossForFloor(run.floor) || getEnemiesForFloor(run.floor)[0];
      setAmbushState('none'); // Bosses can't be ambushed
      setAmbushTurns(0);
    } else {
      const pool = getEnemiesForFloor(run.floor);
      if (pool.length === 0) {
        // If no enemies for this floor, use closest range
        const allNonBoss = ENEMIES.filter(e => !e.isBoss);
        eDef = allNonBoss[Math.floor(Math.random() * allNonBoss.length)];
      } else {
        eDef = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    // Bosses are 1-5 levels above the player for a real challenge
    const bossLevelBoost = isBossFloor ? Math.min(5, 1 + Math.floor(run.floor / 20)) : 0;
    let scaled = scaleEnemy(eDef, run.floor, run.level + bossLevelBoost);

    // Meditation: chance to weaken
    if (meditationBuff && !isBossFloor && pct(25)) {
      scaled = { ...scaled, hp: Math.round(scaled.hp * 0.7), atk: Math.round(scaled.atk * 0.8) };
      addLog('🧘 La meditación debilitó al enemigo.');
    }
    if (stronger) {
      scaled = { ...scaled, hp: Math.round(scaled.hp * 1.3), atk: Math.round(scaled.atk * 1.2) };
    }

    const ce: CombatEnemy = {
      def: scaled, hp: scaled.hp, maxHp: scaled.hp, mp: scaled.mp, buffs: meditationBuff ? [] : [],
    };

    setEnemy(ce);
    const introText = pick(scaled.intros || COMBAT_INTROS);
    addLog(`— ${introText} —`);
    addLog(`${scaled.isBoss ? '👑 JEFE: ' : ''}${scaled.name} aparece! (HP: ${scaled.hp})`);
    speak(introText);

    // Update bestiary
    const newBestiary = { ...profile.bestiary };
    if (!newBestiary[scaled.id]) newBestiary[scaled.id] = { seen: true, killed: 0 };
    else newBestiary[scaled.id].seen = true;
    saveProfile({ ...profile, bestiary: newBestiary });

    setPhase('combat');
    setDefending(false);

    // Handle ambush & speed initiative
    if (ambushState === 'enemy') {
      setPlayerTurn(false);
      setTimeout(() => doEnemyTurn(ce, run), 800);
    } else if (ambushState === 'player') {
      setPlayerTurn(true);
    } else {
      const curSpd = getEffectiveStats()?.spd || run.stats.spd;
      if (curSpd >= ce.def.spd) {
        setPlayerTurn(true);
      } else {
        addLog(`⚡ ${ce.def.name} es más veloz (${ce.def.spd} vs ${curSpd} SPD) y toma la iniciativa!`);
        setPlayerTurn(false);
        setTimeout(() => doEnemyTurn(ce, run), 800);
      }
    }
  }

  function doCombatAction(action: string, payload?: { abilityId?: string; itemIdx?: number; itemKind?: 'potion' | 'food' | 'beverage'; weaponIdx?: number }) {
    if (!run || !enemy || !playerTurn) return;
    const s = getEffectiveStats();
    if (!s) return;
    setActionModal(null);
    setCombatAction(action);
    setPlayerTurn(false);

    let newRun = { ...run };
    let newEnemy = { ...enemy, hp: enemy.hp, buffs: [...enemy.buffs] };
    let turnLog: string[] = [];

    const isCrit = rollCrit(s.lck, meditationBuff ? 15 : 0);
    const enemyDef = enemy.def;

    switch (action) {
      case 'attack': {
        const atkName = CLASS_ATTACKS[run.className]?.name || 'Atacar';
        if (rollDodge(enemyDef.spd, s.spd)) {
          turnLog.push(`El enemigo esquiva tu ${atkName}!`);
        } else {
          const dmg = calcDamage(s.atk, enemyDef.def, 0, isCrit, ambushState === 'player' && ambushTurns > 0 ? 1.5 : 1);
          newEnemy.hp -= dmg;
          turnLog.push(`⚔ ${atkName}: ${dmg} daño${isCrit ? ' ¡CRÍTICO!' : ''}`);
          sfxHit();
          showFloat(String(dmg), isCrit, 'enemy');
          setShakeEnemy(true);
          setTimeout(() => setShakeEnemy(false), 300);

          // Self-harm weapon
          const w = getWeapon();
          if (w?.selfHarm && w.effect === 'cursedBlade') {
            newRun.stats = { ...newRun.stats, hp: newRun.stats.hp - 3 };
            turnLog.push('🩸 La espada maldita te drena 3 HP.');
          }

          // Lifesteal check
          const cls = getCls();
          if (cls && run.stats.mas >= 50 && cls.id === 'guerrero') {
            const heal = Math.round(dmg * 0.15);
            newRun.stats = { ...newRun.stats, hp: Math.min(newRun.stats.maxHp, newRun.stats.hp + heal) };
            turnLog.push(`💚 Sed de Sangre cura ${heal} HP.`);
          }
        }
        break;
      }
      case 'defend': {
        setDefending(true);
        turnLog.push('🛡 Te pones en guardia. DEF +50% este turno.');
        break;
      }
      case 'ability': {
        const ab = ABILITIES.find(a => a.id === payload?.abilityId);
        if (!ab) { setPlayerTurn(true); setCombatAction(null); return; }
        // Cost handling: mp, hp, or none
        const cType = ab.costType || 'mp';
        if (cType === 'mp' && ab.cost > 0) {
          if (run.stats.mp < ab.cost) { turnLog.push(`⚠ MP insuficiente para ${ab.name} (${ab.cost} MP).`); setPlayerTurn(true); setCombatAction(null); return; }
          newRun.stats = { ...newRun.stats, mp: newRun.stats.mp - ab.cost };
        } else if (cType === 'hp' && ab.cost > 0) {
          const hpCost = Math.round(newRun.stats.maxHp * ab.cost / 100);
          newRun.stats = { ...newRun.stats, hp: Math.max(1, newRun.stats.hp - hpCost) };
          turnLog.push(`💔 ${ab.name} cuesta ${hpCost} HP.`);
        }

        if (ab.effect === 'flee') {
          // Flee attempt: SPD check vs enemy, not on bosses
          if (enemyDef.isBoss) { turnLog.push('⚠ No puedes huir de un jefe.'); for (const l of turnLog) addLog(l); setPlayerTurn(true); setCombatAction(null); return; }
          const fleeChance = 40 + (s.spd - enemyDef.spd) * 3 + s.lck;
          if (pct(Math.min(90, Math.max(15, fleeChance)))) {
            turnLog.push('💨 ¡Huyes exitosamente!'); speak('Huyes del combate.');
            for (const l of turnLog) addLog(l); saveRun(newRun); setEnemy(null); setPhase('postCombat'); setPostCombatData({ enemyName: '', damageTaken: 0, statsGained: {} }); return;
          } else { turnLog.push('❌ ¡No puedes escapar! El enemigo te bloquea.'); }
          break;
        }
        if (ab.effect === 'guard') {
          // Caballero class ability
          setDefending(true);
          turnLog.push('🛡️ Guardia: DEF +50% este turno.');
          if (pct(20)) turnLog.push('⚔ ¡Contraataque listo!');
          break;
        }
        if (ab.effect === 'steal') {
          // Pícaro class ability — max 3 per combat
          if (enemyDef.isBoss) { turnLog.push('⚠ No se puede robar a un jefe.'); break; }
          const stealChance = 35 + s.lck * 1.5 + s.spd * 0.5;
          if (pct(Math.min(80, stealChance))) {
            const f = getFoodForFloor(run.floor, s.lck);
            newRun.foods = [...newRun.foods, f];
            turnLog.push(`🤏 ¡Robaste ${f.name}!`);
          } else {
            turnLog.push('🤏 Fallas al intentar robar.');
          }
          break;
        }
        if (ab.effect === 'consecrate') {
          // Paladín class ability
          newRun.buffs = [...newRun.buffs, { id: 'consecrate_heal', name: 'CSG+', turns: 5, stat: 'hp', value: Math.round(newRun.stats.maxHp * 0.03) }];
          newEnemy.buffs.push({ id: 'consecrate_dmg', name: 'CSG☠', turns: 5, stat: 'hp', value: -Math.round(newEnemy.maxHp * 0.05) });
          turnLog.push('✝️ Consagración: +3% HP/turno, -5% HP enemigo/turno por 5t.');
          break;
        }
        if (ab.effect === 'fury') {
          // Guerrero class ability
          const hpCost = Math.round(newRun.stats.maxHp * 0.1);
          newRun.stats = { ...newRun.stats, hp: Math.max(1, newRun.stats.hp - hpCost) };
          newRun.buffs = [...newRun.buffs,
            { id: 'fury_atk', name: 'FUR⚔', turns: 3, stat: 'atk', value: Math.round(s.atk * 1.5) },
            { id: 'fury_spd', name: 'FUR»', turns: 3, stat: 'spd', value: Math.round(s.spd * 0.5) },
          ];
          turnLog.push(`💢 ¡Furia! ATK +150%, SPD +50% por 3t. Pierdes ${hpCost} HP.`);
          break;
        }
        if (ab.effect === 'vileFire') {
          // Brujo class ability — needs charge
          turnLog.push('🔥 Preparando Fuego Vil... (se ejecuta siguiente turno)');
          newRun.buffs = [...newRun.buffs, { id: 'charging_vilefire', name: 'CARGA🔥', turns: 1 }];
          break;
        }
        if (ab.effect === 'humanBeing') {
          // Humano class ability — passive 2x EXP + use other class ability
          turnLog.push('👤 Ser: Selecciona una habilidad de clase de otro héroe...');
          // For simplicity, grant a random powerful buff
          const randomBuff = ['atk', 'def', 'mag', 'spd'][Math.floor(Math.random() * 4)];
          newRun.buffs = [...newRun.buffs, { id: 'human_adapt', name: 'SER↑', turns: 2, stat: randomBuff, value: Math.round((s[randomBuff as keyof GameStats] || 10) * 0.3) }];
          turnLog.push(`👤 Adaptación: +30% ${randomBuff.toUpperCase()} por 2t.`);
          break;
        }
        if (ab.effect === 'warCry') {
          // Guerrero grito de batalla
          const hpCost = Math.round(newRun.stats.maxHp * 0.05);
          newRun.stats = { ...newRun.stats, hp: Math.max(1, newRun.stats.hp - hpCost) };
          newRun.buffs = [...newRun.buffs, { id: 'warcry', name: 'GRT⚔', turns: 3, stat: 'atk', value: 5 }];
          turnLog.push(`📢 Grito de Batalla: +5 ATK por 3t. -${hpCost} HP.`);
          break;
        }
        if (ab.effect === 'biteFeed') {
          // Humano hambre y miedo
          if (!rollDodge(enemyDef.spd, s.spd)) {
            const dmg = calcDamage(s.atk, enemyDef.def, 0, isCrit, 1.0);
            newEnemy.hp -= dmg;
            newRun.hunger = clamp(newRun.hunger + 8, 0, 100);
            turnLog.push(`😨 Muerdes: ${dmg} daño. +8 hambre.`);
            sfxHit(); setShakeEnemy(true); setTimeout(() => setShakeEnemy(false), 300);
          } else { turnLog.push('El enemigo esquiva tu mordisco.'); }
          break;
        }
        if (ab.effect === 'multiRandom') {
          // Humano desesperación
          const hits = 1 + Math.floor(Math.random() * 5);
          let totalDmg = 0;
          for (let h = 0; h < hits; h++) {
            const hitCrit = rollCrit(s.lck);
            const dmg = calcDamage(s.atk, enemyDef.def, 0, hitCrit, 0.6);
            totalDmg += dmg;
            newEnemy.hp -= dmg;
          }
          turnLog.push(`💥 Desesperación: ${hits} golpes, ${totalDmg} daño total!`);
          sfxHit(); setShakeEnemy(true); setTimeout(() => setShakeEnemy(false), 300);
          break;
        }
        if (ab.effect === 'alwaysFirst') {
          // Pícaro corte furtivo
          const dmg = calcDamage(s.atk, enemyDef.def, 0, isCrit, 0.8);
          newEnemy.hp -= dmg;
          turnLog.push(`🌙 Corte Furtivo: ${dmg} daño (siempre primero).`);
          sfxHit(); setShakeEnemy(true); setTimeout(() => setShakeEnemy(false), 300);
          break;
        }
        if (ab.effect === 'precisionHit') {
          // Caballero estocada
          const precChance = 60 + s.spd * 1.5;
          if (pct(precChance)) {
            const dmg = calcDamage(s.atk, enemyDef.def, 0, isCrit, 1.4);
            newEnemy.hp -= dmg;
            turnLog.push(`🗡️ Estocada precisa: ${dmg} daño!`);
            sfxHit(); setShakeEnemy(true); setTimeout(() => setShakeEnemy(false), 300);
          } else { turnLog.push('🗡️ Estocada falla — falta precisión.'); }
          break;
        }
        if (ab.effect === 'holyBurn') {
          if (!rollDodge(enemyDef.spd, s.spd)) {
            const dmg = calcDamage(s.atk, enemyDef.def, 0, isCrit, 1.3);
            newEnemy.hp -= dmg;
            turnLog.push(`✨ Corte Sacro: ${dmg} daño.`);
            if (pct(30)) { newEnemy.buffs.push({ id: 'burn', name: 'BRN', turns: 2, stat: 'hp', value: -Math.round(newEnemy.maxHp * 0.06) }); turnLog.push('🔥 ¡Quemadura sagrada!'); }
            sfxHit(); setShakeEnemy(true); setTimeout(() => setShakeEnemy(false), 300);
          } else { turnLog.push('El enemigo esquiva.'); }
          break;
        }
        if (ab.effect === 'stunHigh') {
          if (!rollDodge(enemyDef.spd, s.spd)) {
            const dmg = calcDamage(s.atk, enemyDef.def, 0, isCrit, 1.4);
            newEnemy.hp -= dmg;
            turnLog.push(`⚖️ Justicia: ${dmg} daño.`);
            if (pct(50)) { newEnemy.buffs.push({ id: 'stun', name: 'STN', turns: 1 }); turnLog.push('💫 ¡Aturdido!'); }
            sfxHit(); setShakeEnemy(true); setTimeout(() => setShakeEnemy(false), 300);
          } else { turnLog.push('Esquivado.'); }
          break;
        }
        if (ab.effect === 'silence') {
          newEnemy.buffs.push({ id: 'silence', name: 'SIL', turns: 3 });
          turnLog.push('🔇 Sellar: magia enemiga silenciada 3 turnos.');
          break;
        }
        if (ab.effect === 'cleanse') {
          newRun.buffs = newRun.buffs.filter(b => !['poison', 'burn', 'infection', 'bleed'].includes(b.id));
          turnLog.push('🧹 Limpia: venenos y quemaduras removidos.');
          sfxHeal();
          break;
        }
        if (ab.effect === 'replicate') {
          // Mago orbe replicante — replica última magia al 50%
          const lastMagic = run.magics.length > 0 ? ABILITIES.find(a => a.id === run.magics[0]) : null;
          if (lastMagic && lastMagic.power > 0) {
            const dmg = calcMagicDamage(s.mag, enemyDef.spd, 0, false, lastMagic.power * 0.5);
            newEnemy.hp -= dmg;
            turnLog.push(`🔮 Orbe Replicante: ${lastMagic.icon} ${lastMagic.name} al 50% = ${dmg} daño.`);
            sfxMagic(); setShakeEnemy(true); setTimeout(() => setShakeEnemy(false), 300);
          } else { turnLog.push('🔮 No hay magia que replicar.'); }
          break;
        }
        if (ab.effect === 'summonShadow') {
          turnLog.push('👤 Invocando Sombra... (carga 1t)');
          newRun.buffs = [...newRun.buffs, { id: 'charging_shadow', name: 'INV👤', turns: 1 }];
          break;
        }
        if (ab.effect === 'summonImp') {
          turnLog.push('😈 Invocando Diablillo... (carga 1t)');
          newRun.buffs = [...newRun.buffs, { id: 'charging_imp', name: 'INV😈', turns: 1 }];
          break;
        }
        if (ab.effect === 'summonGolem') {
          turnLog.push('🗿 Invocando Gólem... (carga 3t)');
          newRun.buffs = [...newRun.buffs, { id: 'charging_golem', name: 'INV🗿', turns: 3 }];
          break;
        }
        if (ab.effect === 'chargedCrit') {
          turnLog.push('🎯 Preparando Golpe Certero... (siguiente turno)');
          newRun.buffs = [...newRun.buffs, { id: 'charging_crit', name: 'CARGA🎯', turns: 1 }];
          break;
        }
        if (ab.effect === 'stunLow') {
          if (!rollDodge(enemyDef.spd, s.spd)) {
            const dmg = calcDamage(s.atk, enemyDef.def, 0, isCrit, 1.5);
            newEnemy.hp -= dmg;
            turnLog.push(`🦵 Patada: ${dmg} daño.`);
            if (pct(20)) { newEnemy.buffs.push({ id: 'stun', name: 'STN', turns: 1 }); turnLog.push('💫 ¡Aturdido!'); }
            sfxHit(); setShakeEnemy(true); setTimeout(() => setShakeEnemy(false), 300);
          } else { turnLog.push('Esquivado.'); }
          break;
        }
        if (ab.effect === 'mercy') {
          // Mercy: only works if enemy HP < 25%
          if (!enemy || enemy.hp > enemy.maxHp * 0.25) { turnLog.push('⚠ El enemigo es demasiado fuerte para perdonar (HP > 25%).'); for (const l of turnLog) addLog(l); setPlayerTurn(true); setCombatAction(null); return; }
          if (enemyDef.isBoss) { turnLog.push('⚠ No puedes perdonar a un jefe.'); for (const l of turnLog) addLog(l); setPlayerTurn(true); setCombatAction(null); return; }
          const hpRecover = Math.round(newRun.stats.maxHp * 0.2); const mpRecover = Math.round(newRun.stats.maxMp * 0.15);
          newRun.stats = { ...newRun.stats, hp: Math.min(newRun.stats.maxHp, newRun.stats.hp + hpRecover), mp: Math.min(newRun.stats.maxMp, newRun.stats.mp + mpRecover) };
          turnLog.push(`🕊️ Perdonas a ${enemyDef.name}. Recuperas ${hpRecover} HP y ${mpRecover} MP.`);
          speak(`Perdonas a ${enemyDef.name}. La misericordia te restaura.`);
          for (const l of turnLog) addLog(l); saveRun(newRun); setEnemy(null); setPhase('postCombat'); setPostCombatData({ enemyName: enemyDef.name + ' (perdonado)', damageTaken: 0, statsGained: {} }); return;
        }
        if (ab.effect === 'heal') {
          const heal = Math.round(newRun.stats.maxHp * 0.3);
          newRun.stats = { ...newRun.stats, hp: Math.min(newRun.stats.maxHp, newRun.stats.hp + heal) };
          turnLog.push(`💚 ${ab.name}: recuperas ${heal} HP.`);
          sfxHeal();
        } else {
          const dodged = ab.type === 'skill' && rollDodge(enemyDef.spd, s.spd);
          if (dodged) {
            turnLog.push(`${enemyDef.name} esquiva tu ${ab.name}!`);
          } else {
            const scaleStat = ab.scaling === 'atk' ? s.atk : s.mag;
            const dmg = ab.scaling === 'atk'
              ? calcDamage(scaleStat, enemyDef.def, 0, isCrit, ab.power * (ab.effect === 'pierce' ? 1 : 1))
              : calcMagicDamage(scaleStat, enemyDef.spd, 0, isCrit, ab.power);
            newEnemy.hp -= dmg;
            turnLog.push(`${ab.icon} ${ab.name}: ${dmg} daño${isCrit ? ' ¡CRÍTICO!' : ''}`);
            ab.type === 'magic' ? sfxMagic() : sfxHit();
            setShakeEnemy(true); setTimeout(() => setShakeEnemy(false), 300);

            // Status effects from ability
            if (ab.effect === 'drain') { const h = Math.round(dmg * 0.4); newRun.stats = { ...newRun.stats, hp: Math.min(newRun.stats.maxHp, newRun.stats.hp + h) }; turnLog.push(`🧛 Drenas ${h} HP.`); }
            if (ab.effect === 'bleed') { newEnemy.buffs.push({ id: 'bleed', name: 'BLD', turns: 3, stat: 'hp', value: -5 }); turnLog.push('🩸 Sangrado.'); }
            if (ab.effect === 'burn') { newEnemy.buffs.push({ id: 'burn', name: 'BRN', turns: 2, stat: 'hp', value: -6 }); turnLog.push('🔥 Quemadura.'); }
            if (ab.effect === 'stun') { newEnemy.buffs.push({ id: 'stun', name: 'STN', turns: 1 }); turnLog.push('💫 Aturdido.'); }
            if (ab.effect === 'slow' || ab.effect === 'freeze') { newEnemy.buffs.push({ id: 'slow', name: 'SLW', turns: 3 }); turnLog.push('❄️ Ralentizado.'); }
            if (ab.effect === 'curse' || ab.effect === 'curseAll') { newEnemy.buffs.push({ id: 'curse', name: 'CRS', turns: 4 }); turnLog.push('💜 Maldito.'); }
            if (ab.effect === 'poison') { newEnemy.buffs.push({ id: 'poison', name: 'PSN', turns: 3, stat: 'hp', value: -4 }); turnLog.push('☠ Envenenado.'); }
            if (ab.effect === 'poisonBurn') { newEnemy.buffs.push({ id: 'poison', name: 'PSN', turns: 2, stat: 'hp', value: -4 }); newEnemy.buffs.push({ id: 'burn', name: 'BRN', turns: 2, stat: 'hp', value: -5 }); turnLog.push('🤒 Veneno y quemadura.'); }
            if (ab.effect === 'guilt') { newEnemy.buffs.push({ id: 'guilt', name: 'GLT', turns: 2, stat: 'atk', value: -Math.round(enemyDef.atk * 0.15) }); turnLog.push('😔 Culpa debilita al enemigo.'); }
            if (ab.effect === 'defBreak') { newEnemy.buffs.push({ id: 'defbreak', name: 'DEF↓', turns: 1, stat: 'def', value: -Math.round(enemyDef.def * 0.15) }); }
            if (ab.effect === 'selfHarm') { newRun.stats = { ...newRun.stats, hp: Math.max(1, newRun.stats.hp - Math.round(newRun.stats.maxHp * 0.05)) }; turnLog.push('💔 Te lastimas en el proceso.'); }
            if (ab.effect === 'multiHit3') { const dmg2 = Math.round(dmg * 0.5); const dmg3 = Math.round(dmg * 0.5); newEnemy.hp -= dmg2 + dmg3; turnLog.push(`💥 ×3 golpes: +${dmg2 + dmg3} daño extra.`); }
            if (ab.effect === 'pierce') { /* pierce already factored into damage calc */ }
            if (ab.effect === 'infection') { newEnemy.buffs.push({ id: 'poison', name: 'INF', turns: 3, stat: 'hp', value: -3 }); turnLog.push('🦠 Infección.'); }
            if (ab.effect === 'lckDrain') { newEnemy.buffs.push({ id: 'lckdrain', name: 'LCK↓', turns: 3, stat: 'lck', value: -5 }); turnLog.push('🐦‍⬛ Mala suerte.'); }
            if (ab.effect === 'blind') { newEnemy.buffs.push({ id: 'blind', name: 'BLN', turns: 2 }); turnLog.push('🕊️ Cegado.'); }
            // Self-buff abilities
            if (ab.effect === 'spdBuff') { newRun.buffs = [...newRun.buffs, { id: 'spdbuff', name: 'SPD↑', turns: 3, stat: 'spd', value: Math.round(s.spd * 0.2) }]; turnLog.push('🌕 +20% SPD.'); }
            if (ab.effect === 'critBuff') { newRun.buffs = [...newRun.buffs, { id: 'critbuff', name: 'CRT↑', turns: 3, stat: 'lck', value: 10 }]; turnLog.push('😇 +25% crit.'); }
            if (ab.effect === 'royalBuff') { newRun.buffs = [...newRun.buffs, { id: 'atkbuff', name: 'ATK↑', turns: 3, stat: 'atk', value: Math.round(s.atk * 0.25) }, { id: 'defbuff', name: 'DEF↑', turns: 3, stat: 'def', value: Math.round(s.def * 0.25) }]; turnLog.push('🤴 +25% ATK y DEF.'); }
            if (ab.effect === 'alphaBuff') { newRun.buffs = [...newRun.buffs, { id: 'atkbuff', name: 'ATK↑', turns: 3, stat: 'atk', value: Math.round(s.atk * 0.25) }]; turnLog.push('🦁 Rugido.'); }
            if (ab.effect === 'tankBuff') { newRun.buffs = [...newRun.buffs, { id: 'defbuff', name: 'DEF↑', turns: 3, stat: 'def', value: Math.round(s.def * 0.4) }]; turnLog.push('🤖 +40% DEF, -20% SPD.'); }
            if (ab.effect === 'speedBuff') { newRun.buffs = [...newRun.buffs, { id: 'spdbuff', name: 'SPD↑', turns: 2, stat: 'spd', value: Math.round(s.spd * 0.3) }]; turnLog.push('💨 +30% SPD.'); }
            if (ab.effect === 'evasionBuff') { newRun.buffs = [...newRun.buffs, { id: 'evade', name: 'EVD↑', turns: 2, stat: 'spd', value: 8 }]; turnLog.push('🧛 +Evasión.'); }
            if (ab.effect === 'terrorDebuff') { newEnemy.buffs.push({ id: 'terror', name: 'TRR', turns: 2, stat: 'atk', value: -Math.round(enemyDef.atk * 0.1) }); turnLog.push('😨 Terror.'); }
            if (ab.effect === 'toxicAll') { newEnemy.buffs.push({ id: 'poison', name: 'PSN', turns: 2, stat: 'hp', value: -4 }); newEnemy.buffs.push({ id: 'slow', name: 'SLW', turns: 2 }); turnLog.push('🦠 Nube tóxica.'); }
            if (ab.effect === 'plagueAll') { newEnemy.buffs.push({ id: 'poison', name: 'PSN', turns: 2, stat: 'hp', value: -3 }); newEnemy.buffs.push({ id: 'burn', name: 'BRN', turns: 1, stat: 'hp', value: -4 }); turnLog.push('☠️ Plaga.'); }
            if (ab.effect === 'confusion') { newEnemy.buffs.push({ id: 'confuse', name: 'CNF', turns: 2 }); turnLog.push('💀 Confusión.'); }
            if (ab.effect === 'chaos') { const chaosRoll = Math.random(); if (chaosRoll < 0.4) { newEnemy.hp -= Math.round(dmg * 1.5); turnLog.push('🌀 ¡Caos masivo!'); } else if (chaosRoll < 0.6) { const h = Math.round(newRun.stats.maxHp * 0.2); newRun.stats = { ...newRun.stats, hp: Math.min(newRun.stats.maxHp, newRun.stats.hp + h) }; turnLog.push('🌀 Caos te cura.'); } else { turnLog.push('🌀 El caos se disipa sin efecto.'); } }
            if (ab.effect === 'floorScale') { const floorBonus = Math.round(dmg * (1 + run.floor * 0.01)); newEnemy.hp -= Math.max(0, floorBonus - dmg); turnLog.push(`🎭 Magia escala con piso ${run.floor}.`); }
          }
        }
        break;
      }
      case 'useItem': {
        const kind = payload?.itemKind; const idx = payload?.itemIdx ?? -1;
        if (kind === 'potion') {
          const pot = run.potions[idx]; if (!pot) { setPlayerTurn(true); setCombatAction(null); return; }
          newRun.potions = run.potions.filter((_, i) => i !== idx);
          if (pot.effect === 'healHP') { const h = Math.round(newRun.stats.maxHp * 0.25); newRun.stats = { ...newRun.stats, hp: Math.min(newRun.stats.maxHp, newRun.stats.hp + h) }; turnLog.push(`💚 ${pot.name}: +${h} HP.`); sfxHeal(); }
          else if (pot.effect === 'healMP') { const m = Math.round(newRun.stats.maxMp * 0.25); newRun.stats = { ...newRun.stats, mp: Math.min(newRun.stats.maxMp, newRun.stats.mp + m) }; turnLog.push(`💎 ${pot.name}: +${m} MP.`); sfxHeal(); }
          else if (pot.effect === 'healBoth') { const h = Math.round(newRun.stats.maxHp * 0.1); const m = Math.round(newRun.stats.maxMp * 0.1); newRun.stats = { ...newRun.stats, hp: Math.min(newRun.stats.maxHp, newRun.stats.hp + h), mp: Math.min(newRun.stats.maxMp, newRun.stats.mp + m) }; turnLog.push(`✨ ${pot.name}: +${h} HP, +${m} MP.`); sfxHeal(); }
          else if (pot.effect === 'vigor') { newRun.hunger = 50; newRun.energy = Math.min(100, newRun.energy + 10); turnLog.push(`⚡ ${pot.name}: hambre→50, +10 energía.`); }
          else if (pot.effect === 'darkElixir') { const h = Math.round(newRun.stats.maxHp * 0.4); const m = Math.round(newRun.stats.maxMp * 0.4); newRun.stats = { ...newRun.stats, hp: Math.min(newRun.stats.maxHp, newRun.stats.hp + h), mp: Math.min(newRun.stats.maxMp, newRun.stats.mp + m) }; newRun.buffs = [...newRun.buffs, { id: 'curse', name: 'CRS', turns: 2, stat: 'def', value: -Math.round(newRun.stats.def * 0.05) }]; turnLog.push(`🖤 ${pot.name}: +${h} HP, +${m} MP. Maldición.`); sfxHeal(); }
          else if (pot.effect === 'fireDamage') { const fd = 30 + run.floor * 2; newEnemy.hp -= fd; turnLog.push(`🔥 ${pot.name}: ${fd} daño.`); sfxMagic(); setShakeEnemy(true); setTimeout(() => setShakeEnemy(false), 300); }
          else if (pot.effect === 'mistScroll') { newRun.buffs = [...newRun.buffs, { id: 'evade', name: 'EVD↑', turns: 3, stat: 'spd', value: 8 }]; turnLog.push(`🌫️ ${pot.name}: +evasión.`); }
          else if (pot.effect === 'curePoison') { newRun.buffs = run.buffs.filter(b => !['poison', 'burn', 'infection'].includes(b.id)); turnLog.push(`✨ ${pot.name}: estados curados.`); }
          else if (pot.effect === 'reduceHunger') { newRun.hunger = clamp(run.hunger - 40, 0, 100); turnLog.push(`🤮 ${pot.name}: hambre -40.`); }
          else if (pot.effect === 'increaseHunger') { newRun.hunger = clamp(run.hunger + 35, 0, 100); turnLog.push(`🍽️ ${pot.name}: hambre +35.`); }
          else if (pot.effect === 'revealScroll') { turnLog.push(`📜 ${pot.name}: ${enemy?.def.name} — HP:${enemy?.hp}/${enemy?.maxHp} ATK:${enemy?.def.atk} DEF:${enemy?.def.def} MAG:${enemy?.def.mag} SPD:${enemy?.def.spd}`); }
          else if (pot.effect === 'escapeScroll') { if (enemy?.def.isBoss) { turnLog.push('⚠ No puedes huir de un jefe.'); newRun.potions = [...run.potions]; } else { turnLog.push('💨 ¡Huyes del combate!'); saveRun(newRun); setEnemy(null); setPhase('postCombat'); setPostCombatData({ enemyName:'', damageTaken:0, statsGained:{} }); return; } }
          else { turnLog.push(`Usas ${pot.name}.`); }
        } else if (kind === 'food') {
          const f = run.foods[idx]; if (!f) { setPlayerTurn(true); setCombatAction(null); return; }
          newRun.foods = run.foods.filter((_, i) => i !== idx);
          newRun.hunger = clamp(run.hunger + f.hunger, 0, 100);
          newRun.energy = clamp(run.energy + f.energy, 0, 100);
          if (f.hpHeal) newRun.stats = { ...newRun.stats, hp: Math.min(newRun.stats.maxHp, newRun.stats.hp + f.hpHeal) };
          if (f.mpHeal) newRun.stats = { ...newRun.stats, mp: Math.min(newRun.stats.maxMp, newRun.stats.mp + f.mpHeal) };
          turnLog.push(`🍖 Comes ${f.name}.`); sfxEat();
        } else if (kind === 'beverage') {
          const b = run.beverages[idx]; if (!b) { setPlayerTurn(true); setCombatAction(null); return; }
          newRun.beverages = run.beverages.filter((_, i) => i !== idx);
          newRun.energy = clamp(run.energy + b.energy, 0, 100);
          if (b.hunger) newRun.hunger = clamp(run.hunger + b.hunger, 0, 100);
          if (b.mpHeal) newRun.stats = { ...newRun.stats, mp: Math.min(newRun.stats.maxMp, newRun.stats.mp + b.mpHeal) };
          turnLog.push(`🥤 Bebes ${b.name}.`); sfxEat();
        }
        break;
      }
      case 'swap': {
        const idx = payload?.weaponIdx ?? -1;
        if (idx < 0 || idx === run.equippedWeapon || !run.weapons[idx]) { setPlayerTurn(true); setCombatAction(null); return; }
        newRun.equippedWeapon = idx;
        turnLog.push(`🔄 Empuñas ${run.weapons[idx].name}. Pierdes el turno.`);
        sfxSwap();
        break;
      }
    }

    // Check ambush turns
    if (ambushState === 'player' && ambushTurns > 0) {
      setAmbushTurns(prev => prev - 1);
      if (ambushTurns - 1 > 0) {
        turnLog.push('[EMBOSCADA] Turno extra de emboscada.');
      }
    }

    for (const l of turnLog) addLog(l);
    setEnemy(newEnemy);

    // Check enemy death
    if (newEnemy.hp <= 0) {
      handleEnemyDeath(newRun, newEnemy);
      return;
    }

    // If ambush still active, player goes again
    if (ambushState === 'player' && ambushTurns - 1 > 0) {
      saveRun(newRun);
      setTimeout(() => { setPlayerTurn(true); setCombatAction(null); }, 600);
      return;
    }

    // Enemy turn
    saveRun(newRun);
    setTimeout(() => doEnemyTurn(newEnemy, newRun), 800);
  }

  function doEnemyTurn(ce: CombatEnemy, currentRun: RunState) {
    if (!currentRun) return;
    const s = getEffectiveStats();
    if (!s) return;

    const eDef = ce.def;
    let newRun = { ...currentRun };
    let turnLog: string[] = [];
    let workEnemy = { ...ce, buffs: [...ce.buffs] };

    // Process enemy DoT (bleed/burn) and check stun
    let enemyStunned = false;
    const survivingEnemyBuffs: StatusEffect[] = [];
    for (const b of workEnemy.buffs) {
      if ((b.id === 'bleed' || b.id === 'burn') && b.value) {
        workEnemy.hp += b.value;
        turnLog.push(`${b.id === 'bleed' ? '🩸' : '🔥'} ${eDef.name} sufre ${-b.value} (${b.name}).`);
      }
      if (b.id === 'stun') enemyStunned = true;
      if (b.turns > 1) survivingEnemyBuffs.push({ ...b, turns: b.turns - 1 });
    }
    workEnemy.buffs = survivingEnemyBuffs;

    if (workEnemy.hp <= 0) {
      for (const l of turnLog) addLog(l);
      setEnemy(workEnemy);
      handleEnemyDeath(newRun, workEnemy);
      return;
    }
    if (enemyStunned) {
      turnLog.push(`💫 ${eDef.name} está aturdido y pierde el turno.`);
      for (const l of turnLog) addLog(l);
      setEnemy(workEnemy);
      saveRun(newRun);
      setTimeout(() => { setPlayerTurn(true); setCombatAction(null); }, 400);
      return;
    }
    ce = workEnemy;

    // Enemy attack
    const playerDodge = rollDodge(s.spd, eDef.spd, meditationBuff ? 10 : 0);
    if (playerDodge) {
      turnLog.push(`» Esquivas el ataque de ${eDef.name}!`);
    } else {
      const defMod = defending ? 1.5 : 1;
      const rawDmg = calcDamage(eDef.atk, Math.round(s.def * defMod), 0, pct(5));
      const dmg = Math.max(1, rawDmg);
      newRun.stats = { ...newRun.stats, hp: newRun.stats.hp - dmg };
      turnLog.push(`💥 ${eDef.name} ataca por ${dmg} daño${defending ? ' (defendido)' : ''}.`);
      sfxDamage();
      showFloat(String(dmg), false, 'player');
      setShakePlayer(true);
      setHitFlash(true);
      setEnemyLunge(true);
      setTimeout(() => { setShakePlayer(false); setHitFlash(false); setEnemyLunge(false); }, 500);

      // Check if enemy uses its special abilities
      const abId = eDef.learnableSkill || eDef.learnableMagic || eDef.abilities[0];
      const ab = abId ? ABILITIES.find(a => a.id === abId || a.id === eDef.abilities[0]) : null;
      if (ab && pct(40)) {
        turnLog.push(`⚡ ¡${eDef.name} usa ${ab.icon} ${ab.name}!`);
        if (ab.effect === 'drain' || eDef.abilities.includes('drain')) {
          const drain = Math.round(dmg * 0.4);
          const newCe = { ...ce, hp: Math.min(ce.maxHp, ce.hp + drain) };
          setEnemy(newCe);
          turnLog.push(`🧛 drena ${drain} HP.`);
        }
        if (ab.effect === 'poison' || eDef.abilities.includes('poison')) {
          turnLog.push(`☠ ¡Envenenado! (-5 HP/turno, 3 turnos)`);
          newRun.buffs = [...newRun.buffs, { id: 'poison', name: 'PSN', turns: 3, stat: 'hp', value: -5 }];
        }
        if (ab.effect === 'bleed' || eDef.abilities.includes('bleed')) {
          turnLog.push(`🩸 ¡Sangrado! (-4 HP/turno, 3 turnos)`);
          newRun.buffs = [...newRun.buffs, { id: 'poison', name: 'BLD', turns: 3, stat: 'hp', value: -4 }];
        }
        if (ab.effect === 'burn' || eDef.abilities.includes('burn')) {
          turnLog.push(`🔥 ¡Quemadura! (-6 HP/turno, 2 turnos)`);
          newRun.buffs = [...newRun.buffs, { id: 'poison', name: 'BRN', turns: 2, stat: 'hp', value: -6 }];
        }
        if (ab.effect === 'slow' || ab.effect === 'freeze') {
          turnLog.push(`❄️ ¡Ralentizado! (-30% SPD, 3 turnos)`);
          newRun.buffs = [...newRun.buffs, { id: 'slow', name: 'SLW', turns: 3, stat: 'spd', value: -Math.round(s.spd * 0.3) }];
        }
        if (ab.effect === 'curse' || ab.effect === 'curseAll') {
          turnLog.push(`💜 ¡Maldición! (-15% DEF y ATK, 3 turnos)`);
          newRun.buffs = [...newRun.buffs, { id: 'curse', name: 'CRS', turns: 3, stat: 'def', value: -Math.round(s.def * 0.15) }];
        }
        if (ab.effect === 'guilt' || eDef.abilities.includes('guiltyPlea')) {
          turnLog.push(`🥺 ¡Culpa! El peso moral te debilita (-20% ATK, 2 turnos)`);
          newRun.buffs = [...newRun.buffs, { id: 'guilt', name: 'GLT', turns: 2, stat: 'atk', value: -Math.round(s.atk * 0.2) }];
        }
        if (ab.effect === 'lckDrain') {
          turnLog.push(`🐦‍⬛ ¡Mala suerte! (-5 LCK, 3 turnos)`);
          newRun.buffs = [...newRun.buffs, { id: 'lckdrain', name: 'LCK↓', turns: 3, stat: 'lck', value: -5 }];
        }
        if (ab.effect === 'blind') {
          turnLog.push(`🕊️ ¡Cegado! Tu precisión y evasión disminuyen (2 turnos)`);
          newRun.buffs = [...newRun.buffs, { id: 'blind', name: 'BLN', turns: 2, stat: 'spd', value: -5 }];
        }
      } else {
        // Boss special: second attack chance
        if (eDef.isBoss && pct(40)) {
          const dmg2 = Math.max(1, calcDamage(Math.round(eDef.atk * 0.7), Math.round(s.def * defMod), 0, false));
          newRun.stats = { ...newRun.stats, hp: newRun.stats.hp - dmg2 };
          turnLog.push(`👑 ${eDef.name} ataca de nuevo por ${dmg2}!`);
        }

        // Enemy magic attack chance
        if (eDef.mag > 10 && ce.mp >= 5 && pct(35)) {
          const mgDmg = calcMagicDamage(eDef.mag, s.int, 0, false);
          newRun.stats = { ...newRun.stats, hp: newRun.stats.hp - mgDmg };
          const newCe = { ...ce, mp: ce.mp - 5 };
          setEnemy(newCe);
          turnLog.push(`★ ${eDef.name} lanza magia por ${mgDmg} daño.`);
        }
      }
    }

    // Process player debuffs
    const newBuffs: StatusEffect[] = [];
    for (const b of newRun.buffs) {
      if (b.id === 'poison' && b.turns > 0) {
        newRun.stats = { ...newRun.stats, hp: newRun.stats.hp + (b.value || 0) };
        turnLog.push(`☠ Veneno: ${b.value} HP.`);
      }
      if (b.turns > 1) newBuffs.push({ ...b, turns: b.turns - 1 });
    }
    newRun.buffs = newBuffs;

    for (const l of turnLog) addLog(l);
    setDefending(false);
    setEnemy(ce);

    // Check player death
    if (newRun.stats.hp <= 0) {
      newRun.stats.hp = 0;
      saveRun(newRun);
      handleDeath(newRun);
      return;
    }

    // Check last stand (Caballero MAS 100)
    const cls = getCls();
    if (newRun.stats.hp <= 0 && cls?.id === 'caballero' && newRun.stats.mas >= 100) {
      newRun.stats.hp = 1;
      addLog('🛡 ¡Bastión Inquebrantable! Sobrevives con 1 HP.');
    }

    saveRun(newRun);
    setTimeout(() => {
      setPlayerTurn(true);
      setCombatAction(null);
    }, 400);
  }

  function handleEnemyDeath(currentRun: RunState, ce: CombatEnemy) {
    const eDef = ce.def;
    addLog(`✦ ${eDef.name} derrotado!`);
    const outroText = pick(eDef.outros || COMBAT_OUTROS);
    addLog(`— ${outroText} —`);
    speak(outroText);

    // Calculate rewards
    const isHumano = currentRun.className === 'humano';
    const cls = getCls();
    const statsGained: Record<string, number> = {};
    const baseSG = eDef.statGain || { atk: 1, def: 1 };
    const xpMult = eDef.xpMult || 1;

    // Stat gains from enemy
    for (const [k, v] of Object.entries(baseSG)) {
      const gain = calcStatGain(v, isHumano, cls?.affinity.includes(k) || false);
      statsGained[k] = gain;
    }
    // Random minor stat gains
    const statPool = ['atk', 'def', 'mag', 'int', 'spd', 'lck'];
    const randomStat = statPool[Math.floor(Math.random() * statPool.length)];
    statsGained[randomStat] = (statsGained[randomStat] || 0) + (isHumano ? 2 : 1);

    // MAS gain
    statsGained['mas'] = Math.round(xpMult * (isHumano ? 2 : 1));

    // Apply stat gains with cap enforcement
    const newStats = { ...currentRun.stats };
    const caps = cls?.caps || {};
    for (const [k, v] of Object.entries(statsGained)) {
      const key = k as keyof GameStats;
      if (key === 'hp') {
        newStats.maxHp = Math.min((caps.hp || 999), newStats.maxHp + v);
        newStats.hp = Math.min(newStats.maxHp, newStats.hp + Math.round(v * 0.5));
      } else if (key === 'mp') {
        newStats.maxMp = Math.min((caps.mp || 999), newStats.maxMp + v);
        newStats.mp = Math.min(newStats.maxMp, newStats.mp + Math.round(v * 0.5));
      } else if (key in newStats) {
        const cap = (caps as Record<string, number>)[key] || 999;
        (newStats as Record<string, number>)[key] = Math.min(cap, (newStats[key] || 0) + v);
      }
    }

    // Weapon drop chance
    let weaponFound: WeaponDef | undefined;
    if (pct(20 + currentRun.stats.lck * 0.5) || eDef.isBoss) {
      weaponFound = getWeaponForFloor(currentRun.floor, currentRun.stats.lck);
    }

    // Score
    const scoreGain = Math.round(10 * xpMult + (eDef.isBoss ? 100 : 0));

    // HP/MP regen from combat
    const hpRegen = Math.round(newStats.maxHp * 0.02);
    const mpRegen = Math.round(newStats.maxMp * 0.05);
    newStats.hp = Math.min(newStats.maxHp, newStats.hp + hpRegen);
    newStats.mp = Math.min(newStats.maxMp, newStats.mp + mpRegen);

    // Update bestiary & unlock classes if dark bosses defeated
    const newBestiary = { ...profile.bestiary };
    if (newBestiary[eDef.id]) newBestiary[eDef.id].killed++;
    let newUnlocked = [...profile.unlockedClasses];
    if (eDef.id === 'paladin_oscuro' && !newUnlocked.includes('paladin')) {
      newUnlocked.push('paladin');
      addLog('👑 ¡Has purificado al Paladín Oscuro! Nueva clase disponible: PALADÍN.');
    }
    if (eDef.id === 'guerrero_oscuro' && !newUnlocked.includes('guerrero')) {
      newUnlocked.push('guerrero');
      addLog('👑 ¡Has vencido al Guerrero Oscuro! Nueva clase disponible: GUERRERO.');
    }
    if (eDef.id === 'brujo_oscuro' && !newUnlocked.includes('brujo')) {
      newUnlocked.push('brujo');
      addLog('👑 ¡Has liberado al Brujo Oscuro! Nueva clase disponible: BRUJO.');
    }
    saveProfile({ ...profile, unlockedClasses: newUnlocked, bestiary: newBestiary });

    // ABILITY ABSORPTION — absorb enemy essence
    let newSkills = [...currentRun.skills];
    let newMagics = [...currentRun.magics];
    let learnedAbilityName = '';
    const learnChance = 25 + currentRun.stats.lck * 0.5 + (eDef.isBoss ? 40 : 0);
    if (pct(learnChance)) {
      // Try to learn a skill first, then magic
      const candidates: string[] = [];
      if (eDef.learnableSkill && !newSkills.includes(eDef.learnableSkill)) candidates.push(eDef.learnableSkill);
      if (eDef.learnableMagic && !newMagics.includes(eDef.learnableMagic)) candidates.push(eDef.learnableMagic);
      if (candidates.length > 0) {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        const ab = ABILITIES.find(a => a.id === chosen);
        if (ab) {
          if (ab.type === 'skill' && newSkills.length < 8) {
            newSkills.push(chosen);
            learnedAbilityName = `⚔ ${ab.name}`;
            addLog(`✦ ¡Absorbiste la esencia! Aprendiste: ${ab.icon} ${ab.name}`);
          } else if (ab.type === 'magic' && newMagics.length < 8) {
            newMagics.push(chosen);
            learnedAbilityName = `★ ${ab.name}`;
            addLog(`✦ ¡La magia fluye hacia ti! Aprendiste: ${ab.icon} ${ab.name}`);
          }
        }
      }
    }

    // EXP & Level Up system (max level 60, reachable around floor 80)
    const expGain = Math.round((10 + currentRun.floor * 0.5) * xpMult * (eDef.isBoss ? 3 : 1));
    let newLevel = currentRun.level;
    let newExp = currentRun.exp + expGain;
    let newExpToNext = currentRun.expToNext;
    while (newExp >= newExpToNext && newLevel < 60) {
      newExp -= newExpToNext;
      newLevel++;
      newExpToNext = Math.round(20 + newLevel * 8 + newLevel * newLevel * 0.3);
      // Level up bonus stats
      const lvlCls = getCls();
      const lvlCaps = lvlCls?.caps || {};
      const bonusStats = ['hp', 'mp', 'atk', 'def', 'mag', 'int', 'spd', 'lck'];
      for (const bs of bonusStats) {
        const cap = (lvlCaps as Record<string, number>)[bs] || 999;
        const gain = bs === 'hp' ? 5 : bs === 'mp' ? 3 : 1;
        if (bs === 'hp') { newStats.maxHp = Math.min(cap, newStats.maxHp + gain); newStats.hp = Math.min(newStats.maxHp, newStats.hp + gain); }
        else if (bs === 'mp') { newStats.maxMp = Math.min(cap, newStats.maxMp + gain); newStats.mp = Math.min(newStats.maxMp, newStats.mp + gain); }
        else { (newStats as Record<string, number>)[bs] = Math.min(cap, (newStats[bs as keyof GameStats] || 0) + gain); }
      }
      addLog(`⬆ ¡Nivel ${newLevel}! Tus estadísticas mejoran.`);
    }
    if (newLevel >= 60) { newExp = 0; newExpToNext = 1; }

    const updatedRun: RunState = {
      ...currentRun,
      stats: newStats,
      permStats: { ...newStats, hp: newStats.maxHp, mp: newStats.maxMp },
      score: currentRun.score + scoreGain,
      kills: currentRun.kills + 1,
      bossKills: currentRun.bossKills + (eDef.isBoss ? 1 : 0),
      skills: newSkills,
      magics: newMagics,
      level: newLevel, exp: newExp, expToNext: newExpToNext,
      weapons: weaponFound && currentRun.weapons.length < 5
        ? [...currentRun.weapons, weaponFound] : currentRun.weapons,
    };

    sfxLevelUp();
    setPostCombatData({
      enemyName: eDef.name,
      damageTaken: currentRun.stats.hp - newStats.hp + hpRegen,
      statsGained,
      weaponFound,
      learnedAbility: learnedAbilityName || undefined,
    });
    saveRun(updatedRun);
    setEnemy(null);
    setPhase('postCombat');
    setAmbushState('none');
    setAmbushTurns(0);
  }

  function handleDeath(currentRun: RunState) {
    sfxDeath();
    // Save high score
    const newScores = [...profile.highScores, {
      cls: currentRun.className, floor: currentRun.floor, day: currentRun.day,
      score: currentRun.score, date: new Date().toLocaleDateString()
    }].sort((a, b) => b.score - a.score).slice(0, 10);
    // ROGUELIKE: save class progress (level, skills, magics, permStats survive death)
    const newClassProgress = { ...profile.classProgress };
    const existing = newClassProgress[currentRun.className];
    // Only save if better than previous progress
    if (!existing || currentRun.level > existing.level) {
      newClassProgress[currentRun.className] = {
        level: currentRun.level, exp: currentRun.exp, expToNext: currentRun.expToNext,
        skills: currentRun.skills, magics: currentRun.magics,
        permStats: currentRun.permStats,
      };
    }
    saveProfile({ ...profile, highScores: newScores, classProgress: newClassProgress });
    deleteData('currentRun');
    setScreen('death');
  }

  function advanceFloor() {
    if (!run) return;
    const newFloor = run.floor + 1;
    if (newFloor > 100) { handleVictory(); return; }

    // Build the next-floor run state directly
    const rested = run.lastFloorRested;
    const hungerDec = getHungerDecrease(run.energy, rested);
    const energyDec = rested ? 2 : 5;

    const nextRun: RunState = {
      ...run,
      floor: newFloor,
      lastFloorRested: false,
      consecutiveRests: 0,
      hunger: clamp(run.hunger - hungerDec, 0, 100),
      energy: clamp(run.energy - energyDec, 0, 100),
      day: newFloor % 3 === 0 ? run.day + 1 : run.day
    };

    if (nextRun.hunger < 25) {
      const hpLoss = Math.round(nextRun.stats.maxHp * 0.03);
      nextRun.stats = { ...nextRun.stats, hp: clamp(nextRun.stats.hp - hpLoss, 1, nextRun.stats.maxHp) };
    }

    // Save and start the new floor
    saveRun(nextRun);
    initFloor(nextRun);
    if (newFloor % 10 === 0) sfxBossWarning();
  }

  function doRest() {
    if (!run) return;
    setMusicState('rest');
    const dimReturn = run.consecutiveRests === 0 ? 1 : run.consecutiveRests === 1 ? 0.5 : 0.25;
    // HP recovers ONLY if hunger >= 40 (well-fed enough)
    const hpGain = run.hunger >= 40 ? Math.round(run.stats.maxHp * 0.15 * dimReturn) : 0;
    // MP recovers ONLY if energy >= 45
    const mpGain = run.energy >= 45 ? Math.round(run.stats.maxMp * 0.15 * dimReturn) : 0;

    const newStats = { ...run.stats };
    if (hpGain > 0) newStats.hp = Math.min(newStats.maxHp, newStats.hp + hpGain);
    if (mpGain > 0) newStats.mp = Math.min(newStats.maxMp, newStats.mp + mpGain);

    saveRun({
      ...run,
      stats: newStats,
      lastFloorRested: true,
      consecutiveRests: run.consecutiveRests + 1,
    });
    setPhase('rest');
    setRestTab(0);
    const restNarr = pick(REST_TEXTS);
    let restInfo = '';
    if (hpGain > 0) restInfo += ` Recuperas ${hpGain} HP.`;
    if (mpGain > 0) restInfo += ` Recuperas ${mpGain} MP.`;
    if (hpGain === 0) restInfo += ' Demasiada hambre para recuperar HP.';
    if (mpGain === 0) restInfo += ' Muy poca energía para recuperar MP.';
    addLog(`🏕️ Descansas.${restInfo}`);
    speak(restNarr);
  }

  function eatFood(idx: number) {
    if (!run) return;
    sfxEat();
    const food = run.foods[idx];
    const newFoods = [...run.foods];
    newFoods.splice(idx, 1);
    const newStats = { ...run.stats };
    if (food.hpHeal) newStats.hp = Math.min(newStats.maxHp, newStats.hp + food.hpHeal);
    if (food.mpHeal) newStats.mp = Math.min(newStats.maxMp, newStats.mp + food.mpHeal);
    saveRun({
      ...run,
      foods: newFoods,
      hunger: clamp(run.hunger + food.hunger, 0, 100),
      energy: clamp(run.energy + food.energy, 0, 100),
      stats: newStats,
    });
  }

  function handleVictory() {
    if (!run) return;
    const newAscended = [...new Set([...profile.ascendedClasses, run.className])];
    const unlockHumano = newAscended.length >= 6 && !profile.unlockedClasses.includes('humano');
    const newUnlocked = unlockHumano ? [...profile.unlockedClasses, 'humano'] : profile.unlockedClasses;
    const newScores = [...profile.highScores, {
      cls: run.className, floor: 100, day: run.day,
      score: run.score + 1000, date: new Date().toLocaleDateString()
    }].sort((a, b) => b.score - a.score).slice(0, 10);
    saveProfile({ ...profile, ascendedClasses: newAscended, unlockedClasses: newUnlocked, highScores: newScores });
    deleteData('currentRun');
    setScreen('victory');
  }

  function initFloor(r: RunState) {
    setRun(r);
    let text = getFloorText(r.floor);
    // 10% chance of wall inscription
    if (pct(10)) {
      text += '\n\nInscripción en la pared:\n"' + pick(WALL_INSCRIPTIONS) + '"';
    }
    setFloorText(text);
    speak(text); // Narrator reads arrival text
    setPhase('arrival');
    setTypewriterDone(false);
    setCombatLog([]);
    setMeditationBuff(false);
    setDefending(false);
    setPostCombatData(null);
    setEnemy(null);
    setAmbushState('none');
    setAmbushTurns(0);
    setActionModal(null);
    setFloorEvent(null);
  }

  function startNewGame(classId: string) {
    setPendingClass(classId);
    setShowIntro(true);
  }

  function confirmStartGame() {
    setShowIntro(false);
    const classId = pendingClass;
    const saved = profile.classProgress[classId];
    const r = newRun(classId, saved);
    // Discover starting items
    const startItemIds = [r.weapons[0]?.id, ...r.foods.map(f=>f.id), ...r.potions.map(p=>p.id)].filter(Boolean) as string[];
    const newDiscovered = [...new Set([...profile.discoveredItems, ...startItemIds])];
    if (newDiscovered.length !== profile.discoveredItems.length) saveProfile({ ...profile, discoveredItems: newDiscovered });
    saveRun(r);
    setScreen('tower');
    initFloor(r);
  }

  function continueGame() {
    if (run) {
      setScreen('tower');
      initFloor(run);
    }
  }

  // ==================== RENDER HELPERS ====================

  const renderBackpack = (inCombat: boolean) => {
    if (!run) return null;
    const useConsumable = (kind: 'potion' | 'food' | 'beverage', idx: number) => {
      if (inCombat) {
        doCombatAction('useItem', { itemKind: kind, itemIdx: idx });
      } else {
        // Rest usage (free)
        if (kind === 'food') eatFood(idx);
        else if (kind === 'potion') {
          const pot = run.potions[idx]; if (!pot) return;
          const ns = { ...run.stats };
          if (pot.effect === 'healHP') ns.hp = Math.min(ns.maxHp, ns.hp + Math.round(ns.maxHp * 0.25));
          if (pot.effect === 'healMP') ns.mp = Math.min(ns.maxMp, ns.mp + Math.round(ns.maxMp * 0.25));
          if (pot.effect === 'healBoth') { ns.hp = Math.min(ns.maxHp, ns.hp + Math.round(ns.maxHp * 0.1)); ns.mp = Math.min(ns.maxMp, ns.mp + Math.round(ns.maxMp * 0.1)); }
          if (pot.effect === 'darkElixir') { ns.hp = Math.min(ns.maxHp, ns.hp + Math.round(ns.maxHp * 0.4)); ns.mp = Math.min(ns.maxMp, ns.mp + Math.round(ns.maxMp * 0.4)); }
          let energy = run.energy;
          if (pot.effect === 'vigor') { energy = clamp(energy + 10, 0, 100); }
          let buffs = run.buffs;
          if (pot.effect === 'curePoison') buffs = run.buffs.filter(b => !['poison', 'burn', 'infection'].includes(b.id));
          let hunger = run.hunger;
          if (pot.effect === 'reduceHunger') hunger = clamp(hunger - 40, 0, 100);
          if (pot.effect === 'increaseHunger') hunger = clamp(hunger + 35, 0, 100);
          sfxHeal();
          saveRun({ ...run, stats: ns, energy, hunger, buffs, potions: run.potions.filter((_, i) => i !== idx) });
        } else {
          const b = run.beverages[idx]; if (!b) return;
          const ns = { ...run.stats };
          if (b.mpHeal) ns.mp = Math.min(ns.maxMp, ns.mp + b.mpHeal);
          sfxEat();
          saveRun({ ...run, stats: ns, energy: clamp(run.energy + b.energy, 0, 100), hunger: clamp(run.hunger + (b.hunger || 0), 0, 100), beverages: run.beverages.filter((_, i) => i !== idx) });
        }
      }
    };
    const Section = ({ label, empty, children }: { label: string; empty: string; children: React.ReactNode }) => (
      <div className="mb-4">
        <div className="label mb-2">{label}</div>
        {children || <p className="text-bone/30 font-type text-xs">{empty}</p>}
      </div>
    );
    // Group items by id for stacking display
    type Grouped<T extends {id:string}> = {item:T; count:number; firstIdx:number}[];
    function group<T extends {id:string}>(arr: T[]): Grouped<T> {
      const m = new Map<string, {item:T; count:number; firstIdx:number}>();
      arr.forEach((it, i) => { const e = m.get(it.id); if (e) e.count++; else m.set(it.id, {item:it, count:1, firstIdx:i}); });
      return [...m.values()];
    }
    const gPotions = group(run.potions);
    const gFoods = group(run.foods);
    const gBeverages = group(run.beverages);

    return (
      <div>
        {inCombat && <p className="text-[11px] font-type text-amber-300/70 mb-3">⚠ Usar un objeto consume tu turno.</p>}
        <Section label={`🧪 Pociones (${gPotions.length}/10 tipos)`} empty="Sin pociones.">
          {gPotions.map((g) => (
            <button key={g.item.id} onClick={() => useConsumable('potion', g.firstIdx)} className="w-full text-left panel rounded-sm p-2.5 mb-1.5 active:scale-[.98] flex justify-between items-center">
              <div><p className="font-display text-sm">{g.item.name} {g.count > 1 && <span className="text-amber-300/70">×{g.count}</span>}</p><p className="text-[10px] font-type text-green-300">{g.item.effectDesc}</p></div>
              <span className="text-[10px] font-display text-amber-300">USAR</span>
            </button>
          ))}
        </Section>
        <div className="divider-rune mb-3" />
        <Section label={`🍖 Comida (${gFoods.length}/10 tipos)`} empty="Sin comida.">
          {gFoods.map((g) => (
            <button key={g.item.id} onClick={() => useConsumable('food', g.firstIdx)} className="w-full text-left panel rounded-sm p-2.5 mb-1.5 active:scale-[.98] flex justify-between items-center">
              <div>
                <p className="font-display text-sm">{g.item.name} {g.count > 1 && <span className="text-amber-300/70">×{g.count}</span>}</p>
                <div className="flex gap-2 text-[10px] font-type mt-0.5">
                  <span className="text-amber-300">+{g.item.hunger}▣</span>
                  <span className="text-cyan-300">+{g.item.energy}◈</span>
                  {g.item.hpHeal && <span className="text-green-300">+{g.item.hpHeal}♥</span>}
                  {g.item.mpHeal && <span className="text-blue-300">+{g.item.mpHeal}◆</span>}
                </div>
              </div>
              <span className="text-[10px] font-display text-amber-300">COMER</span>
            </button>
          ))}
        </Section>
        <div className="divider-rune mb-3" />
        <Section label={`🥤 Bebestibles (${gBeverages.length}/10 tipos)`} empty="Sin bebidas.">
          {gBeverages.map((g) => (
            <button key={g.item.id} onClick={() => useConsumable('beverage', g.firstIdx)} className="w-full text-left panel rounded-sm p-2.5 mb-1.5 active:scale-[.98] flex justify-between items-center">
              <div><p className="font-display text-sm">{g.item.name} {g.count > 1 && <span className="text-cyan-300/70">×{g.count}</span>}</p><p className="text-[10px] font-type text-cyan-300">{g.item.effectDesc}</p></div>
              <span className="text-[10px] font-display text-amber-300">BEBER</span>
            </button>
          ))}
        </Section>
      </div>
    );
  };

  const renderSettingsModal = () => (
    <Modal open={showSettings} onClose={() => setShowSettings(false)} title="⚙ Opciones">
      <div className="space-y-4">
        <div>
          <label className="label">🎵 Música</label>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => {
              const ns = { ...profile.settings, musicEnabled: !profile.settings.musicEnabled };
              setMusicEnabled(ns.musicEnabled);
              saveProfile({ ...profile, settings: ns });
            }} className="btn-stone px-4 py-2 rounded-sm text-sm" style={profile.settings.musicEnabled ? { background: 'linear-gradient(180deg,#5a3010,#3a1808)', borderColor: 'rgba(194,120,30,0.5)' } : {}}>
              {profile.settings.musicEnabled ? 'ON' : 'OFF'}
            </button>
            <input type="range" min="0" max="100" value={profile.settings.musicVol * 100}
              onChange={e => {
                const v = Number(e.target.value) / 100;
                setMusicVolume(v);
                saveProfile({ ...profile, settings: { ...profile.settings, musicVol: v } });
              }} className="flex-1 accent-amber-600" />
          </div>
        </div>
        <div className="divider-rune" />
        <div>
          <label className="label">🔊 Efectos de Sonido</label>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => {
              const ns = { ...profile.settings, sfxEnabled: !profile.settings.sfxEnabled };
              setSfxEnabled(ns.sfxEnabled);
              saveProfile({ ...profile, settings: ns });
            }} className="btn-stone px-4 py-2 rounded-sm text-sm" style={profile.settings.sfxEnabled ? { background: 'linear-gradient(180deg,#5a3010,#3a1808)', borderColor: 'rgba(194,120,30,0.5)' } : {}}>
              {profile.settings.sfxEnabled ? 'ON' : 'OFF'}
            </button>
            <input type="range" min="0" max="100" value={profile.settings.sfxVol * 100}
              onChange={e => {
                const v = Number(e.target.value) / 100;
                setSfxVolume(v);
                saveProfile({ ...profile, settings: { ...profile.settings, sfxVol: v } });
              }} className="flex-1 accent-amber-600" />
          </div>
        </div>
        <div className="divider-rune" />
        <div>
          <label className="label">📜 Velocidad de Texto</label>
          <input type="range" min="10" max="80" value={profile.settings.textSpeed}
            onChange={e => saveProfile({ ...profile, settings: { ...profile.settings, textSpeed: Number(e.target.value) } })}
            className="w-full accent-amber-600 mt-2" />
          <div className="flex justify-between text-[10px] font-type text-bone/35 mt-1">
            <span>Rápido</span><span>Lento</span>
          </div>
        </div>
        <div className="divider-rune" />
        <div>
          <label className="label">🗣️ Narrador (Texto a Voz)</label>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => {
              const ns = { ...profile.settings, narratorEnabled: !profile.settings.narratorEnabled };
              setNarratorEnabled(ns.narratorEnabled);
              saveProfile({ ...profile, settings: ns });
            }} className="btn-stone px-4 py-2 rounded-sm text-sm" style={profile.settings.narratorEnabled ? { background: 'linear-gradient(180deg,#5a3010,#3a1808)', borderColor: 'rgba(194,120,30,0.5)' } : {}}>
              {profile.settings.narratorEnabled ? 'ON' : 'OFF'}
            </button>
            <input type="range" min="0" max="100" value={profile.settings.narratorVol * 100}
              onChange={e => {
                const v = Number(e.target.value) / 100;
                setNarratorVolume(v);
                saveProfile({ ...profile, settings: { ...profile.settings, narratorVol: v } });
              }} className="flex-1 accent-amber-600" />
          </div>
          {profile.settings.narratorEnabled && (
            <div className="mt-2">
              <label className="label text-[9px]">Velocidad de lectura</label>
              <input type="range" min="50" max="130" value={profile.settings.narratorRate * 100}
                onChange={e => {
                  const v = Number(e.target.value) / 100;
                  setNarratorRate(v);
                  saveProfile({ ...profile, settings: { ...profile.settings, narratorRate: v } });
                }} className="w-full accent-amber-600 mt-1" />
              <div className="flex justify-between text-[9px] font-type text-bone/30"><span>Lento</span><span>Rápido</span></div>
            </div>
          )}
          {profile.settings.narratorEnabled && (
            <div className="mt-2">
              <label className="label text-[9px]">Seleccionar voz</label>
              <div className="space-y-1 mt-1" style={{ maxHeight: 160, overflowY: 'scroll', WebkitOverflowScrolling: 'touch' }}>
                {getAvailableVoices().map(v => (
                  <button key={v.idx} onClick={() => {
                    setNarratorVoiceIdx(v.idx);
                    speak('La torre te observa.');
                  }} className="w-full text-left btn-stone rounded-sm px-2 py-1.5 text-[10px] font-type truncate">
                    {v.name}
                  </button>
                ))}
                {getAvailableVoices().length === 0 && <p className="font-type text-[10px] text-bone/40 text-center py-2">No se encontraron voces en español.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );

  // ---- START SCREEN ----
  if (screen === 'start') {
    return (
      <div className="min-h-full flex flex-col items-center justify-end p-6 pb-10 overflow-y-auto vignette" onClick={startAudio}
        style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(100,40,20,0.12), transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(20,15,30,0.8), transparent 60%), linear-gradient(180deg, #0c0a10 0%, #151218 30%, #1a161e 60%, #0e0c12 100%)' }}>
        <div className="text-center mb-8 animate-fadeIn" style={{ maxWidth: 400 }}>
          {/* Tower silhouette — 7 rapid clicks = debug menu */}
          {/* CSS Tower silhouette — no external images needed */}
          <button className="mb-5 relative w-24 h-44 mx-auto" onClick={(e) => {
            e.stopPropagation();
            eyeClicks.current++;
            if (eyeTimer.current) clearTimeout(eyeTimer.current);
            eyeTimer.current = setTimeout(() => { eyeClicks.current = 0; }, 2000);
            if (eyeClicks.current >= 7) { setShowDebug(true); eyeClicks.current = 0; }
          }}>
            {/* Tower body */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-32 animate-pulse-slow" style={{
              background: 'linear-gradient(180deg, #1a1520 0%, #201822 30%, #2a2028 70%, #1a1520 100%)',
              clipPath: 'polygon(35% 0%, 50% -5%, 65% 0%, 62% 100%, 38% 100%)',
              boxShadow: '0 0 40px rgba(0,0,0,0.8)',
            }} />
            {/* Tower spire */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-16" style={{
              background: 'linear-gradient(180deg, transparent 0%, #1a1520 40%, #201822 100%)',
              clipPath: 'polygon(50% 0%, 70% 100%, 30% 100%)',
            }} />
            {/* Glowing eye at top */}
            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-3 h-2 rounded-full animate-ember" style={{
              background: 'radial-gradient(ellipse, rgba(220,100,20,0.9), rgba(180,40,20,0.4), transparent)',
              boxShadow: '0 0 12px rgba(200,80,20,0.6), 0 0 30px rgba(200,60,10,0.3)',
            }} />
            {/* Fog effect */}
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 50% 70%, rgba(40,35,50,0.5), transparent 70%)',
            }} />
            {/* Ground fog */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-12" style={{
              background: 'radial-gradient(ellipse at 50% 100%, rgba(30,25,40,0.7), transparent 70%)',
            }} />
          </button>
          <h1 className="font-display font-black leading-tight mb-3 animate-ember"
            style={{ fontSize: 32, color: '#e0cba0', letterSpacing: '0.08em' }}>
            LA TORRE
          </h1>
          <div className="divider-rune w-36 mx-auto my-3" />
          <p className="font-type text-[10px] text-bone/45 leading-relaxed max-w-[300px] mx-auto">
            La locura, el hambre, la peste y la monotonía<br />
            ya habitaban la humanidad<br />
            antes de la aparición de esta torre.
          </p>
        </div>
        <div className="w-full space-y-2.5 animate-riseIn" style={{ maxWidth: 340 }}>
          {run && (
            <button onClick={(e) => { e.stopPropagation(); continueGame(); }} className="btn-blood w-full py-4 rounded-sm text-base">
              ⚔ Continuar · Piso {run.floor}
            </button>
          )}
          <button onClick={() => { sfxClick(); setScreen('charSelect'); }} className={`${run ? 'btn-stone' : 'btn-blood'} w-full py-4 rounded-sm text-base`}>
            Nueva Ascensión
          </button>
          <button onClick={() => { sfxClick(); setScreen('bestiary'); }} className="btn-stone w-full py-3 rounded-sm text-sm">
            📖 Compendio
          </button>
          <button onClick={() => { sfxClick(); setScreen('scores'); }} className="btn-stone w-full py-3 rounded-sm text-sm">
            🏆 Crónicas
          </button>
          <button onClick={() => { sfxClick(); setShowSettings(true); }} className="btn-stone w-full py-3 rounded-sm text-sm">
            ⚙ Opciones
          </button>
        </div>
        {renderSettingsModal()}
        <Modal open={showDebug} onClose={() => setShowDebug(false)} title="🔧 Modo Desarrollador">
          <div className="space-y-2">
            <button onClick={() => {
              const nb: Record<string, {seen:boolean;killed:number}> = {};
              ENEMIES.forEach(e => { nb[e.id] = { seen: true, killed: 5 }; });
              saveProfile({ ...profile, bestiary: nb });
              addLog('✅ Bestiario completo desbloqueado.');
            }} className="btn-stone w-full py-2 rounded-sm text-xs">📖 Desbloquear Bestiario completo</button>
            <button onClick={() => {
              saveProfile({ ...profile, unlockedClasses: ['caballero','mago','picaro','paladin','guerrero','brujo','humano'] });
              addLog('✅ Todas las clases desbloqueadas.');
            }} className="btn-stone w-full py-2 rounded-sm text-xs">🔓 Desbloquear todas las clases</button>
            <button onClick={() => {
              const allNotes = FOUND_NOTES.map((_,i) => i);
              saveProfile({ ...profile, foundNotes: allNotes });
              addLog('✅ Todas las notas desbloqueadas.');
            }} className="btn-stone w-full py-2 rounded-sm text-xs">📜 Desbloquear todas las notas</button>
            <button onClick={() => {
              const allNotes = FOUND_NOTES.map((_,i) => i);
              const nb: Record<string, {seen:boolean;killed:number}> = {};
              ENEMIES.forEach(e => { nb[e.id] = { seen: true, killed: 5 }; });
              const allItems = [...WEAPONS.map(w=>w.id), ...POTIONS.map(p=>p.id), ...FOODS.map(f=>f.id)];
              saveProfile({ ...profile, foundNotes: allNotes, bestiary: nb, unlockedClasses: ['caballero','mago','picaro','paladin','guerrero','brujo','humano'], discoveredItems: allItems });
            }} className="btn-stone w-full py-2 rounded-sm text-xs">🌟 Desbloquear TODO</button>
            <button onClick={() => setDebugInGame(!debugInGame)}
              className={`w-full py-2 rounded-sm text-xs ${debugInGame ? 'btn-blood' : 'btn-stone'}`}>
              🔧 Editor en partida: {debugInGame ? 'ON' : 'OFF'}
            </button>
            {run && (
              <>
                <div className="divider-rune" />
                <p className="label">Editor de PJ ({run.className} Nv{run.level})</p>
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {(['hp','mp','atk','def','mag','int','spd','lck'] as const).map(st => (
                    <button key={st} onClick={() => {
                      const ns = {...run.stats};
                      if (st === 'hp') { ns.maxHp += 50; ns.hp = ns.maxHp; }
                      else if (st === 'mp') { ns.maxMp += 30; ns.mp = ns.maxMp; }
                      else { (ns as Record<string,number>)[st] += 10; }
                      saveRun({...run, stats: ns, permStats: {...ns, hp: ns.maxHp, mp: ns.maxMp}});
                    }} className="btn-stone py-1.5 rounded-sm text-[10px] font-type">+{st === 'hp' ? '50' : st === 'mp' ? '30' : '10'} {st.toUpperCase()}</button>
                  ))}
                  <button onClick={() => saveRun({...run, level: Math.min(60, run.level + 5), exp: 0})} className="btn-stone py-1.5 rounded-sm text-[10px] font-type">+5 LVL</button>
                  <button onClick={() => saveRun({...run, hunger: 70, energy: 90})} className="btn-stone py-1.5 rounded-sm text-[10px] font-type">🍖 Fill</button>
                  <button onClick={() => saveRun({...run, stats: {...run.stats, hp: run.stats.maxHp, mp: run.stats.maxMp}})} className="btn-stone py-1.5 rounded-sm text-[10px] font-type">💚 Full HP/MP</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      </div>
    );
  }

  // ---- CHARACTER SELECT ----
  if (screen === 'charSelect') {
    return (
      <div className="min-h-full p-4 overflow-y-auto stone-bg vignette" onClick={startAudio}>
        <div className="mx-auto" style={{ maxWidth: 420 }}>
          <button onClick={() => { sfxClick(); setScreen('start'); }} className="font-type text-bone/50 mb-3 text-sm">← Volver</button>
          <h2 className="font-display text-xl tracking-wider mb-4">Elige tu Legado</h2>
          <div className="space-y-2.5">
            {CLASSES.map(cls => {
              const locked = cls.locked && !profile.unlockedClasses.includes(cls.id);
              const ascended = profile.ascendedClasses.includes(cls.id);
              return (
                <button key={cls.id} disabled={locked}
                  onClick={() => { sfxClick(); startNewGame(cls.id); }}
                  className={`w-full panel rounded-sm p-3 text-left active:scale-[.98] transition ${locked ? 'opacity-35' : ''}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-display font-bold tracking-wide text-bone/90">{cls.name}</span>
                    <div className="flex gap-1.5">
                      {ascended && <span className="text-[9px] font-type bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded">👑 Ascendido</span>}
                      {locked && <span className="text-[9px] font-type bg-red-950/50 text-red-400 px-1.5 py-0.5 rounded">🔒 Bloqueado</span>}
                    </div>
                  </div>
                  <p className="font-type text-bone/45 text-xs mb-2">{cls.desc}</p>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[10px] font-type">
                    {(['hp', 'atk', 'def', 'mag', 'spd', 'lck'] as const).map(stat => (
                      <div key={stat} className="flex items-center gap-1">
                        <span className="text-bone/30 uppercase w-6">{stat}</span>
                        <div className="flex-1 h-1 rounded-full bg-black/40 overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${((cls.stats[stat] || 0) / (cls.caps[stat] || 100)) * 100}%`,
                            background: stat === 'hp' ? '#a11c1f' : stat === 'atk' ? '#b45309' : stat === 'def' ? '#6b6b6b' : stat === 'mag' ? '#7e22ce' : stat === 'spd' ? '#15803d' : '#d97706'
                          }} />
                        </div>
                        <span className="text-bone/40 w-4 text-right">{cls.stats[stat]}</span>
                      </div>
                    ))}
                  </div>
                  <p className="font-type text-bone/25 text-[10px] mt-2 italic leading-relaxed">{cls.lore.slice(0, 70)}...</p>
                </button>
              );
            })}
          </div>
        </div>
        <Modal open={showIntro} onClose={() => setShowIntro(false)} title="">
          <div className="text-center py-4">
            <div className="text-5xl mb-4 animate-pulse-slow">🏔️</div>
            <p className="font-type text-sm text-bone/80 leading-relaxed mb-4 italic">
              Una torre se alza en medio de la nada, allí donde una estrella fugaz cayó.
            </p>
            <p className="font-type text-sm text-bone/60 leading-relaxed mb-6">
              Te adentras por alguna razón...
            </p>
            <button onClick={confirmStartGame} className="btn-blood w-full py-4 rounded-sm font-display text-base">
              Entrar a la Torre
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  // ---- COMPENDIO (Bestiary + Weapons + Items + Food) ----
  if (screen === 'bestiary') {
    const seenCount = Object.values(profile.bestiary).filter(b => b.seen).length;
    return (
      <div className="min-h-full p-4 overflow-y-auto stone-bg vignette">
        <div className="mx-auto" style={{ maxWidth: 420 }}>
          <button onClick={() => { sfxClick(); setScreen('start'); }} className="font-type text-bone/50 mb-3 text-sm">← Volver</button>
          <h2 className="font-display text-xl tracking-wider mb-3">Compendio</h2>
          <div className="flex gap-1 mb-3 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {['Bestiario', 'Armas', 'Pociones', 'Comida'].map((t, i) => (
              <button key={t} onClick={() => setCompendiumTab(i)}
                className="flex-1 px-2 py-2 rounded-sm text-[10px] font-display tracking-wider whitespace-nowrap active:scale-[.97]"
                style={compendiumTab === i
                  ? { background: 'linear-gradient(180deg,#5a3515,#3a200a)', border: '1px solid rgba(200,130,50,0.45)', color: '#e8d0a0' }
                  : { background: 'rgba(30,26,30,0.8)', border: '1px solid rgba(100,85,60,0.2)', color: '#8a7a5a' }}>
                {t}
              </button>
            ))}
          </div>

          {compendiumTab === 0 && (
            <div className="space-y-2">
              <p className="font-type text-[10px] text-bone/40 mb-2">{seenCount}/{ENEMIES.length} criaturas</p>
              {ENEMIES.map(e => {
                const entry = profile.bestiary[e.id];
                return (
                  <div key={e.id} className={`panel rounded-sm p-2.5 flex items-start gap-2.5 ${entry?.seen ? '' : 'opacity-50'}`}>
                    <div className="text-2xl w-8 text-center flex-shrink-0">{entry?.seen ? (ENEMY_EMOJI[e.id] || '☠️') : '❓'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-display text-sm font-bold text-bone/85">{entry?.seen ? e.name : '???'}{e.isBoss ? ' 👑' : ''}</span>
                        <span className="text-[9px] font-type text-bone/30">P{e.floors[0]}-{e.floors[1]}</span>
                      </div>
                      {entry?.seen && <p className="text-bone/40 text-[10px] mt-0.5 font-type leading-relaxed">{e.lore.slice(0, 80)}...</p>}
                      {entry?.killed ? <span className="text-[9px] font-type text-red-400/50">☠{entry.killed}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {compendiumTab === 1 && (
            <div className="space-y-2">
              {WEAPONS.filter(w => profile.discoveredItems.includes(w.id)).length === 0 && <p className="font-type text-bone/35 text-center py-6">Aún no has descubierto armas.</p>}
              {WEAPONS.filter(w => profile.discoveredItems.includes(w.id)).map(w => (
                <div key={w.id} className="panel rounded-sm p-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-display text-sm font-bold text-bone/85">🗡 {w.name}</span>
                    <span className="text-[9px] font-type text-bone/30">Tier {w.tier}</span>
                  </div>
                  <div className="flex gap-2 text-[10px] font-type mt-1">
                    <span className="text-amber-300">ATK+{w.atk}</span>
                    {w.mag > 0 && <span style={{ color: '#9070c0' }}>MAG+{w.mag}</span>}
                    {w.spd !== 0 && <span className={w.spd > 0 ? 'text-green-300' : 'text-red-300'}>SPD{w.spd > 0 ? '+' : ''}{w.spd}</span>}
                  </div>
                  {w.effectDesc && <p className={`text-[9px] font-type mt-0.5 ${w.selfHarm ? 'text-red-300' : 'text-green-300'}`}>{w.effectDesc}</p>}
                  <p className="text-[9px] font-type text-bone/30 italic mt-0.5">{w.lore}</p>
                </div>
              ))}
            </div>
          )}

          {compendiumTab === 2 && (
            <div className="space-y-2">
              {POTIONS.filter(p => profile.discoveredItems.includes(p.id)).length === 0 && <p className="font-type text-bone/35 text-center py-6">Aún no has descubierto pociones.</p>}
              {POTIONS.filter(p => profile.discoveredItems.includes(p.id)).map(p => (
                <div key={p.id} className="panel rounded-sm p-2.5">
                  <span className="font-display text-sm font-bold text-bone/85">🧪 {p.name}</span>
                  <p className="text-[10px] font-type text-green-300 mt-0.5">{p.effectDesc}</p>
                  <p className="text-[9px] font-type text-bone/30 italic mt-0.5">{p.lore}</p>
                </div>
              ))}
            </div>
          )}

          {compendiumTab === 3 && (
            <div className="space-y-2">
              {FOODS.filter(f => profile.discoveredItems.includes(f.id)).length === 0 && <p className="font-type text-bone/35 text-center py-6">Aún no has descubierto comida.</p>}
              {FOODS.filter(f => profile.discoveredItems.includes(f.id)).map(f => (
                <div key={f.id} className="panel rounded-sm p-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-display text-sm font-bold text-bone/85">🍖 {f.name}</span>
                    <span className="text-[9px] font-type text-bone/30">{f.tier}</span>
                  </div>
                  <div className="flex gap-2 text-[10px] font-type mt-1">
                    <span className="text-amber-300">+{f.hunger}▣</span>
                    <span className="text-cyan-300">+{f.energy}◈</span>
                    {f.hpHeal && <span className="text-green-300">+{f.hpHeal}♥</span>}
                    {f.mpHeal && <span className="text-blue-300">+{f.mpHeal}◆</span>}
                  </div>
                  {f.effectDesc && <p className="text-[9px] font-type text-bone/40 mt-0.5">{f.effectDesc}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- CRÓNICAS (Records + Lore + Notes) ----
  if (screen === 'scores') {
    const lorePhases = [
      { title: 'La Verdad que no quieres escuchar', text: 'No eres un héroe. Nunca lo fuiste. Los que entran a la torre no son valientes — son los que ya tenían oscuridad suficiente para sentirse atraídos. La torre no corrompe. Revela. Cada piso que subes, cada criatura que matas, cada poder que absorbes — no es heroísmo. Es tu naturaleza alimentándose. Los monstruos que enfrentas son víctimas más antiguas que tú. Y tú te convertirás en uno de ellos. O en algo peor.' },
      { title: 'Pisos 1-15: La Oscuridad', text: 'Algo cayó del cielo. Su poder era equivalente al de una deidad. La corrupción no era ajena — no era diferente de nosotros en naturaleza. Bestias malignas fueron atraídas como por gravedad. Los brujos sintieron un malestar que no podían comprender. Mujeres y niños fueron secuestrados. Los muertos se levantaron. Los perros mordieron a los humanos, las infecciones empeoraron en enfermedades y virus. Nacieron los hombres lobo.' },
      { title: 'Pisos 16-30: Las Pistas', text: 'Exploradores anteriores dejaron rastros de lo que encontraron. Campamentos abandonados, diarios incompletos, señales de secuestros masivos. La corrupción se extiende más allá de las bestias — los humanos también cambian. Algunos se sienten emboldecidos, aventurándose heroicamente en las áreas oscuras. Pero su propia oscuridad interna los atrae.' },
      { title: 'Pisos 31-44: Revelaciones', text: 'Las víctimas dejaron memorias en las paredes. La arquitectura ya no finge normalidad — las escaleras suben hacia abajo, los pasillos se curvan en direcciones que no existen. La torre mide el progreso no en pisos sino en días. Cada piso es un TRAVERSAL — un viaje oscuro y solitario a través de la humedad oscura.' },
      { title: 'Pisos 45-60: El Giro', text: '"Aprender habilidades" es consumir espíritus. Cada poder nuevo sabe a ceniza y recuerdos ajenos. Los enemigos te temen — no por respeto, sino por reconocimiento. ¿Héroes o depredadores? La torre no distingue. Tu reflejo tiene más cicatrices que tú. Y sonríe.' },
      { title: 'Pisos 61-80: La Verdad', text: 'Ya no eres una persona. Eres un amalgama de espíritus en un cuerpo mortal débil. La "misión heroica" es tu naturaleza oscura cumpliéndose. Cada habilidad aprendida fue un alma consumida. La torre no te atrapa — te invitó. Aceptaste.' },
      { title: 'Pisos 81-99: La Prueba', text: 'El Dios verdadero te dio la oportunidad de luchar contra tu naturaleza. ¿Es posible ganar? ¿O la victoria misma es la derrota? Los últimos pisos son silenciosos. Incluso los monstruos saben lo que se acerca.' },
      { title: 'Piso 100: El Final', text: 'El humano disfrazado de héroe somete al mal y se convierte en él. La naturaleza se cumple. Lo que cayó del cielo no trajo la maldad — la despertó. Y tú eres la prueba.' },
    ];
    return (
      <div className="min-h-full p-4 overflow-y-auto stone-bg vignette">
        <div className="mx-auto" style={{ maxWidth: 420 }}>
          <button onClick={() => { sfxClick(); setScreen('start'); }} className="font-type text-bone/50 mb-3 text-sm">← Volver</button>
          <h2 className="font-display text-2xl tracking-wider mb-3">Crónicas</h2>
          <div className="flex gap-1 mb-3 overflow-x-auto">
            {['Récords', 'Lore', 'Notas'].map((t, i) => (
              <button key={t} onClick={() => setChronicleTab(i)}
                className="flex-1 px-2 py-2 rounded-sm text-[11px] font-display tracking-wider whitespace-nowrap active:scale-[.97]"
                style={chronicleTab === i
                  ? { background: 'linear-gradient(180deg,#5a3515,#3a200a)', border: '1px solid rgba(200,130,50,0.45)', color: '#e8d0a0' }
                  : { background: 'rgba(30,26,30,0.8)', border: '1px solid rgba(100,85,60,0.2)', color: '#8a7a5a' }}>
                {t}
              </button>
            ))}
          </div>

          {chronicleTab === 0 && (
            profile.highScores.length === 0 ? (
              <div className="panel rounded-sm p-6 text-center"><p className="font-type text-bone/35">Las crónicas aguardan tu legado.</p></div>
            ) : (
              <div className="space-y-2">
                {profile.highScores.map((s, i) => (
                  <div key={i} className="panel rounded-sm p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-lg" style={{ color: i === 0 ? '#f0b429' : i === 1 ? '#a0a0a0' : i === 2 ? '#b45309' : '#6b5b3a' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <div>
                        <span className="font-display text-sm text-bone/85">{CLASSES.find(c => c.id === s.cls)?.name || s.cls}</span>
                        <span className="font-type text-[10px] text-bone/40 ml-2">Piso {s.floor} · Día {s.day}</span>
                      </div>
                    </div>
                    <span className="font-display font-bold text-amber-400">{s.score}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {chronicleTab === 1 && (
            <div className="space-y-3">
              {lorePhases.map((lp, i) => (
                <div key={i} className="panel rounded-sm p-3">
                  <p className="font-display text-xs text-amber-300 mb-1">{lp.title}</p>
                  <p className="font-type text-[11px] text-bone/60 leading-relaxed">{lp.text}</p>
                </div>
              ))}
            </div>
          )}

          {chronicleTab === 2 && (
            profile.foundNotes.length === 0 ? (
              <div className="panel rounded-sm p-6 text-center"><p className="font-type text-bone/35">Aún no has encontrado notas.</p></div>
            ) : (
              <div className="space-y-2">
                {profile.foundNotes.map((idx) => (
                  <div key={idx} className="panel rounded-sm p-2.5">
                    <p className="font-type text-[11px] text-bone/60 italic leading-relaxed">"{FOUND_NOTES[idx]}"</p>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  // ---- DEATH SCREEN ----
  if (screen === 'death') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 stone-bg vignette" onClick={startAudio}>
        <div className="text-center animate-fadeIn" style={{ maxWidth: 380 }}>
          <div className="text-6xl mb-5 animate-pulse-slow" style={{ filter: 'drop-shadow(0 0 20px rgba(122,21,24,0.6))' }}>💀</div>
          <h1 className="font-display font-black text-2xl tracking-wider mb-3 text-red-400" style={{ textShadow: '0 2px 10px rgba(122,21,24,0.5)' }}>
            HAS CAÍDO
          </h1>
          {run && (
            <div className="panel rounded-sm p-4 mb-6">
              <div className="space-y-2 font-type text-sm text-bone/50">
                <p>Clase: <span className="text-bone/90 font-bold">{getCls()?.name}</span></p>
                <p>Piso alcanzado: <span className="text-bone/90 font-bold">{run.floor}</span></p>
                <p>Día: <span className="text-bone/90 font-bold">{run.day}</span></p>
                <p>Puntuación: <span className="text-amber-400 font-bold">{run.score}</span></p>
                <p>Enemigos derrotados: <span className="text-red-400 font-bold">{run.kills}</span></p>
              </div>
            </div>
          )}
          <p className="font-type text-bone/30 text-xs italic mb-6">
            "La torre no perdona. Pero siempre acepta nuevos aspirantes."
          </p>
          <div className="space-y-2.5">
            <button onClick={() => { setRun(null); setScreen('charSelect'); }} className="btn-blood w-full py-4 rounded-sm">
              ⚔️ Intentar de Nuevo
            </button>
            <button onClick={() => { setRun(null); setScreen('start'); }} className="btn-stone w-full py-3 rounded-sm">
              Menú Principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- VICTORY SCREEN ----
  if (screen === 'victory') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 stone-bg vignette" onClick={startAudio}>
        <div className="text-center animate-fadeIn" style={{ maxWidth: 380 }}>
          <div className="text-6xl mb-5 animate-ember" style={{ filter: 'drop-shadow(0 0 24px rgba(194,65,12,0.6))' }}>👑</div>
          <h1 className="font-display font-black text-2xl tracking-wider mb-3" style={{ color: '#f0b429', textShadow: '0 2px 12px rgba(194,65,12,0.5)' }}>
            {run?.className === 'humano' ? 'ARTÍFICE DE LA GUERRA' : 'ASCENSIÓN COMPLETA'}
          </h1>
          {run && (
            <div className="panel rounded-sm p-4 mb-6">
              <div className="space-y-2 font-type text-sm text-bone/50">
                <p>Clase: <span className="text-amber-300 font-bold">{getCls()?.name}</span> — ASCENDIDA</p>
                <p>Día final: <span className="text-bone/90 font-bold">{run.day}</span></p>
                <p>Puntuación: <span className="text-amber-400 font-bold">{run.score + 1000}</span></p>
              </div>
            </div>
          )}
          <p className="font-type text-bone/35 text-xs italic mb-6">
            "El humano disfrazado de héroe somete al mal y se convierte en él."
          </p>
          <div className="space-y-2.5">
            <button onClick={() => { setRun(null); setScreen('charSelect'); }} className="btn-blood w-full py-4 rounded-sm">
              👑 Nueva Ascensión
            </button>
            <button onClick={() => { setRun(null); setScreen('start'); }} className="btn-stone w-full py-3 rounded-sm">
              Menú Principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- TOWER SCREEN ----
  if (screen !== 'tower' || !run) return null;

  const stats = getEffectiveStats();
  if (!stats) return null;
  const cls = getCls();
  const weapon = getWeapon();
  const hungerZone = getHungerZone(run.hunger);

  /* SettingsModal rendered via renderSettingsModal() */

  // Face emoji based on hunger/energy/hp state
  const getFaceEmoji = () => {
    const hpPct = run.stats.maxHp > 0 ? run.stats.hp / run.stats.maxHp : 1;
    if (hpPct < 0.15) return '💀';
    if (run.hunger <= 10) return '🥵';
    if (run.energy <= 10) return '😵';
    if (hpPct < 0.3) return '😰';
    if (run.hunger >= 90) return '🤢';
    if (run.hunger <= 25) return '😣';
    if (run.energy <= 25) return '😩';
    if (hpPct > 0.8 && run.hunger >= 40 && run.hunger <= 75 && run.energy >= 50) return '😤';
    if (hpPct > 0.5 && run.hunger >= 30 && run.energy >= 30) return '😐';
    return '😑';
  };

  // Mini Status Bar — compact, dark, with face
  const MiniStatusBar = () => (
    <div className="sticky top-0 z-40 border-b border-rune/30" style={{ background: 'linear-gradient(180deg,#12100a,#0a0805)' }}>
      <div className="flex items-center justify-between px-2.5 py-1.5 mx-auto" style={{ maxWidth: 620 }}>
        {/* Left: Face + Core stats */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowStats(true)} className="text-2xl leading-none" title="Estado">{getFaceEmoji()}</button>
          <div className="flex flex-col gap-0.5">
            {/* HP/MP row */}
            <div className="flex items-center gap-2 text-[11px] font-type">
              <span className="text-red-400">♥{run.stats.hp}<span className="text-red-900">/{run.stats.maxHp}</span></span>
              <span className="text-blue-300">◆{run.stats.mp}<span className="text-blue-900">/{run.stats.maxMp}</span></span>
            </div>
            {/* Hunger/Energy/Level row */}
            <div className="flex items-center gap-2 text-[10px] font-type">
              <span className="text-amber-300">Nv{run.level}</span>
              <span className={run.hunger < 30 ? 'text-red-400' : run.hunger > 80 ? 'text-amber-400' : 'text-amber-600'}>▣{run.hunger}</span>
              <span className={run.energy < 25 ? 'text-red-400' : 'text-cyan-600'}>◈{run.energy}</span>
            </div>
          </div>
        </div>
        {/* Right: Buttons */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowStats(true)} className="w-8 h-8 rounded-sm btn-stone flex items-center justify-center text-sm" title="Estadísticas">📜</button>
          <button onClick={() => setShowMenu(true)} className="w-8 h-8 rounded-sm btn-stone flex items-center justify-center text-sm" title="Menú">☰</button>
        </div>
      </div>
    </div>
  );

  // Stats Modal
  const StatsModal = () => (
    <Modal open={showStats} onClose={() => setShowStats(false)} title="Estadísticas">
      <div className="space-y-4">
        {/* Level & EXP */}
        <div className="panel rounded-sm p-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-display font-bold text-amber-300">Nivel {run.level}{run.level >= 60 ? ' (MAX)' : ''}</span>
            <span className="font-type text-xs text-bone/50">{run.level < 60 ? `${run.exp}/${run.expToNext} EXP` : 'MAX'}</span>
          </div>
          {run.level < 60 && <StatBar value={run.exp} max={run.expToNext} color="bg-amber-500" height="h-2" />}
          <div className="font-type text-[10px] text-bone/40 mt-1">Clase: {cls?.name} · Piso {run.floor} · Día {run.day}</div>
        </div>
        <div className="divider-rune" />
        {/* HP */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-red-400">♥ HP</span>
            <span className="text-sm font-extrabold">{run.stats.hp} / {run.stats.maxHp} <span className="text-white/20">(cap: {cls?.caps.hp})</span></span>
          </div>
          <StatBar value={run.stats.hp} max={run.stats.maxHp} color="bg-red-500" />
          <div className="mt-1"><StatBar value={run.stats.maxHp} max={cls?.caps.hp || 400} color="bg-red-500/30" height="h-1" /></div>
        </div>
        {/* MP */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-blue-400">◆ MP</span>
            <span className="text-sm font-extrabold">{run.stats.mp} / {run.stats.maxMp} <span className="text-white/20">(cap: {cls?.caps.mp})</span></span>
          </div>
          <StatBar value={run.stats.mp} max={run.stats.maxMp} color="bg-blue-500" />
          <div className="mt-1"><StatBar value={run.stats.maxMp} max={cls?.caps.mp || 200} color="bg-blue-500/30" height="h-1" /></div>
        </div>
        <div className="divider" />
        {/* Combat Stats */}
        {([
          ['atk', '⚔ ATK', 'text-amber-400', 'bg-amber-500'],
          ['def', '● DEF', 'text-gray-400', 'bg-gray-400'],
          ['mag', '★ MAG', 'text-purple-300', 'bg-purple-700'],
          ['int', '◇ INT', 'text-cyan-400', 'bg-cyan-500'],
          ['spd', '» SPD', 'text-green-400', 'bg-green-500'],
          ['lck', '✦ LCK', 'text-amber-300', 'bg-amber-400'],
          ['mas', '∞ MAS', 'text-amber-300', 'bg-amber-600'],
        ] as const).map(([key, label, textColor, barColor]) => {
          const current = stats[key] || 0;
          const base = run.permStats[key] || 0;
          const cap = (cls?.caps as Record<string, number>)?.[key] || 100;
          const diff = current - base;
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className={textColor}>{label}</span>
                <span className="text-sm font-extrabold">
                  {current}
                  {diff !== 0 && <span className={diff > 0 ? 'text-green-400' : 'text-red-400'}> ({diff > 0 ? '+' : ''}{diff})</span>}
                  <span className="text-white/20"> (cap: {key === 'mas' ? 100 : cap})</span>
                </span>
              </div>
              <StatBar value={current} max={key === 'mas' ? 100 : cap} color={barColor} />
              <div className="mt-0.5"><StatBar value={base} max={key === 'mas' ? 100 : cap} color={`${barColor}/30`} height="h-1" /></div>
            </div>
          );
        })}
        <div className="divider" />
        {/* Hunger & Energy */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span>▣ Hambre</span>
            <span className={`text-sm font-extrabold ${hungerZone.color}`}>{run.hunger}/100 [{hungerZone.zone}]</span>
          </div>
          <StatBar value={run.hunger} max={100} color={run.hunger > 70 ? 'bg-amber-500' : run.hunger < 25 ? 'bg-red-500' : 'bg-green-500'} />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-cyan-400">◈ Energía</span>
            <span className="text-sm font-extrabold">{run.energy}/100</span>
          </div>
          <StatBar value={run.energy} max={100} color="bg-cyan-500" />
        </div>
        {/* Active Buffs */}
        {run.buffs.length > 0 && (
          <>
            <div className="divider" />
            <div>
              <span className="label">Efectos Activos</span>
              <div className="flex flex-wrap gap-1 mt-2">
                {run.buffs.map((b, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-bold ${b.value && b.value > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {b.name} ({b.turns}t)
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
        {/* Weapon */}
        {/* Arma se gestiona desde el menú inferior y el tab Equipar */}
      </div>
    </Modal>
  );

  // Menu Modal
  const MenuModal = () => (
    <Modal open={showMenu} onClose={() => setShowMenu(false)} title="☰ Menú">
      <div className="space-y-2">
        <button onClick={() => { setShowMenu(false); setShowNotes(true); }} className="btn-stone w-full py-3 rounded-sm text-left px-4 text-sm">
          📜 Notas Encontradas ({profile.foundNotes.length}/{FOUND_NOTES.length})
        </button>
        <button onClick={() => { setShowMenu(false); setShowSettings(true); }} className="btn-stone w-full py-3 rounded-sm text-left px-4 text-sm">
          ⚙ Opciones de Audio
        </button>
        {debugInGame && run && (
          <>
            <div className="divider-rune my-2" />
            <p className="label text-[9px] mb-1">🔧 Editor Debug</p>
            <div className="grid grid-cols-3 gap-1">
              {(['hp','mp','atk','def','mag','int','spd','lck'] as const).map(st => (
                <button key={st} onClick={() => {
                  const ns = {...run.stats};
                  if (st === 'hp') { ns.maxHp += 50; ns.hp = ns.maxHp; } else if (st === 'mp') { ns.maxMp += 30; ns.mp = ns.maxMp; } else { (ns as Record<string,number>)[st] += 10; }
                  saveRun({...run, stats: ns, permStats: {...ns, hp: ns.maxHp, mp: ns.maxMp}});
                }} className="btn-stone py-1 rounded-sm text-[9px] font-type">+{st.toUpperCase()}</button>
              ))}
              <button onClick={() => saveRun({...run, level: Math.min(60, run.level + 5), exp: 0})} className="btn-stone py-1 rounded-sm text-[9px] font-type">+5 LVL</button>
              <button onClick={() => saveRun({...run, hunger: 70, energy: 90})} className="btn-stone py-1 rounded-sm text-[9px] font-type">🍖Fill</button>
              <button onClick={() => saveRun({...run, stats: {...run.stats, hp: run.stats.maxHp, mp: run.stats.maxMp}})} className="btn-stone py-1 rounded-sm text-[9px] font-type">💚Full</button>
              <button onClick={() => {
                const w = getWeaponForFloor(run.floor + 20, 30);
                if (run.weapons.length < 5) saveRun({...run, weapons: [...run.weapons, w]});
              }} className="btn-stone py-1 rounded-sm text-[9px] font-type">+Arma</button>
              <button onClick={() => {
                const f = getFoodForFloor(run.floor + 10, 30);
                saveRun({...run, foods: [...run.foods, f]});
              }} className="btn-stone py-1 rounded-sm text-[9px] font-type">+Comida</button>
              <button onClick={() => {
                const p = getPotionForFloor(run.floor + 20);
                saveRun({...run, potions: [...run.potions, p]});
              }} className="btn-stone py-1 rounded-sm text-[9px] font-type">+Poción</button>
            </div>
          </>
        )}
        <div className="divider-rune my-3" />
        <button onClick={() => {
          setShowMenu(false);
          // Save current run and go to main menu without losing progress
          if (run) saveRun(run);
          stopMusic();
          setScreen('start');
        }} className="btn-stone w-full py-3 rounded-sm text-left px-4 text-sm">
          🏠 Volver al Menú (guarda partida)
        </button>
        <button onClick={() => { setShowMenu(false); setShowAbandon(true); }}
          className="w-full py-3 rounded-sm text-sm font-display tracking-wide mt-2" style={{ background: 'linear-gradient(180deg,#4a0508,#2a0204)', border: '1px solid rgba(122,21,24,0.5)', color: '#e8a0a0' }}>
          ☠ Abandonar Partida
        </button>
      </div>
    </Modal>
  );

  // REST STATION
  if (phase === 'rest') {
    const restText = pick(REST_TEXTS);
    return (
      <div className="min-h-full flex flex-col stone-bg vignette">
        <MiniStatusBar />
        {/* Scrollable content area — leaves room for fixed bottom */}
        <div className="flex-1 overflow-y-auto scroll-styled px-4 pt-3 pb-[130px] mx-auto w-full" style={{ maxWidth: 600 }}>
          <p className="font-type text-[11px] text-bone/45 text-center italic mb-3 leading-relaxed">{restText}</p>

          {/* Tab Content */}
          {restTab === 0 && (
            <div className="space-y-3 animate-fadeIn">
              <div className="panel rounded-sm p-3">
                <span className="label">Estado Actual</span>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm font-type">
                  <div><span className="text-red-400">♥</span> {run.stats.hp}/{run.stats.maxHp}</div>
                  <div><span className="text-blue-300">◆</span> {run.stats.mp}/{run.stats.maxMp}</div>
                  <div><span className={run.hunger < 30 ? 'text-red-400' : 'text-amber-400'}>▣</span> {run.hunger} <span className="text-bone/40 text-xs">[{hungerZone.zone}]</span></div>
                  <div><span className={run.energy < 25 ? 'text-red-400' : 'text-cyan-400'}>◈</span> {run.energy}</div>
                </div>
              </div>
              <div className="panel rounded-sm p-3">
                <span className="label">Progreso</span>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm font-type">
                  <div>Piso: <span className="font-bold text-bone">{run.floor}</span></div>
                  <div>Día: <span className="font-bold text-bone">{run.day}</span></div>
                  <div>Puntos: <span className="text-amber-400 font-bold">{run.score}</span></div>
                  <div>Derrotas: <span className="text-red-400 font-bold">{run.kills}</span></div>
                </div>
              </div>
              {postCombatData && postCombatData.enemyName && (
                <div className="panel rounded-sm p-3">
                  <span className="label">Último Combate</span>
                  <p className="text-sm font-type mt-1">Enemigo: <span className="font-bold text-amber-300">{postCombatData.enemyName}</span></p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(postCombatData.statsGained).map(([k, v]) => (
                      <span key={k} className="text-[10px] font-type px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(40,90,40,0.3)', color: '#8aba8a' }}>+{v} {k.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {restTab === 1 && (
            <div className="space-y-2 animate-fadeIn">
              <div className="flex justify-between items-center mb-3">
                <span className={`text-sm font-bold ${hungerZone.color}`}>Hambre: {run.hunger}/100 [{hungerZone.zone}]</span>
              </div>
              {run.foods.length === 0 ? (
                <p className="text-bone/40 text-center py-6 font-type text-sm">Sin comida.</p>
              ) : run.foods.map((f, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[.03] border border-white/[.08] flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm">{f.name}</p>
                    <div className="flex gap-2 text-xs mt-1">
                      <span className="text-amber-400">+{f.hunger} hambre</span>
                      <span className="text-cyan-400">+{f.energy} energía</span>
                      {f.hpHeal && <span className="text-green-400">+{f.hpHeal} HP</span>}
                      {f.mpHeal && <span className="text-blue-400">+{f.mpHeal} MP</span>}
                    </div>
                    <p className={`text-xs mt-0.5 ${f.tier === 'legendaria' ? 'text-amber-300' : f.tier === 'excelente' ? 'text-amber-400' : f.tier === 'buena' ? 'text-green-300' : 'text-bone/40'}`}>
                      {f.effectDesc}
                    </p>
                    {run.hunger + f.hunger > 85 && <p className="text-xs text-amber-400 mt-0.5">⚠ Riesgo de sobrealimentación</p>}
                  </div>
                  <button onClick={() => eatFood(i)} className="btn-blood px-3 py-2 text-xs rounded-sm">Comer</button>
                </div>
              ))}
            </div>
          )}

          {restTab === 2 && (
            <div className="space-y-2 animate-fadeIn">
              <span className="label">Pociones ({run.potions.length}/6)</span>
              {run.potions.length === 0 ? (
                <p className="text-white/30 text-center py-6">Mochila vacía.</p>
              ) : run.potions.map((p, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[.03] border border-white/[.08] flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm">{p.name}</p>
                    <p className="text-xs text-green-400">{p.effectDesc}</p>
                  </div>
                  <button onClick={() => {
                    const newPotions = [...run.potions]; newPotions.splice(i, 1);
                    saveRun({ ...run, potions: newPotions });
                  }} className="text-xs text-red-400/60 px-2">Descartar</button>
                </div>
              ))}
            </div>
          )}

          {restTab === 3 && (
            <div className="space-y-2 animate-fadeIn">
              <span className="label">Armas ({run.weapons.length}/5)</span>
              {run.weapons.map((w, i) => (
                <div key={i} className="panel rounded-sm p-3" style={i === run.equippedWeapon ? { borderColor: 'rgba(180,120,30,0.4)', borderWidth: 1 } : {}}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-display font-bold text-sm text-bone/85">{w.name} {i === run.equippedWeapon && <span className="text-amber-400 text-[10px] font-type">(equipada)</span>}</p>
                      <div className="flex gap-2 text-xs mt-1">
                        <span className="text-amber-400">ATK +{w.atk}</span>
                        {w.mag > 0 && <span style={{ color: '#9070c0' }}>MAG +{w.mag}</span>}
                        {w.spd !== 0 && <span className={w.spd > 0 ? 'text-green-400' : 'text-red-400'}>SPD {w.spd > 0 ? '+' : ''}{w.spd}</span>}
                      </div>
                      {w.effectDesc && (
                        <p className={`text-xs mt-1 ${w.selfHarm ? 'text-red-400' : 'text-green-400'}`}>
                          {w.selfHarm ? '⚠ ' : '✦ '}{w.effectDesc}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {i !== run.equippedWeapon && (
                        <button onClick={() => { sfxSwap(); saveRun({ ...run, equippedWeapon: i }); }}
                          className="btn-blood px-3 py-1.5 text-xs rounded-sm">Equipar</button>
                      )}
                      {run.weapons.length > 1 && i !== run.equippedWeapon && (
                        <button onClick={() => {
                          const nw = run.weapons.filter((_, j) => j !== i);
                          const ne = run.equippedWeapon > i ? run.equippedWeapon - 1 : run.equippedWeapon;
                          saveRun({ ...run, weapons: nw, equippedWeapon: ne });
                        }} className="text-xs text-red-400/60 px-2">×</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
        {/* FIXED BOTTOM — tabs + continue */}
        <div className="fixed bottom-0 left-0 right-0 z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto" style={{ maxWidth: 600, background: 'linear-gradient(180deg,#1a161e,#121016)' }}>
            <div className="flex gap-1 p-2 overflow-x-auto border-t" style={{ borderColor: 'rgba(140,120,80,0.2)' }}>
              {['Resumen', 'Comida', 'Mochila', 'Equipar'].map((t, i) => (
                <button key={t} onClick={() => setRestTab(i)}
                  className="flex-1 px-2 py-2 rounded-sm text-[11px] font-display tracking-wider whitespace-nowrap active:scale-[.97]"
                  style={restTab === i
                    ? { background: 'linear-gradient(180deg,#5a3515,#3a200a)', border: '1px solid rgba(200,130,50,0.45)', color: '#e8d0a0' }
                    : { background: 'rgba(30,26,30,0.8)', border: '1px solid rgba(100,85,60,0.2)', color: '#8a7a5a' }}>
                  {t}
                </button>
              ))}
            </div>
            <div className="px-2 pb-2">
              <button onClick={() => advanceFloor()} className="btn-blood w-full py-3 rounded-sm text-sm">
                Continuar al Siguiente Piso ▸
              </button>
            </div>
          </div>
        </div>
        <StatsModal />
        <MenuModal />
        {renderSettingsModal()}
        <Modal open={showNotes} onClose={() => setShowNotes(false)} title="📜 Notas">
          {profile.foundNotes.length === 0 ? (
            <p className="font-type text-bone/40 text-sm text-center py-6">Sin notas.</p>
          ) : profile.foundNotes.map((idx) => (
            <div key={idx} className="panel rounded-sm p-2.5 mb-2">
              <p className="font-type text-[11px] text-bone/60 italic leading-relaxed">"{FOUND_NOTES[idx]}"</p>
            </div>
          ))}
        </Modal>
      </div>
    );
  }

  // MAIN TOWER SCREEN
  const combatActive = phase === 'combat' && !!enemy;
  return (
    <div className="min-h-full flex flex-col stone-bg vignette" onClick={startAudio}>
      <MiniStatusBar />

      <div className="flex-1 overflow-y-auto scroll-styled mx-auto w-full" style={{ maxWidth: 620, paddingBottom: combatActive ? 100 : 12 }}>
        {/* Floor Header — carved plaque */}
        <div className="text-center py-3 px-4 relative">
          <div className="inline-block px-5 py-1 panel rounded-sm">
            <span className="font-display text-sm tracking-[0.25em] text-bone/70">PISO {run.floor}</span>
            <span className="mx-2 text-rune">·</span>
            <span className="font-type text-xs text-bone/50">Día {run.day}</span>
          </div>
          {run.floor % 10 === 0 && phase === 'arrival' && (
            <div className="mt-2"><span className="text-[10px] font-display tracking-widest bg-red-950/50 text-red-300 border border-red-700/40 px-3 py-1 rounded animate-pulse-slow">⚠ GUARDIÁN DEL UMBRAL</span></div>
          )}
        </div>

        {/* ARRIVAL PHASE — tap to advance narrative */}
        {phase === 'arrival' && (
          <div className="flex flex-col justify-end min-h-[70vh] p-4 animate-fadeIn" onClick={() => typewriterDone && setPhase('decision')}>
            <div className="panel rounded-sm p-4 mb-3">
              <TypewriterText text={floorText} speed={profile.settings.textSpeed} onDone={() => setTypewriterDone(true)} />
            </div>
            {typewriterDone ? (
              <button onClick={() => setPhase('decision')} className="btn-blood w-full py-3 rounded-sm animate-riseIn">
                Continuar ▸
              </button>
            ) : (
              <button onClick={() => { setTypewriterDone(true); setPhase('decision'); stopNarrator(); }} className="font-type text-bone/30 text-xs text-center w-full py-2">
                ▸ Toca para saltar
              </button>
            )}
          </div>
        )}

        {/* DECISION PHASE — stacked at bottom for mobile */}
        {phase === 'decision' && (
          <div className="flex flex-col justify-end min-h-[75vh] px-3 pb-4 pt-2 animate-fadeIn">
            {/* Compact resource bar */}
            <div className="flex items-center justify-center gap-4 mb-3 font-type text-xs">
              <span className="text-red-400">♥{run.stats.hp}/{run.stats.maxHp}</span>
              <span className="text-blue-300">◆{run.stats.mp}/{run.stats.maxMp}</span>
              <span className={run.hunger < 30 ? 'text-red-400' : 'text-amber-500'}>▣{run.hunger}</span>
              <span className={run.energy < 25 ? 'text-red-400' : 'text-cyan-500'}>◈{run.energy}</span>
            </div>

            {/* Decision cards — darker, more gothic */}
            <div className="space-y-2">
              <button onClick={() => doFloorDecision('advance')} className="w-full panel rounded-sm p-3 text-left active:scale-[.98] transition border-l-2 border-l-red-800/60">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">⚔️</span>
                  <span className="font-display font-bold tracking-wide text-bone/90">Avanzar</span>
                </div>
                <p className="font-type text-[11px] text-bone/40 leading-relaxed">Sin coste. Riesgo de emboscada.</p>
              </button>

              <button onClick={() => doFloorDecision('observe')} disabled={run.energy < 3}
                className={`w-full panel rounded-sm p-3 text-left active:scale-[.98] transition border-l-2 border-l-cyan-800/60 ${run.energy < 3 ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">👁️</span>
                  <span className="font-display font-bold tracking-wide text-bone/90">Observar</span>
                  <span className="font-type text-[10px] text-cyan-400 ml-auto">-6◈</span>
                </div>
                <p className="font-type text-[11px] text-bone/40 leading-relaxed">Busca enemigos, armas o comida. Nada es seguro.</p>
              </button>

              <button onClick={() => doFloorDecision('meditate')} disabled={run.hunger < 5 || run.energy < 3}
                className={`w-full panel rounded-sm p-3 text-left active:scale-[.98] transition border-l-2 border-l-amber-800/60 ${run.hunger < 5 || run.energy < 3 ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🕯️</span>
                  <span className="font-display font-bold tracking-wide text-bone/90">Meditar</span>
                  <span className="font-type text-[10px] text-amber-400 ml-auto">-4▣ -4◈</span>
                </div>
                <p className="font-type text-[11px] text-bone/40 leading-relaxed">Prepara tu mente. +crit, +esquiva, debilita.</p>
              </button>
            </div>
          </div>
        )}

        {/* OBSERVATION/MEDITATION TRANSITION */}
        {(phase === 'observation' || phase === 'meditation') && (
          <div className="flex flex-col justify-end min-h-[60vh] p-4 animate-fadeIn">
            <div className="panel rounded-sm p-3 mb-3">
              <div ref={logRef} className="max-h-40 overflow-y-auto scroll-styled space-y-1">
                {combatLog.map((l, i) => (
                  <p key={i} className={`font-type text-xs animate-riseIn ${
                    l.includes('EMBOSCADA') || l.includes('no te ha visto') ? 'text-green-300 font-bold' :
                    l.includes('EMBOSCADO') || l.includes('observaba') ? 'text-red-400 font-bold' :
                    'text-bone/50'
                  }`}>{l}</p>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <span className="font-type text-xs text-bone/30 animate-pulse-slow">
                {phase === 'meditation' ? '🕯️ Concentrando...' : '👁️ Acechando...'}
              </span>
            </div>
          </div>
        )}

        {/* COMBAT PHASE */}
        {phase === 'combat' && enemy && (
          <div className="flex flex-col animate-fadeIn">
            {/* Enemy Panel — the confrontation */}
            <div className="relative px-4 pt-5 pb-4" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(122,21,24,0.18), transparent 70%)' }}>
              <div className={`${shakeEnemy ? 'animate-shake' : ''} flex flex-col items-center`}>
                {/* Big emoji portrait */}
                <div className={`relative text-6xl mb-2 ${enemyLunge ? 'animate-enemyLunge' : enemy.def.isBoss ? 'animate-ember' : 'animate-bob'}`}
                  style={{ filter: 'drop-shadow(0 4px 14px rgba(122,21,24,0.6))' }}>
                  {enemy.def.emoji}
                  {floatDmg && floatDmg.side === 'enemy' && (
                    <span key={floatDmg.id} className={`absolute left-1/2 -translate-x-1/2 -top-2 animate-floatUp font-display font-black ${floatDmg.crit ? 'text-amber-300 text-2xl' : 'text-red-300 text-xl'}`}
                      style={{ textShadow: '0 2px 6px #000' }}>
                      -{floatDmg.val}{floatDmg.crit ? '!' : ''}
                    </span>
                  )}
                </div>
                <div className="font-display font-bold text-lg text-center tracking-wide" style={{ color: enemy.def.isBoss ? '#f0b429' : '#e0cba0' }}>
                  {enemy.def.isBoss ? '👑 ' : ''}{enemy.def.name}
                </div>
                {ambushState === 'player' && ambushTurns > 0 && (
                  <span className="mt-1 text-[10px] font-display tracking-widest bg-green-900/40 text-green-300 border border-green-500/30 px-2 py-0.5 rounded">SORPRENDIDO</span>
                )}
                {ambushState === 'enemy' && (
                  <span className="mt-1 text-[10px] font-display tracking-widest bg-red-900/50 text-red-300 border border-red-500/40 px-2 py-0.5 rounded animate-pulse-slow">TE ACECHA</span>
                )}
                <div className="w-full mt-3 max-w-[380px]">
                  <div className="flex justify-between text-[11px] font-type mb-1">
                    <span className="text-red-300/80">♥ VITALIDAD</span>
                    <span className="text-bone/60">{enemy.hp}/{enemy.maxHp}</span>
                  </div>
                  <div className="h-3 rounded-sm bg-black/60 border border-red-900/40 overflow-hidden">
                    <div className="h-full transition-all duration-500 ease-out" style={{
                      width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`,
                      background: enemy.hp < enemy.maxHp * 0.25
                        ? 'linear-gradient(90deg,#dc2626,#ef4444)'
                        : enemy.def.isBoss
                          ? 'linear-gradient(90deg,#7a1518,#c2410c,#f0b429)'
                          : 'linear-gradient(90deg,#5a0e10,#a11c1f)'
                    }} />
                  </div>
                  {/* Fixed height status row */}
                  <div className="min-h-[26px] mt-2 flex gap-1 flex-wrap justify-center">
                    {enemy.buffs.map((b, i) => (
                      <span key={i} className="text-[10px] font-type bg-red-950/60 text-red-300 border border-red-800/40 px-1.5 py-0.5 rounded">{b.name} {b.turns > 1 ? `${b.turns}` : ''}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Combat Log — seamless chronicle */}
            <div ref={logRef} className="flex-1 min-h-[80px] max-h-[45vh] overflow-y-auto scroll-styled px-4 py-3 space-y-1 font-type text-xs leading-relaxed">
              {combatLog.map((l, i) => (
                <p key={i} className={`animate-riseIn ${
                  l.includes('EMBOSCADA') || l.includes('SORPREND') ? 'text-green-300 font-bold' :
                  l.includes('EMBOSCADO') || l.includes('ACECHA') ? 'text-red-400 font-bold' :
                  l.includes('CRÍTICO') ? 'text-amber-300 font-bold' :
                  l.includes('esquiv') || l.includes('Esquiv') ? 'text-cyan-300' :
                  l.includes('💀') || l.includes('💥') ? 'text-red-400' :
                  l.includes('✦') || l.includes('💚') || l.includes('derrotado') ? 'text-green-300' :
                  l.includes('🩸') || l.includes('🔥') || l.includes('☠') || l.includes('💜') ? 'text-orange-300' :
                  'text-bone/55'
                }`}>{l}</p>
              ))}
            </div>

            {/* Buffs only in scroll — HP/MP bars moved to fixed bottom */}
            {run.buffs.length > 0 && (
              <div className="px-4 py-1 flex items-center gap-1 flex-wrap">
                {run.buffs.map((b, i) => (
                  <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-type ${b.value && b.value > 0 ? 'text-green-300 bg-green-900/30' : 'text-red-300 bg-red-900/30'}`}>{b.name} {b.turns}t</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* POST-COMBAT PHASE — pushed to bottom */}
        {phase === 'postCombat' && postCombatData && (
          <div className="flex flex-col justify-end min-h-[75vh] p-4 animate-fadeIn">
            {/* Narrative outro */}
            <div className="panel rounded-sm p-3 mb-3">
              <p className="font-type text-xs text-bone/45 italic text-center leading-relaxed">{pick(COMBAT_OUTROS)}</p>
            </div>

            {postCombatData.enemyName && (
              <div className="panel rounded-sm p-3 mb-2">
                <p className="font-type text-sm text-bone/60">Enemigo derrotado: <span className="font-display font-bold text-amber-300">{postCombatData.enemyName}</span></p>
              </div>
            )}

            <div className="panel rounded-sm p-3 mb-2" style={{ borderLeftColor: 'rgba(34,120,34,0.4)', borderLeftWidth: 2 }}>
              <span className="label" style={{ color: '#5a9a5a' }}>Mejoras Obtenidas</span>
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(postCombatData.statsGained).map(([k, v]) => (
                  <span key={k} className="text-[10px] font-type px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,80,34,0.3)', color: '#8aba8a' }}>
                    +{v} {k.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            {postCombatData.learnedAbility && (
              <div className="panel rounded-sm p-3 mb-2 animate-riseIn" style={{ borderLeftColor: 'rgba(100,180,200,0.5)', borderLeftWidth: 2 }}>
                <span className="label" style={{ color: '#6ab4c8' }}>✦ Esencia Absorbida</span>
                <p className="font-display font-bold text-sm mt-1 text-cyan-200">{postCombatData.learnedAbility}</p>
                <p className="font-type text-[10px] text-bone/40 mt-0.5">La oscuridad del enemigo ahora es tuya.</p>
              </div>
            )}

            {postCombatData.weaponFound && (
              <div className="panel rounded-sm p-3 mb-2" style={{ borderLeftColor: 'rgba(180,120,30,0.4)', borderLeftWidth: 2 }}>
                <span className="label" style={{ color: '#b48030' }}>🗡 Arma Encontrada</span>
                <p className="font-display font-bold text-sm mt-1 text-bone/85">{postCombatData.weaponFound.name}</p>
                <div className="flex gap-2 text-[10px] font-type mt-1">
                  <span className="text-amber-300">ATK+{postCombatData.weaponFound.atk}</span>
                  {postCombatData.weaponFound.mag > 0 && <span style={{ color: '#9070c0' }}>MAG+{postCombatData.weaponFound.mag}</span>}
                </div>
              </div>
            )}

            {/* Decision — always at bottom */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={doRest} className="btn-stone py-3.5 rounded-sm text-center">
                <span className="font-display text-sm">Descansar</span>
                <span className="block text-[9px] font-type text-bone/35 mt-0.5">Recuperar recursos</span>
              </button>
              <button onClick={advanceFloor} className="btn-blood py-3.5 rounded-sm text-center">
                <span className="font-display text-sm">Ascender ▸</span>
                <span className="block text-[9px] font-type text-bone/35 mt-0.5">Mantener impulso</span>
              </button>
            </div>
          </div>
        )}

        {/* ITEM FOUND PHASE */}
        {phase === 'itemFound' && (
          <div className="flex flex-col justify-end min-h-[70vh] p-4 animate-fadeIn">
            <div ref={logRef} className="max-h-32 overflow-y-auto scroll-styled space-y-1 mb-3">
              {combatLog.map((l, i) => <p key={i} className="font-type text-xs text-bone/50 animate-riseIn">{l}</p>)}
            </div>

            {postCombatData?.weaponFound && (
              <div className="panel rounded-sm p-3 mb-3" style={{ borderLeftColor: 'rgba(180,120,30,0.4)', borderLeftWidth: 2 }}>
                <p className="font-display font-bold text-sm text-bone/85">🗡 {postCombatData.weaponFound.name}</p>
                <div className="flex gap-2 text-[10px] font-type mt-1">
                  <span className="text-amber-300">ATK+{postCombatData.weaponFound.atk}</span>
                  {postCombatData.weaponFound.mag > 0 && <span style={{ color: '#9070c0' }}>MAG+{postCombatData.weaponFound.mag}</span>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={doRest} className="btn-stone py-3 rounded-sm font-display text-sm">Descansar</button>
              <button onClick={advanceFloor} className="btn-blood py-3 rounded-sm font-display text-sm">Ascender ▸</button>
            </div>
          </div>
        )}

        {/* EMPTY FLOOR */}
        {phase === 'empty' && (
          <div className="flex flex-col justify-end min-h-[70vh] p-4 animate-fadeIn">
            <div className="panel rounded-sm p-4 mb-4 text-center">
              <p className="font-type text-bone/40 text-xs italic leading-relaxed">{pick(OBSERVATION_TEXTS.empty)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={doRest} className="btn-stone py-3 rounded-sm font-display text-sm">Descansar</button>
              <button onClick={advanceFloor} className="btn-blood py-3 rounded-sm font-display text-sm">Ascender ▸</button>
            </div>
          </div>
        )}
      </div>

      {/* FIXED BOTTOM ACTION BAR (combat only) */}
      {combatActive && (
        <div className={`fixed bottom-0 left-0 right-0 z-40 ${hitFlash ? 'animate-menuShake' : ''}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto" style={{ maxWidth: 620 }}>
            {/* HP bar + weapon + stats — single compact row */}
            <div className={`border-t px-2.5 py-1 ${shakePlayer ? 'animate-playerRecoil' : ''}`} style={{ background: 'linear-gradient(180deg,#1a160f,#12100a)', borderColor: 'rgba(140,120,80,0.15)' }}>
              {/* HP bar row */}
              <div className="flex items-center gap-1.5 mb-0.5 relative">
                <span className="text-[9px] font-type text-red-400">♥{run.stats.hp}</span>
                <div className="flex-1 h-1.5 rounded-sm overflow-hidden" style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <div className="h-full transition-all duration-500" style={{ width: `${(run.stats.hp / run.stats.maxHp) * 100}%`, background: run.stats.hp < run.stats.maxHp * 0.25 ? '#dc2626' : '#7a1518' }} />
                </div>
                <span className="text-[9px] font-type text-blue-300">◆{run.stats.mp}</span>
                <div className="w-10 h-1 rounded-sm overflow-hidden" style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <div className="h-full transition-all duration-500" style={{ width: `${(run.stats.mp / run.stats.maxMp) * 100}%`, background: '#1e40af' }} />
                </div>
                {floatDmg && floatDmg.side === 'player' && (
                  <span key={floatDmg.id} className="absolute -top-3 left-1/4 animate-floatUp font-display font-bold text-red-400 text-xs" style={{ textShadow: '0 1px 4px #000' }}>-{floatDmg.val}</span>
                )}
              </div>
              {/* Weapon + stats row */}
              <div className="flex items-center">
                <button onClick={(e) => { e.stopPropagation(); setActionModal('swap'); }}
                  className="flex items-center gap-1 text-left active:opacity-80 mr-auto min-w-0 flex-shrink">
                  <span className="text-amber-400 text-xs">🗡</span>
                  <span className="font-type text-[10px] text-bone/55 truncate max-w-[90px]">{weapon?.name || '—'}</span>
                  {weapon?.selfHarm && <span className="text-red-400 text-[8px]">⚠</span>}
                  <span className="font-type text-[8px] text-bone/20">🔄</span>
                </button>
                <div className="flex items-center gap-1.5 text-[9px] font-type flex-shrink-0">
                  <span className="text-amber-300">⚔{stats.atk}</span>
                  <span className="text-stone-400">●{stats.def}</span>
                  <span style={{ color: '#9070c0' }}>★{stats.mag}</span>
                  <span className="text-green-300">»{stats.spd}</span>
                </div>
              </div>
            </div>
            {/* Action buttons */}
            <div style={{ background: 'linear-gradient(180deg,#14100c,#0c0906)' }}>
              {playerTurn ? (
                <div className="grid grid-cols-5 gap-1 p-1.5">
                  {(() => {
                    const cAb = getClassAbility(run.className);
                    const atkInfo = CLASS_ATTACKS[run.className] || { name: 'Atacar', icon: '⚔️' };
                    return [
                      { k: 'classAb', icon: cAb?.icon || '🛡️', label: cAb?.name?.slice(0,7) || 'Clase', on: () => cAb ? doCombatAction('ability', { abilityId: cAb.id }) : doCombatAction('defend'), dis: false },
                      { k: 'skills', icon: '💢', label: 'Técnica', on: () => setActionModal('skills'), dis: run.skills.length === 0 },
                      { k: 'attack', icon: atkInfo.icon, label: atkInfo.name.slice(0,8), on: () => doCombatAction('attack'), dis: false },
                      { k: 'magic', icon: '🔮', label: 'Magia', on: () => setActionModal('magic'), dis: run.magics.length === 0 },
                      { k: 'items', icon: '🎒', label: 'Mochila', on: () => setActionModal('items'), dis: false },
                    ];
                  })().map(b => (
                    <button key={b.k} onClick={(e) => { e.stopPropagation(); b.on(); }} disabled={b.dis}
                      className={`flex flex-col items-center justify-center py-2.5 rounded-sm ${b.k === 'attack' ? 'btn-blood' : 'btn-stone'} ${b.dis ? 'opacity-25' : ''}`}
                      style={{ minHeight: 52 }}>
                      <span className="text-xl leading-none">{b.icon}</span>
                      <span className="text-[8px] font-display tracking-widest mt-1 uppercase">{b.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-5 text-center">
                  <span className="font-type text-sm text-red-300/60 animate-pulse-slow">
                    {enemy?.def.emoji} {enemy?.def.name} actúa...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTION MODALS */}
      {actionModal === 'skills' && (
        <ActionListModal title="✴ Técnicas de Combate" onClose={() => setActionModal(null)}
          items={run.skills.map(id => ABILITIES.find(a => a.id === id)).filter(Boolean) as Ability[]}
          render={(ab) => (
            <button key={ab.id} disabled={run.stats.mp < ab.cost}
              onClick={() => doCombatAction('ability', { abilityId: ab.id })}
              className={`w-full text-left panel rounded-sm p-3 mb-2 active:scale-[.98] transition ${run.stats.mp < ab.cost ? 'opacity-40' : 'hover:border-amber-700/40'}`}>
              <div className="flex justify-between items-center">
                <span className="font-display font-bold">{ab.icon} {ab.name}</span>
                <span className="text-[11px] font-type text-blue-300">{ab.cost} MP</span>
              </div>
              <p className="text-xs text-bone/50 font-type mt-1">{ab.desc}</p>
            </button>
          )} />
      )}
      {actionModal === 'magic' && (
        <ActionListModal title="☄ Grimorio" onClose={() => setActionModal(null)}
          items={run.magics.map(id => ABILITIES.find(a => a.id === id)).filter(Boolean) as Ability[]}
          render={(ab) => (
            <button key={ab.id} disabled={run.stats.mp < ab.cost}
              onClick={() => doCombatAction('ability', { abilityId: ab.id })}
              className={`w-full text-left panel rounded-sm p-3 mb-2 active:scale-[.98] transition ${run.stats.mp < ab.cost ? 'opacity-40' : ''}`}>
              <div className="flex justify-between items-center">
                <span className="font-display font-bold">{ab.icon} {ab.name}</span>
                <span className="text-[11px] font-type text-blue-300">{ab.cost} MP</span>
              </div>
              <p className="text-xs text-bone/50 font-type mt-1">{ab.desc}</p>
            </button>
          )} />
      )}
      {actionModal === 'items' && (
        <Modal open onClose={() => setActionModal(null)} title="🎒 Mochila">
          {renderBackpack(true)}
        </Modal>
      )}
      {actionModal === 'swap' && (
        <Modal open onClose={() => setActionModal(null)} title="🔄 Cambiar Arma">
          <p className="text-xs font-type text-amber-300/70 mb-3">⚠ Cambiar de arma consume tu turno.</p>
          {run.weapons.map((w, i) => (
            <button key={i} disabled={i === run.equippedWeapon}
              onClick={() => doCombatAction('swap', { weaponIdx: i })}
              className={`w-full text-left panel rounded-sm p-3 mb-2 active:scale-[.98] ${i === run.equippedWeapon ? 'opacity-40 border-amber-700/40' : 'hover:border-amber-700/40'}`}>
              <div className="flex justify-between">
                <span className="font-display font-bold">🗡 {w.name}</span>
                {i === run.equippedWeapon && <span className="text-[10px] font-type text-amber-300">EQUIPADA</span>}
              </div>
              <div className="flex gap-2 text-[11px] font-type mt-1">
                <span className="text-amber-300">ATK+{w.atk}</span>
                {w.mag > 0 && <span style={{ color: '#9070c0' }}>MAG+{w.mag}</span>}
                {w.spd !== 0 && <span className={w.spd > 0 ? 'text-green-300' : 'text-red-300'}>SPD{w.spd > 0 ? '+' : ''}{w.spd}</span>}
              </div>
              {w.effectDesc && <p className={`text-[10px] font-type mt-1 ${w.selfHarm ? 'text-red-300' : 'text-green-300'}`}>{w.selfHarm ? '⚠ ' : '✦ '}{w.effectDesc}</p>}
            </button>
          ))}
        </Modal>
      )}

      <StatsModal />
      <MenuModal />
      {renderSettingsModal()}
      <Modal open={showNotes} onClose={() => setShowNotes(false)} title="📜 Notas Encontradas">
        {profile.foundNotes.length === 0 ? (
          <p className="font-type text-bone/40 text-sm text-center py-6">Aún no has encontrado notas.</p>
        ) : (
          <div className="space-y-3">
            {profile.foundNotes.map((idx) => (
              <div key={idx} className="panel rounded-sm p-3">
                <p className="font-type text-xs text-bone/65 italic leading-relaxed">"{FOUND_NOTES[idx]}"</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* FLOOR EVENTS */}
      {floorEvent && (
        <Modal open onClose={() => { setFloorEvent(null); startEncounter(); }} title="👁 Evento en la Torre">
          {floorEvent === 'altar' && (
            <div className="space-y-3 font-type text-xs">
              <p className="text-bone/80 leading-relaxed">Un altar de piedra negra. Alguien dejó ofrendas que ya se pudrieron. La piedra todavía vibra con un eco antiguo.</p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => {
                  const roll = Math.random();
                  if (roll < 0.4) { const h = Math.round(run.stats.maxHp * 0.15); saveRun({ ...run, stats: { ...run.stats, hp: Math.min(run.stats.maxHp, run.stats.hp + h) } }); addLog('✨ El altar te bendice: recuperas HP.'); }
                  else if (roll < 0.7) { saveRun({ ...run, stats: { ...run.stats, hp: Math.max(1, run.stats.hp - 10) } }); addLog('💔 El altar exige sangre: pierdes 10 HP.'); }
                  else { saveRun({ ...run, stats: { ...run.stats, mag: run.stats.mag + 3 } }); addLog('🔮 El altar otorga poder: +3 MAG.'); }
                  setFloorEvent(null); startEncounter();
                }} className="btn-blood py-3 rounded-sm font-display text-xs">Tocar el altar</button>
                <button onClick={() => { addLog('Pasas de largo el altar.'); setFloorEvent(null); startEncounter(); }} className="btn-stone py-3 rounded-sm font-display text-xs">Ignorar</button>
              </div>
            </div>
          )}
          {floorEvent === 'espejo' && (
            <div className="space-y-3 font-type text-xs">
              <p className="text-bone/80 leading-relaxed">Fragmentos de espejo en el suelo. Cada uno refleja un momento diferente de tu vida. Algunos no los recuerdas. Algunos aún no ocurren.</p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => {
                  saveRun({ ...run, stats: { ...run.stats, int: run.stats.int + 3 } });
                  addLog('🪞 El espejo te revela secretos: +3 INT.');
                  setFloorEvent(null); startEncounter();
                }} className="btn-blood py-3 rounded-sm font-display text-xs">Mirar</button>
                <button onClick={() => { addLog('Le das la espalda a tus reflejos.'); setFloorEvent(null); startEncounter(); }} className="btn-stone py-3 rounded-sm font-display text-xs">Seguir</button>
              </div>
            </div>
          )}
          {floorEvent === 'fuente' && (
            <div className="space-y-3 font-type text-xs">
              <p className="text-bone/80 leading-relaxed">Agua negra brota de la pared. No deberías beberla. Pero tienes sed y el cansancio te pesa.</p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => {
                  let bfs = run.buffs;
                  if (pct(30)) { bfs = [...bfs, { id: 'poison', name: 'PSN', turns: 3, stat: 'hp', value: -4 }]; addLog('🤢 El agua estaba contaminada.'); }
                  else { addLog('🥤 El agua refresca tu cuerpo.'); }
                  saveRun({ ...run, hunger: clamp(run.hunger + 15, 0, 100), energy: clamp(run.energy + 15, 0, 100), buffs: bfs });
                  setFloorEvent(null); startEncounter();
                }} className="btn-blood py-3 rounded-sm font-display text-xs">Beber</button>
                <button onClick={() => { addLog('Mantienes el autocontrol.'); setFloorEvent(null); startEncounter(); }} className="btn-stone py-3 rounded-sm font-display text-xs">No beber</button>
              </div>
            </div>
          )}
          {floorEvent === 'cadaver' && (
            <div className="space-y-3 font-type text-xs">
              <p className="text-bone/80 leading-relaxed">Un cuerpo contra la pared. Todavía tibio. Tiene la mano cerrada con fuerza alrededor de algo.</p>
              <div className="mt-4">
                <button onClick={() => {
                  if (pct(50)) findPotion(); else findFood();
                  setFloorEvent(null);
                }} className="btn-blood w-full py-3 rounded-sm font-display text-xs">Examinar mano</button>
              </div>
            </div>
          )}
          {floorEvent === 'susurro' && (
            <div className="space-y-3 font-type text-xs">
              <p className="text-bone/80 italic leading-relaxed">"La torre no te atrapa. Te invitó. Y tú aceptaste. Los monstruos aquí son solo víctimas más antiguas que tú..."</p>
              <div className="mt-4">
                <button onClick={() => {
                  addLog('👁 La verdad resuena en tu mente.');
                  setFloorEvent(null); startEncounter();
                }} className="btn-stone w-full py-3 rounded-sm font-display text-xs">Comprender</button>
              </div>
            </div>
          )}
          {floorEvent === 'trampa' && (
            <div className="space-y-3 font-type text-xs">
              <p className="text-bone/80 leading-relaxed">El suelo cede bajo tus pies. Una trampa oculta se activa con un chasquido mecánico.</p>
              <div className="mt-4">
                <button onClick={() => {
                  const spdCheck = pct(40 + run.stats.spd * 2);
                  if (spdCheck) {
                    addLog('⚡ Esquivas la trampa en el último momento.');
                    saveRun({ ...run, buffs: [...run.buffs, { id: 'alert', name: 'ALR↑', turns: 3, stat: 'spd', value: 3 }] });
                  } else {
                    const dmg = Math.round(run.stats.maxHp * 0.15);
                    saveRun({ ...run, stats: { ...run.stats, hp: Math.max(1, run.stats.hp - dmg) } });
                    addLog(`💥 ¡La trampa te golpea! -${dmg} HP.`);
                  }
                  setFloorEvent(null); startEncounter();
                }} className="btn-blood w-full py-3 rounded-sm font-display text-xs">Intentar esquivar (SPD)</button>
              </div>
            </div>
          )}
          {floorEvent === 'niebla' && (
            <div className="space-y-3 font-type text-xs">
              <p className="text-bone/80 leading-relaxed">Una niebla espesa y antinatural llena el corredor. Reduce tu visibilidad a cero. Algo se mueve dentro.</p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => {
                  addLog('🌫️ Avanzas a ciegas por la niebla.');
                  saveRun({ ...run, buffs: [...run.buffs, { id: 'fog', name: 'NIB↓', turns: 3, stat: 'spd', value: -5 }] });
                  setAmbushState('enemy'); setAmbushTurns(1);
                  setFloorEvent(null); startEncounter();
                }} className="btn-blood py-3 rounded-sm font-display text-xs">Avanzar ciego</button>
                <button onClick={() => {
                  if (run.energy >= 4) {
                    saveRun({ ...run, energy: run.energy - 4 });
                    addLog('👁 Esperas a que la niebla se disipe. -4 energía.');
                  } else { addLog('⚠ Sin energía para esperar.'); }
                  setFloorEvent(null); startEncounter();
                }} className="btn-stone py-3 rounded-sm font-display text-xs">Esperar (-4◈)</button>
              </div>
            </div>
          )}
          {floorEvent === 'grieta' && (
            <div className="space-y-3 font-type text-xs">
              <p className="text-bone/80 leading-relaxed">Una grieta en la pared emana energía oscura. Puedes sentirla llamándote. Podría fortalecerte... o destruirte.</p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => {
                  const roll = Math.random();
                  if (roll < 0.3) {
                    saveRun({ ...run, stats: { ...run.stats, mag: run.stats.mag + 5, maxMp: run.stats.maxMp + 10, mp: Math.min(run.stats.maxMp + 10, run.stats.mp + 10) } });
                    addLog('🔮 ¡La grieta te otorga poder! +5 MAG, +10 MP.');
                    speak('La energía oscura fluye por tus venas.');
                  } else if (roll < 0.6) {
                    const dmg = Math.round(run.stats.maxHp * 0.2);
                    saveRun({ ...run, stats: { ...run.stats, hp: Math.max(1, run.stats.hp - dmg) }, buffs: [...run.buffs, { id: 'darkmark', name: 'OSC☠', turns: 5, stat: 'def', value: -3 }] });
                    addLog(`💀 ¡La grieta te maldice! -${dmg} HP, -3 DEF por 5t.`);
                  } else {
                    saveRun({ ...run, stats: { ...run.stats, atk: run.stats.atk + 3 }, buffs: [...run.buffs, { id: 'darkpower', name: 'OSC⚔', turns: 5, stat: 'atk', value: 5 }] });
                    addLog('⚔ La oscuridad te fortalece. +3 ATK perm, +5 ATK 5t.');
                  }
                  setFloorEvent(null); startEncounter();
                }} className="btn-blood py-3 rounded-sm font-display text-xs">Tocar la grieta</button>
                <button onClick={() => { addLog('Ignoras la grieta. La prudencia tiene su valor.'); setFloorEvent(null); startEncounter(); }}
                  className="btn-stone py-3 rounded-sm font-display text-xs">Ignorar</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* HIT FLASH — full screen red overlay */}
      {hitFlash && <div className="fixed inset-0 z-30 pointer-events-none animate-hitFlash" />}

      {/* ABANDON MODAL */}
      <Modal open={showAbandon} onClose={() => setShowAbandon(false)} title="☠ Abandonar Partida">
        <p className="font-type text-sm text-bone/70 mb-4 leading-relaxed">
          ¿Estás seguro? Perderás armas, comida y objetos. Tu nivel y habilidades se conservarán.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setShowAbandon(false)} className="btn-stone py-3 rounded-sm font-display text-sm">Cancelar</button>
          <button onClick={() => {
            setShowAbandon(false);
            if (run) {
              const newCP = { ...profile.classProgress };
              const ex = newCP[run.className];
              if (!ex || run.level > ex.level) {
                newCP[run.className] = { level: run.level, exp: run.exp, expToNext: run.expToNext, skills: run.skills, magics: run.magics, permStats: run.permStats };
              }
              saveProfile({ ...profile, classProgress: newCP });
            }
            deleteData('currentRun');
            setRun(null);
            stopMusic();
            setScreen('start');
          }} className="btn-blood py-3 rounded-sm font-display text-sm">Abandonar</button>
        </div>
      </Modal>
    </div>
  );

}
