import { Network } from '@capacitor/network';

let status = typeof navigator !== 'undefined' ? navigator.onLine : true;

void Network.getStatus()
  .then((s) => {
    status = s.connected;
  })
  .catch(() => undefined);

/** Last known connectivity. Optimistic: a failed request is still the final word. */
export function isOnline(): boolean {
  return status;
}

/** Calls `cb` whenever connectivity changes. Returns an unsubscribe function. */
export function onNetworkChange(cb: (online: boolean) => void): () => void {
  const set = (online: boolean) => {
    status = online;
    cb(online);
  };
  const onUp = () => set(true);
  const onDown = () => set(false);
  window.addEventListener('online', onUp);
  window.addEventListener('offline', onDown);
  const handle = Network.addListener('networkStatusChange', (s) => set(s.connected));
  return () => {
    window.removeEventListener('online', onUp);
    window.removeEventListener('offline', onDown);
    void handle.then((h) => h.remove()).catch(() => undefined);
  };
}
