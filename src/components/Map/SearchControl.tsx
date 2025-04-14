import { useState, useEffect } from 'react';
import { WMSLayer } from '../../types/map';
import { GeoJSON } from 'ol/format';
import Feature from 'ol/Feature';
import { useAuth } from '../../contexts/AuthContext';

interface SearchControlProps {
  layers: WMSLayer[];
  onFeaturesSelected: (features: Feature[], searchCriteria?: {
    layer?: string;
    field?: string;
    operator?: string;
    value?: string;
  }) => void;
  onSearchComplete?: () => void;
}

interface LayerField {
  name: string;
  type: 'string' | 'number';
}

interface SearchState {
  selectedLayer: string;
  selectedField: string;
  searchValue: string;
  operator: '=' | '>' | '<' | '>=' | '<=';
  fields: LayerField[];
}

export const SearchControl = ({ layers, onFeaturesSelected, onSearchComplete }: SearchControlProps) => {
  const { isAuthenticated } = useAuth();
  const [searchState, setSearchState] = useState<SearchState>({
    selectedLayer: '',
    selectedField: '',
    searchValue: '',
    operator: '=',
    fields: []
  });
  const [loading, setLoading] = useState(false);

  const visibleLayers = layers.filter(layer => layer.visible);

  useEffect(() => {
    const fetchLayerFields = async () => {
      if (!searchState.selectedLayer) return;

      const selectedLayer = layers.find(l => l.name === searchState.selectedLayer);
      if (!selectedLayer) return;

      setLoading(true);
      try {
        const response = await fetch(
          `https://imde.portoalegre.rs.gov.br/geoserver/wfs?service=WFS&version=1.0.0&request=DescribeFeatureType&typeName=${selectedLayer.workspace}:${selectedLayer.name}&outputFormat=application/json`,
          {
            headers: {
              'Authorization': 'Basic ' + btoa('admin:geoserver')
            }
          }
        );

        const data = await response.json();
        const fields: LayerField[] = data.featureTypes[0].properties
          .filter((prop: any) => prop.name !== 'geometry' && prop.name !== 'geom')
          .map((prop: any) => ({
            name: prop.name,
            type: prop.type.toLowerCase().includes('string') || 
                  prop.type.toLowerCase().includes('text') || 
                  prop.type.toLowerCase().includes('char') ? 'string' : 'number'
          }));

        setSearchState(prev => ({ 
          ...prev, 
          fields,
          selectedField: '',
          operator: '=',
          searchValue: ''
        }));
      } catch (error) {
        console.error('Error fetching layer fields:', error);
        alert('Erro ao carregar os campos da camada');
      } finally {
        setLoading(false);
      }
    };

    fetchLayerFields();
  }, [searchState.selectedLayer, layers]);

  const handleSearch = async () => {
    if (!searchState.selectedLayer || !searchState.selectedField || !searchState.searchValue) {
      alert('Por favor, preencha todos os campos de busca');
      return;
    }

    const selectedLayer = layers.find(l => l.name === searchState.selectedLayer);
    if (!selectedLayer) return;

    const field = searchState.fields.find(f => f.name === searchState.selectedField);
    if (!field) return;

    setLoading(true);
    try {
      const cql_filter = `${searchState.selectedField}${searchState.operator}${
        field.type === 'string' ? `'${searchState.searchValue}'` : searchState.searchValue
      }`;

      const url = `${selectedLayer.source.getUrls()[0]}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=${selectedLayer.workspace}:${selectedLayer.name}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cql_filter)}&srsName=EPSG:3857`;

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

        onFeaturesSelected(features, {
          layer: selectedLayer.title || selectedLayer.name,
          field: searchState.selectedField,
          operator: searchState.operator,
          value: searchState.searchValue
        });
        
        // Close the search panel
        onSearchComplete?.();
      } else {
        alert('Nenhum resultado encontrado');
        onFeaturesSelected([], undefined);
      }
    } catch (error) {
      console.error('Error searching features:', error);
      alert('Erro ao buscar feições');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    onFeaturesSelected([], undefined);
    setSearchState({
      selectedLayer: '',
      selectedField: '',
      searchValue: '',
      operator: '=',
      fields: []
    });
  };

  if (visibleLayers.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 rounded-lg">
        <p className="text-yellow-700">Por favor, selecione uma ou mais camadas para poder realizar sua busca.</p>
      </div>
    );
  }

  const selectedField = searchState.fields.find(f => f.name === searchState.selectedField);
  const isNumericField = selectedField?.type === 'number';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Camada</label>
        <select
          className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2"
          value={searchState.selectedLayer}
          onChange={(e) => setSearchState(prev => ({ 
            ...prev, 
            selectedLayer: e.target.value,
            selectedField: '',
            searchValue: '',
            operator: '='
          }))}
          disabled={loading}
        >
          <option value="">Selecione uma camada</option>
          {visibleLayers.map((layer) => (
            <option key={layer.name} value={layer.name}>
              {layer.title || layer.name}
            </option>
          ))}
        </select>
      </div>

      {searchState.selectedLayer && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Campo</label>
          {loading ? (
            <div className="text-sm text-gray-500">Carregando campos...</div>
          ) : (
            <select
              className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2"
              value={searchState.selectedField}
              onChange={(e) => setSearchState(prev => ({ 
                ...prev, 
                selectedField: e.target.value,
                searchValue: '',
                operator: '='
              }))}
              disabled={loading}
            >
              <option value="">Selecione um campo</option>
              {searchState.fields.map((field) => (
                <option key={field.name} value={field.name}>
                  {field.name} ({field.type === 'string' ? 'texto' : 'número'})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {searchState.selectedField && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
            <input
              type={isNumericField ? 'number' : 'text'}
              className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2"
              value={searchState.searchValue}
              onChange={(e) => setSearchState(prev => ({ ...prev, searchValue: e.target.value }))}
              placeholder={isNumericField ? "Digite um número" : "Digite o texto"}
              disabled={loading}
            />
          </div>
          {isNumericField && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Operador</label>
              <select
                className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2"
                value={searchState.operator}
                onChange={(e) => setSearchState(prev => ({ ...prev, operator: e.target.value as SearchState['operator'] }))}
                disabled={loading}
              >
                <option value="=">=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
              </select>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
        <button
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
          onClick={handleClear}
          disabled={loading}
        >
          Limpar
        </button>
      </div>
    </div>
  );
};