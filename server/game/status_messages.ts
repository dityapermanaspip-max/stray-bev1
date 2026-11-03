import { eat } from '../food/food_service.ts';
import type { SwapPlace } from '../loadout/loadout.ts';
import type { Rng } from '../util/rng.ts';
import type { CompanionRequest, DropRequest, EatRequest, FormationRequest, GearRequest, LoadoutRequest } from '../../shared/town.ts';
import type { FieldClient, Seat } from './field_state.ts';
import { companionPanel, partyView } from './party_service.ts';
import { changeGear, changeLoadout, changeSlot, dropItem, statusPanel } from './status_service.ts';
import type { GameWorld } from './world.ts';

// The field room's requests for the status window (status, loadout, gear, drop, eat, formation, party, companion):
// each answers with a fresh view. `seated` runs the work for the client's seat, one action at a time.

type Ctx = { world: GameWorld; rng: Rng; ref: string };
type Seated = <T>(client: FieldClient, work: (seat: Seat) => Promise<T> | T | null) => Promise<T | null> | null;

export function statusMessages(seated: Seated, ctx: () => Ctx, place: (seat: Seat) => SwapPlace) {
  return {
    status: (client: FieldClient) => seated(client, (seat) => statusPanel(ctx(), seat.entityId, place(seat))),
    loadout: (client: FieldClient, msg: LoadoutRequest) => seated(client, (seat) => changeLoadout(ctx(), seat.entityId, place(seat), msg)),
    gear: (client: FieldClient, msg: GearRequest) => seated(client, (seat) => changeGear(ctx(), seat.entityId, place(seat), msg)),
    drop: (client: FieldClient, msg: DropRequest) => seated(client, (seat) => dropItem(ctx(), seat.entityId, place(seat), msg)),
    formation: (client: FieldClient, msg: FormationRequest) => seated(client, (seat) => changeSlot(ctx(), seat.entityId, place(seat), msg)),
    eat: (client: FieldClient, msg: EatRequest) => seated(client, (seat) => eat(ctx(), seat.entityId, place(seat), String(msg?.ref ?? ''))
      .then((done) => ((seat.mealEnds = done.endsAt ?? seat.mealEnds), done.panel))), // the status window again, with a line
    party: (client: FieldClient) => seated(client, (seat) => partyView(ctx(), seat.entityId)),
    companion: (client: FieldClient, msg: CompanionRequest) => seated(client, (seat) => companionPanel(ctx(), seat.entityId, String(msg?.id ?? ''), place(seat))),
  };
}
