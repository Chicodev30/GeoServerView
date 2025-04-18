import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ZoomIn } from 'lucide-react';
import { Map } from 'ol';
import { transformExtent } from 'ol/proj';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

// Registrar a projeção EPSG:26713
proj4.defs('EPSG:26713', '+proj=utm +zone=13 +datum=NAD27 +units=m +no_defs');
register(proj4);

interface LayerPreviewProps {
  layerName: string;
  workspace: string;
  map?: Map;
}

interface BBox {
  minx: number;
  miny: number;
  maxx: number;
  maxy: number;
  srs: string;
}

export const LayerPreview = ({ layerName, workspace, map }: LayerPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [layerBBox, setLayerBBox] = useState<BBox | null>(null);
  const { serverUrl, getAuthHeader } = useAuth();

  useEffect(() => {
    const getLayerBBox = async (): Promise<BBox | null> => {
      try {
        const capabilitiesUrl = `${serverUrl}/wms?service=WMS&version=1.1.0&request=GetCapabilities`;
        const response = await fetch(capabilitiesUrl, {
          headers: {
            'Authorization': getAuthHeader()
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        // Encontra a camada específica
        const fullLayerName = `${workspace}:${layerName}`;
        const layers = xmlDoc.getElementsByTagName('Layer');
        let bbox: BBox | null = null;

        for (let i = 0; i < layers.length; i++) {
          const nameElement = layers[i].getElementsByTagName('Name')[0];
          if (nameElement && nameElement.textContent === fullLayerName) {
            const bboxElement = layers[i].getElementsByTagName('BoundingBox')[0];
            if (bboxElement) {
              bbox = {
                minx: parseFloat(bboxElement.getAttribute('minx') || '-180'),
                miny: parseFloat(bboxElement.getAttribute('miny') || '-90'),
                maxx: parseFloat(bboxElement.getAttribute('maxx') || '180'),
                maxy: parseFloat(bboxElement.getAttribute('maxy') || '90'),
                srs: bboxElement.getAttribute('SRS') || 'EPSG:4326'
              };
              break;
            }
          }
        }

        return bbox;
      } catch (error) {
        console.error('Erro ao buscar BBOX:', error);
        return null;
      }
    };

    const loadPreview = async () => {
      try {
        const bbox = await getLayerBBox();
        setLayerBBox(bbox);
        let bboxString = '-180,-90,180,90';
        let srs = 'EPSG:4326';

        if (bbox) {
          bboxString = `${bbox.minx},${bbox.miny},${bbox.maxx},${bbox.maxy}`;
          srs = bbox.srs;

          // Se o workspace for 'sf', use o SRS específico
          if (workspace === 'sf') {
            srs = 'EPSG:26713';
          }
        }

        const url = `${serverUrl}/wms?service=WMS&version=1.1.0&request=GetMap&layers=${workspace}:${layerName}&bbox=${bboxString}&width=80&height=80&srs=${srs}&styles=&format=image/png`;

        const response = await fetch(url, {
          headers: {
            'Authorization': getAuthHeader()
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao carregar preview:', error);
        setError(true);
        setLoading(false);
      }
    };

    loadPreview();

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [layerName, workspace, serverUrl, getAuthHeader]);

  const handleZoomTo = () => {
    if (!map || !layerBBox) return;

    try {
      const extent = [
        layerBBox.minx,
        layerBBox.miny,
        layerBBox.maxx,
        layerBBox.maxy
      ];

      let sourceSrs = layerBBox.srs;
      if (workspace === 'sf') {
        sourceSrs = 'EPSG:26713';
      }

      // Transformar a extensão do SRS da camada para o SRS do mapa (EPSG:3857)
      const transformedExtent = transformExtent(
        extent,
        sourceSrs,
        'EPSG:3857'
      );

      // Aplicar um pequeno padding à extensão
      map.getView().fit(transformedExtent, {
        padding: [50, 50, 50, 50],
        duration: 1000
      });
    } catch (error) {
      console.error('Erro ao dar zoom para a camada:', error);
    }
  };

  if (loading) {
    return (
      <div className="w-[80px] h-[80px] flex items-center justify-center bg-gray-50 rounded border border-gray-200">
        <span className="text-[10px] text-center">Carregando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-[80px] h-[80px] flex items-center justify-center bg-gray-50 rounded border border-gray-200">
        <span className="text-[10px] text-center text-red-500">Erro ao carregar</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <img
        src={previewUrl}
        alt={`Preview of ${layerName}`}
        className="w-[80px] h-[80px] object-cover rounded border border-gray-200"
        onError={(e) => {
          setError(true);
        }}
      />
      {map && (
        <button
          onClick={handleZoomTo}
          className="absolute bottom-1 right-1 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 transition-colors"
          title="Zoom para camada"
        >
          <ZoomIn className="w-3 h-3 text-gray-600" />
        </button>
      )}
    </div>
  );
};