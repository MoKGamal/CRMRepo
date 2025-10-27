import {
  Component,
  AfterViewInit,
  Inject,
  PLATFORM_ID,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import * as turf from '@turf/turf';
import { environment } from '../../environments/environment';

type MapPin = {
  lat: number;
  lng: number;
  info: string; // may contain <br/> tags
  azimuth: number;
  zoom: number;
  sequence: string; // short label/number
};

type PinGroup = {
  color: string;  // hex color like "#FF0000"
  pins: MapPin[];
};

type MapRegion = {
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  defaultCenter: {
    lat: number;
    lng: number;
  };
  cartoUrl: string;
};

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  // Regional configurations
  private regions: MapRegion[] = [
    {
      name: 'Egypt',
      bounds: {
        north: 31.8,
        south: 22.0,
        east: 36.8,
        west: 24.7
      },
      defaultCenter: {
        lat: 30.0444, // Cairo
        lng: 31.2357
      },
      cartoUrl: environment.cartopmtilesUrl
    },
    {
      name: 'Rwanda',
      bounds: {
        north: -1.0,
        south: -2.9,
        east: 30.9,
        west: 28.9
      },
      defaultCenter: {
        lat: -1.9441, // Kigali
        lng: 30.0619
      },
      cartoUrl: environment.cartoRwandaPmtilesUrl
    }
  ];

  // Current region
  private currentRegion!: MapRegion;

  // Default view properties (will be set based on detected region)
  lng!: number;
  lat!: number;
  azimuth = 30;
  zoom = 7;

  // legacy single-pin state (query param fallback)
  MapInfo = '';
  isPinned = false;

  selectedStyle: string = 'satellite';
  mapInstance!: maplibregl.Map;

  // pins container (flat list for backward compatibility)
  pins: MapPin[] = [];
  
  // NEW: pin groups with colors
  pinGroups: PinGroup[] = [];

  // live references
  private markers: maplibregl.Marker[] = [];
  private popups: maplibregl.Popup[] = [];
  private coneLayerIds: string[] = [];
  private coneSourceIds: string[] = [];
  private currentInfoPopup: maplibregl.Popup | null = null; // ensure only one info popup at a time

  private messageHandler = (ev: MessageEvent) => this.onIncomingMessage(ev);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (!isPlatformBrowser(this.platformId)) return;

    // Initialize with default region (Egypt)
    this.currentRegion = this.regions[0];
    this.lng = this.currentRegion.defaultCenter.lng;
    this.lat = this.currentRegion.defaultCenter.lat;

    // Prefer same-tab state first - check for pin groups first, then flat pins
    if (Array.isArray(history.state?.pinGroups) && history.state.pinGroups.length) {
      this.setPinGroups(history.state.pinGroups as PinGroup[]);
    } else if (Array.isArray(history.state?.pins) && history.state.pins.length) {
      this.setPins(history.state.pins as MapPin[]);
    } else {
      // Legacy query param path (single pin)
      const params = new URLSearchParams(window.location.search);
      const lat = params.get('lat');
      const lng = params.get('lng');
      const info = params.get('info') || '';
      const azimuth = params.get('azimuth');
      const zoom = params.get('zoom');

      if (lat && lng) {
        const pinLat = parseFloat(lat);
        const pinLng = parseFloat(lng);
        
        // Detect region based on coordinates
        this.currentRegion = this.detectRegion(pinLat, pinLng);
        
        this.lat = pinLat;
        this.lng = pinLng;
        this.MapInfo = decodeURIComponent(info);
        this.zoom = zoom ? parseFloat(zoom) : this.zoom;
        this.azimuth = azimuth ? parseFloat(azimuth) : this.azimuth;
        this.isPinned = true;
        this.pins = [
          {
            lat: this.lat,
            lng: this.lng,
            info: this.MapInfo,
            azimuth: this.azimuth,
            zoom: this.zoom,
            sequence: '1',
          },
        ];
      } else {
        // window.name fallback
        try {
          const maybe = window.name ? JSON.parse(window.name) : null;
          if (Array.isArray(maybe) && maybe.length) {
            this.setPins(maybe);
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    window.addEventListener('message', this.messageHandler);

    await this.loadRTLPlugin();

    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const style = this.getMapStyle(this.selectedStyle, true);

    const startCenter = this.pins.length
      ? [this.pins[0].lng, this.pins[0].lat]
      : [this.lng, this.lat];
    const startZoom = this.pins.length
      ? this.pins[0].zoom ?? this.zoom
      : this.zoom;

    this.mapInstance = new maplibregl.Map({
      container: 'map',
      attributionControl: false,
      style,
      center: startCenter as [number, number],
      zoom: startZoom,
    });

    this.mapInstance.addControl(
      new maplibregl.NavigationControl(),
      'top-right'
    );
    this.mapInstance.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right'
    );

    // Style switcher
    const viewSwitcher = document.createElement('div');
    viewSwitcher.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    ['default', 'satellite'].forEach((styleName) => {
      const button = document.createElement('button');
      button.type = 'button';
      const titleMap: Record<string, string> = {
        default: 'Street View',
        satellite: 'OSM-Carto View',
      };
      button.title = titleMap[styleName];
      button.classList.add(`view-${styleName.toLowerCase()}`);
      button.onclick = () => this.setMapStyle(styleName);
      viewSwitcher.appendChild(button);
    });
    this.mapInstance.addControl(
      { onAdd: () => viewSwitcher, onRemove: () => viewSwitcher.remove() },
      'top-left'
    );

    // Region switcher
    const regionSwitcher = document.createElement('div');
    regionSwitcher.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    regionSwitcher.style.marginTop = '10px';
    
    this.regions.forEach((region) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = `Switch to ${region.name}`;
      button.textContent = region.name;
      button.style.fontSize = '12px';
      button.style.padding = '4px 8px';
      if (region === this.currentRegion) {
        button.style.backgroundColor = '#007cbf';
        button.style.color = 'white';
      }
      button.onclick = () => this.switchRegion(region);
      regionSwitcher.appendChild(button);
    });
    
    this.mapInstance.addControl(
      { onAdd: () => regionSwitcher, onRemove: () => regionSwitcher.remove() },
      'top-left'
    );

    this.mapInstance.on('load', () => {
      if (this.pinGroups.length > 0) {
        this.renderPinGroups(this.pinGroups);
        this.applyZoomForPins();
      } else if (this.pins.length) {
        this.renderPins(this.pins);
        this.applyZoomForPins();
      }
    });
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('message', this.messageHandler);
    }
  }

  /** Detect region based on coordinates */
  private detectRegion(lat: number, lng: number): MapRegion {
    for (const region of this.regions) {
      const { bounds } = region;
      if (lat >= bounds.south && lat <= bounds.north && 
          lng >= bounds.west && lng <= bounds.east) {
        return region;
      }
    }
    // Default to first region (Egypt) if no match
    return this.regions[0];
  }

  /** Switch to a different region */
  private switchRegion(region: MapRegion) {
    if (this.currentRegion === region) return;
    
    this.currentRegion = region;
    
    // Update default coordinates
    this.lng = region.defaultCenter.lng;
    this.lat = region.defaultCenter.lat;
    
    // If no pins, fly to the new region's center
    if (!this.pins.length) {
      this.mapInstance.flyTo({
        center: [this.lng, this.lat],
        zoom: this.zoom,
        speed: 1.2,
      });
    }
    
    // Update region switcher buttons
    const regionButtons = document.querySelectorAll('.maplibregl-ctrl-group button');
    regionButtons.forEach((btn) => {
      if (btn.textContent === region.name) {
        (btn as HTMLElement).style.backgroundColor = '#007cbf';
        (btn as HTMLElement).style.color = 'white';
      } else if (this.regions.some(r => r.name === btn.textContent)) {
        (btn as HTMLElement).style.backgroundColor = '';
        (btn as HTMLElement).style.color = '';
      }
    });
    
    // Refresh style to load correct pmtiles
    if (this.selectedStyle === 'satellite') {
      this.setMapStyle('satellite');
    }
  }

  /** postMessage flow */
  private onIncomingMessage(ev: MessageEvent) {
    const data = ev.data;
    
    // Check for pin groups first
    const pinGroups = data?.type === 'MAP_PIN_GROUPS' ? data.pinGroups : null;
    if (Array.isArray(pinGroups) && pinGroups.length) {
      this.setPinGroups(pinGroups);
      if (this.mapInstance?.isStyleLoaded()) {
        this.clearRenderedPins();
        this.renderPinGroups(this.pinGroups);
        this.applyZoomForPins();
      }
      return;
    }
    
    // Fallback to legacy flat pins
    const pins = Array.isArray(data)
      ? data
      : data?.type === 'MAP_PINS'
      ? data.pins
      : null;
    if (Array.isArray(pins) && pins.length) {
      this.setPins(pins);
      if (this.mapInstance?.isStyleLoaded()) {
        this.clearRenderedPins();
        this.renderPins(this.pins);
        this.applyZoomForPins();
      }
    }
  }

  private setPins(pins: MapPin[]) {
    this.pins = pins
      .map((p) => ({
        ...p,
        sequence: p.sequence ?? '',
        zoom: p.zoom ?? this.zoom,
        azimuth: p.azimuth ?? this.azimuth,
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    
    this.isPinned = this.pins.length > 0;

    if (this.isPinned) {
      const first = this.pins[0];
      
      // Detect region based on first pin
      const detectedRegion = this.detectRegion(first.lat, first.lng);
      if (detectedRegion !== this.currentRegion) {
        this.switchRegion(detectedRegion);
      }
      
      this.lat = first.lat;
      this.lng = first.lng;
      this.zoom = first.zoom;
      this.azimuth = first.azimuth;
      this.MapInfo = first.info ?? '';
    }
  }

  private setPinGroups(pinGroups: PinGroup[]) {
    this.pinGroups = pinGroups.map(group => ({
      color: group.color || '#FF0000',
      pins: group.pins
        .map((p) => ({
          ...p,
          sequence: p.sequence ?? '',
          zoom: p.zoom ?? this.zoom,
          azimuth: p.azimuth ?? this.azimuth,
        }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    })).filter(group => group.pins.length > 0);
    
    // Flatten to get all pins for legacy compatibility
    this.pins = this.pinGroups.flatMap(g => g.pins);
    this.isPinned = this.pins.length > 0;

    if (this.isPinned) {
      const first = this.pins[0];
      
      // Detect region based on first pin
      const detectedRegion = this.detectRegion(first.lat, first.lng);
      if (detectedRegion !== this.currentRegion) {
        this.switchRegion(detectedRegion);
      }
      
      this.lat = first.lat;
      this.lng = first.lng;
      this.zoom = first.zoom;
      this.azimuth = first.azimuth;
      this.MapInfo = first.info ?? '';
    }
  }

  private applyZoomForPins() {
    if (!this.mapInstance) return;
    if (this.pins.length === 1) {
      const p = this.pins[0];
      this.mapInstance.flyTo({
        center: [p.lng, p.lat],
        zoom: p.zoom ?? this.zoom,
        speed: 1.2,
      });
    } else if (this.pins.length > 1) {
      this.fitToPins(this.pins);
    }
  }

  /** NEW: Render pin groups with their respective colors */
  private renderPinGroups(pinGroups: PinGroup[]) {
    let globalIndex = 0;
    pinGroups.forEach((group) => {
      group.pins.forEach((pin) => {
        this.renderSinglePin(pin, globalIndex, group.color);
        globalIndex++;
      });
    });
  }

  /** CORE: two-popups-per-pin with single active info popup */
  private renderPins(pins: MapPin[]) {
    pins.forEach((pin, i) => {
      this.renderSinglePin(pin, i, '#FF0000');
    });
  }

  /** Render a single pin with the specified color */
  private renderSinglePin(pin: MapPin, index: number, color: string) {
    // marker
    const marker = new maplibregl.Marker({ color })
      .setLngLat([pin.lng, pin.lat])
      .addTo(this.mapInstance);
    this.markers.push(marker);

    // popup builders
    const makeSequencePopup = () =>
      new maplibregl.Popup({
        offset: [0, -35],
        closeButton: false,
        closeOnClick: false,
        maxWidth: "120px",
        className: "seq-popup"
      })
        .setLngLat([pin.lng, pin.lat])
        .setHTML(
          `<div class="seq-popup-inner"><strong>${wrapCsv(pin.sequence ?? "")}</strong></div>`
        );

    const INFO_POPUP_HEIGHT = 220; // px

    const makeInfoPopup = () =>
      new maplibregl.Popup({
        offset: [0, -35],
        closeButton: true,
        closeOnClick: true,
        maxWidth: '320px',
      })
        .setLngLat([pin.lng, pin.lat])
        .setHTML(
          `<div class="info-popup-scroll"
          style="max-height:${INFO_POPUP_HEIGHT}px;
                 overflow-y:auto;
                 white-space:normal;
                 line-height:1.3;
                 -webkit-overflow-scrolling:touch;
                 padding-right:2px;">
       ${sanitizeInfoHtml(pin.info ?? '')}
     </div>`
        );

    // initially show SEQUENCE
    let seqPopup = makeSequencePopup().addTo(this.mapInstance);
    this.popups.push(seqPopup);

    // per-pin info popup (created on demand)
    let infoPopup: maplibregl.Popup | null = null;

    const addPopupRef = (p: maplibregl.Popup) => {
      if (!this.popups.includes(p)) this.popups.push(p);
    };
    const removePopupRef = (p: maplibregl.Popup | null) => {
      if (!p) return;
      const idx = this.popups.indexOf(p);
      if (idx >= 0) this.popups.splice(idx, 1);
      p.remove();
    };

    // open info popup logic (ensures only one global info popup)
    const openInfo = () => {
      // close any other active info popup
      if (this.currentInfoPopup && this.currentInfoPopup.isOpen()) {
        this.currentInfoPopup.remove();
        this.currentInfoPopup = null;
      }

      // hide sequence for this pin
      if (seqPopup) {
        removePopupRef(seqPopup);
        seqPopup = null as any;
      }

      // (re)create info popup
      if (!infoPopup) {
        infoPopup = makeInfoPopup();

        // when info closes -> restore sequence (no close button)
        infoPopup.on('close', () => {
          if (this.currentInfoPopup === infoPopup) {
            this.currentInfoPopup = null;
          }
          removePopupRef(infoPopup);
          infoPopup = null;

          seqPopup = makeSequencePopup().addTo(this.mapInstance);
          addPopupRef(seqPopup);
        });
      } else {
        // make sure not to stack duplicates
        infoPopup.remove();
      }

      // open info
      infoPopup.addTo(this.mapInstance);
      addPopupRef(infoPopup);
      this.currentInfoPopup = infoPopup;

      // recenter/zoom
      this.mapInstance.flyTo({
        center: [pin.lng, pin.lat],
        zoom: pin.zoom ?? this.zoom,
        speed: 1.2,
      });
    };

    // click to open info
    marker.getElement().addEventListener('click', (e) => {
      e.stopPropagation();
      openInfo();
    });

    // azimuth cone (wedge) + arrow
    const coneId = `azimuth-cone-${index}`;
    this.drawAzimuthCone(
      this.mapInstance,
      pin.lng,
      pin.lat,
      pin.azimuth ?? 0,
      30,
      300,
      coneId
    );
  }

  private fitToPins(pins: MapPin[]) {
    if (pins.length <= 1) return;
    const bounds = new maplibregl.LngLatBounds();
    pins.forEach((p) => bounds.extend([p.lng, p.lat]));
    const maxZoom = Math.max(...pins.map((p) => p.zoom ?? 14));
    this.mapInstance.fitBounds(bounds, { padding: 60, maxZoom });
  }

  private clearRenderedPins() {
    // close any active info popup pointer
    if (this.currentInfoPopup) {
      this.currentInfoPopup.remove();
      this.currentInfoPopup = null;
    }

    this.markers.forEach((m) => m.remove());
    this.markers = [];
    this.popups.forEach((p) => p.remove());
    this.popups = [];

    this.coneLayerIds.forEach((layerId) => {
      if (this.mapInstance.getLayer(layerId))
        this.mapInstance.removeLayer(layerId);
    });
    this.coneSourceIds.forEach((sourceId) => {
      if (this.mapInstance.getSource(sourceId))
        this.mapInstance.removeSource(sourceId);
    });
    this.coneLayerIds = [];
    this.coneSourceIds = [];
  }

  setMapStyle(styleName: string) {
    this.selectedStyle = styleName;
    const newStyle = this.getMapStyle(styleName, false);
    this.mapInstance.setStyle(newStyle);

    this.mapInstance.once('styledata', () => {
      if (this.pinGroups.length > 0) {
        this.clearRenderedPins();
        this.renderPinGroups(this.pinGroups);
        this.applyZoomForPins();
      } else if (this.pins.length) {
        this.clearRenderedPins();
        this.renderPins(this.pins);
        this.applyZoomForPins();
      }
    });
  }

  getMapStyle(view: string, showLabels: boolean = true): any {
    const baseOrigin = window.location.origin;
    const isTopo = view === 'topo';
    const isSatellite = view === 'satellite';
    const isDark = view === 'dark';
    const flavor = isDark ? 'dark' : 'light';
    const spriteName = isSatellite ? 'satellite' : isDark ? 'dark' : 'light';

    const glyphs = `${baseOrigin}/assets/fonts/{fontstack}/{range}.pbf`;
    const sprite = `${baseOrigin}/assets/sprites/v4/${spriteName}`;

    const sources: any = {};
    const layersList: any[] = [];

    // Carto Tiles (Satellite view)
    if (isSatellite) {
      // Use the current region's carto URL
      sources['satellite'] = {
        type: 'raster',
        url: `pmtiles://${this.currentRegion.cartoUrl}`,
        tileSize: 256,
      };

      layersList.push({ id: 'satellite', type: 'raster', source: 'satellite' });

      if (showLabels) {
        sources['protomaps'] = {
          type: 'vector',
          url: `pmtiles://${environment.pmtilesUrl}`,
        };
        const labelLayers = layers('protomaps', namedFlavor('light'), {
          lang: 'ar',
        })
          .filter((l) => l.type === 'symbol')
          .map((l) => ({
            ...l,
            source: 'protomaps',
            layout: {
              ...l.layout,
              'text-font': ['Noto Sans Regular'],
              'text-anchor': 'right',
              'text-field': [
                'format',
                ['coalesce', ['get', 'name:ar'], ['get', 'name:en']],
                {},
              ],
            },
            paint: {
              ...l.paint,
              'text-color': '#FFFFFF',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
            },
          }));
        layersList.push(...labelLayers);
      }
    }
    // Topo Tiles
    else if (isTopo) {
      sources['topo'] = {
        type: 'raster',
        url: `pmtiles://${environment.topopmtilesUrl}`,
        tileSize: 256,
      };

      layersList.push({ id: 'topo', type: 'raster', source: 'topo' });
      if (showLabels) {
        sources['protomaps'] = {
          type: 'vector',
          url: `pmtiles://${environment.pmtilesUrl}`,
        };
        const labelLayers = layers('protomaps', namedFlavor('light'), {
          lang: 'ar',
        })
          .filter((l) => l.type === 'symbol')
          .map((l) => ({
            ...l,
            source: 'protomaps',
            layout: {
              ...l.layout,
              'text-font': ['Noto Sans Regular'],
              'text-anchor': 'right',
              'text-field': [
                'format',
                ['coalesce', ['get', 'name:ar'], ['get', 'name:en']],
                {},
              ],
            },
            paint: {
              ...l.paint,
              'text-color': '#FFFFFF',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
            },
          }));
        layersList.push(...labelLayers);
      }
    } else {
      // Default vector tiles
      sources['protomaps'] = {
        type: 'vector',
        url: `pmtiles://${environment.pmtilesUrl}`,
      };
      layersList.push(
        ...layers('protomaps', namedFlavor(flavor), { lang: 'ar' }).map(
          (layer) => {
            const id = layer.id || '';
            if (layer.type === 'symbol' && layer.layout?.['text-field']) {
              return {
                ...layer,
                layout: {
                  ...layer.layout,
                  'text-font': ['Noto Sans Regular'],
                  'text-anchor': 'right',
                  'text-field': [
                    'format',
                    ['coalesce', ['get', 'name:ar'], ['get', 'name:en']],
                    {},
                  ],
                },
                paint: {
                  ...layer.paint,
                  'text-color': isDark ? '#FFFFFF' : 'rgba(0, 0, 0, 0.64)',
                  ...(isDark && {
                    'text-halo-color': '#000000',
                    'text-halo-width': 1,
                  }),
                },
              };
            }
            if (isDark && layer.type === 'line' && /road|highway/.test(id)) {
              return {
                ...layer,
                paint: { ...layer.paint, 'line-color': '#AAAAAA' },
              };
            }
            if (isDark && layer.type === 'background') {
              return {
                ...layer,
                paint: { ...layer.paint, 'background-color': '#101010' },
              };
            }
            if (isDark && layer.type === 'fill' && /water|landuse/.test(id)) {
              return {
                ...layer,
                paint: { ...layer.paint, 'fill-color': '#222222' },
              };
            }
            return layer;
          }
        )
      );
    }

    return { version: 8, glyphs, sprite, sources, layers: layersList };
  }

  /**
   * Draw a wedge representing azimuth; unique ids allow multiple wedges.
   */
  private drawAzimuthCone(
    map: maplibregl.Map,
    lng: number,
    lat: number,
    azimuth: number,
    spread: number,
    distanceMeters: number,
    id: string
  ) {
    const center = turf.point([lng, lat]);
    const radiusKm = distanceMeters / 1000;
    const coneSteps = 64;
    const coords: number[][] = [[lng, lat]];
    for (let i = -spread; i <= spread; i += (2 * spread) / coneSteps) {
      const point = turf.destination(center, radiusKm, azimuth + i, {
        units: 'kilometers',
      });
      coords.push(point.geometry.coordinates);
    }
    coords.push([lng, lat]);

    const coneFeature: GeoJSON.Feature = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {},
    };

    const sourceId = `src-${id}`;
    const layerId = `lyr-${id}`;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: coneFeature });
      this.coneSourceIds.push(sourceId);
    } else {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(
        coneFeature
      );
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: { 'fill-color': '#FFA500', 'fill-opacity': 0.3 },
      });
      this.coneLayerIds.push(layerId);
    }

    const endpoint = turf.destination(center, radiusKm, azimuth, {
      units: 'kilometers',
    });
    const [arrowLng, arrowLat] = endpoint.geometry.coordinates;
    const arrowElement = document.createElement('div');
    arrowElement.innerHTML = '➤';
    arrowElement.style.fontSize = '24px';
    arrowElement.style.transform = `rotate(${azimuth}deg)`;
    arrowElement.style.color = 'red';
    const arrowMarker = new maplibregl.Marker({ element: arrowElement })
      .setLngLat([arrowLng, arrowLat])
      .addTo(map);
    this.markers.push(arrowMarker);
  }

  private loadRTLPlugin(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="mapbox-gl-rtl-text.js"]')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = './assets/plugins/mapbox-gl-rtl-text.js';
      script.onload = () => {
        (maplibregl as any).setRTLTextPlugin(
          './assets/plugins/mapbox-gl-rtl-text.js',
          true
        );
        resolve();
      };
      script.onerror = () => reject('Failed to load RTL plugin');
      document.body.appendChild(script);
    });
  }
}

/** Escape everything safely */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape everything EXCEPT <br> or <br/> so they render as line breaks.
 * Works whether the source string already has literal <br> or HTML-escaped versions.
 */
function escapeHtmlAllowBr(s: string): string {
  const str = String(s);
  // Temporarily protect real <br> tags
  const protectedStr = str.replace(/<br\s*\/?>/gi, '___BR___');
  // Escape the rest
  const escaped = escapeHtml(protectedStr);
  // Restore the <br> tags (also handle cases where input had &lt;br&gt;)
  return escaped
    .replace(/___BR___/g, '<br>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>');
}

function sanitizeInfoHtml(s: string): string {
  const allowedTags = new Set([
    "br", "b", "strong", "i", "em",
    "table", "thead", "tbody", "tr", "td", "th",
    "div", "span"
  ]);
  const allowedAttrs = new Set(["style", "colspan", "rowspan"]);

  const root = document.createElement("div");
  root.innerHTML = normalizeInfoHtml(s);

  const walk = (el: Element) => {
    // clean attributes
    Array.from(el.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      if (/^on/i.test(name)) el.removeAttribute(attr.name);         // no event handlers
      else if (name === "style" && /url\(|expression\(/i.test(attr.value)) {
        el.removeAttribute("style");                                 // no url()/expression()
      } else if (!allowedAttrs.has(name)) {
        el.removeAttribute(attr.name);
      }
    });

    Array.from(el.children).forEach(child => {
      const tag = child.tagName.toLowerCase();
      if (!allowedTags.has(tag)) {
        child.replaceWith(document.createTextNode(child.textContent ?? ""));
      } else {
        walk(child);
      }
    });
  };

  walk(root);
  return root.innerHTML;
}

function wrapCsv(seq: string): string {
  const safe = escapeHtml(seq || "");
  return safe.replace(/,/g, ",&#8203;"); // zero‑width space after comma
}

/** Fix common info fragments before sanitizing */
function normalizeInfoHtml(raw: string): string {
  if (!raw) return "";

  // 1) Decode if URL-encoded
  let s = /%(?:[0-9A-Fa-f]{2})/.test(raw) ? decodeURIComponent(raw) : raw;

  // 2) Remove a leading CSV like "1,4,5" line if present
  s = s.replace(/^\s*\d+(?:\s*,\s*\d+)+\s*(?:\r?\n|$)/, "");

  // 3) If there's a table fragment but no <table>, wrap it
  const fragIdx = s.search(/<(thead|tbody|tr)\b/i);
  if (fragIdx >= 0 && !/<table\b/i.test(s)) {
    const head = s.slice(0, fragIdx);
    const tableFrag = s.slice(fragIdx);
    s = `${head}<table style="border-collapse:collapse;margin-top:4px">${tableFrag}</table>`;
  }

  // 4) Make "Tracking Time" a header if it's just text
  s = s.replace(/(^|>|\n)\s*Tracking Time\s*(?=<|$)/i,
                `$1<div style="margin-top:6px"><strong>Tracking Time</strong></div>`);

  // 5) Convert newlines to <br> so the plain lines break correctly
  s = s.replace(/\r?\n/g, "<br>");

  return s;
}
