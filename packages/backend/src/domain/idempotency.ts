/**
 * Registro de idempotência — entidade IdempotencyRecord (10), regra 15/57.
 * A primeira execução com uma chave vence; repetições recebem o resultado
 * original sem reexecutar a mutação.
 */
export class IdempotencyRegistry {
  private readonly seen = new Set<string>();

  /**
   * Retorna true quando a chave é nova (execução deve prosseguir) e false
   * quando já foi consumida (chamador deve repetir a resposta original).
   */
  claim(key: string): boolean {
    if (key.trim() === '') throw new Error('Idempotency key must not be empty.');
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}
