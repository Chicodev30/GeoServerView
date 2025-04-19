import { useState } from 'react';
import { Layers, Folder, Search, MapPinned, Menu, LogOut, Palette } from 'lucide-react';
import { LayerControl } from './LayerControl';
import { WorkspaceControl } from './WorkspaceControl';
import { SearchControl } from './SearchControl';
import { StyleControl } from './StyleControl';
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
  const [activeSection, setActiveSection] = useState<'workspace' | 'layers' | 'search' | 'style'>('layers');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const { logout } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  const handleSearchComplete = () => {
    setIsPanelVisible(false);
  };

  const handleMobileClose = () => {
    setIsMobileMenuOpen(false);
    setIsPanelVisible(false);
  };

  const menuItems = [
    {
      id: 'workspace',
      icon: <Folder className="w-5 h-5" />,
      label: 'Workspaces'
    },
    {
      id: 'layers',
      icon: <Layers className="w-5 h-5" />,
      label: 'Camadas'
    },
    {
      id: 'search',
      icon: <Search className="w-5 h-5" />,
      label: 'Procurar'
    },
    {
      id: 'style',
      icon: <Palette className="w-5 h-5" />,
      label: 'Estilizar'
    }
  ];

  return (
    <div className="fixed top-0 left-0 h-screen z-50 flex">
      {/* Mobile Menu Button */}
      <button
        className="lg:hidden fixed top-2 left-2 z-50 bg-white p-2 rounded-lg shadow-lg"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Side Menu */}
      <div 
        className={`bg-white shadow-lg transition-all duration-300 h-full w-[64px]
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
          lg:translate-x-0`}
      >
        <div className="flex flex-col h-full p-2 gap-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id as any);
                setIsPanelVisible(true);
              }}
              className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-colors
                ${activeSection === item.id ? 
                  'bg-blue-50 text-blue-600' : 
                  'text-gray-700 hover:bg-gray-100'}`}
            >
              {item.icon}
              <span className="text-xs">{item.label}</span>
            </button>
          ))}

          <div className="flex-1" />

          <button
            onClick={() => {
              setMessage('Tem certeza que deseja sair?');
            }}
            className="p-2 rounded-lg flex flex-col items-center gap-1 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-xs">Sair</span>
          </button>
        </div>
      </div>

      {/* Content Panel */}
      <div 
        className={`fixed top-0 h-screen bg-white shadow-lg p-2 transition-all duration-300 pointer-events-auto
          ${isPanelVisible ? 'opacity-100 visible' : 'opacity-0 invisible'}
          ${isMobileMenuOpen ? 'left-[64px]' : 'left-0'} lg:left-[64px]`}
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
              {selectedWorkspaces.length > 0 ? (
                <LayerControl map={map} layers={layers} />
              ) : (
                <div className="text-yellow-700 bg-yellow-50 p-3 rounded-lg text-sm">
                  Por favor, selecione um ou mais workspaces para poder escolher a camada.
                </div>
              )}
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

          {activeSection === 'style' && (
            <div className="h-full overflow-auto">
              <h2 className="text-base font-semibold mb-2">Estilizar Camadas</h2>
              <StyleControl 
                map={map}
                layers={layers}
              />
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

      {message && (
        <MessageDialog
          message={message}
          onClose={() => setMessage(null)}
          onConfirm={() => {
            logout();
            setMessage(null);
          }}
          showConfirm
        />
      )}
    </div>
  );
};