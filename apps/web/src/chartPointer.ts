/** Convert viewport pointer coordinates to SVG viewBox coordinates.
 *
 * getScreenCTM includes the browser's preserveAspectRatio letterboxing, which
 * matters when a responsive SVG is given a height that does not match its
 * viewBox. The fallback handles the default centered `meet` behavior.
 */
export function svgViewBoxPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const matrix = svg.getScreenCTM();
  if (matrix) {
    try {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const local = point.matrixTransform(matrix.inverse());
      return { x: local.x, y: local.y };
    } catch {
      // A detached or temporarily zero-sized SVG can have a singular matrix.
    }
  }

  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  if (!rect.width || !rect.height || !viewBox.width || !viewBox.height)
    return { x: viewBox.x, y: viewBox.y };

  const aspect = svg.preserveAspectRatio.baseVal;
  if (aspect.align === SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_NONE) {
    return {
      x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
      y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height,
    };
  }

  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
  const drawnWidth = viewBox.width * scale;
  const drawnHeight = viewBox.height * scale;
  const align = aspect.align - SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_XMINYMIN;
  const xAlign = (align % 3) / 2;
  const yAlign = Math.floor(align / 3) / 2;
  const offsetX = (rect.width - drawnWidth) * xAlign;
  const offsetY = (rect.height - drawnHeight) * yAlign;
  return {
    x: viewBox.x + (clientX - rect.left - offsetX) / scale,
    y: viewBox.y + (clientY - rect.top - offsetY) / scale,
  };
}
