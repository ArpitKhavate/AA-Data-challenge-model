declare module "react-simple-maps" {
  import type { ComponentType, CSSProperties, ReactNode } from "react";

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }
  export const ComposableMap: ComponentType<ComposableMapProps>;

  interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number } | any) => void;
    children?: ReactNode;
  }
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;

  interface GeographiesProps {
    geography: string | Record<string, unknown>;
    children: (data: { geographies: Geography[] }) => ReactNode;
  }
  export const Geographies: ComponentType<GeographiesProps>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Geography = any;

  interface GeographyProps {
    geography: Geography;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
  }
  export const Geography: ComponentType<GeographyProps>;

  interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
  }
  export const Marker: ComponentType<MarkerProps>;

  interface LineProps {
    from: [number, number];
    to: [number, number];
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    strokeLinecap?: string;
    strokeDasharray?: string;
  }
  export const Line: ComponentType<LineProps>;

  interface AnnotationProps {
    subject: [number, number];
    dx?: number;
    dy?: number;
    children?: ReactNode;
  }
  export const Annotation: ComponentType<AnnotationProps>;

  interface GraticuleProps {
    stroke?: string;
    strokeWidth?: number;
  }
  export const Graticule: ComponentType<GraticuleProps>;

  interface SphereProps {
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
  }
  export const Sphere: ComponentType<SphereProps>;
}
