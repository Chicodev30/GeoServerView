import { useState } from 'react';
import { Layers, Folder, Search, FileText, MapPinned, Menu, LogOut } from 'lucide-react';
import { LayerControl } from './LayerControl';
import { WorkspaceControl } from './WorkspaceControl';
import { SearchControl } from './SearchControl';
import { Map } from 'ol';
import { WMSLayer, Workspace } from '../../types/map';
import { useAuth } from '../../contexts/AuthContext';
import { MessageDialog } from '../UI/MessageDialog';
import Feature from 'ol/Feature';

interface SideMenuProps {
  map: Map;
  layers: WMSLayer[];
  workspaces: Workspace[];
  selectedWorkspaces: string[];
  onToggleWorkspace: (workspace: string, selected: boolean) => void;
  onFeaturesSelected: (features: Feature[], searchCriteria?: {
    layer?: string;
    field?: string;
    operator?: string;
    value?: string;
  }) => void;
}

export const SideMenu = ({ 
  map, 
  layers, 
  workspaces, 
  selectedWorkspaces, 
  onToggleWorkspace,
  onFeaturesSelected 
}: SideMenuProps) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { username, serverUrl, logout } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [isPanelVisible, setIsPanelVisible] = useState(false);

  const handleLayersClick = () => {
    if (selectedWorkspaces.length === 0) {
      setMessage('Por favor, primeiro você deve selecionar um workspace');
      setActiveSection('workspace');
      setIsPanelVisible(true);
      return;
    }
    if (activeSection === 'layers') {
      setIsPanelVisible(false);
      setTimeout(() => setActiveSection(null), 300);
    } else {
      setActiveSection('layers');
      setIsPanelVisible(true);
    }
  };

  const handleSearchClick = () => {
    const visibleLayers = layers.filter(layer => layer.visible);
    if (visibleLayers.length === 0) {
      setMessage('Por favor, selecione uma ou mais camadas para poder realizar sua busca');
      setActiveSection('layers');
      setIsPanelVisible(true);
      return;
    }
    if (activeSection === 'search') {
      setIsPanelVisible(false);
      setTimeout(() => setActiveSection(null), 300);
    } else {
      setActiveSection('search');
      setIsPanelVisible(true);
    }
  };

  const handleWorkspaceClick = () => {
    if (activeSection === 'workspace') {
      setIsPanelVisible(false);
      setTimeout(() => setActiveSection(null), 300);
    } else {
      setActiveSection('workspace');
      setIsPanelVisible(true);
    }
  };

  const handleLogsClick = () => {
    if (activeSection === 'logs') {
      setIsPanelVisible(false);
      setTimeout(() => setActiveSection(null), 300);
    } else {
      setActiveSection('logs');
      setIsPanelVisible(true);
    }
  };

  const handleMobileClose = () => {
    setIsPanelVisible(false);
    setTimeout(() => {
      setIsMobileMenuOpen(false);
      setActiveSection(null);
    }, 300);
  };

  const handleSearchComplete = () => {
    setIsPanelVisible(false);
    setTimeout(() => setActiveSection(null), 300);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {message && (
        <MessageDialog message={message} onClose={() => setMessage(null)} />
      )}

      {/* Mobile Menu Button */}
      <button 
        className="fixed top-4 left-4 z-50 lg:hidden bg-white rounded-lg p-2 shadow-lg pointer-events-auto"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Side Menu */}
      <div 
        className={`fixed left-0 top-0 h-screen w-40 bg-white shadow-lg transition-transform duration-300 pointer-events-auto ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="flex flex-col px-3 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <MapPinned className="w-7 h-7 text-blue-600 flex-shrink-0" />
              <span className="text-sm font-bold leading-tight">GeoServerView</span>
            </div>
            <div className="bg-gray-50 p-2 rounded space-y-1 text-[11px]">
              <div className="flex gap-1">
                <span className="font-medium text-gray-700">Usuário:</span>
                <span className="text-gray-900 break-all">{username}</span>
              </div>
              <div className="flex gap-1 items-start">
                <span className="font-medium text-gray-700">URL:</span>
                <span className="text-gray-900 break-all">{serverUrl}</span>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-2 flex items-center justify-center w-full text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 py-1.5 px-2 rounded transition-colors"
            >
              <LogOut className="w-3 h-3 mr-1" />
              Sair
            </button>
          </div>
          
          <div className="flex flex-col mt-2 px-2">
            <button 
              className={`flex items-center h-10 px-2 mt-1 rounded hover:bg-gray-300 ${
                activeSection === 'workspace' ? 'bg-gray-300' : ''
              }`}
              onClick={handleWorkspaceClick}
            >
              <Folder className="w-4 h-4" />
              <span className="ml-2 text-xs font-medium">Workspace</span>
            </button>
            
            <button 
              className={`flex items-center h-10 px-2 mt-1 rounded hover:bg-gray-300 ${
                activeSection === 'layers' ? 'bg-gray-300' : ''
              }`}
              onClick={handleLayersClick}
            >
              <Layers className="w-4 h-4" />
              <span className="ml-2 text-xs font-medium">Camadas</span>
            </button>
            
            <button 
              className={`flex items-center h-10 px-2 mt-1 rounded hover:bg-gray-300 ${
                activeSection === 'search' ? 'bg-gray-300' : ''
              }`}
              onClick={handleSearchClick}
            >
              <Search className="w-4 h-4" />
              <span className="ml-2 text-xs font-medium">Procurar</span>
            </button>
            
            <button 
              className={`flex items-center h-10 px-2 mt-1 rounded hover:bg-gray-300 ${
                activeSection === 'logs' ? 'bg-gray-300' : ''
              }`}
              onClick={handleLogsClick}
            >
              <FileText className="w-4 h-4" />
              <span className="ml-2 text-xs font-medium">Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Panels Container */}
      <div 
        className={`fixed top-0 h-screen bg-white shadow-lg p-2 transition-all duration-300 pointer-events-auto
          ${isPanelVisible ? 'opacity-100 visible' : 'opacity-0 invisible'}
          ${isMobileMenuOpen ? 'left-40' : 'left-0'} lg:left-40`}
        style={{
          width: isPanelVisible ? '280px' : '0',
          minWidth: isPanelVisible ? '280px' : '0',
          maxWidth: '280px'
        }}
      >
        <div className="h-full">
          {activeSection === 'workspace' && (
            <div className="h-full overflow-auto">
              <h2 className="text-base font-semibold mb-2">Workspaces Disponíveis</h2>
              <WorkspaceControl workspaces={workspaces} onToggleWorkspace={onToggleWorkspace} />
            </div>
          )}

          {activeSection === 'layers' && (
            <div className="h-full overflow-auto">
              <LayerControl map={map} layers={layers} />
            </div>
          )}

          {activeSection === 'search' && (
            <div className="h-full overflow-auto">
              <h2 className="text-base font-semibold mb-2">Procurar</h2>
              <SearchControl 
                layers={layers} 
                onFeaturesSelected={onFeaturesSelected}
                onSearchComplete={handleSearchComplete}
              />
            </div>
          )}

          {activeSection === 'logs' && (
            <div className="h-full overflow-auto">
              <h2 className="text-base font-semibold mb-2">Logs</h2>
              <div className="prose prose-sm">
                <p>Em desenvolvimento...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 lg:hidden pointer-events-auto
          ${(isMobileMenuOpen || isPanelVisible) ? 'opacity-50' : 'opacity-0 pointer-events-none'}`}
        onClick={handleMobileClose}
      />
    </div>
  );
};