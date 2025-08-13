import { readAsArrayBuffer } from './asyncReader.js';
import { fetchFont, getAsset, Fonts } from './prepareAssets';
import { noop } from './helper.js';

export async function save(pdfFile, objects, name) {
  const PDFLib = await getAsset('PDFLib');
  const fontkit = await getAsset('fontkit');
  const download = await getAsset('download');
  let pdfDoc;
  try {
    pdfDoc = await PDFLib.PDFDocument.load(await readAsArrayBuffer(pdfFile));
    // Register fontkit for custom font embedding
    pdfDoc.registerFontkit(fontkit);
  } catch (e) {
    console.log('Failed to load PDF.');
    throw e;
  }
  const pagesProcesses = pdfDoc.getPages().map(async (page, pageIndex) => {
    const pageObjects = objects[pageIndex];
    console.log(`Processing page ${pageIndex} with objects:`, pageObjects);
    console.log(`Page ${pageIndex} dimensions:`, page.getWidth(), 'x', page.getHeight());
    
    if (!pageObjects || pageObjects.length === 0) {
      console.log(`Page ${pageIndex} has no objects to process`);
      return;
    }
    
    // 'y' starts from bottom in PDFLib, use this to calculate y
    const pageHeight = page.getHeight();
    const embedProcesses = pageObjects.map(async (object, objectIndex) => {
      console.log(`Processing object ${objectIndex}:`, object);
      
      if (object.type === 'image') {
        let { file, x, y, width, height } = object;
        let img;
        try {
          if (file.type === 'image/jpeg') {
            img = await pdfDoc.embedJpg(await readAsArrayBuffer(file));
          } else {
            img = await pdfDoc.embedPng(await readAsArrayBuffer(file));
          }
          return () =>
            page.drawImage(img, {
              x,
              y: pageHeight - y - height,
              width,
              height,
            });
        } catch (e) {
          console.log('Failed to embed image.', e);
          return noop;
        }
      } else if (object.type === 'text') {
        let { x, y, lines, lineHeight, size, fontFamily, width } = object;
        const height = size * lineHeight * lines.length;
        
        // Ensure font is fully loaded before processing
        let font;
        let embeddedFont = null;
        
        try {
          font = await fetchFont(fontFamily);
          console.log(`Processing text object with font: ${fontFamily}`, font);
          console.log(`Font object keys:`, Object.keys(font));
          console.log(`Font buffer type:`, typeof font.buffer);
          console.log(`Font buffer length:`, font.buffer ? font.buffer.byteLength : 'undefined');
          
          // Check if this is an external font that needs to be embedded
          if (font.buffer) {
            console.log(`Using font buffer for ${fontFamily}, size: ${font.buffer.byteLength} bytes`);
            
            // Try to embed the font into the PDF document
            try {
              console.log(`Attempting to embed font buffer (${font.buffer.byteLength} bytes) into PDF...`);
              embeddedFont = await pdfDoc.embedFont(font.buffer);
              console.log(`Font embedded successfully, using name: ${embeddedFont.name}`);
            } catch (embedError) {
              console.error(`Failed to embed font:`, embedError);
              // Fallback to Times-Roman
              embeddedFont = await pdfDoc.embedFont(await fetchFont('Times-Roman').then(f => f.buffer));
            }
          } else {
            console.log(`Using built-in font: ${fontFamily}`);
            // For built-in fonts, we need to embed them too
            try {
              embeddedFont = await pdfDoc.embedFont(fontFamily);
            } catch (e) {
              console.log(`Built-in font ${fontFamily} failed to embed, using Times-Roman`);
              embeddedFont = await pdfDoc.embedFont('Times-Roman');
            }
          }
        } catch (e) {
          console.log(`Font ${fontFamily} failed to load, using fallback:`, e);
          // Fallback to Times-Roman if external font fails
          try {
            embeddedFont = await pdfDoc.embedFont('Times-Roman');
          } catch (fallbackError) {
            console.error(`Even Times-Roman failed to embed:`, fallbackError);
            throw fallbackError;
          }
        }
        
        console.log(`Creating text PDF with:`, {
          lines,
          fontSize: size,
          lineHeight,
          width,
          height,
          fontType: typeof font.buffer,
          fontBufferSize: font.buffer ? font.buffer.byteLength : 'undefined',
          dy: font.correction(size, lineHeight)
        });
        
        // Use PDFLib's built-in text drawing instead of makeTextPDF
        return () => {
          const drawX = x;
          const drawY = pageHeight - y - height;
          console.log(`Drawing text directly at x: ${drawX}, y: ${drawY}, width: ${width}, height: ${height}`);
          
          // Check if signature is within page bounds
          if (drawX < 0 || drawY < 0 || drawX + width > page.getWidth() || drawY + height > pageHeight) {
            console.warn(`Warning: Signature may be outside page bounds!`);
          }
          
          // Draw each line of text
          lines.forEach((line, lineIndex) => {
            const lineY = drawY + (lineIndex * size * lineHeight);
            page.drawText(line, {
              x: drawX,
              y: lineY,
              size: size,
              font: embeddedFont,
              lineHeight: lineHeight,
            });
          });
        };
      } else if (object.type === 'drawing') {
        let { x, y, path, scale } = object;
        const {
          pushGraphicsState,
          setLineCap,
          popGraphicsState,
          setLineJoin,
          LineCapStyle,
          LineJoinStyle,
        } = PDFLib;
        return () => {
          page.pushOperators(
            pushGraphicsState(),
            setLineCap(LineCapStyle.Round),
            setLineJoin(LineJoinStyle.Round),
          );
          page.drawSvgPath(path, {
            borderWidth: 5,
            scale,
            x,
            y: pageHeight - y,
          });
          page.pushOperators(popGraphicsState());
        };
      }
    });
    // embed objects in order
    const drawProcesses = await Promise.all(embedProcesses);
    console.log(`Page ${pageIndex} draw processes:`, drawProcesses.length);
    
    // Filter out undefined processes (from empty pages)
    const validDrawProcesses = drawProcesses.filter(p => p !== undefined);
    console.log(`Page ${pageIndex} valid draw processes:`, validDrawProcesses.length);
    
    validDrawProcesses.forEach((p, index) => {
      console.log(`Executing draw process ${index} on page ${pageIndex}`);
      p();
    });
  });
  await Promise.all(pagesProcesses);
  try {
    const pdfBytes = await pdfDoc.save();
    download(pdfBytes, name, 'application/pdf');
  } catch (e) {
    console.log('Failed to save PDF.');
    throw e;
  }
}
