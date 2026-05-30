import React from 'react';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import TokenCreditsItem from './TokenCreditsItem';
import AutoRefillSettings from './AutoRefillSettings';

function Balance() {
  const localize = useLocalize();
  const { isAuthenticated } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();

  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && !!startupConfig?.balance?.enabled,
  });
  const balanceData = balanceQuery.data;

  // Pull out all the fields we need, with safe defaults
  const {
    tokenCredits = 0,
    autoRefillEnabled = false,
    lastRefill,
    refillAmount,
    refillIntervalUnit,
    refillIntervalValue,
  } = balanceData ?? {};

  // Check that all auto-refill props are present
  const hasValidRefillSettings =
    lastRefill !== undefined &&
    refillAmount !== undefined &&
    refillIntervalUnit !== undefined &&
    refillIntervalValue !== undefined;

  let autoRefillContent = (
    <div className="text-sm text-text-secondary">
      {localize('com_nav_balance_auto_refill_disabled')}
    </div>
  );

  if (autoRefillEnabled && hasValidRefillSettings) {
    autoRefillContent = (
      <AutoRefillSettings
        lastRefill={lastRefill}
        refillAmount={refillAmount}
        refillIntervalUnit={refillIntervalUnit}
        refillIntervalValue={refillIntervalValue}
      />
    );
  } else if (autoRefillEnabled) {
    autoRefillContent = (
      <div className="text-sm text-red-600">{localize('com_nav_balance_auto_refill_error')}</div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 text-sm text-text-primary">
      {/* Token credits display */}
      <TokenCreditsItem tokenCredits={tokenCredits} />

      {/* Auto-refill display */}
      {autoRefillContent}
    </div>
  );
}

export default React.memo(Balance);
