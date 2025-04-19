import { useState, useRef, useEffect, useCallback } from 'react';
import { Map } from 'ol';
import { WMSLayer } from '../../types/map';
import { SketchPicker } from 'react-color';
import { Upload, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface StyleControlProps {
  map: Map;
  layers: WMSLayer[];
}

interface LayerStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  selectedIcon?: string;
}

interface LayerGeometryType {
  layerName: string;
  isPoint: boolean;
}

const availableIcons = [
  {
    name: 'Feira',
    url: 'https://raw.githubusercontent.com/Chicodev30/icones-geonode-chico/refs/heads/main/icones/feira.png'
  },
  {
    name: 'Home',
    url: 'https://raw.githubusercontent.com/Chicodev30/icones-geonode-chico/refs/heads/main/icones/home.png'
  },
  {
    name: 'Market',
    url: 'https://raw.githubusercontent.com/Chicodev30/icones-geonode-chico/refs/heads/main/icones/market.svg'
  },
  {
    name: 'Market 2',
    url: 'https://raw.githubusercontent.com/Chicodev30/icones-geonode-chico/refs/heads/main/icones/market2.svg'
  }
];

export const StyleControl = ({ map, layers }: StyleControlProps) => {
  const { serverUrl, getAuthHeader } = useAuth();
  const [selectedLayer, setSelectedLayer] = useState<string>('');
  const [showFillPicker, setShowFillPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const [showIconDropdown, setShowIconDropdown] = useState(false);
  const [styleMode, setStyleMode] = useState<'basic' | 'icon'>('basic');
  const [layerTypes, setLayerTypes] = useState<Record<string, boolean>>({});
  const [currentStyle, setCurrentStyle] = useState<LayerStyle>({
    fillColor: '#FF0000',
    strokeColor: '#000000',
    strokeWidth: 1
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleLayers = layers.filter(layer => layer.visible);

  const uploadIcon = async (file: File, workspace: string): Promise<string> => {
    try {
      // Criar um nome único para o arquivo
      const timestamp = Date.now();
      const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const uniqueName = `${baseName}_${timestamp}.svg`;

      // Fazer upload do arquivo para o diretório de dados do GeoServer
      console.log('Fazendo upload do ícone:', uniqueName);
      
      // Primeiro criar o estilo vazio
      const createStyleResponse = await fetch(`${serverUrl}/rest/workspaces/${workspace}/styles`, {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          style: {
            name: uniqueName,
            filename: uniqueName
          }
        })
      });

      if (!createStyleResponse.ok) {
        console.error('Erro ao criar estilo:', await createStyleResponse.text());
        throw new Error('Erro ao criar estilo');
      }

      // Agora fazer upload do arquivo SVG
      const uploadResponse = await fetch(`${serverUrl}/rest/workspaces/${workspace}/styles/${uniqueName}`, {
        method: 'PUT',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'image/svg+xml'
        },
        body: file
      });

      if (!uploadResponse.ok) {
        console.error('Erro ao fazer upload:', await uploadResponse.text());
        throw new Error('Erro ao fazer upload do ícone');
      }

      return uniqueName;
    } catch (error) {
      console.error('Erro ao fazer upload do ícone:', error);
      throw error;
    }
  };

  const convertToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        // Remove o prefixo "data:image/svg+xml;base64," se existir
        const base64 = base64String.replace(/^data:image\/svg\+xml;base64,/, '');
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const generateSLD = (layerName: string, style: LayerStyle) => {
    const fillColor = style.fillColor.replace('#', '');
    const strokeColor = style.strokeColor.replace('#', '');

    let pointSymbolizer = `
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#${fillColor}</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#${strokeColor}</CssParameter>
                  <CssParameter name="stroke-width">${style.strokeWidth}</CssParameter>
                </Stroke>
              </Mark>
              <Size>10</Size>
            </Graphic>
          </PointSymbolizer>`;

    if (styleMode === 'icon' && style.selectedIcon) {
      pointSymbolizer = `
          <PointSymbolizer>
            <Graphic>
              <ExternalGraphic>
                <OnlineResource xmlns:xlink="http://www.w3.org/1999/xlink" xlink:type="simple" xlink:href="${style.selectedIcon}"/>
                <Format>image/${style.selectedIcon.endsWith('.svg') ? 'svg+xml' : 'png'}</Format>
              </ExternalGraphic>
              <Opacity>1.0</Opacity>
              <Size>24</Size>
            </Graphic>
          </PointSymbolizer>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" 
    xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd" 
    xmlns="http://www.opengis.net/sld" 
    xmlns:ogc="http://www.opengis.net/ogc" 
    xmlns:xlink="http://www.w3.org/1999/xlink" 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>${layerName}</Name>
    <UserStyle>
      <Title>Style</Title>
      <FeatureTypeStyle>
        <Rule>
          <PolygonSymbolizer>
            <Fill>
              <CssParameter name="fill">#${fillColor}</CssParameter>
              <CssParameter name="fill-opacity">0.7</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#${strokeColor}</CssParameter>
              <CssParameter name="stroke-width">${style.strokeWidth}</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#${strokeColor}</CssParameter>
              <CssParameter name="stroke-width">${style.strokeWidth}</CssParameter>
            </Stroke>
          </LineSymbolizer>
          ${pointSymbolizer}
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;
  };

  const applyStyle = async () => {
    try {
      const layer = layers.find(l => l.name === selectedLayer);
      if (!layer) {
        console.error('Camada não encontrada:', selectedLayer);
        return;
      }

      console.log('Aplicando estilo para a camada:', layer.name);
      console.log('Estilo atual:', currentStyle);

      // Usar o nome da camada como nome do estilo
      const styleName = layer.name;
      const sld = generateSLD(layer.name, currentStyle);
      console.log('SLD gerado:', sld);

      let updateSuccess = false;

      // Tentar atualizar o estilo existente no workspace
      console.log('Tentando atualizar estilo no workspace:', styleName);
      try {
        // Primeiro enviar o SLD
        const uploadResponse = await fetch(`${serverUrl}/rest/workspaces/${layer.workspace}/styles/${styleName}`, {
          method: 'PUT',
          headers: {
            'Authorization': getAuthHeader(),
            'Content-Type': 'application/vnd.ogc.sld+xml'
          },
          body: sld
        });

        if (uploadResponse.ok) {
          updateSuccess = true;
          console.log('Estilo atualizado no workspace com sucesso');
        } else {
          const uploadError = await uploadResponse.text();
          console.log('Erro ao atualizar SLD no workspace:', uploadError);
          
          // Se falhou ao atualizar, tentar criar
          console.log('Tentando criar novo estilo no workspace:', styleName);
          const createResponse = await fetch(`${serverUrl}/rest/workspaces/${layer.workspace}/styles`, {
            method: 'POST',
            headers: {
              'Authorization': getAuthHeader(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              style: {
                name: styleName,
                filename: `${styleName}.sld`
              }
            })
          });

          if (createResponse.ok) {
            // Tentar enviar o SLD novamente após criar o estilo
            const retryUpload = await fetch(`${serverUrl}/rest/workspaces/${layer.workspace}/styles/${styleName}`, {
              method: 'PUT',
              headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/vnd.ogc.sld+xml'
              },
              body: sld
            });

            if (retryUpload.ok) {
              updateSuccess = true;
              console.log('Novo estilo criado e atualizado com sucesso');
            } else {
              const retryError = await retryUpload.text();
              console.log('Erro ao enviar SLD após criar estilo:', retryError);
            }
          } else {
            const createError = await createResponse.text();
            console.log('Erro ao criar novo estilo:', createError);
          }
        }
      } catch (error) {
        console.log('Erro ao atualizar/criar estilo:', error);
      }

      if (!updateSuccess) {
        console.error('Não foi possível aplicar o estilo');
        return;
      }

      // Definir o estilo como padrão para a camada
      console.log('Definindo estilo como padrão para a camada');
      const setDefaultStyleResponse = await fetch(`${serverUrl}/rest/layers/${layer.workspace}:${layer.name}`, {
        method: 'PUT',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          layer: {
            defaultStyle: {
              name: styleName,
              workspace: layer.workspace
            }
          }
        })
      });

      if (!setDefaultStyleResponse.ok) {
        const defaultError = await setDefaultStyleResponse.text();
        console.error('Erro ao definir estilo padrão:', defaultError);
        return;
      }

      // Atualizar a camada no mapa
      console.log('Atualizando camada no mapa');
      const source = layer.source;
      const params = source.getParams();
      params.STYLES = `${layer.workspace}:${styleName}`;
      params._timestamp = Date.now();
      source.updateParams(params);
      
      console.log('Estilo aplicado com sucesso!');
    } catch (error) {
      console.error('Erro ao aplicar estilo:', error);
    }
  };

  const fetchLayerType = useCallback(async (workspace: string, layerName: string): Promise<boolean> => {
    try {
      // Verificar se já temos o tipo desta camada
      if (layerTypes[layerName] !== undefined) {
        return layerTypes[layerName];
      }

      const response = await fetch(
        `${serverUrl}/wfs?` +
        'service=WFS&' +
        'version=1.0.0&' +
        'request=DescribeFeatureType&' +
        `typeName=${workspace}:${layerName}&` +
        'outputFormat=application/json',
        {
          headers: {
            'Authorization': getAuthHeader()
          }
        }
      );

      if (!response.ok) {
        console.error('Erro ao buscar tipo da camada:', await response.text());
        return false;
      }

      const data = await response.json();
      const properties = data.featureTypes[0]?.properties || [];
      const geometryProperty = properties.find((prop: any) => 
        prop.type.includes('gml:') || 
        prop.type.includes('Point') || 
        prop.type.includes('MultiPoint') ||
        prop.type.includes('Geometry')
      );

      const isPoint = geometryProperty?.type.includes('Point') || 
                     geometryProperty?.type.includes('MultiPoint');

      console.log(`Camada ${layerName} é do tipo:`, geometryProperty?.type);
      
      // Atualizar o cache de tipos
      setLayerTypes(prev => ({
        ...prev,
        [layerName]: isPoint
      }));

      return isPoint;
    } catch (error) {
      console.error('Erro ao verificar tipo da camada:', error);
      return false;
    }
  }, [serverUrl, getAuthHeader, layerTypes]);

  // Efeito para buscar o tipo apenas da camada selecionada
  useEffect(() => {
    if (selectedLayer && layerTypes[selectedLayer] === undefined) {
      const layer = layers.find(l => l.name === selectedLayer);
      if (layer) {
        fetchLayerType(layer.workspace, layer.name);
      }
    }
  }, [selectedLayer, layers, fetchLayerType]);

  const isPointLayer = (layerName: string): boolean => {
    return layerTypes[layerName] || false;
  };

  const handleLayerChange = (layerName: string) => {
    setSelectedLayer(layerName);
    setStyleMode('basic');
    setCurrentStyle({
      fillColor: '#FF0000',
      strokeColor: '#000000',
      strokeWidth: 1
    });
  };

  const handleStyleModeChange = (mode: 'basic' | 'icon') => {
    setStyleMode(mode);
    if (mode === 'basic') {
      setCurrentStyle(prev => ({
        ...prev,
        selectedIcon: undefined
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Selecione a Camada
        </label>
        <select
          className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2"
          value={selectedLayer}
          onChange={(e) => handleLayerChange(e.target.value)}
        >
          <option value="">Selecione uma camada</option>
          {visibleLayers.map(layer => (
            <option key={layer.name} value={layer.name}>
              {layer.title || layer.name}
            </option>
          ))}
        </select>
      </div>

      {selectedLayer && isPointLayer(selectedLayer) && (
        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 px-4 py-2 rounded ${
              styleMode === 'basic' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
            onClick={() => handleStyleModeChange('basic')}
          >
            Estilizar Camada
          </button>
          <button
            className={`flex-1 px-4 py-2 rounded ${
              styleMode === 'icon' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
            onClick={() => handleStyleModeChange('icon')}
          >
            Escolher Ícone
          </button>
        </div>
      )}

      {selectedLayer && (
        <div className="space-y-4">
          {(!isPointLayer(selectedLayer) || styleMode === 'basic') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cor de Preenchimento
                </label>
                <div className="relative">
                  <button
                    className="w-full h-10 rounded-md border border-gray-300 shadow-sm"
                    style={{ backgroundColor: currentStyle.fillColor }}
                    onClick={() => setShowFillPicker(!showFillPicker)}
                  />
                  {showFillPicker && (
                    <div className="absolute z-10 mt-2">
                      <div
                        className="fixed inset-0"
                        onClick={() => setShowFillPicker(false)}
                      />
                      <SketchPicker
                        color={currentStyle.fillColor}
                        onChange={(color) => {
                          setCurrentStyle(prev => ({
                            ...prev,
                            fillColor: color.hex
                          }));
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cor da Borda
                </label>
                <div className="relative">
                  <button
                    className="w-full h-10 rounded-md border border-gray-300 shadow-sm"
                    style={{ backgroundColor: currentStyle.strokeColor }}
                    onClick={() => setShowStrokePicker(!showStrokePicker)}
                  />
                  {showStrokePicker && (
                    <div className="absolute z-10 mt-2">
                      <div
                        className="fixed inset-0"
                        onClick={() => setShowStrokePicker(false)}
                      />
                      <SketchPicker
                        color={currentStyle.strokeColor}
                        onChange={(color) => {
                          setCurrentStyle(prev => ({
                            ...prev,
                            strokeColor: color.hex
                          }));
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Espessura da Borda
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2"
                  value={currentStyle.strokeWidth}
                  onChange={(e) => setCurrentStyle(prev => ({
                    ...prev,
                    strokeWidth: Number(e.target.value)
                  }))}
                />
              </div>
            </>
          )}

          {isPointLayer(selectedLayer) && styleMode === 'icon' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selecione o Ícone
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowIconDropdown(!showIconDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm bg-white hover:bg-gray-50"
                >
                  <span>{currentStyle.selectedIcon ? availableIcons.find(i => i.url === currentStyle.selectedIcon)?.name : 'Selecione um ícone'}</span>
                  <ChevronDown className="w-5 h-5" />
                </button>
                
                {showIconDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    <div className="py-1">
                      {availableIcons.map((icon) => (
                        <button
                          key={icon.url}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                          onClick={() => {
                            setCurrentStyle(prev => ({
                              ...prev,
                              selectedIcon: icon.url
                            }));
                            setShowIconDropdown(false);
                          }}
                        >
                          <img src={icon.url} alt={icon.name} className="w-6 h-6" />
                          {icon.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            onClick={applyStyle}
          >
            Aplicar Estilo
          </button>
        </div>
      )}
    </div>
  );
}; 