/** Messages d’erreur sûrs pour le client (pas de fuite driver/MySQL). */

export function publicErrorMessage(
  err: unknown,
  fallback = "Erreur serveur",
): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message || fallback;

  // Erreurs métier déjà rédigées en français → OK à renvoyer
  const safePrefixes = [
    "L’installation",
    "L'installation",
    "Identifiant",
    "Nom affiché",
    "Mot de passe",
    "Cet identifiant",
    "Utilisateur introuvable",
    "Impossible",
    "Vous ne pouvez pas",
    "version,",
    "status invalide",
    "Fiche introuvable",
    "Authentification",
    "Accès administrateur",
    "Non connecté",
    "Cette fiche est finalisée",
    "Réponse",
  ];
  if (safePrefixes.some((p) => msg.startsWith(p))) {
    return msg;
  }

  // Codes / patterns MySQL / réseau → message générique
  const e = err as Error & { code?: string; errno?: number };
  if (
    e.code === "ER_ACCESS_DENIED_ERROR" ||
    e.code === "ECONNREFUSED" ||
    e.code === "PROTOCOL_CONNECTION_LOST" ||
    e.code === "ER_BAD_DB_ERROR" ||
    e.code === "ER_DBACCESS_DENIED_ERROR" ||
    /Access denied for user/i.test(msg) ||
    /ECONNREFUSED/i.test(msg) ||
    /ER_/i.test(msg) ||
    /mysql/i.test(msg)
  ) {
    return "Service temporairement indisponible. Réessayez plus tard.";
  }

  // Tout le reste : log côté serveur, message générique
  return fallback;
}

export function isClientSafeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || "";
  return (
    msg.startsWith("L’installation") ||
    msg.startsWith("L'installation") ||
    msg.startsWith("Identifiant") ||
    msg.startsWith("Nom affiché") ||
    msg.startsWith("Mot de passe") ||
    msg.startsWith("Cet identifiant") ||
    msg.startsWith("Utilisateur introuvable") ||
    msg.startsWith("Impossible") ||
    msg.startsWith("Vous ne pouvez pas") ||
    msg.startsWith("Cette fiche est finalisée") ||
    msg.startsWith("Fiche introuvable") ||
    msg.startsWith("status invalide")
  );
}
