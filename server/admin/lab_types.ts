import type { BattleEvent, Row, Side } from '../battle/types.ts';
import type { CoreStats } from '../stats/derived.ts';

// Battle lab request and response shapes. Admin only: these carry hidden numbers on purpose.
// The admin page (stray-fev2/src/admin/types.ts) mirrors them.

export type LabMove = { name: string; level: number; equipped: boolean };
export type LabGearItem = { item: string; qty: number; slot: string | null }; // slot null = carried only

export type LabGearInfo = {
  weaponType: string | null;
  weaponPower: number;
  weaponAccuracy: number;
  vsArmor: Record<string, number>;
  punchPower: number;
  kickPower: number;
  defense: number;
  reduction: number;
  coverage: Record<string, number>;
  statAdd: Record<string, number>;
  weight: number;
  maxWeight: number;
  loadTier: number;
  thrownLeft: number | null;
};

export type LabFighter = {
  label: string;
  source: 'human' | 'species'; // human = grows like a player; species = creature body and no growth
  species: string | null;
  stats: CoreStats;
  moves: LabMove[];
  row: Row;
  corrupted: boolean;
  count: number; // copies of this fighter (enemies)
  gear?: LabGearItem[];
};

export type LabBattleRequest = {
  seed: number;
  maxSeconds: number;
  summonerInParty: boolean;
  party: LabFighter[];
  enemies: LabFighter[];
};

export type LabEntityState = {
  id: string;
  hp: number;
  stamina: number;
  mana: number;
  atb: number;
  phase: string;
  effects: string[];
};

export type LabFrame = { t: number; events: BattleEvent[]; state: LabEntityState[] };

export type LabEntityInfo = {
  id: string;
  label: string;
  side: Side;
  row: Row;
  maxHp: number;
  maxStamina: number;
  maxMana: number;
  moves: string[];
  gear: LabGearInfo;
  wear: { item: string; lost: number }[];
};

export type LabGrowth = {
  id: string;
  stats: { stat: string; before: number; after: number; exp: number }[];
  moves: { move: string; before: number; after: number; exp: number; learned: boolean }[];
};

export type LabBattleResult = {
  winner: Side | null;
  durationMs: number;
  entities: LabEntityInfo[];
  frames: LabFrame[];
  growth: LabGrowth[];
  damageBy: Record<string, number>;
  carcasses: LabCarcasses; // after a party win: who carries what, what stays on the field
};

export type LabCarcasses = { taken: { by: string; item: string }[]; left: string[] };

// A stored field by ref, or a custom template + biome blend + seed.
export type LabFieldRequest = { ref?: string; template?: string; biomeA?: string; biomeB?: string; from?: number; to?: number; seed?: number };

export type LabButcherRequest = { species: string; corrupted: boolean; hours: number; level: number; luck: number; rolls: number; seed: number };
export type LabButcherResult = {
  carcass: string;
  totalStats: number;
  freshness: number; // 1 fresh .. 4 rotten
  rolls: number;
  junkShare: number; // share of butcherings that gave only worthless drops
  drops: { item: string; quality: string; share: number; avgQty: number; value: number }[];
  fee: number;
  priceShop: number | null; // null = refused
  priceButcher: number | null;
};

export type LabSessionRequest = {
  fights: number;
  enemies: string[];
  corruptedShare: number;
  lowHpTier: number;
  seed: number;
  start: { stats: CoreStats; moves: { name: string; level: number }[] } | null;
};
