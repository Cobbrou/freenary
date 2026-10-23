import { m } from "@/paraglide/messages.js";

import { link, messageParts, strong } from "../lib/message-parts";
import { fieldLabel } from "../model/labels";
import { RichText } from "./rich-text";

const TYPESAFE_QUICKSTART_URL =
  "https://docs.typesafe.ai/introduction/quickstart";

const SUBQ_QUICKSTART_URL = "https://docs.subq.ai/endpoints/decisions-api/";

interface HostedClassifierGuideProps {
  keyPageLabel: string;
  keyPageUrl: string;
  tradeoffs: string;
}

const HostedClassifierGuide = ({
  keyPageLabel,
  keyPageUrl,
  tradeoffs,
}: HostedClassifierGuideProps) => (
  <div className="text-muted-foreground flex flex-col gap-2 text-sm break-words">
    <p>{tradeoffs}</p>
    <p>
      <RichText
        parts={messageParts(m.setup_classifier_guide_key, {
          field: strong(fieldLabel("TRANSACTION_CLASSIFIER_API_KEY")),
          link: link(keyPageLabel, keyPageUrl),
        })}
      />
    </p>
  </div>
);

export const JevGuide = () => (
  <HostedClassifierGuide
    keyPageLabel={m.setup_jev_guide_quickstart_link()}
    keyPageUrl={TYPESAFE_QUICKSTART_URL}
    tradeoffs={m.setup_variant_jev_tradeoffs()}
  />
);

export const SubqSnapGuide = () => (
  <HostedClassifierGuide
    keyPageLabel={m.setup_subq_snap_guide_quickstart_link()}
    keyPageUrl={SUBQ_QUICKSTART_URL}
    tradeoffs={m.setup_variant_subq_snap_tradeoffs()}
  />
);

export const NoGuideNote = () => null;
