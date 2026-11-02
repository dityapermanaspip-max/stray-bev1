// Town and status window messages (Step 3). The backend owns these types; the client imports them.
// Numbers only for money and counts; body and load as tier words.

// Server -> client 'service' when the player stops on a door (and again after each action there).
export type ServiceView = {
  service: string; // inn | shop | cook | woodworker | tanner | temple | guild | trainer
  name: string;
  text: string | null; // what the player hears at the door (closed doors, refusals, results)
  inn: { price: number } | null; // copper
  shop: {
    offers: { ref: string; name: string; qty: number; price: number }[]; // what the shop pays for one, in copper
    wares: { key: string; name: string; qty: number; price: number }[]; // the shelf: count and price for one
    haggle: boolean; // the keeper is open to a haggle (one try per visit)
  } | null;
  craft: {
    recipes: { name: string; outputs: { name: string; qty: number }[]; inputs: { name: string; qty: number; have: number }[]; fee: number }[];
  } | null; // what this craftsman makes here; fee in copper
  purse: number; // copper carried
};

// Client -> server 'service': act at the door the player stands on.
export type ServiceRequest =
  | { action: 'rest' }
  | { action: 'sell'; ref: string; generous?: boolean } // generous: take less than the price
  | { action: 'buy'; key: string; generous?: boolean } // generous: pay more than the price
  | { action: 'haggle' }
  | { action: 'craft'; name: string };

export type Word = { tier: number; text: string | null };

// room.request('status') answers with this; the same shape comes back after 'loadout' and 'gear'.
export type StatusPanel = {
  body: { resource: string; tier: number; text: string | null }[];
  slots: { slot: number; move: string | null }[];
  moves: { move: string; name: string; mastery: number; slot: number | null; isNew: boolean }[];
  bag: {
    load: Word;
    slots: { slot: string; item: string | null }[];
    items: { ref: string; item: string; name: string; qty: number; slot: string | null; wearable: boolean; edible: boolean; condition: number | null; freshness: Word | null }[];
  } | null;
  formation: { slot: number; front: number; back: number }; // own battle slot: 1..front is the front row, then the back row
  canSwap: boolean; // inside a town's safe square (or the testing flag)
  line: string | null; // a refusal or a remark after the last change
};

// Client -> server requests (answered with StatusPanel). move null empties the slot.
export type LoadoutRequest = { slot: number; move: string | null };
export type GearRequest = { wear: string; slot?: string } | { remove: string }; // wear: a bag ref; remove: a gear slot
export type FormationRequest = { slot: number }; // a battle slot; town only, like loadout changes
export type EatRequest = { ref: string }; // a bag ref; answered with StatusPanel (its line says how it went)
