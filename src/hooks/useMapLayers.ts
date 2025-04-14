import { useEffect, useState } from 'react';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import { WMSLayer, Workspace } from '../types/map';
import { useAuth } from '../contexts/AuthContext';

export const useMapLayers = () => {
  const [layers, setLayers] = useState<WMSLayer[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<WMSLayer[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const { serverUrl, getAuthHeader } = useAuth();

  useEffect(() => {
    const fetchLayers = async () => {
      try {
        const response = await fetch(
          `${serverUrl}/wms?request=GetCapabilities&service=WMS`,
          {
            headers: {
              'Authorization': getAuthHeader()
            }
          }
        );

        const text = await response.text();
        const data = new DOMParser().parseFromString(text, 'text/xml');
        const layerElements = Array.from(data.getElementsByTagName('Layer')).filter(layer => 
          layer.getElementsByTagName('Name').length > 0 && 
          !layer.getElementsByTagName('Layer').length // Only get leaf layers
        );

        const wmsLayers: WMSLayer[] = [];
        const uniqueWorkspaces = new Set<string>();

        for (const layerElement of layerElements) {
          const nameElement = layerElement.getElementsByTagName('Name')[0];
          const titleElement = layerElement.getElementsByTagName('Title')[0];
          const crsElements = layerElement.getElementsByTagName('CRS');

          if (nameElement?.textContent) {
            const [workspace, name] = nameElement.textContent.split(':');
            if (!name) continue; // Skip if no workspace prefix

            uniqueWorkspaces.add(workspace);
            const title = titleElement?.textContent || name;
            
            // Get the native CRS (usually the first one) or default to EPSG:3857
            let srs = 'EPSG:3857';
            if (crsElements.length > 0) {
              // Convert NodeList to Array for easier manipulation
              const crsList = Array.from(crsElements).map(crs => crs.textContent);
              
              // Try to find EPSG:10665 first
              const preferredCrs = crsList.find(crs => crs === 'EPSG:10665');
              if (preferredCrs) {
                srs = preferredCrs;
              } else if (crsList.length > 0 && crsList[0]) {
                // If EPSG:10665 not found, use the first CRS
                srs = crsList[0];
              }
            }

            const source = new TileWMS({
              url: `${serverUrl}/wms`,
              params: {
                'LAYERS': `${workspace}:${name}`,
                'TILED': true,
                'FORMAT': 'image/png',
                'VERSION': '1.1.1',
                'SRS': srs
              },
              serverType: 'geoserver',
              crossOrigin: 'anonymous',
              tileLoadFunction: (imageTile, src) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', src);
                xhr.setRequestHeader('Authorization', getAuthHeader());
                xhr.responseType = 'blob';
                xhr.onload = function() {
                  const objectURL = URL.createObjectURL(xhr.response);
                  (imageTile.getImage() as HTMLImageElement).src = objectURL;
                };
                xhr.send();
              }
            });

            const layer = new TileLayer({
              source,
              visible: false
            });

            const wmsLayer: WMSLayer = {
              name,
              title,
              layer,
              source,
              visible: false,
              workspace,
              srs,
              setVisible: (visible: boolean) => {
                layer.setVisible(visible);
                wmsLayer.visible = visible;
                setVisibleLayers(prev => 
                  visible 
                    ? [...prev.filter(l => l.name !== name), wmsLayer]
                    : prev.filter(l => l.name !== name)
                );
              }
            };

            wmsLayers.push(wmsLayer);
          }
        }

        const workspacesList = Array.from(uniqueWorkspaces).map(name => ({
          name,
          title: name,
          selected: false
        }));

        setWorkspaces(workspacesList);
        setLayers(wmsLayers);
      } catch (error) {
        console.error('Error fetching layers:', error);
      }
    };

    fetchLayers();
  }, [serverUrl, getAuthHeader]);

  const toggleWorkspace = (workspace: string, selected: boolean) => {
    setSelectedWorkspaces(prev => 
      selected 
        ? [...prev, workspace]
        : prev.filter(w => w !== workspace)
    );
    
    setWorkspaces(prev => 
      prev.map(w => w.name === workspace ? { ...w, selected } : w)
    );
  };

  const filteredLayers = layers.filter(layer => 
    selectedWorkspaces.includes(layer.workspace)
  );

  return { 
    layers: filteredLayers, 
    visibleLayers,
    workspaces,
    selectedWorkspaces,
    toggleWorkspace 
  };
};