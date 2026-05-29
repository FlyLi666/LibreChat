import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { easings } from '@react-spring/web';
import { Plus, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { EModelEndpoint } from 'librechat-data-provider';
import { BirthdayIcon, TooltipAnchor, SplitText } from '@librechat/client';
import {
  useChatContext,
  useChatFormContext,
  useAgentsMapContext,
  useAssistantsMapContext,
} from '~/Providers';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import ConvoIcon from '~/components/Endpoints/ConvoIcon';
import { useLocalize, useAuthContext } from '~/hooks';
import { cn, getIconEndpoint, getEntity } from '~/utils';

const containerClassName =
  'shadow-stroke relative flex h-full items-center justify-center rounded-full bg-white dark:bg-presentation dark:text-white text-black dark:after:shadow-none ';

function getTextSizeClass(text: string | undefined | null) {
  if (!text) {
    return 'text-xl sm:text-2xl';
  }

  if (text.length < 40) {
    return 'text-2xl sm:text-4xl';
  }

  if (text.length < 70) {
    return 'text-xl sm:text-2xl';
  }

  return 'text-lg sm:text-md';
}

export default function Landing({ centerFormOnLanding }: { centerFormOnLanding: boolean }) {
  const { conversation } = useChatContext();
  const methods = useChatFormContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { user } = useAuthContext();
  const localize = useLocalize();

  const [textHasMultipleLines, setTextHasMultipleLines] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);
  const [taskPage, setTaskPage] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const addTaskLabel = '添加任务';
  const templateLabel = '模板';
  const refreshLabel = '换一批';

  const endpointType = useMemo(() => {
    let ep = conversation?.endpoint ?? '';
    if (ep === EModelEndpoint.azureOpenAI) {
      ep = EModelEndpoint.openAI;
    }
    return getIconEndpoint({
      endpointsConfig,
      iconURL: conversation?.iconURL,
      endpoint: ep,
    });
  }, [conversation?.endpoint, conversation?.iconURL, endpointsConfig]);

  const { entity, isAgent, isAssistant } = getEntity({
    endpoint: endpointType,
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });

  const name = entity?.name ?? '';
  const description = (entity?.description || conversation?.greeting) ?? '';

  const getGreeting = useCallback(() => {
    if (typeof startupConfig?.interface?.customWelcome === 'string') {
      const customWelcome = startupConfig.interface.customWelcome;
      // Replace {{user.name}} with actual user name if available
      if (user?.name && customWelcome.includes('{{user.name}}')) {
        return customWelcome.replace(/{{user.name}}/g, user.name);
      }
      return customWelcome;
    }

    const now = new Date();
    const hours = now.getHours();

    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Early morning (midnight to 4:59 AM)
    if (hours >= 0 && hours < 5) {
      return localize('com_ui_late_night');
    }
    // Morning (6 AM to 11:59 AM)
    else if (hours < 12) {
      if (isWeekend) {
        return localize('com_ui_weekend_morning');
      }
      return localize('com_ui_good_morning');
    }
    // Afternoon (12 PM to 4:59 PM)
    else if (hours < 17) {
      return localize('com_ui_good_afternoon');
    }
    // Evening (5 PM to 8:59 PM)
    else {
      return localize('com_ui_good_evening');
    }
  }, [localize, startupConfig?.interface?.customWelcome, user?.name]);

  const handleLineCountChange = useCallback((count: number) => {
    setTextHasMultipleLines(count > 1);
    setLineCount(count);
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.offsetHeight);
    }
  }, [lineCount, description]);

  const getDynamicMargin = useMemo(() => {
    let margin = 'mb-0';

    if (lineCount > 2 || (description && description.length > 100)) {
      margin = 'mb-10';
    } else if (lineCount > 1 || (description && description.length > 0)) {
      margin = 'mb-6';
    } else if (textHasMultipleLines) {
      margin = 'mb-4';
    }

    if (contentHeight > 200) {
      margin = 'mb-16';
    } else if (contentHeight > 150) {
      margin = 'mb-12';
    }

    return margin;
  }, [lineCount, description, textHasMultipleLines, contentHeight]);

  const greetingText =
    typeof startupConfig?.interface?.customWelcome === 'string'
      ? getGreeting()
      : getGreeting() + (user?.name ? ', ' + user.name : '');

  const recommendationGroups = useMemo(
    () => [
      [
        {
          title: '整理今天的灵感',
          prompt: '帮我把今天零散的想法整理成 3 个可执行任务，并标出优先级。',
          tag: '规划',
        },
        {
          title: '写一版产品说明',
          prompt: '基于我的产品想法，写一版简洁、有购买欲的中文产品说明。',
          tag: '文案',
        },
        {
          title: '拆解一个页面',
          prompt: '请用设计师视角拆解这个页面的结构、视觉层级和可优化点。',
          tag: '设计',
        },
      ],
      [
        {
          title: '生成客服回复',
          prompt: '帮我写一条自然、直接、像真人打字的英文客服回复。',
          tag: '客服',
        },
        {
          title: '做竞品观察',
          prompt: '帮我把这个竞品按定位、价格、卖点、用户评价四栏做对比。',
          tag: '市场',
        },
        {
          title: '创建开发任务',
          prompt: '把这个需求拆成一个可交给工程师执行的小任务，包含验收标准。',
          tag: '开发',
        },
      ],
    ],
    [],
  );

  const chips = useMemo(() => ['品牌命名', 'Listing 优化', '页面审查', '代码排障', '社媒脚本'], []);

  const applyPrompt = useCallback(
    (prompt: string) => {
      methods.setValue('text', prompt, { shouldValidate: true, shouldDirty: true });
    },
    [methods],
  );

  const appendPrompt = useCallback(
    (prompt: string) => {
      const current = methods.getValues('text')?.trim();
      methods.setValue('text', current ? `${current}\n${prompt}` : prompt, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [methods],
  );

  const visibleTasks = recommendationGroups[taskPage % recommendationGroups.length];

  return (
    <div
      className={`flex h-full max-h-full transform-gpu flex-col items-center justify-center pb-7 transition-all duration-200 sm:pb-10 ${centerFormOnLanding ? 'pt-2 sm:pt-0' : ''} ${getDynamicMargin}`}
    >
      <div ref={contentRef} className="flex w-full max-w-5xl flex-col items-center gap-0 p-2">
        <div
          className={`flex ${textHasMultipleLines ? 'flex-col' : 'flex-col md:flex-row'} items-center justify-center gap-2`}
        >
          <div
            className={`relative size-14 justify-center rounded-full border border-white/10 bg-white/10 p-1 shadow-[0_16px_60px_rgba(0,0,0,0.28)] backdrop-blur ${textHasMultipleLines ? 'mb-2' : ''}`}
          >
            <ConvoIcon
              agentsMap={agentsMap}
              assistantMap={assistantMap}
              conversation={conversation}
              endpointsConfig={endpointsConfig}
              containerClassName={containerClassName}
              context="landing"
              className="h-2/3 w-2/3 text-black dark:text-white"
              size={54}
            />
            {startupConfig?.showBirthdayIcon && (
              <TooltipAnchor
                className="absolute bottom-[27px] right-2"
                description={localize('com_ui_happy_birthday')}
                aria-label={localize('com_ui_happy_birthday')}
              >
                <BirthdayIcon />
              </TooltipAnchor>
            )}
          </div>
          {((isAgent || isAssistant) && name) || name ? (
            <div className="flex flex-col items-center gap-0 p-2">
              <SplitText
                key={`split-text-${name}`}
                text={name}
                className={`${getTextSizeClass(name)} font-medium text-white`}
                delay={50}
                textAlign="center"
                animationFrom={{ opacity: 0, transform: 'translate3d(0,50px,0)' }}
                animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
                easing={easings.easeOutCubic}
                threshold={0}
                rootMargin="0px"
                onLineCountChange={handleLineCountChange}
              />
            </div>
          ) : (
            <SplitText
              key={`split-text-${greetingText}${user?.name ? '-user' : ''}`}
              text={greetingText}
              className={`${getTextSizeClass(greetingText)} font-medium text-white`}
              delay={50}
              textAlign="center"
              animationFrom={{ opacity: 0, transform: 'translate3d(0,50px,0)' }}
              animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
              easing={easings.easeOutCubic}
              threshold={0}
              rootMargin="0px"
              onLineCountChange={handleLineCountChange}
            />
          )}
        </div>
        {description && (
          <div className="animate-fadeIn mt-4 max-w-md text-center text-sm font-normal text-white/60">
            {description}
          </div>
        )}
        <div className="mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => applyPrompt(`围绕「${chip}」给我 3 个可直接执行的建议。`)}
              className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-sm text-white/75 transition hover:border-white/25 hover:bg-white/[0.12] hover:text-white"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="mt-5 grid w-full max-w-4xl grid-cols-1 gap-3 px-1 sm:grid-cols-3">
          {visibleTasks.map((task) => (
            <div
              key={task.title}
              className="group min-h-32 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left shadow-[0_18px_70px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.1]"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                  {task.tag}
                </span>
                <Wand2 className="size-4 text-white/40 transition group-hover:text-white/80" />
              </div>
              <button
                type="button"
                onClick={() => applyPrompt(task.prompt)}
                className="block w-full text-left text-sm font-medium text-white"
              >
                {task.title}
              </button>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/50">{task.prompt}</p>
              <div className="mt-4 flex items-center gap-2 opacity-90">
                <button
                  type="button"
                  onClick={() => appendPrompt(task.prompt)}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/15 hover:text-white"
                >
                  <Plus className="size-3.5" />
                  {addTaskLabel}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPrompt(
                      `请按「目标 / 背景 / 输出格式 / 验收标准」模板处理：\n${task.prompt}`,
                    )
                  }
                  className="rounded-full px-2.5 py-1 text-xs text-white/55 transition hover:bg-white/10 hover:text-white"
                >
                  {templateLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTaskPage((page) => page + 1)}
          className={cn(
            'mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-white/65 transition hover:border-white/20 hover:bg-white/[0.11] hover:text-white',
            visibleTasks.length === 0 && 'hidden',
          )}
        >
          <RefreshCw className="size-4" />
          {refreshLabel}
          <Sparkles className="size-4" />
        </button>
      </div>
    </div>
  );
}
