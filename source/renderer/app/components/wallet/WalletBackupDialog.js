// @flow
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import WalletBackupPrivacyWarningDialog from './backup-recovery/WalletBackupPrivacyWarningDialog';
import WalletRecoveryPhraseDisplayDialog from './backup-recovery/WalletRecoveryPhraseDisplayDialog';
import WalletRecoveryPhraseEntryDialog from './backup-recovery/WalletRecoveryPhraseEntryDialog';
import type { walletBackupStep } from '../../types/walletBackupTypes';
import { WALLET_BACKUP_STEPS } from '../../types/walletBackupTypes';

type Props = {
  currentStep: walletBackupStep,
  canPhraseBeShown: boolean,
  isPrivacyNoticeAccepted: boolean,
  countdownRemaining: number,
  isTermOfflineAccepted: boolean,
  canFinishBackup: boolean,
  isTermRecoveryAccepted: boolean,
  isTermRewardsAccepted: boolean,
  isValid: boolean,
  isSubmitting: boolean,
  isShelleyActivated: boolean,
  recoveryPhrase: string,
  enteredPhrase: Array<string>,
  onCancelBackup: Function,
  onAcceptPrivacyNotice: Function,
  onContinue: Function,
  onStartWalletBackup: Function,
  onAcceptTermOffline: Function,
  onAcceptTermRecovery: Function,
  onAcceptTermRewards: Function,
  onUpdateVerificationPhrase: Function,
  onFinishBackup: Function,
  onRestartBackup: Function,
};

@observer
export default class WalletBackupDialog extends Component<Props> {
  render() {
    const {
      currentStep,
      onCancelBackup,
      canPhraseBeShown,
      isPrivacyNoticeAccepted,
      countdownRemaining,
      onAcceptPrivacyNotice,
      onContinue,
      recoveryPhrase,
      onStartWalletBackup,
      isTermOfflineAccepted,
      enteredPhrase,
      canFinishBackup,
      isTermRecoveryAccepted,
      isTermRewardsAccepted,
      isValid,
      isSubmitting,
      onAcceptTermOffline,
      onAcceptTermRecovery,
      onAcceptTermRewards,
      onUpdateVerificationPhrase,
      onFinishBackup,
      onRestartBackup,
      isShelleyActivated,
    } = this.props;

    if (currentStep === WALLET_BACKUP_STEPS.PRIVACY_WARNING) {
      return (
        <WalletBackupPrivacyWarningDialog
          canPhraseBeShown={canPhraseBeShown}
          isPrivacyNoticeAccepted={isPrivacyNoticeAccepted}
          countdownRemaining={countdownRemaining}
          isShelleyActivated={isShelleyActivated}
          onAcceptPrivacyNotice={onAcceptPrivacyNotice}
          onCancelBackup={onCancelBackup}
          onContinue={onContinue}
        />
      );
    }
    if (currentStep === WALLET_BACKUP_STEPS.RECOVERY_PHRASE_DISPLAY) {
      return (
        <WalletRecoveryPhraseDisplayDialog
          recoveryPhrase={recoveryPhrase}
          onStartWalletBackup={onStartWalletBackup}
          onCancelBackup={onCancelBackup}
          isShelleyActivated={isShelleyActivated}
        />
      );
    }
    if (currentStep === WALLET_BACKUP_STEPS.RECOVERY_PHRASE_ENTRY) {
      return (
        <WalletRecoveryPhraseEntryDialog
          isTermOfflineAccepted={isTermOfflineAccepted}
          enteredPhrase={enteredPhrase}
          canFinishBackup={canFinishBackup}
          isTermRecoveryAccepted={isTermRecoveryAccepted}
          isTermRewardsAccepted={isTermRewardsAccepted}
          isValid={isValid}
          isShelleyActivated={isShelleyActivated}
          isSubmitting={isSubmitting}
          onAcceptTermOffline={onAcceptTermOffline}
          onAcceptTermRecovery={onAcceptTermRecovery}
          onAcceptTermRewards={onAcceptTermRewards}
          onUpdateVerificationPhrase={onUpdateVerificationPhrase}
          onCancelBackup={onCancelBackup}
          onFinishBackup={onFinishBackup}
          onRestartBackup={onRestartBackup}
        />
      );
    }
    return null;
  }
}
