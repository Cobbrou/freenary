import { Data } from "effect";

export class BrowserGenerationFailed extends Data.TaggedError(
  "BrowserGenerationFailed"
)<{
  readonly cause: unknown;
}> {}
