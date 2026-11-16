// Original daily study curve (Vietnam time), shared across accounts and timezones.
// Quantized, deterministic movement replaces independent per-browser randomness.
export function studyBaseline(at = Date.now()) {
  const slot = Math.floor(at / 12000);
  const date = new Date(slot * 12000 + 7 * 3600000);
  const h = date.getUTCHours() + date.getUTCMinutes() / 60;
  const anchors = [[0,82],[2,46],[4,22],[5.5,12],[7.5,34],[9.5,56],[11.5,44],[13.5,52],[16,64],[17.5,98],[19,156],[20.5,208],[22,170],[23.5,112],[24,82]];
  let base = 82;
  for (let i=1;i<anchors.length;i++) {
    const [h0,n0]=anchors[i-1], [h1,n1]=anchors[i];
    if(h<=h1) { base=n0+(n1-n0)*(h-h0)/(h1-h0); break; }
  }
  // A smooth common wave, with a shared daily phase; no user-specific state.
  const phase = Math.floor(at / 86400000) % 31;
  const movement = 4 * Math.sin(slot / 9 + phase) + 2 * Math.sin(slot / 23);
  return Math.max(6, Math.min(240, Math.round(base + movement)));
}
