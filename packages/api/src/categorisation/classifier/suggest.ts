import type { HeldValue, ServerSettings } from "@freenary/instance-config";
import {
  findIntegration,
  recogniseVariant,
  rememberedVariantKey,
  settings as instanceSettings,
  storedSettingsAtBoot,
} from "@freenary/instance-config";
import { Option } from "effect";

import type { SpendingCategory } from "../../lib/taxonomy";
import { normaliseDescriptor } from "../normalise/normalise-descriptor";
import { CATEGORISATION_INTEGRATION } from "./probe";
import { suggestSystemOneCategories } from "./providers/system-one";
import { primarySlotOf } from "./registry";
import type {
  ClassificationInput,
  ClassifierTransport,
  TransactionDirection,
} from "./types";

const JEV_VARIANT = "jev";
const SUGGESTION_LIMIT = 3;

export interface SuggestionRequest {
  currency: string;
  direction: TransactionDirection;
  query: string;
}

export interface CategorySuggester {
  suggest: (request: SuggestionRequest) => Promise<SpendingCategory[]>;
}

const isJevConfigured = (
  held: HeldValue,
  remembered: (variantKey: string) => string | undefined
): boolean =>
  Option.match(findIntegration(CATEGORISATION_INTEGRATION), {
    onNone: () => false,
    onSome: (integration) =>
      Option.match(
        recogniseVariant(
          integration,
          held,
          remembered(rememberedVariantKey(integration))
        ),
        {
          onNone: () => false,
          onSome: (variant) => variant.id === JEV_VARIANT,
        }
      ),
  });

const suggestionInputOf = ({
  currency,
  direction,
  query,
}: SuggestionRequest): ClassificationInput | null => {
  const descriptor = normaliseDescriptor(query);

  if (descriptor === "") {
    return null;
  }

  return {
    amountBucket: "small",
    channel: "unknown",
    counterpartyName: null,
    country: null,
    currency,
    direction,
    merchantCategoryCode: null,
    merchantKey: descriptor,
    normalisedDescriptor: descriptor,
    path: "card",
  };
};

const heldIn =
  (settings: ServerSettings): HeldValue =>
  (key) => {
    const value = settings[key];

    return value === undefined ? undefined : String(value);
  };

export const createJevSuggester = (
  settings: ServerSettings,
  remembered: (variantKey: string) => string | undefined,
  transport: ClassifierTransport = fetch
): Option.Option<CategorySuggester> => {
  if (!isJevConfigured(heldIn(settings), remembered)) {
    return Option.none();
  }

  const slot = primarySlotOf(settings);
  const { model, url } = slot;

  if (model === undefined || url === undefined) {
    return Option.none();
  }

  const endpoint = {
    apiKey: slot.apiKey,
    model,
    temperature: slot.temperature,
    timeoutMs: slot.timeoutMs,
    url,
  };

  return Option.some({
    suggest: async (request) => {
      const input = suggestionInputOf(request);

      return input === null
        ? []
        : await suggestSystemOneCategories(
            endpoint,
            transport,
            input,
            SUGGESTION_LIMIT
          );
    },
  });
};

export const categorySuggester = createJevSuggester(
  instanceSettings,
  (variantKey) => storedSettingsAtBoot()[variantKey]
);
