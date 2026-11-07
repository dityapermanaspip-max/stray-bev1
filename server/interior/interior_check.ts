import { interiorConfig } from '../config/interior_config.ts';
import { NODE_NAME_PREFIX, SERVICE_NAME_PREFIX, TALK_OPT_PREFIX } from '../db/startup_check.ts';
import { findRoomProblems } from './interior_grid.ts';

// Startup check for the small rooms: every room builds with its seats reachable, every wild kind has a room and a
// node name, every service with a room has a name, and every talk choice has its word.

const TALK_ACTS = ['talk', 'trade', 'rest', 'gift', 'hire', 'recruit', 'pay', 'dismiss'];

export function findInteriorProblems(raw: unknown, lineKeys: Set<string>): string[] {
  if (!raw) return ['balance_config interior is missing'];
  const cfg = interiorConfig(raw as Parameters<typeof interiorConfig>[0]);
  return [
    ...Object.entries(cfg.rooms).flatMap(([name, l]) => findRoomProblems(name, l)),
    ...Object.keys(cfg.wild).flatMap((k) => [
      ...(cfg.rooms[k] ? [] : [`interior wild ${k}: no room`]),
      ...(lineKeys.has(NODE_NAME_PREFIX + k) ? [] : [`interior wild ${k}: no ${NODE_NAME_PREFIX} line`]),
      ...(lineKeys.has(SERVICE_NAME_PREFIX + k) ? [] : [`interior wild ${k}: no ${SERVICE_NAME_PREFIX} line`]),
    ]),
    ...Object.keys(cfg.rooms).filter((k) => !cfg.wild[k] && !lineKeys.has(SERVICE_NAME_PREFIX + k)).map((k) => `interior ${k}: no ${SERVICE_NAME_PREFIX} line`),
    ...Object.entries(cfg.rooms).flatMap(([name, l]) => l.props.flatMap((p) => (p.use && !lineKeys.has(SERVICE_NAME_PREFIX + p.use) ? [`interior ${name}: prop use ${p.use} has no ${SERVICE_NAME_PREFIX} line`] : []))),
    ...TALK_ACTS.filter((a) => !lineKeys.has(TALK_OPT_PREFIX + a)).map((a) => `talk choice ${a}: no ${TALK_OPT_PREFIX} line`),
  ];
}
