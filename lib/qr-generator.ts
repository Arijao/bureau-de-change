import QRCode from 'qrcode'

/**
 * Génère un QR code en SVG localement (hors ligne)
 * @param data - Texte à encoder
 * @returns SVG string
 */
export async function generateQrSvg(data: string): Promise<string> {
  try {
    return await QRCode.toString(data, {
      type: 'svg',
      width: 120,
      margin: 1,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
    })
  } catch (error) {
    console.error('Erreur génération QR:', error)
    return '<svg width="120" height="120"><text x="10" y="60">QR Error</text></svg>'
  }
}

/**
 * Génère un QR code en DataURL (pour affichage HTML)
 * @param data - Texte à encoder
 * @returns DataURL string (data:image/svg+xml;base64,...)
 */
export async function generateQrDataUrl(data: string): Promise<string> {
  try {
    // toDataURL ne supporte que PNG/JPEG/WEBP - on utilise toString avec SVG puis on convertit
    const svg = await QRCode.toString(data, {
      type: 'svg',
      width: 120,
      margin: 1,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
    })
    // Encoder le SVG en data URL
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  } catch (error) {
    console.error('Erreur génération QR:', error)
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCI+PHRleHQgeD0iMTAiIHk9IjYwIj5RciBFcnJvcjwvdGV4dD48L3N2Zz4='
  }
}