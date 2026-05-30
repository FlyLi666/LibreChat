import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Plus, Sparkles, X } from 'lucide-react';
import { Tools } from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import {
  useCreateAgentMutation,
  useGetExpandedAgentByIdQuery,
  useUpdateAgentMutation,
} from '~/data-provider/Agents';
import { useLocalize } from '~/hooks';
import cn from '~/utils/cn';
import type { ResolvedAgentRouteContext } from '../useAgentRouteContext';
import AgentPageShell from './AgentPageShell';

const defaultInstructions = `## Role
You are Lobe AI, a focused assistant for product thinking, coding plans, and careful execution.

## Style
- Keep answers direct.
- Ask one clarifying question when the request is ambiguous.
- Prefer small, verifiable steps.`;

const defaultSkills = ['Search', 'Code', 'Image', 'Notebook'];
const modelOptions = ['gpt-5.5', 'gpt-5.1', 'claude-opus-4.7', 'gemini-3.5-flash'];

const skillToolMap: Record<string, string> = {
  code: Tools.execute_code,
  image: 'image_edit',
  notebook: Tools.file_search,
  search: Tools.web_search,
};

const toolSkillMap = Object.fromEntries(
  Object.entries(skillToolMap).map(([skill, tool]) => [tool, skill]),
);

function normalizeSkill(value: string) {
  return value.trim().toLowerCase();
}

function formatSkillLabel(value: string) {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getDisplaySkills(agent?: t.Agent | null) {
  const tools = Array.isArray(agent?.tools) ? agent.tools : [];
  const toolLabels = tools
    .map((tool) => toolSkillMap[String(tool)])
    .filter(Boolean)
    .map(formatSkillLabel);
  const persistedSkills = Array.isArray(agent?.skills)
    ? agent.skills.map((skill) => formatSkillLabel(String(skill))).filter(Boolean)
    : [];
  const labels = [...new Set([...persistedSkills, ...toolLabels])];

  return labels.length > 0 ? labels : defaultSkills;
}

function getAgentInstructions(agent?: t.Agent | null) {
  return agent?.instructions || defaultInstructions;
}

function getAgentModel(agent?: t.Agent | null) {
  return agent?.model || 'gpt-5.5';
}

export default function AgentProfilePage({
  agentId,
  agentContext,
}: {
  agentId: string;
  agentContext?: ResolvedAgentRouteContext;
}) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const resolvedAgentId = agentContext?.resolvedAgentId;
  const expandedAgentQuery = useGetExpandedAgentByIdQuery(resolvedAgentId ?? '', {
    enabled: !!resolvedAgentId,
  });
  const persistedAgent = expandedAgentQuery.data || agentContext?.agent;
  const updateAgent = useUpdateAgentMutation();
  const createAgent = useCreateAgentMutation();
  const [name, setName] = useState(persistedAgent?.name || agentContext?.displayName || 'Lobe AI');
  const [model, setModel] = useState(getAgentModel(persistedAgent));
  const [description, setDescription] = useState(
    persistedAgent?.description ||
      'A dark-room assistant for strategy, coding, image workflows, and daily project control.',
  );
  const [instructions, setInstructions] = useState(getAgentInstructions(persistedAgent));
  const [skills, setSkills] = useState(getDisplaySkills(persistedAgent));
  const [draftSkill, setDraftSkill] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const isSaving = updateAgent.isLoading || createAgent.isLoading;
  const lastSyncedProfile = useRef('');
  const profileFingerprint = useMemo(
    () =>
      persistedAgent
        ? JSON.stringify({
            description: persistedAgent.description,
            id: persistedAgent.id,
            instructions: persistedAgent.instructions,
            model: persistedAgent.model,
            name: persistedAgent.name,
            skills: persistedAgent.skills,
            tools: persistedAgent.tools,
          })
        : '',
    [persistedAgent],
  );

  useEffect(() => {
    if (!persistedAgent || lastSyncedProfile.current === profileFingerprint) {
      return;
    }

    lastSyncedProfile.current = profileFingerprint;
    setName(persistedAgent.name || agentContext?.displayName || 'Lobe AI');
    setModel(getAgentModel(persistedAgent));
    setDescription(persistedAgent.description || '');
    setInstructions(getAgentInstructions(persistedAgent));
    setSkills(getDisplaySkills(persistedAgent));
  }, [agentContext?.displayName, persistedAgent, profileFingerprint]);

  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'AI',
    [name],
  );

  const addSkill = () => {
    const nextSkill = draftSkill.trim();
    if (!nextSkill || skills.some((skill) => normalizeSkill(skill) === normalizeSkill(nextSkill))) {
      return;
    }
    setSkills((current) => [...current, nextSkill]);
    setDraftSkill('');
  };

  const removeSkill = (skill: string) => {
    setSkills((current) => current.filter((item) => item !== skill));
  };

  const buildProfilePayload = (): t.AgentUpdateParams => {
    const tools = skills
      .map((skill) => skillToolMap[normalizeSkill(skill)])
      .filter((tool): tool is string => Boolean(tool));

    return {
      description: description.trim(),
      instructions,
      model,
      name: name.trim() || agentContext?.displayName || 'Lobe AI',
      skills: skills.map(normalizeSkill),
      skills_enabled: tools.length > 0,
      tools,
    };
  };

  const handleSave = async () => {
    setSaveError('');
    const payload = buildProfilePayload();

    try {
      if (resolvedAgentId) {
        await updateAgent.mutateAsync({
          agent_id: resolvedAgentId,
          data: payload,
        });
      } else {
        const createdAgent = await createAgent.mutateAsync({
          ...payload,
          model_parameters: {},
          provider: 'openAI',
        });
        navigate(`/agent/${createdAgent.id}/profile`, { replace: true });
      }

      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : localize('com_agent_profile_save_error'),
      );
    }
  };

  const selectOptions = modelOptions.includes(model) ? modelOptions : [model, ...modelOptions];
  let saveButtonLabel = localize('com_agent_save_profile');
  if (saved) {
    saveButtonLabel = localize('com_agent_saved');
  } else if (isSaving) {
    saveButtonLabel = localize('com_ui_loading');
  }

  return (
    <AgentPageShell
      testId="agent-profile-page"
      eyebrow={agentId}
      title={localize('com_agent_profile')}
      description={localize('com_agent_profile_subtitle')}
      actions={
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60',
            isSaving && 'cursor-not-allowed opacity-65',
            saved
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400 dark:text-emerald-950'
              : 'bg-surface-submit text-white hover:bg-surface-submit-hover',
          )}
        >
          <Check className="size-4" aria-hidden="true" />
          {saveButtonLabel}
        </button>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border-light bg-surface-primary-alt p-5 shadow-2xl shadow-black/20">
            <div className="mx-auto flex size-40 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-300 via-sky-400 to-violet-500 text-5xl font-semibold text-text-primary shadow-2xl shadow-sky-950/40">
              {initials}
            </div>
            <div className="mt-5 text-center">
              <div className="text-sm font-medium text-text-primary">{name}</div>
              <div className="mt-1 text-xs text-text-tertiary">{agentId}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
              {localize('com_agent_model')}
            </label>
            <div className="relative mt-2">
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="h-11 w-full appearance-none rounded-md border border-border-light bg-surface-primary px-3 pr-9 text-sm text-text-primary transition-colors hover:border-border-medium focus:border-sky-300/70 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                aria-label={localize('com_agent_model')}
              >
                {selectOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'gemini-3.5-flash'
                      ? localize('com_agent_model_gemini_flash')
                      : option.toUpperCase()}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border-light bg-surface-primary-alt p-5">
            <label
              htmlFor="agent-profile-name"
              className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary"
            >
              {localize('com_agent_name')}
            </label>
            <input
              id="agent-profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-3 w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-normal text-text-primary outline-none placeholder:text-text-tertiary focus:ring-0 sm:text-4xl"
              placeholder={localize('com_agent_name')}
            />
            <label
              htmlFor="agent-profile-description"
              className="mt-6 block text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary"
            >
              {localize('com_agent_description')}
            </label>
            <textarea
              id="agent-profile-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="mt-3 w-full resize-none rounded-md border border-border-light bg-surface-primary px-3 py-3 text-sm leading-6 text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-sky-300/70 focus:ring-2 focus:ring-sky-400/20"
            />
          </div>

          <div className="rounded-lg border border-border-light bg-surface-primary-alt p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                {localize('com_agent_skills')}
              </label>
              <Sparkles className="size-4 text-sky-700 dark:text-sky-300" aria-hidden="true" />
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <button
                  type="button"
                  key={skill}
                  onClick={() => removeSkill(skill)}
                  className="hover:bg-rose-400/12 inline-flex h-8 items-center gap-2 rounded-full border border-border-light bg-surface-hover px-3 text-xs font-medium text-text-primary transition-colors hover:border-rose-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/50"
                >
                  {skill}
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={draftSkill}
                onChange={(event) => setDraftSkill(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addSkill();
                  }
                }}
                className="h-10 min-w-0 flex-1 rounded-md border border-border-light bg-surface-primary px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-sky-300/70 focus:ring-2 focus:ring-sky-400/20"
                placeholder={localize('com_agent_add_skill')}
              />
              <button
                type="button"
                onClick={addSkill}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-border-light bg-surface-hover px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-active-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <Plus className="size-4" aria-hidden="true" />
                {localize('com_ui_add')}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border-light bg-surface-primary-alt p-5">
            <label
              htmlFor="agent-profile-instructions"
              className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary"
            >
              {localize('com_agent_instructions_markdown')}
            </label>
            <textarea
              id="agent-profile-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={10}
              className="mt-3 w-full resize-y rounded-md border border-border-light bg-surface-primary px-4 py-3 font-mono text-sm leading-6 text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-sky-300/70 focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          {saveError ? (
            <div className="rounded-md border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-100">
              {saveError}
            </div>
          ) : null}
        </div>
      </section>
    </AgentPageShell>
  );
}
