// @flow
import { DownloaderHelper } from 'node-downloader-helper';
import fs from 'fs';
import type { BrowserWindow } from 'electron';
import { MainIpcChannel } from './lib/MainIpcChannel';
import {
  getOriginalFilename,
  getPathFromDirectoryName,
  getEventActions,
  getIdFromFileName,
} from '../utils/downloadManager';
import {
  REQUEST_DOWNLOAD,
  RESUME_DOWNLOAD,
  DELETE_DOWNLOADED_FILE,
  GET_DOWNLOAD_LOCAL_DATA,
  GET_DOWNLOADS_LOCAL_DATA,
  CLEAR_DOWNLOAD_LOCAL_DATA,
} from '../../common/ipc/api';
import {
  DEFAULT_DIRECTORY_NAME,
  TEMPORARY_FILENAME,
} from '../../common/config/downloadManagerConfig';
import { generateFileNameWithTimestamp } from '../../common/utils/files.js';
import { downloadManagerLocalStorage as localStorage } from '../utils/mainLocalStorage';
import type {
  DownloadRendererRequest,
  DownloadMainResponse,
  ResumeDownloadRendererRequest,
  ResumeDownloadMainResponse,
  DeleteDownloadedFileRendererRequest,
  DeleteDownloadedFileMainResponse,
  DownloadLocalDataRendererRequest,
  DownloadLocalDataMainResponse,
  DownloadsLocalDataRendererRequest,
  DownloadsLocalDataMainResponse,
  ClearDownloadLocalDataRendererRequest,
  ClearDownloadLocalDataMainResponse,
} from '../../common/ipc/api';

localStorage.setAllStopped();

const requestDownload = async (
  downloadRequestPayload: DownloadRendererRequest,
  window: BrowserWindow
): Promise<any> => {
  const {
    fileUrl,
    destinationDirectoryName = DEFAULT_DIRECTORY_NAME,
    // options,
    options: _options,
    id,
    resumeDownload,
  } = downloadRequestPayload;
  const temporaryFilename = resumeDownload
    ? resumeDownload.temporaryFilename
    : generateFileNameWithTimestamp(TEMPORARY_FILENAME);
  const originalFilename = getOriginalFilename(downloadRequestPayload);
  const destinationPath = getPathFromDirectoryName(destinationDirectoryName);
  const options = {
    ..._options,
    fileName: temporaryFilename,
  };
  const downloadId = getIdFromFileName(id || originalFilename);
  const info = {
    downloadId,
    fileUrl,
    destinationPath,
    destinationDirectoryName,
    temporaryFilename,
    originalFilename,
    options,
  };
  const eventActions = await getEventActions(
    info,
    window,
    requestDownloadChannel
  );
  const download = new DownloaderHelper(fileUrl, destinationPath, options);

  if (resumeDownload) {
    const { total: downloadSize } = await download.getTotalSize(); // get the total size from the server
    download.__total = downloadSize;
    download.__filePath = `${info.destinationPath}/${info.temporaryFilename}`;
    download.__downloaded = download.__getFilesizeInBytes(download.__filePath);
    download.__isResumable = true;
  }

  let currentDownloadData = 0;

  const progressType =
    options.progressIsThrottled === false ? 'progress' : 'progress.throttled';

  download.on('start', eventActions.start);
  download.on('download', eventActions.download);
  download.on(progressType, evt => {
    if (!evt || parseInt(evt.progress, 10) === currentDownloadData) return;
    currentDownloadData++;
    eventActions.progress(evt);
  });
  download.on('end', eventActions.end);
  download.on('error', eventActions.error);
  if (resumeDownload) download.resume();
  else download.start();
  return download;
};

const requestResumeDownload = async (
  resumeDownloadRequestPayload: ResumeDownloadRendererRequest,
  window: BrowserWindow
): Promise<any> => {
  const downloadLocalData = await getDownloadLocalData(
    resumeDownloadRequestPayload
  );
  const {
    temporaryFilename,
    originalFilename,
    downloadId: id,
    fileUrl,
    destinationDirectoryName,
    destinationPath,
    options,
  } = downloadLocalData.info || {};
  if (!id) throw new Error('Invalid download ID');
  const filePath = `${destinationPath}/${temporaryFilename}`;
  let requestDownloadPayload = {
    id,
    fileUrl,
    destinationDirectoryName,
    options,
  };
  // Check if the file to be resumed still exists
  // Otherwise it's a new download request
  if (fs.existsSync(filePath)) {
    requestDownloadPayload = {
      ...requestDownloadPayload,
      resumeDownload: { temporaryFilename, originalFilename },
    };
  }
  return requestDownload(
    {
      ...requestDownloadPayload,
      override: true,
    },
    window
  );
};

// @UPDATE TODO
const deleteDownloadedFile = async ({
  id,
}: DeleteDownloadedFileRendererRequest): Promise<DeleteDownloadedFileMainResponse> => {
  const downloadLocalData = await getDownloadLocalData({ id });
  const { originalFilename, fileUrl, destinationDirectoryName, options } =
    downloadLocalData.info || {};
  console.log('originalFilename', originalFilename);
  console.log('fileUrl', fileUrl);
  console.log('destinationDirectoryName', destinationDirectoryName);
  console.log('options', options);
};

const getDownloadLocalData = async ({
  fileName,
  id = fileName,
}: DownloadLocalDataRendererRequest): Promise<DownloadLocalDataMainResponse> => {
  if (!id) throw new Error('Requires `id` or `fileName`');
  const downloadId: string = getIdFromFileName(String(id));
  return localStorage.get(downloadId);
};

const getDownloadsLocalData = async (): Promise<DownloadsLocalDataMainResponse> =>
  localStorage.getAll();

const clearDownloadLocalData = async ({
  fileName,
  id = fileName,
}: ClearDownloadLocalDataRendererRequest): Promise<ClearDownloadLocalDataMainResponse> => {
  if (!id) throw new Error('Requires `id` or `fileName`');
  const downloadId: string = getIdFromFileName(String(id));
  console.log('downloadId', downloadId);
  return localStorage.unset(downloadId);
};

const requestDownloadChannel: // IpcChannel<Incoming, Outgoing>
MainIpcChannel<
  DownloadRendererRequest,
  DownloadMainResponse
> = new MainIpcChannel(REQUEST_DOWNLOAD);
const requestResumeDownloadChannel: // IpcChannel<Incoming, Outgoing>
MainIpcChannel<
  ResumeDownloadRendererRequest,
  ResumeDownloadMainResponse
> = new MainIpcChannel(RESUME_DOWNLOAD);

const deleteDownloadedFileChannel: // IpcChannel<Incoming, Outgoing>
MainIpcChannel<
  DeleteDownloadedFileRendererRequest,
  DeleteDownloadedFileMainResponse
> = new MainIpcChannel(DELETE_DOWNLOADED_FILE);

const getDownloadLocalDataChannel: // IpcChannel<Incoming, Outgoing>
MainIpcChannel<
  DownloadLocalDataRendererRequest,
  DownloadLocalDataMainResponse
> = new MainIpcChannel(GET_DOWNLOAD_LOCAL_DATA);
const getDownloadsLocalDataChannel: // IpcChannel<Incoming, Outgoing>
MainIpcChannel<
  DownloadsLocalDataRendererRequest,
  DownloadsLocalDataMainResponse
> = new MainIpcChannel(GET_DOWNLOADS_LOCAL_DATA);
const clearDownloadLocalDataChannel: // IpcChannel<Incoming, Outgoing>
MainIpcChannel<
  ClearDownloadLocalDataRendererRequest,
  ClearDownloadLocalDataMainResponse
> = new MainIpcChannel(CLEAR_DOWNLOAD_LOCAL_DATA);

export const downloadManagerChannel = (window: BrowserWindow) => {
  requestDownloadChannel.onRequest(
    (downloadRequestPayload: DownloadRendererRequest) =>
      requestDownload(downloadRequestPayload, window)
  );
  requestResumeDownloadChannel.onRequest(
    (resumeDownloadRequestPayload: ResumeDownloadRendererRequest) =>
      requestResumeDownload(resumeDownloadRequestPayload, window)
  );
  deleteDownloadedFileChannel.onRequest(deleteDownloadedFile);

  getDownloadLocalDataChannel.onRequest(getDownloadLocalData);
  getDownloadsLocalDataChannel.onRequest(getDownloadsLocalData);
  clearDownloadLocalDataChannel.onRequest(clearDownloadLocalData);
};
