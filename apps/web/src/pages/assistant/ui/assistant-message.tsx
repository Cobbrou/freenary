import { Button } from "@freenary/ui/components/button";
import { Tooltip } from "@freenary/ui/components/tooltip";
import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import {
  RiArrowRightSLine,
  RiDashboardLine,
  RiFileCopyLine,
  RiRefreshLine,
} from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { memo, useRef } from "react";

import { savedDashboardsOf, useDashboardUpdates } from "@/entities/dashboard";
import type { SavedDashboard } from "@/entities/dashboard";
import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";
import { AiUpdateScope } from "@/shared/ui/ai-update-scope";
import type { AiUpdateScopeHandle } from "@/shared/ui/ai-update-scope";

import type { AnswerSegment } from "../model/answer-segments";
import { activityOf, traceOf } from "../model/execution";
import type { ChatStatus } from "../model/execution";
import { useExecutionTimings } from "../model/use-execution-timings";
import { AssistantActivity } from "./assistant-activity";
import { AssistantAvatar } from "./assistant-avatar";
import { AssistantChart } from "./assistant-chart";
import { AssistantProse } from "./assistant-prose";
import { AssistantTrace } from "./assistant-trace";

interface AssistantMessageProps {
  message: UIMessage;
  avatarState?: BrandAvatarState;
  live: boolean;
  status: ChatStatus;
  retrying: boolean;
  startedAt?: number;
  latest?: boolean;
  onMakeDashboard?: () => void;
  onRetry?: (messageId: string) => void;
}

const DashboardIcon = remixIcon(RiDashboardLine);

const OpenIcon = remixIcon(RiArrowRightSLine);

const bubblePad = { compact: "px-3 py-2", default: "px-4 py-3" } as const;

const textOf = (segments: AnswerSegment[]): string =>
  segments
    .flatMap((segment) => (segment.kind === "markdown" ? [segment.text] : []))
    .join("\n\n");

const AnswerSegments = ({
  prefix,
  segments,
}: {
  prefix: string;
  segments: AnswerSegment[];
}) =>
  segments.map((segment, index) =>
    segment.kind === "markdown" ? (
      <AssistantProse className="w-full" key={`${prefix}-${index}`}>
        {segment.text}
      </AssistantProse>
    ) : (
      <AssistantChart
        key={`${prefix}-${index}`}
        program={segment.code}
        streaming={!segment.closed}
      />
    )
  );

const AnswerAction = ({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <Tooltip content={label}>
    <Button
      aria-label={label}
      onClick={onClick}
      size="icon-compact"
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  </Tooltip>
);

const SavedDashboardLink = ({ dashboard }: { dashboard: SavedDashboard }) => (
  <Link
    className="bg-card hover:bg-accent focus-visible:ring-ring/50 flex items-center gap-3 rounded-lg border px-3 py-2.5 outline-none focus-visible:ring-[3px]"
    params={{ dashboardId: dashboard.dashboardId }}
    to="/dashboards/$dashboardId"
  >
    <RiDashboardLine
      aria-hidden="true"
      className="text-muted-foreground size-4 shrink-0"
    />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate font-medium">{dashboard.title}</span>
      <span className="text-muted-foreground text-xs">
        {dashboard.created
          ? m.ask_dashboard_created()
          : m.ask_dashboard_updated()}
      </span>
    </span>
    <span className="text-muted-foreground flex items-center gap-0.5 text-xs">
      {m.ask_dashboard_open()}
      <OpenIcon aria-hidden="true" className="size-4" />
    </span>
  </Link>
);

const SavedDashboardList = ({ dashboards }: { dashboards: SavedDashboard[] }) =>
  dashboards.map((dashboard) => (
    <SavedDashboardLink dashboard={dashboard} key={dashboard.dashboardId} />
  ));

const AnnouncedDashboardList = ({
  dashboards,
}: {
  dashboards: SavedDashboard[];
}) => {
  const scope = useRef<AiUpdateScopeHandle>(null);

  useDashboardUpdates(({ dashboardIds }) => {
    if (
      dashboards.some((dashboard) =>
        dashboardIds.includes(dashboard.dashboardId)
      )
    ) {
      scope.current?.play({});
    }
  });

  return (
    <AiUpdateScope ref={scope} size="element">
      <div className="flex flex-col gap-2">
        <SavedDashboardList dashboards={dashboards} />
      </div>
    </AiUpdateScope>
  );
};

const UserMessage = ({ message }: { message: UIMessage }) => {
  const size = useSize();
  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n");

  return (
    <div className="flex w-full justify-end">
      <div
        className={cn(
          "bg-secondary text-foreground max-w-[85%] min-w-0 rounded-lg text-sm break-words whitespace-pre-wrap",
          bubblePad[size.variant]
        )}
      >
        {text}
      </div>
    </div>
  );
};

const AnswerMessage = ({
  avatarState,
  latest = false,
  live,
  message,
  onMakeDashboard,
  onRetry,
  retrying,
  startedAt,
  status,
}: AssistantMessageProps) => {
  const retry = onRetry ? () => onRetry(message.id) : undefined;
  const trace = traceOf(message.parts, live);
  const timings = useExecutionTimings(message.parts, live, startedAt);
  const answer = trace.steps.flatMap((step) => step.answer);
  const copyable = textOf(answer);
  const traced = trace.steps.some(
    (step) => step.tools.length > 0 || step.thinking !== null
  );

  const savedDashboards = savedDashboardsOf(message.parts);
  const charted = answer.some((segment) => segment.kind === "chart");
  const canMakeDashboard =
    onMakeDashboard !== undefined && charted && savedDashboards.length === 0;

  return (
    <div className="flex w-full gap-3">
      <AssistantAvatar
        className="mt-0.5 size-7"
        frozen={avatarState === undefined}
        state={avatarState ?? "idle"}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
        {traced && (
          <AssistantTrace
            live={live}
            onRetry={retry}
            timings={timings}
            trace={trace}
          />
        )}
        <AnswerSegments prefix={message.id} segments={answer} />
        {latest && savedDashboards.length > 0 ? (
          <AnnouncedDashboardList dashboards={savedDashboards} />
        ) : (
          <SavedDashboardList dashboards={savedDashboards} />
        )}
        {live && (
          <AssistantActivity
            activity={activityOf(trace, status)}
            retrying={retrying}
          />
        )}
        {!live && copyable.length > 0 && (
          <div className="flex items-center gap-1">
            <AnswerAction
              label={m.assistant_copy()}
              onClick={() => navigator.clipboard.writeText(copyable)}
            >
              <RiFileCopyLine />
            </AnswerAction>
            {retry && (
              <AnswerAction label={m.assistant_retry()} onClick={retry}>
                <RiRefreshLine />
              </AnswerAction>
            )}
            {canMakeDashboard && (
              <Button
                className="ms-auto"
                leadingIcon={DashboardIcon}
                onClick={onMakeDashboard}
                size="compact"
                type="button"
                variant="secondary"
              >
                {m.ask_make_dashboard()}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AssistantMessageRow = (props: AssistantMessageProps) =>
  props.message.role === "assistant" ? (
    <AnswerMessage {...props} />
  ) : (
    <UserMessage message={props.message} />
  );

export const AssistantMessage = memo(AssistantMessageRow);
