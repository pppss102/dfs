"use client";
import log from "electron-log/renderer";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  Clock,
  Download,
  HardDrive,
  Star,
  Upload,
  Activity,
  FileText,
  Scroll,
  Shield,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Progress } from "./ui/progress";
import { backendService } from "../IpcService/BackendService";
import type { Folder } from "../lib/types";
import type { DataUsage } from "../IpcService/BackendService";
import {
  formatProgress,
  calculatePercentage,
  formatFileSize,
  createPollCallback,
} from "../lib/utils";
import { DownloadManager } from "./download-manager";
import { BlockedPeersDialog } from "./blocked-peers-dialog";

interface SidebarProps {
  readonly currentFolder: string | null;
  readonly navigateToFolder: (folderId: string | null) => void;
  readonly folders: Folder[];
  readonly onContainerDownloaded?: () => void;
  readonly onContainerPublished?: () => void;
}

export function Sidebar({
  currentFolder,
  navigateToFolder,
  folders,
  onContainerDownloaded,
  onContainerPublished,
}: SidebarProps) {
  // Get root folders from the passed folders prop
  const rootFolders = folders.filter((folder) => folder.parentId.length === 0);

  // State for publish dialog
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [publishTrackerUri, setPublishTrackerUri] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<boolean | null>(null);

  // State for download dialog
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadContainerGuid, setDownloadContainerGuid] = useState("");
  const [downloadTrackerUri, setDownloadTrackerUri] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean | null>(null);
  const [downloadDestination, setDownloadDestination] = useState<string>("");
  const [activeContainerDownloadIds, setActiveContainerDownloadIds] = useState<
    string[]
  >([]);
  const [containerDownloadProgress, setContainerDownloadProgress] = useState({
    filesTotal: 0,
    filesCompleted: 0,
    bytesTotal: 0,
    bytesReceived: 0,
  });

  // State for download manager
  const [downloadManagerOpen, setDownloadManagerOpen] = useState(false);
  const [activeDownloadIds, setActiveDownloadIds] = useState<string[]>([]);
  const [dataUsage, setDataUsage] = useState<DataUsage | null>(null);

  // State for blocked peers dialog
  const [blockedPeersDialogOpen, setBlockedPeersDialogOpen] = useState(false);

  // Calculate download percentage
  const downloadPercentage = calculatePercentage(
    containerDownloadProgress.bytesReceived,
    containerDownloadProgress.bytesTotal,
  );

  // Listen for custom event to open download dialog
useEffect(() => {
  const handleOpenDownloadDialog = (event: CustomEvent) => {
    const { containerGuid, trackerUri } = event.detail;
    setDownloadContainerGuid(containerGuid);
    setDownloadTrackerUri(trackerUri);
    setDownloadDialogOpen(true);
  };

  window.addEventListener(
    "openDownloadDialog",
    handleOpenDownloadDialog as EventListener
  );

  return () => {
    window.removeEventListener(
      "openDownloadDialog",
      handleOpenDownloadDialog as EventListener
    );
  };
}, []);

  // // Fetch data usage periodically
  // const fetchDataUsage = async () => {
  //   try {
  //     const usage = await backendService.GetDataUsage();
  //     setDataUsage(usage);
  //   } catch (error) {
  //     log.error("Failed to fetch data usage:", error);
  //   }
  // };

useEffect(() => {
  const fetchData = async () => {
    try {
      const usage = await backendService.GetDataUsage();
      setDataUsage(usage);
    } catch (error) {
      log.error("Failed to fetch data usage:", error);
    }
  };

  fetchData(); // Initial call
  const intervalId = setInterval(fetchData, 1000);

  return () => {
  
    clearInterval(intervalId); // Cleanup: clear the interval
  };
}, []); 

  const fetchProgress = async () => {
    try {
      if (activeContainerDownloadIds.length === 0) return;
      let filesTotal = 0;
      let filesCompleted = 0;
      let bytesTotal = 0;
      let bytesReceived = 0;
      let allCompleted = true;

      // Fetch progress for each file in the container
      for (const downloadId of activeContainerDownloadIds) {
        const progress = await backendService.GetDownloadProgress(downloadId);
        filesTotal++;
        bytesTotal += progress.totalBytes;
        bytesReceived += progress.receivedBytes;

        if (progress.status === "completed") {
          filesCompleted++;
        } else if (progress.status === "active") {
          allCompleted = false;
        }
      }

      // Update container download progress
      setContainerDownloadProgress({
        filesTotal,
        filesCompleted,
        bytesTotal,
        bytesReceived,
      });

      // If all files are completed, trigger the onContainerDownloaded callback
      if (allCompleted && filesTotal > 0 && filesCompleted === filesTotal) {
        setIsDownloading(false);

        // Close dialog after a short delay to show success state
        setTimeout(() => {
          setDownloadDialogOpen(false);
          setDownloadContainerGuid("");
          setDownloadTrackerUri("");
          setDownloadDestination("");
          setDownloadSuccess(null);
          setActiveContainerDownloadIds([]);
          setContainerDownloadProgress({
            filesTotal: 0,
            filesCompleted: 0,
            bytesTotal: 0,
            bytesReceived: 0,
          });
        }, 1500);

        if (onContainerDownloaded) {
          onContainerDownloaded();
        }
      }
    } catch (error) {
      log.error("Failed to fetch download progress:", error);
    }
  };

  // Update container download progress
  useEffect(createPollCallback(fetchProgress, 500), [
    activeContainerDownloadIds,
    onContainerDownloaded,
  ]);

  // Handle publish to tracker
  const handlePublish = async () => {
    if (!selectedContainer || !publishTrackerUri) return;

    setIsPublishing(true);
    setPublishSuccess(null);

    try {
      await backendService.publishToTracker(
        selectedContainer,
        publishTrackerUri,
      );
      setPublishSuccess(true);

      // Close dialog after a short delay to show success state
      setTimeout(() => {
        setPublishDialogOpen(false);
        setSelectedContainer("");
        setPublishTrackerUri("");
        setPublishSuccess(null);

        // Trigger refresh of container list
        if (onContainerPublished) {
          onContainerPublished();
        }
      }, 1500);
    } catch (error) {
      log.error("Failed to publish:", error);
      setPublishSuccess(false);
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle download container
  const handleDownload = async () => {
    if (!downloadContainerGuid || !downloadTrackerUri) return;

    setIsDownloading(true);
    setDownloadSuccess(null);

    try {
      // Start the download and get the download IDs for each file
      const downloadIds = await backendService.downloadContainer(
        downloadContainerGuid,
        downloadTrackerUri,
        downloadDestination ?? undefined,
      );

      // Add to active downloads list
      setActiveDownloadIds((prev) => [...prev, ...downloadIds]);

      setDownloadSuccess(true);

      // Keep the dialog open for a moment to show success state
      setTimeout(() => {
        setDownloadDialogOpen(false);
        setDownloadContainerGuid("");
        setDownloadTrackerUri("");
        setDownloadDestination("");
        setDownloadSuccess(null);
      }, 1500);
    } catch (error) {
      log.error("Failed to download:", error);
      setDownloadSuccess(false);
      setIsDownloading(false);
    }
  };

  // Handle opening logs
  const handleOpenLogs = async () => {
    console.log("Opening logs via UI API...");//example

    try {

      await backendService.RevealLogFile();

    } catch (error) {
      console.error("Failed to open logs:", error);
    }
  };
  return (
    <div className="w-64 border-r bg-background p-4 hidden md:block">
      <div className="space-y-1">
        <Button
          variant="ghost"
          className={`w-full justify-start ${
            currentFolder === null ? "bg-muted" : ""
          }`}
          onClick={() => navigateToFolder(null)}
        >
          <HardDrive className="mr-2 h-4 w-4" />
          My Drive
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <Clock className="mr-2 h-4 w-4" />
          Recent
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <Star className="mr-2 h-4 w-4" />
          Starred
        </Button>
      </div>

      <div className="mt-6 space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setPublishDialogOpen(true)}
        >
          <Upload className="mr-2 h-4 w-4" />
          Publish to Tracker
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setDownloadDialogOpen(true)}
        >
          <Download className="mr-2 h-4 w-4" />
          Download Container
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setDownloadManagerOpen(true)}
        >
          <Activity className="mr-2 h-4 w-4" />
          Transfer Manager
          {activeDownloadIds.length > 0 && (
            <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
              {activeDownloadIds.length}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleOpenLogs}
        >
          <Scroll className="mr-2 h-4 w-4" />
          Open Logs
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setBlockedPeersDialogOpen(true)}
        >
          <Shield className="mr-2 h-4 w-4" />
          Blocked Peers
        </Button>
      </div>

      {/* Data Usage Summary */}
      {dataUsage && (
        <div className="mt-6 border rounded-md p-3 bg-muted/30">
          <h3 className="text-sm font-medium mb-2">Data Usage</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Downloaded:</span>
              <span>{formatFileSize(dataUsage.totalBytesReceived)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uploaded:</span>
              <span>{formatFileSize(dataUsage.totalBytesSent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total:</span>
              <span>
                {formatFileSize(
                  dataUsage.totalBytesReceived + dataUsage.totalBytesSent,
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium">My folders</h3>
        {rootFolders.length === 0 ? (
          <div className="py-2 px-3 text-sm text-muted-foreground italic">
            No folders available
          </div>
        ) : (
          <div className="space-y-1">
            {rootFolders.map((folder) => (
              <Button
                key={folder.id}
                variant="ghost"
                className={`w-full justify-start ${
                  currentFolder === folder.id ? "bg-muted" : ""
                }`}
                onClick={() => navigateToFolder(folder.id)}
              >
                {folder.hasChildren ? (
                  <ChevronRight className="mr-2 h-4 w-4" />
                ) : (
                  <span className="mr-2 w-4" />
                )}
                {folder.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Publish to Tracker Dialog */}
      <Dialog
        open={publishDialogOpen}
        onOpenChange={(open) => {
          if (!isPublishing) {
            setPublishDialogOpen(open);
            if (!open) {
              setPublishSuccess(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Publish to Tracker</DialogTitle>
            <DialogDescription>
              Select a container and enter a tracker URI to publish your
              container.
            </DialogDescription>
          </DialogHeader>

          {publishSuccess === true && (
            <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Container published successfully!
            </div>
          )}

          {publishSuccess === false && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              Failed to publish container. Please try again.
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right text-sm font-medium">Container</div>
              <select
                value={selectedContainer}
                onChange={(e) => setSelectedContainer(e.target.value)}
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={isPublishing}
              >
                <option value="">Select a container</option>
                {rootFolders.map((folder) => (
                  <option
                    key={folder.containerGuid}
                    value={folder.containerGuid}
                  >
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right text-sm font-medium">Tracker URI</div>
              <Input
                value={publishTrackerUri}
                onChange={(e) => setPublishTrackerUri(e.target.value)}
                placeholder="Enter tracker URI"
                className="col-span-3"
                disabled={isPublishing}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handlePublish}
              disabled={
                !selectedContainer || !publishTrackerUri || isPublishing
              }
            >
              {isPublishing ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Publishing...
                </span>
              ) : (
                "Publish"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Container Dialog */}
      <Dialog
        open={downloadDialogOpen}
        onOpenChange={(open) => {
          if (!isDownloading) {
            setDownloadDialogOpen(open);
            if (!open) {
              setDownloadSuccess(null);
              setContainerDownloadProgress({
                filesTotal: 0,
                filesCompleted: 0,
                bytesTotal: 0,
                bytesReceived: 0,
              });
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Download Container</DialogTitle>
            <DialogDescription>
              Enter a container GUID and tracker URI to download a container.
            </DialogDescription>
          </DialogHeader>

          {downloadSuccess === true && (
            <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Download started successfully!
            </div>
          )}

          {downloadSuccess === false && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              Failed to start download. Please try again.
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right text-sm font-medium">
                Container GUID
              </div>
              <Input
                value={downloadContainerGuid}
                onChange={(e) => setDownloadContainerGuid(e.target.value)}
                placeholder="Enter container GUID"
                className="col-span-3"
                disabled={isDownloading}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right text-sm font-medium">Tracker URI</div>
              <Input
                value={downloadTrackerUri}
                onChange={(e) => setDownloadTrackerUri(e.target.value)}
                placeholder="Enter tracker URI"
                className="col-span-3"
                disabled={isDownloading}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right text-sm font-medium">Destination</div>
              <div className="col-span-3 flex gap-2">
                <Input
                  value={downloadDestination ?? "Default location"}
                  readOnly
                  className="flex-1"
                  disabled={isDownloading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    // In a real app, this would open a directory picker
                    log.info("Opening directory picker...");
                    const path =
                      (await window.electronAPI.selectFolder()) ?? "";
                    setDownloadDestination(path);
                    log.info(`picked: ${path}`);
                  }}
                  disabled={isDownloading}
                >
                  Browse...
                </Button>
              </div>
            </div>

            {/* Progress bar for downloading */}
            {activeContainerDownloadIds.length > 0 &&
              containerDownloadProgress.bytesTotal > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Download progress</span>
                    <span>{downloadPercentage}%</span>
                  </div>
                  <Progress value={downloadPercentage} className="h-2" />
                  <div className="text-xs text-muted-foreground text-right">
                    {formatProgress(
                      containerDownloadProgress.bytesReceived,
                      containerDownloadProgress.bytesTotal,
                    )}
                  </div>

                  {/* File count information */}
                  <div className="flex items-center text-xs text-muted-foreground mt-2">
                    <FileText className="h-3 w-3 mr-1" />
                    <span>
                      {containerDownloadProgress.filesCompleted} of{" "}
                      {containerDownloadProgress.filesTotal} files
                    </span>
                  </div>
                </div>
              )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleDownload}
              disabled={
                !downloadContainerGuid || !downloadTrackerUri || isDownloading
              }
            >
              {isDownloading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Downloading...
                </span>
              ) : (
                "Download"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Manager Dialog */}
      <DownloadManager
        open={downloadManagerOpen}
        onOpenChange={setDownloadManagerOpen}
        activeDownloadIds={activeDownloadIds}
      />
      {/* Blocked Peers Dialog */}
      <BlockedPeersDialog
        open={blockedPeersDialogOpen}
        onOpenChange={setBlockedPeersDialogOpen}
      />
    </div>
  );
}
