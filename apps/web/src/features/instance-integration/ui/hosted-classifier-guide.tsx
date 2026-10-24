import { m } from "@/paraglide/messages.js";

import { link, messageParts, strong } from "../lib/message-parts";
import { fieldLabel } from "../model/labels";
import { RichText } from "./rich-text";

const TYPESAFE_QUICKSTART_URL =
  "https://docs.typesafe.ai/introduction/quickstart";

const SUBQ_QUICKSTART_URL = "https://docs.subq.ai/endpoints/decisions-api/";

interface HostedClassifierGuideProps {
  details?: string;
  keyPageLabel: string;
  keyPageUrl: string;
  tradeoffs: string;
}

const HostedClassifierGuide = ({
  details,
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
    {details === undefined ? null : (
      <details>
        <summary className="hover:text-foreground cursor-pointer select-none">
          {m.setup_more_details()}
        </summary>
        <p className="mt-2">{details}</p>
      </details>
    )}
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
    details={m.setup_subq_snap_retention()}
    keyPageLabel={m.setup_subq_snap_guide_quickstart_link()}
    keyPageUrl={SUBQ_QUICKSTART_URL}
    tradeoffs={m.setup_variant_subq_snap_tradeoffs()}
  />
);

export const NoGuideNote = () => null;
