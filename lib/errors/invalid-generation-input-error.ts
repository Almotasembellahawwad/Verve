/** A client selection cannot silently turn into a different generated identity. */
export class InvalidGenerationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGenerationInputError";
  }
}
