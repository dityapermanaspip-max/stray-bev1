// World map messages (Step 4). The backend owns these types; the client imports them.
// Fog of war: a hex the player stood in is visited (biome, name, town); its neighbors and both ends of the
// corridor they are in are glimpsed (biome and name only); the rest is fog (only its place on the grid).
// Nothing hidden is ever here: no creatures, corruption, vices or rings.

export type MapSeen = 'visited' | 'glimpsed' | 'fog';
export type MapHex = {
  q: number;
  r: number;
  seen: MapSeen;
  biome: string | null; // biome key for the colour; null in fog
  name: string | null; // biome display name; null in fog
  town: boolean | null; // known only once visited
};
export type MapPoint = { q: number; r: number };

// room.request('map') answers with this.
export type MapView = {
  hexes: MapHex[];
  here: MapPoint | null; // the hex the player stands in
  between: { from: MapPoint; to: MapPoint; step: number; steps: number } | null; // in a corridor: field `step` of `steps` from `from`
};
