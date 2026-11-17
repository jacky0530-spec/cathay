// Pure Firebase transaction callback helper; network/state checks live in manager.mjs.
// A null value can be the SDK's initial uncached local snapshot; the manager verifies
// that the actual record exists on the server BEFORE initiating the transaction.
export function nextVipStatus(current, expectedActive) {
  if (typeof expectedActive !== 'boolean') return undefined;
  if (current === null) return !expectedActive;
  if (typeof current !== 'boolean' || current !== expectedActive) return undefined;
  return !expectedActive;
}
