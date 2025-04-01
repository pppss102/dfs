"use client";

import { useEffect, useState } from "react";
import { FileGrid } from "./file-grid";
import { FileList } from "./file-list";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { IStoredContents, getContents } from "@/lib/getData";

export function Drive() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [contents, setContents] = useState<IStoredContents>({
    folders: [],
    files: [],
  });

  useEffect(() => {
    getContents().then((c) => setContents(c));
  }, []);

  // Filter files based on current folder and search query
  const filteredFiles = contents.files.filter((file) => {
    const matchesFolder = currentFolder
      ? file.parentId.find((a) => a === currentFolder) !== undefined
      : file.parentId === null;
    const matchesSearch = file.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesFolder && (searchQuery === "" || matchesSearch);
  });

  // Filter folders based on parent folder and search query
  const filteredFolders = contents.folders.filter((folder) => {
    const matchesParent = currentFolder
      ? folder.parentId.find((a) => a === currentFolder) !== undefined
      : folder.parentId === null;
    const matchesSearch = folder.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesParent && (searchQuery === "" || matchesSearch);
  });

  // Get current folder name
  const currentFolderName = currentFolder
    ? contents.folders.find((folder) => folder.id === currentFolder)?.name ||
      "Unknown Folder"
    : "My Drive";

  // Navigate to a folder
  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolder(folderId);
  };

  // Navigate to parent folder
  const navigateToParent = () => {
    if (!currentFolder) return;
    const parentFolder =
      contents.folders.find((folder) => folder.id === currentFolder)
        ?.parentId || null;
    setCurrentFolder(parentFolder?.at(0) ?? null);
  };

  return (
    <div className="flex h-screen flex-col">
      <Header
        view={view}
        setView={setView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentFolder={currentFolder}
          navigateToFolder={navigateToFolder}
        />
        <main className="flex-1 overflow-auto p-4">
          {view === "grid" ? (
            <FileGrid
              files={filteredFiles}
              folders={filteredFolders}
              currentFolder={currentFolder}
              currentFolderName={currentFolderName}
              navigateToFolder={navigateToFolder}
              navigateToParent={navigateToParent}
            />
          ) : (
            <FileList
              files={filteredFiles}
              folders={filteredFolders}
              currentFolder={currentFolder}
              currentFolderName={currentFolderName}
              navigateToFolder={navigateToFolder}
              navigateToParent={navigateToParent}
            />
          )}
        </main>
      </div>
    </div>
  );
}
