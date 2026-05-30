import React, { useMemo } from 'react';
import { TooltipAnchor } from '@librechat/client';
import { VisuallyHidden } from '@ariakit/react';
import { Bot, CheckCircle2 } from 'lucide-react';
import { getConfigDefaults } from 'librechat-data-provider';
import type { ModelSelectorProps } from '~/common';
import { ModelSelectorProvider, useModelSelectorContext } from './ModelSelectorContext';
import { ModelSelectorChatProvider } from './ModelSelectorChatContext';
import {
  chatModelProviderOrder,
  formatChatModelName,
  getSelectedIcon,
  isSelectableChatModel,
} from './utils';
import { CustomMenu as Menu, CustomMenuGroup, CustomMenuItem as MenuItem } from './CustomMenu';
import DialogManager from './DialogManager';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

const defaultInterface = getConfigDefaults().interface;

const HEZI_MODEL_ENDPOINT = 'HeZi newAPI';

function ModelSelectorContent() {
  const localize = useLocalize();

  const {
    // LibreChat
    modelSpecs,
    mappedEndpoints,
    endpointsConfig,
    // State
    searchValue,
    selectedValues,
    // Functions
    setSearchValue,
    setSelectedValues,
    handleSelectModel,
    // Dialog
    keyDialogOpen,
    onOpenChange,
    keyDialogEndpoint,
  } = useModelSelectorContext();

  const selectedIcon = useMemo(
    () =>
      getSelectedIcon({
        mappedEndpoints: mappedEndpoints ?? [],
        selectedValues,
        modelSpecs,
        endpointsConfig,
      }),
    [mappedEndpoints, selectedValues, modelSpecs, endpointsConfig],
  );
  const selectedDisplayValue = useMemo(() => {
    const selectedSpecModel = selectedValues.modelSpec
      ? modelSpecs.find((spec) => spec.name === selectedValues.modelSpec)?.preset?.model
      : null;
    const modelName = selectedSpecModel || selectedValues.model;

    if (modelName && isSelectableChatModel(modelName)) {
      return formatChatModelName(modelName);
    }

    return localize('com_ui_select_model');
  }, [localize, modelSpecs, selectedValues.model, selectedValues.modelSpec]);

  const directEndpoints = useMemo(() => {
    const heziEndpoint = mappedEndpoints?.find(
      (endpoint) => endpoint.value === HEZI_MODEL_ENDPOINT && (endpoint.models?.length ?? 0) > 0,
    );

    if (heziEndpoint) {
      return [heziEndpoint];
    }

    return (mappedEndpoints ?? []).filter((endpoint) => {
      const endpointValue = endpoint.value.toLowerCase();
      return (
        endpoint.models?.length &&
        (endpointValue.includes('openai') ||
          endpointValue.includes('anthropic') ||
          endpointValue.includes('google'))
      );
    });
  }, [mappedEndpoints]);

  const groupedModels = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const seen = new Set<string>();
    const groups: Record<
      (typeof chatModelProviderOrder)[number],
      Array<{
        endpoint: (typeof directEndpoints)[number];
        modelId: string;
        label: string;
      }>
    > = {
      GPT: [],
      Claude: [],
      Gemini: [],
    };

    directEndpoints.forEach((endpoint) => {
      endpoint.models?.forEach((model) => {
        const modelId = model.name;
        if (!isSelectableChatModel(modelId)) {
          return;
        }

        const provider = chatModelProviderOrder.find((entry) =>
          formatChatModelName(modelId).toLowerCase().startsWith(entry.toLowerCase()),
        );
        if (!provider) {
          return;
        }

        const label = formatChatModelName(modelId);
        const searchableValue = `${label} ${modelId}`.toLowerCase();
        if (normalizedSearch && !searchableValue.includes(normalizedSearch)) {
          return;
        }

        const dedupeKey = `${provider}:${modelId.toLowerCase()}`;
        if (seen.has(dedupeKey)) {
          return;
        }
        seen.add(dedupeKey);
        groups[provider].push({ endpoint, modelId, label });
      });
    });

    return groups;
  }, [directEndpoints, searchValue]);

  const hasVisibleModels = chatModelProviderOrder.some(
    (provider) => groupedModels[provider].length,
  );

  const trigger = (
    <TooltipAnchor
      aria-label={localize('com_ui_select_model')}
      description={localize('com_ui_select_model')}
      render={
        <button
          className="my-1 flex h-9 w-full max-w-[70vw] items-center justify-center gap-2 rounded-xl border border-border-light bg-presentation px-3 py-2 text-sm text-text-primary hover:bg-surface-active-alt"
          aria-label={localize('com_ui_select_model')}
        >
          {selectedIcon && React.isValidElement(selectedIcon) && (
            <div className="flex flex-shrink-0 items-center justify-center overflow-hidden">
              {selectedIcon}
            </div>
          )}
          {!selectedIcon && <Bot className="size-4 shrink-0 text-text-primary" />}
          <span className="flex-grow truncate text-left">{selectedDisplayValue}</span>
        </button>
      }
    />
  );

  return (
    <div className="relative flex w-full max-w-md flex-col items-center gap-2">
      <Menu
        values={selectedValues}
        onValuesChange={(values: Record<string, any>) => {
          setSelectedValues({
            endpoint: values.endpoint || '',
            model: values.model || '',
            modelSpec: values.modelSpec || '',
          });
        }}
        onSearch={(value) => setSearchValue(value)}
        combobox={<input id="model-search" placeholder=" " />}
        comboboxLabel={localize('com_endpoint_search_models')}
        trigger={trigger}
      >
        {!hasVisibleModels && (
          <div className="cursor-default px-3 py-3 text-sm text-text-secondary" role="status">
            {localize('com_files_no_results')}
          </div>
        )}
        {chatModelProviderOrder.map((provider) =>
          groupedModels[provider].length ? (
            <CustomMenuGroup key={provider} label={provider}>
              {groupedModels[provider].map(({ endpoint, modelId, label }) => {
                const selectedSpecModel = selectedValues.modelSpec
                  ? modelSpecs.find((spec) => spec.name === selectedValues.modelSpec)?.preset?.model
                  : null;
                const isSelected =
                  selectedValues.model === modelId ||
                  selectedSpecModel === modelId ||
                  (!selectedValues.modelSpec &&
                    selectedValues.endpoint === endpoint.value &&
                    selectedValues.model === modelId);

                return (
                  <MenuItem
                    key={`${endpoint.value}-${modelId}`}
                    onClick={() => handleSelectModel(endpoint, modelId)}
                    aria-selected={isSelected || undefined}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm',
                      isSelected && 'bg-surface-active-alt',
                    )}
                  >
                    <span className="min-w-0 truncate text-left">{label}</span>
                    {isSelected && (
                      <>
                        <CheckCircle2 className="size-4 shrink-0 text-text-primary" />
                        <VisuallyHidden>{localize('com_a11y_selected')}</VisuallyHidden>
                      </>
                    )}
                  </MenuItem>
                );
              })}
            </CustomMenuGroup>
          ) : null,
        )}
      </Menu>
      <DialogManager
        keyDialogOpen={keyDialogOpen}
        onOpenChange={onOpenChange}
        endpointsConfig={endpointsConfig || {}}
        keyDialogEndpoint={keyDialogEndpoint || undefined}
      />
    </div>
  );
}

export default function ModelSelector({ startupConfig }: ModelSelectorProps) {
  const interfaceConfig = startupConfig?.interface ?? defaultInterface;
  const modelSpecs = startupConfig?.modelSpecs?.list ?? [];

  // Hide the selector when modelSelect is false and there are no model specs to show
  if (interfaceConfig.modelSelect === false && modelSpecs.length === 0) {
    return null;
  }

  return (
    <ModelSelectorChatProvider>
      <ModelSelectorProvider startupConfig={startupConfig}>
        <ModelSelectorContent />
      </ModelSelectorProvider>
    </ModelSelectorChatProvider>
  );
}
