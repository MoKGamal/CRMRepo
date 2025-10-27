# Pin Groups with Colors - Usage Guide

## Overview

Your Angular map component has been updated to support **pin groups with individual colors**. Instead of a flat list of pins, you can now organize pins into groups where each group has its own color.

## Structure

### PinGroup Interface

```typescript
interface PinGroup {
  color: string;  // Hex color like "#FF0000", "#00FF00", "#0000FF"
  pins: MapPin[];
}
```

### MapPin Interface (unchanged)

```typescript
interface MapPin {
  lat: number;
  lng: number;
  info: string;
  azimuth: number;
  zoom: number;
  sequence: string;
}
```

## Example Usage

### In launcher.component.ts

```typescript
pinGroupsJson = JSON.stringify([
  {
    color: "#FF0000",  // Red pins
    pins: [
      { 
        lat: 47.5162, 
        lng: 14.5501, 
        info: MapInfo, 
        azimuth: 60, 
        zoom: 7, 
        sequence: '1,4,5' 
      },
      { 
        lat: 47.6162, 
        lng: 14.6501, 
        info: MapInfo, 
        azimuth: 90, 
        zoom: 10, 
        sequence: '3,6,9' 
      }
    ]
  },
  {
    color: "#00FF00",  // Green pins
    pins: [
      { 
        lat: 30.098485, 
        lng: 31.381765, 
        info: MapInfo, 
        azimuth: 120, 
        zoom: 14, 
        sequence: '2,3,61' 
      }
    ]
  },
  {
    color: "#0000FF",  // Blue pins
    pins: [
      { 
        lat: 30.198485, 
        lng: 31.481765, 
        info: MapInfo, 
        azimuth: 180, 
        zoom: 12, 
        sequence: '7,8,9' 
      }
    ]
  }
], null, 2);
```

## Communication Methods

### 1. New Tab (postMessage)

```typescript
openNewTabAndPost() {
  // Sends data with type 'MAP_PIN_GROUPS'
  win.postMessage({ type: 'MAP_PIN_GROUPS', pinGroups }, location.origin);
}
```

### 2. Same Tab (Router State)

```typescript
openSameTabWithState() {
  this.router.navigateByUrl('/map', { state: { pinGroups } });
}
```

## Map Component Changes

The `map.component.ts` has been updated to:

1. **Accept pin groups** - Checks for `pinGroups` in both `history.state` and `postMessage` data
2. **Render with colors** - Each pin is rendered with its group's color
3. **Backward compatibility** - Still supports the old flat `pins` array format

### Key Methods

- `setPinGroups(pinGroups: PinGroup[])` - Processes incoming pin groups
- `renderPinGroups(pinGroups: PinGroup[])` - Renders all groups with their colors
- `renderSinglePin(pin: MapPin, index: number, color: string)` - Renders individual pins with specified color

## Color Examples

Common hex colors you can use:

- `#FF0000` - Red
- `#00FF00` - Green
- `#0000FF` - Blue
- `#FFFF00` - Yellow
- `#FF00FF` - Magenta
- `#00FFFF` - Cyan
- `#FFA500` - Orange
- `#800080` - Purple
- `#FFC0CB` - Pink
- `#A52A2A` - Brown

## Validation

Both components validate the JSON structure:

1. Ensures `pinGroups` is an array
2. Each group must have a `color` property (string)
3. Each group must have a `pins` array
4. Each pin must have a `sequence` property (string)

If validation fails, an alert will be shown with the error message.

## Backward Compatibility

The map component still supports:

1. **Legacy flat pins** via `history.state.pins` or `postMessage` with type `'MAP_PINS'`
2. **Query parameters** for single pins (lat, lng, info, azimuth, zoom)
3. **window.name** fallback

All existing code using the old format will continue to work!

