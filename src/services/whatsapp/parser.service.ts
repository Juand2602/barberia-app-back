export class MessageParserService {
  parsearFecha(texto: string): Date | null {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const textoLower = texto.toLowerCase().trim();
    
    if (textoLower === 'hoy') {
      return hoy;
    }
    
    if (textoLower === 'mañana' || textoLower === 'manana') {
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);
      return manana;
    }
    
    if (textoLower === 'pasado mañana' || textoLower === 'pasado manana') {
      const pasadoManana = new Date(hoy);
      pasadoManana.setDate(pasadoManana.getDate() + 2);
      return pasadoManana;
    }
    
    return null;
  }

  parsearOpcionNumerica(texto: string, max: number): number | null {
    const numero = parseInt(texto.trim());
    if (isNaN(numero) || numero < 1 || numero > max) {
      return null;
    }
    return numero;
  }

  normalizarRespuesta(texto: string): string {
    return texto.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quitar acentos
  }

  esAfirmativo(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    return ['si', 'sí', 'yes', 'ok', '1'].includes(normalizado);
  }

  esNegativo(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    return ['no', '2', 'nop', 'nope'].includes(normalizado);
  }
}

export const messageParser = new MessageParserService();