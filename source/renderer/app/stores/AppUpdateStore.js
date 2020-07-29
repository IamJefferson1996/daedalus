// @flow
import { action, computed, observable, runInAction } from 'mobx';
import { get } from 'lodash';
import semver from 'semver';
import Store from './lib/Store';
import Request from './lib/LocalizedRequest';
import NewsDomains from '../domains/News';
import {
  requestDownloadChannel,
  requestResumeDownloadChannel,
  deleteDownloadedFile,
  getDownloadLocalDataChannel,
  clearDownloadLocalDataChannel,
} from '../ipc/downloadManagerChannel';
import { quitAppAndAppInstallUpdateChannel } from '../ipc/quitAppAndAppInstallUpdateChannel';
import type {
  DownloadMainResponse,
  DownloadLocalDataMainResponse,
} from '../../../common/ipc/api';
import { formattedDownloadData } from '../utils/formatters.js';
import {
  DOWNLOAD_EVENT_TYPES,
  DOWNLOAD_STATES,
} from '../../../common/config/downloadManagerConfig';
import type { SoftwareUpdateInfo } from '../api/news/types';
import type {
  DownloadInfo,
  DownloadData,
} from '../../../common/types/downloadManager.types';
import type { FormattedDownloadData } from '../utils/formatters.js';

const { version: currentVersion, platform } = global.environment;
const { News } = NewsDomains;
const APP_UPDATE_DOWNLOAD_ID = 'appUpdate';

export default class AppUpdateStore extends Store {
  @observable availableUpdate: ?News = null;
  @observable availableUpdateVersion: string = '';
  @observable isUpdateDownloading: boolean = false;
  @observable isUpdateDownloaded: boolean = false;
  @observable isUpdateInstalled: boolean = false;
  @observable isAutomaticUpdateFailed: boolean = false;
  @observable isUpdateProgressOpen: boolean = false;

  @observable downloadInfo: ?DownloadInfo = null;
  @observable downloadData: ?DownloadData = null;

  @observable isUpdateAvailable: boolean = true;
  @observable availableAppVersion: ?string = null;
  @observable isNewAppVersionAvailable: boolean = false;
  @observable applicationVersion: ?number = null;

  @observable getAppAutomaticUpdateFailedRequest: Request<
    Promise<boolean>
  > = new Request(this.api.localStorage.getAppAutomaticUpdateFailed);
  @observable setAppAutomaticUpdateFailedRequest: Request<
    Promise<void>
  > = new Request(this.api.localStorage.setAppAutomaticUpdateFailed);
  @observable unsetAppAutomaticUpdateFailedRequest: Request<
    Promise<void>
  > = new Request(this.api.localStorage.unsetAppAutomaticUpdateFailed);

  setup() {
    const actions = this.actions.appUpdate;
    actions.installUpdate.listen(this._installUpdate);
    actions.openAppUpdateOverlay.listen(this._openAppUpdateOverlay);
    actions.closeAppUpdateOverlay.listen(this._closeAppUpdateOverlay);

    requestDownloadChannel.onReceive(this._manageUpdateResponse);

    // ============== MOBX REACTIONS ==============
    this.registerReactions([this._watchForNewsfeedUpdates]);
  }

  // ================= REACTIONS ==================

  _watchForNewsfeedUpdates = () => {
    const { update } = this.stores.newsFeed.newsFeedData;
    if (update) this._checkNewAppUpdate(update);
  };

  // ==================== PUBLIC ==================

  @computed get displayAppUpdateOverlay(): boolean {
    return (
      !!this.availableUpdate &&
      (this.isUpdateProgressOpen ||
        this.isUpdateDownloaded ||
        this.isAutomaticUpdateFailed)
    );
  }
  @computed get displayAppUpdateNewsItem(): boolean {
    return this.isUpdateDownloading;
  }

  @computed get formattedDownloadData(): FormattedDownloadData {
    return formattedDownloadData(this.downloadData);
  }

  @computed get downloadTimeLeft(): string {
    return this.formattedDownloadData.timeLeft;
  }

  @computed get totalDownloaded(): string {
    return this.formattedDownloadData.downloaded;
  }

  @computed get totalDownloadSize(): string {
    return this.formattedDownloadData.total;
  }

  @computed get downloadProgress(): number {
    return this.formattedDownloadData.progress;
  }

  @computed get showManualUpdate(): boolean {
    return this.isAutomaticUpdateFailed;
  }

  getUpdateInfo(update: News): SoftwareUpdateInfo {
    const softwareUpdate = get(update, 'softwareUpdate', {});
    const { version, hash, url } = softwareUpdate[platform] || {};
    return { version, hash, url };
  }

  isUpdateValid = (update: News) => {
    const { version: updateVersion } = this.getUpdateInfo(update);
    console.log('updateVersion', updateVersion);
    console.log('currentVersion', currentVersion);
    return semver.lt(currentVersion, updateVersion);
  };

  isUnfinishedDownloadValid = async (
    unfinishedDownload: DownloadLocalDataMainResponse
  ) => {
    console.log('unfinishedDownload', unfinishedDownload);
    return true;
  };

  // =================== PRIVATE ==================

  // @UPDATE TODO: Remove it
  @action _toggleUsUpdateDownloaded = () => {
    this.isUpdateDownloaded = !this.isUpdateDownloaded;
  };

  // @UPDATE TODO: Commenting the trigger to avoid automatic download
  _checkNewAppUpdate = async (update: News) => {
    // Is there an 'Automatic Update Failed' flag?
    const isAutomaticUpdateFailed = await this.getAppAutomaticUpdateFailedRequest.execute();
    console.log('isAutomaticUpdateFailed', isAutomaticUpdateFailed);
    if (isAutomaticUpdateFailed) {
      runInAction(() => {
        this.isAutomaticUpdateFailed = true;
      });
    }

    // Is the update valid?
    if (!this.isUpdateValid(update)) {
      await this._removeUpdateFile();
      await this._removeLocalDataInfo();
      return;
    }

    const { version } = this.getUpdateInfo(update);

    runInAction(() => {
      this.availableUpdate = update;
      this.availableUpdateVersion = version;
    });

    // Is there a pending / resumabl\e download?
    const downloadLocalData = await this._getUpdateDownloadLocalData();
    const { info, data } = downloadLocalData;
    if (info && data) {
      if (data.state === DOWNLOAD_STATES.FINISHED && data.progress === 100) {
        runInAction(() => {
          this.downloadInfo = info;
          this.downloadData = data;
          this.isUpdateDownloaded = true;
        });
        return;
      }

      if (this.isUnfinishedDownloadValid(downloadLocalData)) {
        // this._requestResumeUpdateDownload();
        return;
      }
    }
    // await this._removeLocalDataInfo();
    // this._requestUpdateDownload(update);
  };

  _removeLocalDataInfo = async () => {
    clearDownloadLocalDataChannel.request({
      id: APP_UPDATE_DOWNLOAD_ID,
    });
  };

  // @UPDATE TODO: Implement this method
  _removeUpdateFile = () => {
    deleteDownloadedFile.request({
      id: APP_UPDATE_DOWNLOAD_ID,
    });
  };

  _getUpdateDownloadLocalData = async (): Promise<DownloadLocalDataMainResponse> =>
    getDownloadLocalDataChannel.request({
      id: APP_UPDATE_DOWNLOAD_ID,
    });

  _manageUpdateResponse = ({ eventType, info, data }: DownloadMainResponse) => {
    if (eventType === DOWNLOAD_EVENT_TYPES.PROGRESS) {
      runInAction(() => {
        this.downloadInfo = info;
        this.downloadData = data;
      });
      console.log('Progress', data.progress);
    }
    runInAction('updates the download information', () => {
      if (eventType === DOWNLOAD_EVENT_TYPES.END) {
        this.isUpdateDownloading = false;
        this.isUpdateDownloaded = true;
      } else {
        this.isUpdateDownloading = true;
      }
    });
    return Promise.resolve({ fileUrl: '' });
  };

  _requestResumeUpdateDownload = async () => {
    await requestResumeDownloadChannel.request({
      id: APP_UPDATE_DOWNLOAD_ID,
      options: {
        progressIsThrottled: false,
        persistLocalData: true,
      },
    });
  };

  _requestUpdateDownload = async (update: News) => {
    const { url: fileUrl } = this.getUpdateInfo(update);
    if (!fileUrl) return null;
    return requestDownloadChannel.request({
      id: APP_UPDATE_DOWNLOAD_ID,
      fileUrl,
      options: {
        progressIsThrottled: false,
        persistLocalData: true,
      },
    });
  };

  @action _installUpdate = async () => {
    if (
      !this.availableUpdate ||
      this.isUpdateDownloading ||
      !this.isUpdateDownloaded ||
      !this.downloadInfo
    ) {
      console.log('!this.availableUpdate', !this.availableUpdate);
      console.log('this.isUpdateDownloading', this.isUpdateDownloading);
      console.log('!this.isUpdateDownloaded', !this.isUpdateDownloaded);
      console.log('!this.downloadInfo', !this.downloadInfo);
      return;
    }
    const { destinationPath, originalFilename } = this.downloadInfo;
    const filePath = `${destinationPath}/${originalFilename}`;
    const openInstaller = await quitAppAndAppInstallUpdateChannel.request(
      filePath
    );
    if (!openInstaller) {
      await this.setAppAutomaticUpdateFailedRequest.execute();
      runInAction(() => {
        this.isAutomaticUpdateFailed = true;
      });
    }
  };

  @action _openAppUpdateOverlay = () => {
    this.isUpdateProgressOpen = true;
  };

  @action _closeAppUpdateOverlay = () => {
    this.isUpdateProgressOpen = false;
  };
}
