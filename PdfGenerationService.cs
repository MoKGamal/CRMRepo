using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DinkToPdf;
using DinkToPdf.Contracts;

namespace CRMRepo.Services
{
    public class PdfGenerationService
    {
        private readonly IConverter _converter;
        private readonly IRazorRendererHelper _razorRendererHelper;

        public PdfGenerationService(IConverter converter, IRazorRendererHelper razorRendererHelper)
        {
            _converter = converter;
            _razorRendererHelper = razorRendererHelper;
        }

        /// <summary>
        /// Original DinkToPdf method - generates PDF using DinkToPdf library
        /// </summary>
        private async Task<byte[]> GeneratePdfDink(string htmlContent, bool isLandscape = false, string titleSheetName = "")
        {
            try
            {
                var globalSettings = new GlobalSettings
                {
                    ColorMode = ColorMode.Color,
                    Orientation = isLandscape ? Orientation.Landscape : Orientation.Portrait,
                    PaperSize = PaperKind.A4,
                    Margins = new MarginSettings { Top = 10, Bottom = 10, Left = 5, Right = 5 },
                };

                var objectSettings = new ObjectSettings
                {
                    PagesCount = true,
                    HtmlContent = htmlContent,
                    WebSettings = { DefaultEncoding = "utf-8" },
                    HeaderSettings = new HeaderSettings
                    {
                        FontSize = 10,
                        Right = (DateTime.UtcNow.ToString("dd/MM/yyyy HH:mm")),
                        Left = "تم التطوير بواسطة",
                        Center = titleSheetName,
                        Line = true,
                        Spacing = 2.812
                    },
                    FooterSettings = new FooterSettings
                    {
                        FontSize = 8,
                        Center = "",
                        Right = " صفحة [page] من [toPage]",
                        Line = true
                    }
                };

                var htmlToPdfDocument = new HtmlToPdfDocument()
                {
                    GlobalSettings = globalSettings,
                    Objects = { objectSettings },
                };
                return _converter.Convert(htmlToPdfDocument);
            }
            catch (Exception ex)
            {
                throw;
            }
        }

        /// <summary>
        /// New method - generates HTML with PDF-like styling for Angular PDF viewer
        /// </summary>
        private async Task<string> GeneratePdfHtml(string htmlContent, bool isLandscape = false, string titleSheetName = "")
        {
            try
            {
                var currentDateTime = DateTime.UtcNow.ToString("dd/MM/yyyy HH:mm");
                var orientation = isLandscape ? "landscape" : "portrait";
                
                var styledHtml = $@"
<!DOCTYPE html>
<html dir=""rtl"" lang=""ar"">
<head>
    <meta charset=""utf-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>{titleSheetName}</title>
    <style>
        @page {{
            size: A4 {orientation};
            margin: 10mm 5mm;
        }}
        
        * {{
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Arial', 'Tahoma', sans-serif;
            font-size: 12pt;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: white;
            direction: rtl;
        }}
        
        .pdf-container {{
            width: 100%;
            max-width: {(isLandscape ? "297mm" : "210mm")};
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            min-height: {(isLandscape ? "210mm" : "297mm")};
        }}
        
        .pdf-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #ccc;
            margin-bottom: 20px;
            font-size: 10pt;
        }}
        
        .pdf-header .left {{
            flex: 1;
            text-align: left;
        }}
        
        .pdf-header .center {{
            flex: 2;
            text-align: center;
            font-weight: bold;
        }}
        
        .pdf-header .right {{
            flex: 1;
            text-align: right;
        }}
        
        .pdf-content {{
            padding: 0 10px;
            min-height: calc(100% - 100px);
        }}
        
        .pdf-footer {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-top: 1px solid #ccc;
            margin-top: 20px;
            font-size: 8pt;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
        }}
        
        .pdf-footer .left {{
            flex: 1;
            text-align: left;
        }}
        
        .pdf-footer .center {{
            flex: 2;
            text-align: center;
        }}
        
        .pdf-footer .right {{
            flex: 1;
            text-align: right;
        }}
        
        /* Table styling */
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }}
        
        th, td {{
            border: 1px solid #ddd;
            padding: 8px;
            text-align: right;
        }}
        
        th {{
            background-color: #f5f5f5;
            font-weight: bold;
        }}
        
        /* Print styles */
        @media print {{
            body {{
                margin: 0;
                padding: 0;
                box-shadow: none;
            }}
            
            .pdf-container {{
                box-shadow: none;
                margin: 0;
                max-width: none;
                width: 100%;
            }}
            
            .pdf-footer {{
                position: fixed;
                bottom: 0;
            }}
        }}
        
        /* Responsive adjustments */
        @media screen and (max-width: 768px) {{
            .pdf-container {{
                max-width: 100%;
                margin: 0;
                box-shadow: none;
            }}
            
            .pdf-header, .pdf-footer {{
                flex-direction: column;
                text-align: center;
            }}
            
            .pdf-header .left, 
            .pdf-header .center, 
            .pdf-header .right,
            .pdf-footer .left,
            .pdf-footer .center,
            .pdf-footer .right {{
                flex: none;
                text-align: center;
                margin: 2px 0;
            }}
        }}
        
        /* Custom content styling */
        h1, h2, h3, h4, h5, h6 {{
            color: #2c3e50;
            margin-top: 20px;
            margin-bottom: 10px;
        }}
        
        p {{
            margin: 10px 0;
        }}
        
        .text-center {{
            text-align: center;
        }}
        
        .text-left {{
            text-align: left;
        }}
        
        .text-right {{
            text-align: right;
        }}
        
        .font-bold {{
            font-weight: bold;
        }}
        
        .mb-10 {{
            margin-bottom: 10px;
        }}
        
        .mt-10 {{
            margin-top: 10px;
        }}
    </style>
</head>
<body>
    <div class=""pdf-container"">
        <div class=""pdf-header"">
            <div class=""left"">تم التطوير بواسطة CyShield</div>
            <div class=""center"">{titleSheetName}</div>
            <div class=""right"">{currentDateTime}</div>
        </div>
        
        <div class=""pdf-content"">
            {htmlContent}
        </div>
        
        <div class=""pdf-footer"">
            <div class=""left""></div>
            <div class=""center"">Cyshield</div>
            <div class=""right"">صفحة 1 من 1</div>
        </div>
    </div>
</body>
</html>";

                return styledHtml;
            }
            catch (Exception ex)
            {
                throw;
            }
        }

        /// <summary>
        /// Generates PDF using DinkToPdf and returns as base64 string
        /// </summary>
        public async Task<string> GeneratePdfBase64<T>(string viewPath, IEnumerable<T> model, List<string> sumColumns, bool isLandscape = false, string titleSheetName = "") where T : PdfModel
        {
            try
            {
                var htmlContent = await _razorRendererHelper.RenderPartialToString<T>(viewPath, model, sumColumns);
                return Convert.ToBase64String(await GeneratePdfDink(htmlContent, isLandscape, titleSheetName));
            }
            catch (Exception e)
            {
                throw;
            }
        }

        /// <summary>
        /// Generates HTML with PDF styling and returns as base64 string for Angular PDF viewer
        /// </summary>
        public async Task<string> GenerateHtmlBase64<T>(string viewPath, IEnumerable<T> model, List<string> sumColumns, bool isLandscape = false, string titleSheetName = "") where T : PdfModel
        {
            try
            {
                var htmlContent = await _razorRendererHelper.RenderPartialToString<T>(viewPath, model, sumColumns);
                var styledHtml = await GeneratePdfHtml(htmlContent, isLandscape, titleSheetName);
                var bytes = Encoding.UTF8.GetBytes(styledHtml);
                return Convert.ToBase64String(bytes);
            }
            catch (Exception e)
            {
                throw;
            }
        }

        /// <summary>
        /// Alternative method that returns HTML directly (not base64) for Angular PDF viewer
        /// </summary>
        public async Task<string> GenerateHtmlForPdfViewer<T>(string viewPath, IEnumerable<T> model, List<string> sumColumns, bool isLandscape = false, string titleSheetName = "") where T : PdfModel
        {
            try
            {
                var htmlContent = await _razorRendererHelper.RenderPartialToString<T>(viewPath, model, sumColumns);
                return await GeneratePdfHtml(htmlContent, isLandscape, titleSheetName);
            }
            catch (Exception e)
            {
                throw;
            }
        }
    }
}
