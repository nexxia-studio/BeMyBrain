import { Pool, type PoolClient } from "@neondatabase/serverless";

/** Pool du pilote Neon, avec purge des connexions au repos (BRAIN-50). */
export type AppPool = Pool & {
  /**
   * Ferme toutes les connexions au repos du pool ; une connexion empruntée n'est pas touchée.
   * Appelée avant une nouvelle tentative : gelées en même temps que la connexion morte, elles sont suspectes.
   */
  evictIdle: () => Promise<void>;
};

/**
 * Pool du pilote Neon, avec journalisation générique des erreurs de connexion.
 * `role` ne sert qu'au message : ni URL, ni claims, ni détail de l'erreur du pilote.
 */
export function createPool(connectionString: string, role: string): AppPool {
  const pool = new Pool({ connectionString });
  const log = () => {
    console.error(`Erreur sur une connexion du pool ${role}.`);
  };
  // Génération de purge à laquelle chaque connexion est née (événement « connect »).
  const bornAt = new WeakMap<PoolClient, number>();
  let generation = 0;
  // pg-pool retire son écouteur d'erreur de repos quand une transaction emprunte la connexion : un socket
  // coupé pendant une lecture émettrait alors « error » sans écouteur (uncaughtException, processus tué).
  // Écouteur permanent sur chaque connexion : la requête en cours échoue normalement, et la connexion,
  // devenue non requêtable, est retirée du pool à son rendu (QA-4, Sentry BEMYBRAIN-5).
  // Effet de bord : écouter « connect » passe hasFetchUnsupportedListeners à vrai dans le Pool de Neon, ce qui
  // désactive neonConfig.poolQueryViaFetch (non utilisé aujourd'hui).
  pool.on("connect", (client: PoolClient) => {
    client.on("error", log);
    bornAt.set(client, generation);
  });
  // Erreur d'une connexion au repos : déjà journalisée par l'écouteur ci-dessus. Écouteur requis :
  // sans lui, le pool émettrait « error » sans écouteur.
  pool.on("error", () => undefined);

  // Purge par l'API publique de pg-pool. `client.end()` sur une connexion au repos la fermerait sans la
  // retirer du pool (pg-pool n'écoute pas « end », et un client qu'on ferme n'émet pas « error ») : elle
  // resterait au repos et serait prêtée. On emprunte donc chaque connexion au repos (connect() sert le repos
  // en premier) et on la rend par `release(true)` : pg-pool la retire de ses clients et la ferme
  // (_release → _remove, événement « remove »).
  // Une connexion née pendant la purge (repos vidé entre-temps par un autre emprunt) est neuve : rendue
  // normalement, et la purge s'arrête. Purges simultanées (lectures parallèles en échec au réveil) : une passe.
  let running: Promise<void> | undefined;
  async function evict(): Promise<void> {
    const started = ++generation;
    while (pool.idleCount > 0) {
      const client = await pool.connect();
      const fresh = (bornAt.get(client) ?? -1) >= started;
      client.release(fresh ? undefined : true);
      if (fresh) return;
    }
  }
  const evictIdle = () => {
    running ??= evict().finally(() => {
      running = undefined;
    });
    return running;
  };

  return Object.assign(pool, { evictIdle });
}
