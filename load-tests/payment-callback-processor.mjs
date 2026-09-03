// Artillery processor: loads the single trackId seed-payment.mjs produced
// once per Artillery run (not once per virtual user) so every VU replays
// the exact same callback — that collision is the point of this scenario.
import { readFileSync } from 'node:fs';

const { trackId } = JSON.parse(readFileSync(new URL('./payment-track.json', import.meta.url), 'utf8'));

export function setTrackId(context, events, done) {
  context.vars.trackId = trackId;
  return done();
}
