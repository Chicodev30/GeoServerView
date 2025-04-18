import { Map } from 'ol';
import { WMSLayer } from '../../types/map';
import { LayerPreview } from './LayerPreview';

interface LayerControlProps {
  map: Map;
  layers: WMSLayer[];
}

export const LayerControl = ({ map, layers }: LayerControlProps) => {
  const handleUnselectAll = () => {
    layers.forEach(layer => {
      if (layer.visible) {
        layer.setVisible(false);
      }
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-base font-semibold">Camadas Disponíveis</h2>
        <button
          onClick={handleUnselectAll}
          className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
        >
          Desmarcar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {layers.map((layer, index) => (
          <div key={`${layer.name}-${index}`} className="flex items-start gap-2 p-2 border border-gray-200 rounded-md mb-2">
            <div className="flex-shrink-0">
              <LayerPreview layerName={layer.name} workspace={layer.workspace} map={map} />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <label className="flex items-start gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={(e) => layer.setVisible(e.target.checked)}
                  className="mt-0.5 flex-shrink-0"
                />
                <div className="flex flex-col">
                  <span className="block text-sm text-gray-900 leading-tight break-all">
                    {layer.title || layer.name}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    SRS: {layer.srs}
                  </span>
                </div>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};