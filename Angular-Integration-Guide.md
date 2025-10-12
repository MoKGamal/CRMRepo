# Angular PDF Viewer Integration Guide

This guide shows how to use the new HTML-based PDF generation methods with Angular's `ngx-extended-pdf-viewer`.

## C# Backend Usage

### Method 1: Get Base64 HTML String
```csharp
// Inject the service in your controller
private readonly PdfGenerationService _pdfService;

// Use the new method to get base64 HTML
public async Task<IActionResult> GetPdfHtml(string viewPath, bool isLandscape = false, string title = "")
{
    var htmlBase64 = await _pdfService.GenerateHtmlBase64(viewPath, model, sumColumns, isLandscape, title);
    
    return Ok(new { htmlContent = htmlBase64 });
}
```

### Method 2: Get Direct HTML String
```csharp
public async Task<IActionResult> GetPdfHtmlDirect(string viewPath, bool isLandscape = false, string title = "")
{
    var html = await _pdfService.GenerateHtmlForPdfViewer(viewPath, model, sumColumns, isLandscape, title);
    
    return Ok(new { htmlContent = html });
}
```

## Angular Frontend Integration

### 1. Install Required Packages

```bash
npm install ngx-extended-pdf-viewer
npm install jspdf html2canvas  # For client-side PDF generation
```

### 2. Component Setup

```typescript
// pdf-viewer.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.css']
})
export class PdfViewerComponent implements OnInit {
  htmlContent: string = '';
  pdfSrc: string = '';
  isLoading: boolean = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadPdfContent();
  }

  // Method 1: Load HTML and convert to PDF client-side
  async loadPdfContent(): Promise<void> {
    this.isLoading = true;
    
    try {
      // Get HTML from your C# backend
      const response = await this.http.get<{htmlContent: string}>('/api/pdf/html').toPromise();
      
      if (response?.htmlContent) {
        // Decode base64 if needed
        this.htmlContent = atob(response.htmlContent);
        
        // Convert HTML to PDF
        await this.convertHtmlToPdf();
      }
    } catch (error) {
      console.error('Error loading PDF content:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Convert HTML to PDF using jsPDF
  async convertHtmlToPdf(): Promise<void> {
    const element = document.createElement('div');
    element.innerHTML = this.htmlContent;
    element.style.width = '210mm'; // A4 width
    element.style.backgroundColor = 'white';
    
    // Temporarily add to DOM for rendering
    document.body.appendChild(element);
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Convert to blob URL for PDF viewer
      const pdfBlob = pdf.output('blob');
      this.pdfSrc = URL.createObjectURL(pdfBlob);
      
    } finally {
      // Clean up
      document.body.removeChild(element);
    }
  }

  // Method 2: Direct HTML display (alternative approach)
  displayHtmlContent(): void {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(this.htmlContent);
      newWindow.document.close();
    }
  }
}
```

### 3. Template

```html
<!-- pdf-viewer.component.html -->
<div class="pdf-viewer-container">
  <div class="controls" *ngIf="!isLoading">
    <button (click)="loadPdfContent()" class="btn btn-primary">
      Refresh PDF
    </button>
    <button (click)="displayHtmlContent()" class="btn btn-secondary">
      View HTML
    </button>
  </div>

  <div *ngIf="isLoading" class="loading">
    <p>Loading PDF content...</p>
  </div>

  <!-- PDF Viewer -->
  <ngx-extended-pdf-viewer 
    *ngIf="pdfSrc && !isLoading"
    [src]="pdfSrc"
    [height]="'80vh'"
    [showToolbar]="true"
    [showSidebarButton]="true"
    [showFindButton]="true"
    [showPagingButtons]="true"
    [showZoomButtons]="true"
    [showPresentationModeButton]="true"
    [showOpenFileButton]="false"
    [showPrintButton]="true"
    [showDownloadButton]="true">
  </ngx-extended-pdf-viewer>

  <!-- Alternative: Direct HTML display -->
  <div *ngIf="htmlContent && !pdfSrc" 
       class="html-preview" 
       [innerHTML]="htmlContent">
  </div>
</div>
```

### 4. Styles

```css
/* pdf-viewer.component.css */
.pdf-viewer-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.controls {
  padding: 10px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.btn {
  margin-right: 10px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.html-preview {
  flex: 1;
  overflow: auto;
  padding: 20px;
  background-color: #f9f9f9;
}

ngx-extended-pdf-viewer {
  flex: 1;
}
```

### 5. Module Setup

```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';

import { AppComponent } from './app.component';
import { PdfViewerComponent } from './pdf-viewer/pdf-viewer.component';

@NgModule({
  declarations: [
    AppComponent,
    PdfViewerComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    NgxExtendedPdfViewerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

## Alternative Approaches

### 1. Server-Side PDF Generation with Puppeteer
You can also generate PDF server-side using Puppeteer and return the PDF directly:

```csharp
// Add this method to your PdfGenerationService
public async Task<byte[]> GeneratePdfWithPuppeteer(string htmlContent, bool isLandscape = false)
{
    // Use PuppeteerSharp to generate PDF from HTML
    // This requires installing PuppeteerSharp NuGet package
}
```

### 2. Client-Side PDF Generation Libraries
- **jsPDF + html2canvas** (shown above)
- **Puppeteer** (server-side)
- **wkhtmltopdf** (server-side alternative to DinkToPdf)

## Benefits of This Approach

1. **No DinkToPdf Dependency**: Removes the need for native libraries
2. **Better Styling Control**: Full CSS control over appearance
3. **Client-Side Flexibility**: Can modify PDF generation on the client
4. **Cross-Platform**: Works on any platform that supports .NET
5. **Real-Time Preview**: Can show HTML preview before PDF generation

## Usage Tips

1. **Performance**: For large documents, consider server-side PDF generation
2. **Styling**: Use CSS print media queries for optimal PDF appearance
3. **Fonts**: Ensure fonts are available both server and client-side
4. **Images**: Use absolute URLs or base64-encoded images for reliability
5. **Testing**: Test with different content sizes and layouts
