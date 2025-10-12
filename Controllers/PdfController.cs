using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CRMRepo.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PdfController : ControllerBase
    {
        private readonly PdfGenerationService _pdfService;

        public PdfController(PdfGenerationService pdfService)
        {
            _pdfService = pdfService;
        }

        /// <summary>
        /// Generate PDF using DinkToPdf (original method)
        /// </summary>
        [HttpPost("generate-pdf")]
        public async Task<IActionResult> GeneratePdf([FromBody] PdfGenerationRequest request)
        {
            try
            {
                var pdfBase64 = await _pdfService.GeneratePdfBase64(
                    request.ViewPath,
                    request.Model,
                    request.SumColumns,
                    request.IsLandscape,
                    request.TitleSheetName
                );

                return Ok(new { pdfContent = pdfBase64, contentType = "application/pdf" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Generate HTML for Angular PDF viewer (new method) - returns base64 HTML
        /// </summary>
        [HttpPost("generate-html-base64")]
        public async Task<IActionResult> GenerateHtmlBase64([FromBody] PdfGenerationRequest request)
        {
            try
            {
                var htmlBase64 = await _pdfService.GenerateHtmlBase64(
                    request.ViewPath,
                    request.Model,
                    request.SumColumns,
                    request.IsLandscape,
                    request.TitleSheetName
                );

                return Ok(new { htmlContent = htmlBase64, contentType = "text/html" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Generate HTML for Angular PDF viewer (new method) - returns direct HTML
        /// </summary>
        [HttpPost("generate-html")]
        public async Task<IActionResult> GenerateHtml([FromBody] PdfGenerationRequest request)
        {
            try
            {
                var html = await _pdfService.GenerateHtmlForPdfViewer(
                    request.ViewPath,
                    request.Model,
                    request.SumColumns,
                    request.IsLandscape,
                    request.TitleSheetName
                );

                return Ok(new { htmlContent = html, contentType = "text/html" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Get sample data for testing
        /// </summary>
        [HttpGet("sample-data")]
        public IActionResult GetSampleData()
        {
            var sampleRequest = new PdfGenerationRequest
            {
                ViewPath = "~/Views/Reports/SampleReport.cshtml",
                Model = new List<SamplePdfModel>
                {
                    new SamplePdfModel { Id = 1, Name = "عنصر أول", Value = 100.50m, Date = DateTime.Now },
                    new SamplePdfModel { Id = 2, Name = "عنصر ثاني", Value = 250.75m, Date = DateTime.Now.AddDays(-1) },
                    new SamplePdfModel { Id = 3, Name = "عنصر ثالث", Value = 75.25m, Date = DateTime.Now.AddDays(-2) }
                },
                SumColumns = new List<string> { "Value" },
                IsLandscape = false,
                TitleSheetName = "تقرير عينة"
            };

            return Ok(sampleRequest);
        }
    }

    public class PdfGenerationRequest
    {
        public string ViewPath { get; set; }
        public IEnumerable<PdfModel> Model { get; set; }
        public List<string> SumColumns { get; set; }
        public bool IsLandscape { get; set; }
        public string TitleSheetName { get; set; }
    }

    public class SamplePdfModel : PdfModel
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public decimal Value { get; set; }
        public DateTime Date { get; set; }
    }

    // Base class (assuming this exists in your project)
    public abstract class PdfModel
    {
        // Base properties for PDF models
    }
}
