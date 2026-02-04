import html2canvas from 'html2canvas';

/**
 * Capture HTML content to an image blob
 * @param {string} html - The HTML content to render
 * @param {number} width - Width of the capture area
 * @param {number} height - Height of the capture area
 * @param {string} format - Output format ('png' or 'jpeg')
 * @param {number} delay - Delay in ms before capturing (for animations)
 * @param {string} css - Optional CSS to inject
 * @returns {Promise<Blob>} - The captured image as a Blob
 */
export async function captureHtmlToImage(html, width, height, format = 'png', delay = 2000, css = '') {
  return new Promise((resolve, reject) => {
    // Create a temporary container
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      left: -99999px;
      top: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: white;
      z-index: -1;
    `;

    // Add CSS if provided
    if (css) {
      const styleEl = document.createElement('style');
      styleEl.textContent = css;
      container.appendChild(styleEl);
    }

    // Create the content wrapper with exact dimensions
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      position: relative;
    `;
    wrapper.innerHTML = html;
    container.appendChild(wrapper);

    document.body.appendChild(container);

    // Wait for delay (animations) then capture
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(wrapper, {
          width,
          height,
          scale: 1,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const mimeType = format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const quality = format === 'jpg' || format === 'jpeg' ? 0.92 : undefined;

        canvas.toBlob(
          (blob) => {
            document.body.removeChild(container);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          mimeType,
          quality
        );
      } catch (error) {
        document.body.removeChild(container);
        reject(error);
      }
    }, delay);
  });
}

/**
 * Convert an image URL to a specific format
 * @param {string} imageUrl - The image URL to convert
 * @param {string} format - Output format ('png' or 'jpeg')
 * @returns {Promise<Blob>} - The converted image as a Blob
 */
export async function convertImageToFormat(imageUrl, format = 'png') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');

      // Fill with white background for JPEG (no transparency)
      if (format === 'jpg' || format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      const mimeType = format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const quality = format === 'jpg' || format === 'jpeg' ? 0.92 : undefined;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageUrl}`));
    };

    img.src = imageUrl;
  });
}

/**
 * Generate a filename for a creative export
 * @param {object} creative - The creative object
 * @param {string} format - The output format
 * @returns {string} - The generated filename
 */
export function generateFilename(creative, format) {
  const ext = format === 'jpg' || format === 'jpeg' ? 'jpg' : 'png';

  if (creative.isDynamic && creative.messageData) {
    const msg = creative.messageData;
    const size = creative.bannerSize;
    return `MC${msg.number}_${msg.variant}_${size.width}x${size.height}.${ext}`;
  }

  // For static images, replace the extension
  const baseName = creative.filename.replace(/\.[^.]+$/, '');
  return `${baseName}.${ext}`;
}
