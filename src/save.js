// Every game on js13kgames.com shares one origin, so this entry keeps to a key of
// its own and never deletes a key it did not write.
const KEY = 'unicorn-launcher-26.best';

const load = (k) => { try { return JSON.parse(localStorage[k]); } catch (e) { return 0; } };

export let best = load(KEY) || load('uniBest');   // uniBest: this entry's own pre-namespace key

const save = () => { try { localStorage[KEY] = best; } catch (e) {} };

export const wipe = () => { best = 0; save(); };
export const record = (d) => { if (d > best) { best = d; save(); return 1; } return 0; };
