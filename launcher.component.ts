// launcher.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';  // For ngModel
import { CommonModule } from '@angular/common'; // For *ngIf, *ngFor if used

interface MapPin {
  lat: number;
  lng: number;
  info: string;
  azimuth: number;
  zoom: number;
  sequence: string;
}

interface PinGroup {
  color: string;  // hex color like "#FF0000", "#00FF00", etc.
  pins: MapPin[];
}

var MapInfo =
    'Based On: 010041599312<br>' +
    'MISSIDN: 010041599312<br>' +
    'IMSI: Not available<br>' +
    'IMEI: 123456789012345<br>' +
    'iSMSC: Automatic<br>' +
    'Azimuth: 280<br>' +
    'Cell ID: 19309<br>' +
    'MCC: 602<br>' +
    'MNC: 01<br>' +
    'LAC: 6450<br>' +
    'Additional Comments: 3G'; // Here i will get the any page info needed from Page call

    
@Component({
  selector: 'app-launcher',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './launcher.component.html'
})

export class LauncherComponent {
  // Now using a list of PinGroups instead of flat pins
  pinGroupsJson = JSON.stringify([
    {
      color: "#FF0000",  // Red
      pins: [
        { lat: 47.5162, lng: 14.5501, info: MapInfo, azimuth: 60, zoom: 7, sequence: '1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5' },
        { lat: 47.6162, lng: 14.6501, info: MapInfo, azimuth: 90, zoom: 10, sequence: '3,6,9' }
      ]
    },
    {
      color: "#00FF00",  // Green
      pins: [
        { lat: 30.098485, lng: 31.381765, info: MapInfo, azimuth: 120, zoom: 14, sequence: '2,3,61,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5,1,4,5' }
      ]
    },
    {
      color: "#0000FF",  // Blue
      pins: [
        { lat: 30.198485, lng: 31.481765, info: MapInfo, azimuth: 180, zoom: 12, sequence: '7,8,9' },
        { lat: 30.298485, lng: 31.581765, info: MapInfo, azimuth: 200, zoom: 11, sequence: '10,11,12' }
      ]
    }
  ] as PinGroup[], null, 2);

  constructor(private router: Router) {}

  /** Open /map in a new tab and send pin groups via postMessage */
  openNewTabAndPost() {
    let pinGroups: PinGroup[];
    try {
      pinGroups = JSON.parse(this.pinGroupsJson) as PinGroup[];
      if (!Array.isArray(pinGroups)) throw new Error('Pin groups must be an array');
      
      // Validate structure
      pinGroups.forEach((group, idx) => {
        if (typeof group.color !== 'string') {
          throw new Error(`Group ${idx} must have a string "color" property`);
        }
        if (!Array.isArray(group.pins)) {
          throw new Error(`Group ${idx} must have a "pins" array`);
        }
        group.pins.forEach((p, pinIdx) => {
          if (typeof p.sequence !== 'string') {
            throw new Error(`Group ${idx}, pin ${pinIdx}: Each pin needs a string "sequence"`);
          }
        });
      });
    } catch (e) {
      alert(`Invalid JSON: ${(e as Error).message}`);
      return;
    }

    const url = `${location.origin}/#/map`; // adjust if not using hash routing
    const win = window.open(url, '_blank');
    if (!win) {
      alert('Popup blocked. Please allow popups.');
      return;
    }

    let attempts = 0;
    const timer = setInterval(() => {
      if (!win || win.closed) { clearInterval(timer); return; }
      try {
        win.postMessage({ type: 'MAP_PIN_GROUPS', pinGroups }, location.origin);
        clearInterval(timer);
      } catch {
        // retry until the new tab is ready
      }
      if (++attempts > 15) clearInterval(timer);
    }, 300);
  }

  /** Same-tab helper: navigate to /map and pass pin groups via history.state */
  openSameTabWithState() {
    let pinGroups: PinGroup[];
    try {
      pinGroups = JSON.parse(this.pinGroupsJson) as PinGroup[];
      if (!Array.isArray(pinGroups)) throw new Error('Pin groups must be an array');
      
      pinGroups.forEach((group, idx) => {
        if (typeof group.color !== 'string') {
          throw new Error(`Group ${idx} must have a string "color" property`);
        }
        if (!Array.isArray(group.pins)) {
          throw new Error(`Group ${idx} must have a "pins" array`);
        }
        group.pins.forEach((p, pinIdx) => {
          if (typeof p.sequence !== 'string') {
            throw new Error(`Group ${idx}, pin ${pinIdx}: Each pin needs a string "sequence"`);
          }
        });
      });
    } catch (e) {
      alert(`Invalid JSON: ${(e as Error).message}`);
      return;
    }
    
    this.router.navigateByUrl('/map', { state: { pinGroups } });
  }
}

