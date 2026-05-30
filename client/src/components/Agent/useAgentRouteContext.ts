import { useMemo } from 'react';
import type t from 'librechat-data-provider';
import { useAgentsMapContext } from '~/Providers';

export type AgentLookupStatus = 'resolved' | 'fallback' | 'loading';

export type ResolvedAgentRouteContext = {
  requestedAgentId: string;
  routeAgentId: string;
  resolvedAgentId?: string;
  agent: t.Agent | null;
  displayName: string;
  subtitle: string;
  lookupStatus: AgentLookupStatus;
};

const FALLBACK_AGENT_NAME = 'Lobe AI';
const AGENT_ID_PATTERN = /^ag(?:en)?t[_-]/i;
const LOBE_STYLE_AGENT_ID_PATTERN = /^agt[_-]/i;

function normalizeAgentToken(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getAgentSubtitle(agent: t.Agent | null, requestedAgentId: string) {
  if (!agent) {
    return requestedAgentId;
  }

  return agent.description || normalizeAgentToken(agent.name) || agent.id;
}

export default function useAgentRouteContext(agentId: string): ResolvedAgentRouteContext {
  const agentsMap = useAgentsMapContext();

  return useMemo(() => {
    const requestedAgentId = agentId.trim();
    const agents = Object.values(agentsMap ?? {}).filter(Boolean) as t.Agent[];
    const normalizedRequestedId = normalizeAgentToken(requestedAgentId);

    const directAgent = agentsMap?.[requestedAgentId] ?? null;
    const matchedAgent =
      directAgent ??
      agents.find((agent) => {
        const tokens = [agent.id, agent.name, agent.description]
          .filter(Boolean)
          .map((value) => normalizeAgentToken(String(value)));

        return tokens.includes(normalizedRequestedId);
      }) ??
      null;

    if (matchedAgent) {
      return {
        requestedAgentId,
        routeAgentId: requestedAgentId,
        resolvedAgentId: matchedAgent.id,
        agent: matchedAgent,
        displayName: matchedAgent.name || FALLBACK_AGENT_NAME,
        subtitle: getAgentSubtitle(matchedAgent, requestedAgentId),
        lookupStatus: 'resolved' as const,
      };
    }

    const lobeFallbackAgent =
      requestedAgentId === 'lobe-ai' || LOBE_STYLE_AGENT_ID_PATTERN.test(requestedAgentId)
        ? agents.find(
            (agent) => normalizeAgentToken(agent.name) === normalizeAgentToken(FALLBACK_AGENT_NAME),
          )
        : null;

    if (lobeFallbackAgent) {
      return {
        requestedAgentId,
        routeAgentId: requestedAgentId,
        resolvedAgentId: lobeFallbackAgent.id,
        agent: lobeFallbackAgent,
        displayName: lobeFallbackAgent.name || FALLBACK_AGENT_NAME,
        subtitle: getAgentSubtitle(lobeFallbackAgent, requestedAgentId),
        lookupStatus: 'resolved' as const,
      };
    }

    if (AGENT_ID_PATTERN.test(requestedAgentId)) {
      return {
        requestedAgentId,
        routeAgentId: requestedAgentId,
        resolvedAgentId: requestedAgentId,
        agent: null,
        displayName: FALLBACK_AGENT_NAME,
        subtitle: requestedAgentId,
        lookupStatus: 'resolved' as const,
      };
    }

    return {
      requestedAgentId,
      routeAgentId: requestedAgentId || normalizeAgentToken(FALLBACK_AGENT_NAME),
      resolvedAgentId: undefined,
      agent: null,
      displayName: FALLBACK_AGENT_NAME,
      subtitle: requestedAgentId || normalizeAgentToken(FALLBACK_AGENT_NAME),
      lookupStatus: agentsMap === undefined ? ('loading' as const) : ('fallback' as const),
    };
  }, [agentId, agentsMap]);
}
