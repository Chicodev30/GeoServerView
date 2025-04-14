import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { defaults } from 'ol/control';
import { useMapLayers } from '../../hooks/useMapLayers';
import { SideMenu } from './SideMenu';
import { Popup } from './Popup';
import { FeatureHighlight } from './FeatureHighlight';
import { BottomSheet } from './BottomSheet';
import DragBox from 'ol/interaction/DragBox';
import { platformModifierKeyOnly } from 'ol/events/condition';
import { Style, Fill, Stroke } from 'ol/style';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { GeoJSON } from 'ol/format';
import Feature from 'ol/Feature';
import { getWidth } from 'ol/extent';
import { transform } from 'ol/proj';
import ScaleLine from 'ol/control/ScaleLine';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  coordinate: number[];
}

interface SearchCriteria {
  layer?: string;
  field?: string;
  operator?: string;
  value?: string;
}

export const MapComponent = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const { layers, visibleLayers, workspaces, selectedWorkspaces, toggleWorkspace } = useMapLayers();
  const [selectedFeatures, setSelectedFeatures] = useState<Feature[]>([]);
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria | undefined>();
  const vectorSourceRef = useRef<VectorSource>(null);
  const vectorLayerRef = useRef<VectorLayer<VectorSource>>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    coordinate: [0, 0]
  });

  useEffect(() => {
    if (!mapRef.current) return;

    const osmLayer = new TileLayer({
      source: new OSM()
    });

    vectorSourceRef.current = new VectorSource();
    vectorLayerRef.current = new VectorLayer({
      source: vectorSourceRef.current,
      style: new Style({
        fill: new Fill({
          color: 'rgba(255, 255, 255, 0.4)'
        }),
        stroke: new Stroke({
          color: '#3b82f6',
          width: 2
        })
      }),
      zIndex: 1000
    });

    const center = transform([-51.2177, -30.0346], 'EPSG:4326', 'EPSG:3857');

    const scaleControl = new ScaleLine({
      units: 'metric',
      bar: false,
      steps: 4,
      text: true,
      minWidth: 140,
      className: 'ol-scale-line'
    });

    const initialMap = new Map({
      target: mapRef.current,
      layers: [osmLayer, vectorLayerRef.current],
      controls: defaults({
        attribution: false,
        zoom: false,
        rotate: false
      }).extend([scaleControl]),
      view: new View({
        center: center,
        zoom: 12,
        projection: 'EPSG:3857'
      })
    });

    // Prevent default context menu
    mapRef.current.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    setMap(initialMap);

    return () => {
      initialMap.setTarget(undefined);
      if (mapRef.current) {
        mapRef.current.removeEventListener('contextmenu', (e) => {
          e.preventDefault();
        });
      }
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    layers.forEach(layer => {
      map.addLayer(layer.layer);
    });

    const dragBox = new DragBox({
      condition: platformModifierKeyOnly
    });

    map.addInteraction(dragBox);

    dragBox.on('boxend', async () => {
      if (!vectorSourceRef.current) return;

      const boxExtent = dragBox.getGeometry().getExtent();
      const selectedFeaturesList: Feature[] = [];

      const worldExtent = map.getView().getProjection().getExtent();
      const worldWidth = getWidth(worldExtent);
      const startWorld = Math.floor((boxExtent[0] - worldExtent[0]) / worldWidth);
      const endWorld = Math.floor((boxExtent[2] - worldExtent[0]) / worldWidth);

      for (let world = startWorld; world <= endWorld; ++world) {
        const left = Math.max(boxExtent[0] - world * worldWidth, worldExtent[0]);
        const right = Math.min(boxExtent[2] - world * worldWidth, worldExtent[2]);
        const extent = [left, boxExtent[1], right, boxExtent[3]];

        for (const layer of visibleLayers) {
          const url = layer.source.getFeatureInfoUrl(
            [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2],
            map.getView().getResolution() || 1,
            'EPSG:3857',
            {
              'INFO_FORMAT': 'application/json',
              'FEATURE_COUNT': 50,
              'BUFFER': 0,
              'BBOX': extent.join(','),
              'WIDTH': Math.round(map.getSize()?.[0] || 256),
              'HEIGHT': Math.round(map.getSize()?.[1] || 256)
            }
          );

          if (!url) continue;

          try {
            const response = await fetch(url, {
              headers: {
                'Authorization': 'Basic ' + btoa('admin:geoserver')
              }
            });
            const data = await response.json();

            if (data.features?.length > 0) {
              const features = data.features
                .map((featureData: any) => {
                  const feature = new GeoJSON().readFeature(featureData, {
                    dataProjection: 'EPSG:3857',
                    featureProjection: 'EPSG:3857'
                  });
                  
                  const geom = feature.getGeometry();
                  if (geom && geom.intersectsExtent(extent)) {
                    return feature;
                  }
                  return null;
                })
                .filter((f: Feature | null): f is Feature => f !== null);

              selectedFeaturesList.push(...features);
            }
          } catch (error) {
            console.error('Error fetching features:', error);
          }
        }
      }

      vectorSourceRef.current.clear();
      vectorSourceRef.current.addFeatures(selectedFeaturesList);
      setSelectedFeatures(selectedFeaturesList);
      setSearchCriteria(undefined);
    });

    dragBox.on('boxstart', () => {
      if (vectorSourceRef.current) {
        vectorSourceRef.current.clear();
        setSelectedFeatures([]);
        setSearchCriteria(undefined);
      }
    });

    const handleContextMenu = (evt: any) => {
      evt.preventDefault();
      
      const pixel = map.getEventPixel(evt.originalEvent);
      const coordinate = map.getEventCoordinate(evt.originalEvent);

      setContextMenu({
        visible: true,
        x: evt.originalEvent.clientX,
        y: evt.originalEvent.clientY,
        coordinate
      });
    };

    const handleClick = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
    };

    map.on('contextmenu', handleContextMenu);
    map.on('click', handleClick);

    return () => {
      layers.forEach(layer => {
        map.removeLayer(layer.layer);
      });
      map.removeInteraction(dragBox);
      map.un('contextmenu', handleContextMenu);
      map.un('click', handleClick);
    };
  }, [map, layers, visibleLayers]);

  const handleFeaturesSelected = (features: Feature[], criteria?: SearchCriteria) => {
    if (!vectorSourceRef.current || !map) return;

    vectorSourceRef.current.clear();
    vectorSourceRef.current.addFeatures(features);
    setSelectedFeatures(features);
    setSearchCriteria(criteria);

    if (features.length > 0) {
      const extent = vectorSourceRef.current.getExtent();
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000,
        maxZoom: 19
      });
    }
  };

  const handleShowInfo = async () => {
    if (!map || !vectorSourceRef.current) return;

    const coordinate = contextMenu.coordinate;
    const resolution = map.getView().getResolution();
    const projection = map.getView().getProjection();

    if (!resolution) return;

    const selectedFeaturesList: Feature[] = [];

    for (const layer of visibleLayers) {
      const url = layer.source.getFeatureInfoUrl(
        coordinate,
        resolution,
        projection.getCode(),
        {
          'INFO_FORMAT': 'application/json',
          'FEATURE_COUNT': 1,
          'BUFFER': 8
        }
      );

      if (!url) continue;

      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': 'Basic ' + btoa('admin:geoserver')
          }
        });
        const data = await response.json();

        if (data.features?.length > 0) {
          const features = data.features.map((featureData: any) => {
            return new GeoJSON().readFeature(featureData, {
              dataProjection: 'EPSG:3857',
              featureProjection: 'EPSG:3857'
            });
          });
          selectedFeaturesList.push(...features);
          break;
        }
      } catch (error) {
        console.error('Error fetching features:', error);
      }
    }

    vectorSourceRef.current.clear();
    vectorSourceRef.current.addFeatures(selectedFeaturesList);
    setSelectedFeatures(selectedFeaturesList);
    setSearchCriteria(undefined);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  return (
    <div className="relative h-screen w-full">
      <div ref={mapRef} className="w-full h-full" />
      {map && (
        <>
          <SideMenu 
            map={map} 
            layers={layers} 
            workspaces={workspaces}
            selectedWorkspaces={selectedWorkspaces}
            onToggleWorkspace={toggleWorkspace}
            onFeaturesSelected={handleFeaturesSelected}
          />
          <FeatureHighlight map={map} visibleLayers={visibleLayers} />
          <Popup map={map} visibleLayers={visibleLayers} />
          <BottomSheet 
            features={selectedFeatures}
            onClose={() => {
              if (vectorSourceRef.current) {
                vectorSourceRef.current.clear();
                setSelectedFeatures([]);
                setSearchCriteria(undefined);
              }
            }}
            map={map}
            searchCriteria={searchCriteria}
          />
          {contextMenu.visible && (
            <div 
              className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[150px]"
              style={{ 
                left: contextMenu.x,
                top: contextMenu.y
              }}
            >
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={handleShowInfo}
              >
                Mostrar informações
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};