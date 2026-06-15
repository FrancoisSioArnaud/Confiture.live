export function describeSyncError(error) {
  const status = error?.status;
  if (status === 0 || globalThis.navigator?.onLine === false) return 'Connexion instable, sauvegarde locale active.';
  if (status === 409) return 'Divergence serveur détectée : recharge la jam avant de renvoyer les actions locales.';
  if (status === 403 || status === 423) return 'Reprise nécessaire : cette jam est ouverte ailleurs.';
  if (status >= 500) return 'Serveur indisponible, les actions restent sauvegardées sur cet appareil.';
  return error?.message || 'Synchronisation en attente.';
}
