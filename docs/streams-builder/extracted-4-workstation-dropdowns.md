# Extracted 4-Workstation Dropdown Inventory

This is an extraction-only file. It does not change the live Builder UI.

Source file inspected:

```text
src/components/streams-builder/GitHubRepositoryPicker.tsx
source commit: 2c2baf854b930c9631326460676d954a0ad8e985
```

## Dropdowns found in the 4-workstation build

### 1. Workspace mode dropdown

Full list:

```text
Primary Builder
Visual Editing
Component Mapping
Approval Center
Browser Verification
Repository Truth
Projects Dashboard
Truth Panel
```

Supporting names in source:

```text
WorkspaceMode
WORKSPACE_MODES
workspaceMode
setWorkspaceMode
inferMode(path)
defaultPromptForMode(mode)
promptInput
setPromptInput
```

Purpose:

```text
Controls which workstation role is active inside each Agent panel.
```

---

### 2. Repository dropdown

Supporting names in source:

```text
Repo
repos
setRepos
repo
setRepo
selectedRepo
loadRepos()
/api/streams-builder/github/repos
```

Expected values:

```text
GitHub repository full names returned from /api/streams-builder/github/repos
Example: hawk7227/streamsailive
```

Purpose:

```text
Lets each workstation select the repo it owns.
```

---

### 3. Branch field / branch selector behavior

Supporting names in source:

```text
branch
setBranch
selectedRepo.defaultBranch
loadTree(repo, branch)
```

Expected values:

```text
main
master
any selected repo branch name
```

Purpose:

```text
Sets the Git ref used by tree, file pull, and push.
```

---

### 4. Folder dropdown

Supporting names in source:

```text
TreeFile
directories
setDirectories
directory
setDirectory
files
setFiles
loadTree()
/api/streams-builder/github/tree
```

Expected values:

```text
Directory strings returned from /api/streams-builder/github/tree
Example: src/app/about
```

Purpose:

```text
Filters the file dropdown to files inside the selected folder.
```

---

### 5. File dropdown

Supporting names in source:

```text
TreeFile
files
visibleFiles
filePath
setFilePath
file
setFile
```

Expected values:

```text
File paths returned from /api/streams-builder/github/tree
Example: src/app/about/page.tsx
```

Purpose:

```text
Selects the exact GitHub file to pull, edit, prove, and push.
```

---

### 6. Pull control

Supporting names in source:

```text
pullFile()
loadingFile
setLoadingFile
FileResult
setFile
setContent
setRouteInput
setWorkspaceMode
inferMode
/api/streams-builder/github/file
```

Purpose:

```text
Loads selected repo/file content and source truth into the workstation.
```

---

### 7. Push control

Supporting names in source:

```text
pushFile()
pushing
setPushing
file.sha
content
repo
filePath
branch
/api/streams-builder/github/push
```

Purpose:

```text
Writes the edited workstation content back to GitHub.
```

---

### 8. Fullscreen control

Supporting names in source:

```text
fullscreen
setFullscreen
```

Purpose:

```text
Expands/collapses an individual workstation panel.
```

---

## Files that come with the dropdown system

```text
src/components/streams-builder/GitHubRepositoryPicker.tsx
src/components/streams-builder/VisualEditingWorkstation.tsx
src/app/api/streams-builder/github/repos/route.ts
src/app/api/streams-builder/github/tree/route.ts
src/app/api/streams-builder/github/file/route.ts
src/app/api/streams-builder/github/push/route.ts
```

## State bundle extracted

```text
repos
repo
branch
files
directories
directory
filePath
file
routeInput
frameKey
promptInput
chatMessages
proofLog
content
fullscreen
loadingTree
loadingFile
pushing
error
status
workspaceMode
```

## Helper functions extracted

```text
readJson(response)
inferMode(path)
defaultPromptForMode(mode)
loadRepos()
loadTree(repo, branch)
pullFile()
pushFile()
addChat(message)
addProof(message)
```

## VisualEditingWorkstation props supplied by dropdown selections

```text
stationLabel
route
filePath
repo
branch
content
onContentChange
onProof
onChat
```

## Extraction boundary

Included:

```text
Only dropdown inventory, related state, helper names, API files, and VisualEditingWorkstation dependencies.
```

Not included:

```text
No live UI changes.
No layout changes.
No chat centering.
No monitor/proof drawer changes.
No provider/upload/document/admingeneration changes.
```
