// src/services/whatsapp/parser.service.ts
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
    return texto
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^\w\s,]/g, '') // Quitar emojis/puntuación extra
      .replace(/\s+/g, ' ')
      .trim();
  }

  esAfirmativo(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    // Aceptamos variantes de confirmación pero NO números (evitamos conflicto con el menú)
    // ejemplos: 'si', 'sí', 's', 'yes', 'ok', 'claro', 'dale'
    const positivos = ['si', 's', 'yes', 'ok', 'claro', 'dale', 'sip', 'si claro'];
    // comprobar coincidencia exacta o que empiece con la palabra (para frases como "si, cancelar")
    return positivos.some(
      (v) =>
        normalizado === v ||
        normalizado.startsWith(v + ' ') ||
        normalizado.startsWith(v + ',') ||
        normalizado.includes(v + ',')
    );
  }

  esNegativo(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    // Aceptamos variantes de negación pero NO números
    const negativos = ['no', 'nop', 'nope', 'n', 'na'];
    return negativos.some(
      (v) =>
        normalizado === v ||
        normalizado.startsWith(v + ' ') ||
        normalizado.startsWith(v + ',') ||
        normalizado.includes(v + ',')
    );
  }
}

export const messageParser = new MessageParserService();
