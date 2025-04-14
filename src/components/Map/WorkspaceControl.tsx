import { Workspace } from '../../types/map';

interface WorkspaceControlProps {
  workspaces: Workspace[];
  onToggleWorkspace: (workspace: string, selected: boolean) => void;
}

export const WorkspaceControl = ({ workspaces, onToggleWorkspace }: WorkspaceControlProps) => {
  return (
    <div className="max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
      {workspaces.map((workspace) => (
        <div key={workspace.name} className="flex gap-4 p-3 border border-gray-200 rounded-lg mb-3">
          <div className="flex-1 min-w-0">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={workspace.selected}
                onChange={(e) => onToggleWorkspace(workspace.name, e.target.checked)}
                className="mt-1"
              />
              <span className="block text-[15px] text-[#333] flex-1 leading-[1.4] max-w-[150px] font-[cursive] whitespace-normal break-words">
                {workspace.title}
              </span>
            </label>
          </div>
        </div>
      ))}
    </div>
  );
};