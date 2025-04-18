import { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Map } from 'ol';
import Overlay from 'ol/Overlay';
import { WMSLayer } from '../../types/map';
import { GeoJSON } from 'ol/format';
import { FeatureHighlight } from './FeatureHighlight';

interface PopupProps {
  map: Map;
  visibleLayers: WMSLayer[];
}

export const Popup = ({ map, visibleLayers }: PopupProps) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closerRef = useRef<HTMLButtonElement>(null);
  const currentFeatureRef = useRef<any>(null);
  const { serverUrl, getAuthHeader } = useAuth();

  useEffect(() => {
    if (!popupRef.current) return;

    const overlay = new Overlay({
      element: popupRef.current,
      autoPan: true,
      autoPanAnimation: {
        duration: 250
      }
    });

    map.addOverlay(overlay);

    const handleMapClick = async (evt: any) => {
      const coordinate = evt.coordinate;
      const viewResolution = map.getView().getResolution();
      const projection = map.getView().getProjection();

      if (!viewResolution || visibleLayers.length === 0) return;

      let content = '';
      currentFeatureRef.current = null;
      
      for (const layer of visibleLayers) {
        const url = layer.source.getFeatureInfoUrl(
          coordinate,
          viewResolution,
          projection.getCode(),
          {
            'INFO_FORMAT': 'application/json',
            'FEATURE_COUNT': 1,
            'BUFFER': 8
          }
        );

        if (url) {
          try {
            const response = await fetch(url, {
              headers: {
                'Authorization': getAuthHeader()
              }
            });
            const data = await response.json();

            if (data.features?.length > 0) {
              currentFeatureRef.current = data.features[0];
              const properties = data.features[0].properties;
              content += `
                <div class="bg-white rounded-lg shadow-lg border border-gray-200">
                  <div class="px-3 py-2 border-b border-gray-200">
                    <h3 class="text-sm font-medium text-gray-900">${layer.title || layer.name}</h3>
                  </div>
                  <div class="px-3 py-2">
                    <table class="min-w-full divide-y divide-gray-200">
                      <tbody class="divide-y divide-gray-200">
                        ${Object.entries(properties)
                          .filter(([key]) => key !== 'geometry' && key !== 'geom')
                          .map(([key, value]) => `
                            <tr>
                              <td class="py-1 pr-4 text-sm font-medium text-gray-500">${key}</td>
                              <td class="py-1 text-sm text-gray-900">${value}</td>
                            </tr>
                          `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              `;
              break;
            }
          } catch (error) {
            console.error('Error fetching feature info:', error);
          }
        }
      }

      if (content && contentRef.current) {
        content += `
          <div class="mt-2 px-2 pb-2">
            <button 
              onclick="window.zoomToFeature()"
              class="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs py-1 px-2 rounded"
            >
              Zoom para
            </button>
          </div>
        `;
        contentRef.current.innerHTML = content;
        overlay.setPosition(coordinate);

        (window as any).zoomToFeature = () => {
          if (currentFeatureRef.current) {
            const feature = new GeoJSON().readFeature(currentFeatureRef.current, {
              dataProjection: 'EPSG:3857',
              featureProjection: map.getView().getProjection().getCode()
            });
            
            const geometry = feature.getGeometry();
            if (geometry) {
              const extent = geometry.getExtent();
              map.getView().fit(extent, {
                padding: [20, 20, 20, 20],
                duration: 1000
              });
            }
          }
        };
      } else {
        overlay.setPosition(undefined);
      }
    };

    map.on('singleclick', handleMapClick);

    if (closerRef.current) {
      closerRef.current.onclick = () => {
        overlay.setPosition(undefined);
        closerRef.current?.blur();
        return false;
      };
    }

    return () => {
      map.removeOverlay(overlay);
      map.un('singleclick', handleMapClick);
      delete (window as any).zoomToFeature;
    };
  }, [map, visibleLayers, serverUrl, getAuthHeader]);

  return (
    <>
      <FeatureHighlight map={map} visibleLayers={visibleLayers} isPopup={true} />
      <div 
        ref={popupRef} 
        className="absolute bg-white shadow-lg rounded border border-gray-200"
        style={{
          width: '240px',
          maxWidth: '240px',
          maxHeight: '200px'
        }}
      >
        <div className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded-t border-b border-gray-100">
          <div className="flex-1" />
          <button 
            ref={closerRef} 
            className="text-gray-400 hover:text-gray-600 z-10 w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-100 text-xs"
          >
            ✖
          </button>
        </div>
        <div 
          ref={contentRef} 
          className="max-h-[172px] overflow-y-auto overflow-x-hidden"
        />
      </div>
    </>
  );
};