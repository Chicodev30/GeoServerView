import { useState } from 'react';
import { ChevronUp, ChevronDown, ZoomIn, Search } from 'lucide-react';
import { Map } from 'ol';
import Feature from 'ol/Feature';

interface SearchCriteria {
  layer?: string;
  field?: string;
  operator?: string;
  value?: string;
}

interface BottomSheetProps {
  features: Feature[];
  onClose: () => void;
  map: Map;
  searchCriteria?: SearchCriteria;
}

export const BottomSheet = ({ features, onClose, map, searchCriteria }: BottomSheetProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleZoomToFeature = (feature: Feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      const extent = geometry.getExtent();
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000,
        maxZoom: 19
      });
    }
  };

  // Only render if there are features
  if (!features || features.length === 0) return null;

  const contentHeight = 300; // Fixed content height
  const headerHeight = 40; // Fixed header height
  const searchSummaryHeight = searchCriteria ? 40 : 0; // Height for search summary if present

  const getOperatorLabel = (operator: string) => {
    switch (operator) {
      case '=': return 'igual a';
      case '>': return 'maior que';
      case '<': return 'menor que';
      case '>=': return 'maior ou igual a';
      case '<=': return 'menor ou igual a';
      default: return operator;
    }
  };

  return (
    <div 
      className="fixed bottom-0 right-8 bg-white shadow-lg transition-transform duration-300 rounded-t-lg"
      style={{ 
        height: `${contentHeight}px`,
        width: '600px',
        zIndex: 1000,
        transform: isOpen ? 'translateY(0)' : `translateY(${contentHeight - headerHeight - searchSummaryHeight}px)`
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-gray-200 cursor-pointer bg-white rounded-t-lg"
        style={{ height: `${headerHeight}px` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          <span className="text-sm text-gray-700">
            {features.length} {features.length === 1 ? 'item selecionado' : 'itens selecionados'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700 text-sm px-2 py-1 rounded hover:bg-gray-100"
          >
            Limpar seleção
          </button>
          <button className="p-1 hover:bg-gray-100 rounded-full">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Search Summary */}
      {searchCriteria && (
        <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
          <div className="flex items-start gap-2">
            <Search className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 break-words flex-1">
              <span className="font-normal">Busca em </span>
              <span className="font-medium">{searchCriteria.layer}</span>
              <span className="font-normal">: campo </span>
              <span className="font-medium">{searchCriteria.field} </span>
              {searchCriteria.operator && (
                <span className="font-normal">{getOperatorLabel(searchCriteria.operator)} </span>
              )}
              <span className="font-medium">{searchCriteria.value}</span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div 
        className="p-2 overflow-y-auto"
        style={{ height: `${contentHeight - headerHeight - searchSummaryHeight}px` }}
      >
        {features.map((feature, index) => (
          <div 
            key={index} 
            className="mb-2 last:mb-0 p-2 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <div className="flex justify-end items-center mb-1">
              <button
                onClick={() => handleZoomToFeature(feature)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded text-xs hover:bg-blue-50 transition-colors"
              >
                <ZoomIn className="w-3 h-3" />
                <span>Zoom</span>
              </button>
            </div>
            <div className="space-y-1">
              {Object.entries(feature.getProperties())
                .filter(([key]) => key !== 'geometry' && key !== 'geom')
                .map(([key, value]) => (
                  <div 
                    key={key} 
                    className="text-xs p-1.5 rounded bg-white border border-gray-100 hover:border-gray-200 transition-colors"
                    onClick={() => handleZoomToFeature(feature)}
                  >
                    <span className="font-medium text-gray-600">{key}: </span>
                    <span className="text-gray-800 break-words">{String(value)}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};