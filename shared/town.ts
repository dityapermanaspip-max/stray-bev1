// Town and status window messages (Step 3). The backend owns these types; the client imports them.
// Numbers only for money and counts; body and load as tier words.

// Server -> client 'service' when the player stops on a door (and again after each action there).
export type ServiceView = {
  service: string; // inn | shop | cook | woodworker | temple | guild | trainer
  name: string;
  text: string | null; // what the player hears at the door (closed doors, refusals, results)
  inn: { price: number } | null; // copper
  shop: {
    offers: { ref: string; name: string; qty: number; price: number }[]; // what the shop pays for one, in copper
    wares: { key: string; name: string; qty: number; price: number }[]; // the shelf: count and price for one
  } | null;
  craft: { recipes: { name: string; output: string; qty: number; inputs: { name: string; qty: number; have: number }[]; fee: number }[] } | null;
  purse: number; // copper carried
};

// Client -> server 'service': act at the door the player stands on.
export type ServiceRequest =
  | { action: 'rest' }
  | { action: 'sell'; ref: string }
  | { action: 'buy'; key: string }
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
    items: { ref: string; item: string; name: string; qty: number; slot: string | null; wearable: boolean; condition: number | null; freshness: Word | null }[];
  } | null;
  canSwap: boolean; // inside a town's safe square (or the testing flag)
  line: string | null; // a refusal or a remark after the last change
};

// Client -> server requests (answered with StatusPanel). move null empties the slot.
export type LoadoutRequest = { slot: number; move: string | null };
export type GearRequest = { wear: string; slot?: string } | { remove: string }; // wear: a bag ref; remove: a gear slot
