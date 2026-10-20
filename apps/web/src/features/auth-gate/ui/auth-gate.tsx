import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { orpc } from "@/shared/api";
import { authClient } from "@/shared/auth";

type Audience = "guest" | "member" | "onboarding";

type Destination = "/" | "/login" | "/onboarding" | "/setup";

interface AuthGateProps {
  audience: Audience;
  children: ReactNode;
}

interface Visitor {
  completed: boolean | undefined;
  isPending: boolean;
  isSetupUnsettled: boolean;
  isSignedIn: boolean;
  setupCompleted: boolean | undefined;
}

const redirectFor = (
  audience: Audience,
  {
    completed,
    isPending,
    isSetupUnsettled,
    isSignedIn,
    setupCompleted,
  }: Visitor
): Destination | null => {
  if (audience === "guest") {
    return isSignedIn ? "/" : null;
  }

  if (isPending) {
    return null;
  }

  if (!isSignedIn) {
    return "/login";
  }

  if (setupCompleted === false) {
    return "/setup";
  }

  if (isSetupUnsettled) {
    return null;
  }

  if (audience === "member") {
    return completed === false ? "/onboarding" : null;
  }

  return completed === true ? "/" : null;
};

export const AuthGate = ({ audience, children }: AuthGateProps) => {
  const { instance, viewer } = useRouteContext({
    from: "__root__",
    select: (context) => ({
      instance: context.instance,
      viewer: context.viewer,
    }),
  });

  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const isSignedIn = session !== null && session !== undefined;
  const status = useQuery(
    orpc.onboarding.getStatus.queryOptions({ enabled: session !== null })
  );

  const setup = useQuery(
    orpc.instance.status.queryOptions({
      enabled: audience !== "guest" && isSignedIn,
    })
  );

  const isSetupUnsettled = instance.kind !== "ready" && setup.isPending;

  const destination = redirectFor(audience, {
    completed: status.data?.completed,
    isPending,
    isSetupUnsettled,
    isSignedIn: session !== null,
    setupCompleted: setup.data?.completed,
  });

  useEffect(() => {
    if (destination !== null) {
      void navigate({ replace: true, to: destination });
    }
  }, [destination, navigate]);

  if (destination !== null) {
    return null;
  }

  const isPublicToEveryone = audience === "guest";

  if (isPublicToEveryone) {
    return children;
  }

  const wasServerRenderedForMember = viewer.kind === "member";

  if (isPending) {
    return wasServerRenderedForMember ? children : null;
  }

  if (isSetupUnsettled) {
    return null;
  }

  const isOnboardingStatusUnreadable = audience === "member" && status.isError;

  if (isOnboardingStatusUnreadable) {
    return null;
  }

  return children;
};
