import { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Map } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { GeoJSON } from 'ol/format';
import { Style, Fill, Stroke } from 'ol/style';
import { WMSLayer } from '../../types/map';
import { buffer } from 'ol/extent';
import { Feature } from 'ol';
import { Geometry } from 'ol/geom';

interface FeatureHighlightProps {
  map: Map;
  visibleLayers: WMSLayer[];
  isPopup?: boolean;
}

export const FeatureHighlight = ({ map, visibleLayers, isPopup = false }: FeatureHighlightProps) => {
  const highlightSourceRef = useRef<VectorSource>(new VectorSource());
  const highlightLayerRef = useRef<VectorLayer<VectorSource>>(
    new VectorLayer({
      source: highlightSourceRef.current,
      style: new Style({
        fill: new Fill({
          color: isPopup ? 'rgba(0, 120, 255, 0.2)' : 'rgba(255, 255, 0, 0.2)'
        }),
        stroke: new Stroke({
          color: isPopup ? '#0078FF' : '#FFD700',
          width: 2
        })
      }),
      zIndex: 1000
    })
  );
  const { serverUrl, getAuthHeader } = useAuth();

  useEffect(() => {
    const highlightSource = highlightSourceRef.current;
    const highlightLayer = highlightLayerRef.current;

    map.addLayer(highlightLayer);

    const handleMapClick = async (evt: any) => {
      highlightSource.clear();

      const coordinate = evt.coordinate;
      const viewResolution = map.getView().getResolution();
      const projection = map.getView().getProjection();

      if (!viewResolution) return;

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
              // Criar um buffer ao redor do ponto clicado para melhorar a detecção
              const clickBuffer = buffer(
                [coordinate[0], coordinate[1], coordinate[0], coordinate[1]], 
                viewResolution * 10
              );

              for (const feature of data.features) {
                const geojsonFeature = new GeoJSON().readFeature(feature, {
                  dataProjection: 'EPSG:3857',
                  featureProjection: projection.getCode()
                }) as Feature<Geometry>;

                const geom = geojsonFeature.getGeometry();
                if (geom) {
                  const extent = geom.getExtent();
                  // Verificar se o buffer do clique intersecta com a geometria
                  if (!(extent[0] > clickBuffer[2] || 
                      extent[2] < clickBuffer[0] || 
                      extent[1] > clickBuffer[3] || 
                      extent[3] < clickBuffer[1])) {
                    highlightSource.addFeature(geojsonFeature);
                    break;
                  }
                }
              }

              if (highlightSource.getFeatures().length > 0) {
                break;
              }
            }
          } catch (error) {
            console.error('Error fetching feature info:', error);
          }
        }
      }
    };

    map.on('singleclick', handleMapClick);

    return () => {
      map.removeLayer(highlightLayer);
      map.un('singleclick', handleMapClick);
    };
  }, [map, visibleLayers, serverUrl, getAuthHeader]);

  return null;
};