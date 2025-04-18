import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GeoJSON } from 'ol/format';
import { Feature } from 'ol';
import { MessageDialog } from '../UI/MessageDialog';

interface SearchControlProps {
  layers: any[];
  onFeaturesSelected: (features: Feature[], criteria?: SearchCriteria) => void;
  onSearchComplete?: () => void;
}

interface SearchState {
  selectedLayer: string;
  selectedField: string;
  searchValue: string;
  operator: string;
  fields: LayerField[];
}

interface LayerField {
  name: string;
  type: 'string' | 'number';
}

interface SearchCriteria {
  layer: string;
  field: string;
  operator?: string;
  value: string;
}

export const SearchControl = ({ layers, onFeaturesSelected, onSearchComplete }: SearchControlProps) => {
  const { isAuthenticated, serverUrl, getAuthHeader } = useAuth();
  const [searchState, setSearchState] = useState<SearchState>({
    selectedLayer: '',
    selectedField: '',
    searchValue: '',
    operator: '=',
    fields: []
  });
  const [loading, setLoading] = useState(false);
  const [isRasterLayer, setIsRasterLayer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const visibleLayers = layers.filter(layer => layer.visible);

  const checkIfRasterLayer = async (workspace: string, layerName: string) => {
    try {
      const response = await fetch(
        `${serverUrl}/wms?service=WMS&version=1.1.0&request=GetCapabilities`,
        {
          headers: {
            'Authorization': getAuthHeader()
          }
        }
      );

      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      
      const layers = xmlDoc.getElementsByTagName('Layer');
      const fullLayerName = `${workspace}:${layerName}`;

      for (let i = 0; i < layers.length; i++) {
        const nameElement = layers[i].getElementsByTagName('Name')[0];
        if (nameElement && nameElement.textContent === fullLayerName) {
          // Verifica se tem o elemento KeywordList com a palavra "raster"
          const keywordElements = layers[i].getElementsByTagName('Keyword');
          for (let j = 0; j < keywordElements.length; j++) {
            if (keywordElements[j].textContent?.toLowerCase().includes('raster')) {
              return true;
            }
          }
          // Verifica se tem o elemento Style com nome "raster"
          const styleElements = layers[i].getElementsByTagName('Style');
          for (let j = 0; j < styleElements.length; j++) {
            const styleName = styleElements[j].getElementsByTagName('Name')[0]?.textContent;
            if (styleName?.toLowerCase().includes('raster')) {
              return true;
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking if layer is raster:', error);
      return false;
    }
  };

  const fetchUniqueValues = async (workspace: string, layerName: string, fieldName: string, searchText: string = '') => {
    try {
      // Escapa caracteres especiais do CQL
      const escapedSearchText = searchText.replace(/['\\%_]/g, '\\$&');
      const cql_filter = searchText ? `${fieldName} ILIKE '${escapedSearchText}%'` : '';
      const filterParam = cql_filter ? `&CQL_FILTER=${encodeURIComponent(cql_filter)}` : '';
      
      const url = `${serverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=${workspace}:${layerName}&propertyName=${fieldName}${filterParam}&outputFormat=application/json`;

      const response = await fetch(url, {
        headers: {
          'Authorization': getAuthHeader(),
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const uniqueValues = Array.from(new Set(
        data.features
          .map((feature: any) => feature.properties[fieldName])
          .filter((value: any) => value !== null && value !== undefined)
      )).sort();

      return uniqueValues as string[];
    } catch (error) {
      console.error('Error fetching unique values:', error);
      return [];
    }
  };

  useEffect(() => {
    const fetchLayerFields = async () => {
      if (!searchState.selectedLayer) return;

      const selectedLayer = layers.find(l => l.name === searchState.selectedLayer);
      if (!selectedLayer) return;

      setLoading(true);
      try {
        // Primeiro verifica se é uma camada raster
        const isRaster = await checkIfRasterLayer(selectedLayer.workspace, selectedLayer.name);
        setIsRasterLayer(isRaster);

        if (isRaster) {
          setSearchState(prev => ({
            ...prev,
            fields: [],
            selectedField: '',
            operator: '=',
            searchValue: ''
          }));
          setMessage('Desculpe, não é possível fazer pesquisa nessa camada raster.');
          return;
        }

        const response = await fetch(
          `${serverUrl}/wfs?service=WFS&version=1.0.0&request=DescribeFeatureType&typeName=${selectedLayer.workspace}:${selectedLayer.name}&outputFormat=application/json`,
          {
            headers: {
              'Authorization': getAuthHeader(),
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Resposta do servidor não está em formato JSON');
        }

        const data = await response.json();
        if (!data.featureTypes || !data.featureTypes[0] || !data.featureTypes[0].properties) {
          throw new Error('Estrutura de dados inválida na resposta');
        }

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
        setMessage('Erro ao carregar os campos da camada. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchLayerFields();
  }, [searchState.selectedLayer, layers, serverUrl, getAuthHeader]);

  useEffect(() => {
    const updateSuggestions = async () => {
      if (!searchState.selectedLayer || !searchState.selectedField || !searchState.searchValue) {
        setSuggestions([]);
        return;
      }

      const selectedLayer = layers.find(l => l.name === searchState.selectedLayer);
      if (!selectedLayer) return;

      const field = searchState.fields.find(f => f.name === searchState.selectedField);
      if (!field || field.type !== 'string') return;

      const values = await fetchUniqueValues(
        selectedLayer.workspace,
        selectedLayer.name,
        searchState.selectedField,
        searchState.searchValue
      );

      setSuggestions(values);
    };

    const debounceTimer = setTimeout(updateSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchState.searchValue, searchState.selectedLayer, searchState.selectedField]);

  const handleSearch = async () => {
    if (!searchState.selectedLayer || !searchState.selectedField || !searchState.searchValue) {
      setMessage('Por favor, preencha todos os campos de busca');
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

      const url = `${serverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=${selectedLayer.workspace}:${selectedLayer.name}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cql_filter)}&srsName=EPSG:3857`;

      const response = await fetch(url, {
        headers: {
          'Authorization': getAuthHeader(),
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Resposta do servidor não está em formato JSON');
      }

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
        setMessage('Nenhum resultado encontrado');
        onFeaturesSelected([], undefined);
      }
    } catch (error) {
      console.error('Error searching features:', error);
      setMessage('Erro ao buscar feições. Por favor, verifique os parâmetros e tente novamente.');
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
    setIsRasterLayer(false);
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
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Camada</label>
          <select
            className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2"
            value={searchState.selectedLayer}
            onChange={(e) => {
              setSearchState(prev => ({ 
                ...prev, 
                selectedLayer: e.target.value,
                selectedField: '',
                operator: '=',
                searchValue: ''
              }));
            }}
            disabled={loading}
          >
            <option value="">Selecione uma camada</option>
            {visibleLayers.map(layer => (
              <option key={layer.name} value={layer.name}>
                {layer.title || layer.name}
              </option>
            ))}
          </select>
        </div>

        {searchState.selectedLayer && !isRasterLayer && (
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

        {searchState.selectedField && !isRasterLayer && (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
              <div className="relative">
                <input
                  type={isNumericField ? 'number' : 'text'}
                  className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 pr-10"
                  value={searchState.searchValue}
                  onChange={(e) => {
                    setSearchState(prev => ({ ...prev, searchValue: e.target.value }));
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    // Ao focar, busca todas as opções disponíveis
                    if (!isNumericField) {
                      const selectedLayer = layers.find(l => l.name === searchState.selectedLayer);
                      if (selectedLayer) {
                        fetchUniqueValues(
                          selectedLayer.workspace,
                          selectedLayer.name,
                          searchState.selectedField,
                          ''
                        ).then(values => setSuggestions(values));
                      }
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder={isNumericField ? "Digite um número" : "Digite ou selecione um valor"}
                  disabled={loading}
                />
                {!isNumericField && (
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 px-2 flex items-center bg-gray-50 rounded-r-md border-l border-gray-300 hover:bg-gray-100 focus:outline-none"
                    onClick={() => {
                      const selectedLayer = layers.find(l => l.name === searchState.selectedLayer);
                      if (selectedLayer) {
                        fetchUniqueValues(
                          selectedLayer.workspace,
                          selectedLayer.name,
                          searchState.selectedField,
                          ''
                        ).then(values => {
                          setSuggestions(values);
                          setShowSuggestions(!showSuggestions);
                        });
                      }
                    }}
                  >
                    <svg
                      className="h-5 w-5 text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>
              {!isNumericField && showSuggestions && suggestions.length > 0 && (
                <div 
                  className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                  onMouseDown={(e) => e.preventDefault()} // Previne o fechamento do dropdown ao clicar
                >
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setSearchState(prev => ({ ...prev, searchValue: suggestion }));
                        setShowSuggestions(false);
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
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
                  <option value="<>">≠</option>
                </select>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:bg-blue-300"
            onClick={handleSearch}
            disabled={loading || !searchState.selectedLayer || !searchState.selectedField || !searchState.searchValue || isRasterLayer}
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          <button
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
            onClick={handleClear}
            disabled={loading}
          >
            Limpar
          </button>
        </div>
      </div>
      {message && (
        <MessageDialog
          message={message}
          onClose={() => setMessage(null)}
        />
      )}
    </div>
  );
};