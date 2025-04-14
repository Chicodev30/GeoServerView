import { useEffect, useState } from 'react';

interface LayerPreviewProps {
  layerName: string;
  workspace: string;
}

export const LayerPreview = ({ layerName, workspace }: LayerPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url = `https://imde.portoalegre.rs.gov.br/geoserver/${workspace}/wms?service=WMS&version=1.1.0&request=GetMap&layers=${workspace}:${layerName}&bbox=271055.9323950095,1650005.3223791183,298901.3713205436,1687575.8068703907&width=80&height=80&srs=EPSG:10665&styles=&format=image/png`;

    fetch(url, {
      headers: {
        'Authorization': 'Basic ' + btoa('admin:geoserver')
      }
    })
      .then(response => response.blob())
      .then(blob => {
        setPreviewUrl(URL.createObjectURL(blob));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [layerName, workspace]);

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
    <img
      src={previewUrl}
      alt={`Preview of ${layerName}`}
      className="w-[80px] h-[80px] object-cover rounded border border-gray-200"
    />
  );
};