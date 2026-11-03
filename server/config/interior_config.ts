// Typed view of the `interior` key of balance_config (server only). See seeds/35_interiors/01_config.sql.

export type Prop = { terrain: string; x: number; y: number; w: number; h: number }; // blocked furniture
export type Seat = { x: number; y: number; look?: string }; // look: the actor sheet of whoever sits or stands here (a keeper)
// One room. Tiles at x = 0 or y = 0 are the back walls (the camera-facing sides stay open); the exit is the
// middle of the last row. keeper: where the door's NPC stands; guests: where recruits sit; rest: a tile that asks
// "rest here?" (wild rooms).
export type RoomLayout = {
  biome: string; w: number; h: number; floor: string; wall: string | null;
  props: Prop[]; keeper: Seat | null; guests: Seat[]; rest: (Seat & { service: string }) | null;
};
// Resting in the wild: what it costs (copper) and the chance (per mille) that creatures come while resting.
export type WildKind = { restPrice: number; ambushPermille: number };
export type InteriorConfig = { rooms: Record<string, RoomLayout>; wild: Record<string, WildKind> };

type Raw = {
  rooms: Record<string, {
    biome: string; w: number; h: number; floor: string; wall: string | null;
    props: { terrain: string; x: number; y: number; w?: number; h?: number }[];
    keeper: Seat | null; guests: Seat[]; rest: (Seat & { service: string }) | null;
  }>;
  wild: Record<string, { rest_price: number; ambush_permille: number }>;
};

export function interiorConfig(r: Raw): InteriorConfig {
  return {
    rooms: Object.fromEntries(Object.entries(r.rooms).map(([k, v]) => [k, { ...v, props: v.props.map((p) => ({ ...p, w: p.w ?? 1, h: p.h ?? 1 })) }])),
    wild: Object.fromEntries(Object.entries(r.wild).map(([k, v]) => [k, { restPrice: v.rest_price, ambushPermille: v.ambush_permille }])),
  };
}
