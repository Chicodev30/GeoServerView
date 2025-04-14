import { Layer } from 'ol/layer';
import TileWMS from 'ol/source/TileWMS';

export interface WMSLayer {
  name: string;
  title: string;
  layer: Layer;
  source: TileWMS;
  visible: boolean;
  workspace: string;
  srs: string;
  setVisible: (visible: boolean) => void;
}

export interface Workspace {
  name: string;
  title: string;
  selected: boolean;
}